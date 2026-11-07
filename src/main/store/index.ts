import fs from 'node:fs'
import path from 'node:path'
import type {
  AppState,
  ConsolidationResult,
  CreateMemoryInput,
  ImportedMemory,
  McpInstallResult,
  MemoryDetail,
  MemoryFile,
  MemorySummary,
  ScanChange,
  ScanProgress,
  ScanReason,
  ScanResponse,
  ScanResult,
  SearchQuery,
  SyncState,
  UpdateMemoryInput
} from '../../shared/types'
import { DATA_DIR, DISABLE_IMPORT, IS_DEMO, LIBRARY_DIR, ensureDirs } from '../paths'
import {
  normalizeMemoryAuthority,
  normalizeMemoryKind,
  normalizeMemoryScope,
  normalizeMemoryStatus
} from '../../shared/memory-taxonomy'
import { deriveSummary } from '../../shared/memory-summary'
import { SecretContentError, findSecretKinds, redactSecrets } from '../../shared/secrets'
import { discoverAgents, refreshAgents } from '../agents/discovery'
import { importAgentMemories } from '../agents/importers'
import { installMcp } from '../agents/mcp-install'
import {
  Db,
  contentHash,
  makeId,
  memoryIdForSource,
  sourceKeyFor,
  type SourceRecord
} from './db'
import { planConsolidation } from './consolidate'
import { Library, slugify } from './library'

export const SYNC_INTERVAL_MINUTES = 60
const MAX_SCAN_CHANGES = 50

export interface IngestOutcome {
  status: 'added' | 'updated' | 'unchanged' | 'skipped'
  change?: ScanChange
  redacted?: boolean
}

const CONSOLIDATION_MIN_HOURS = 24
const CONSOLIDATION_MIN_RECORDS = 25
const CONSOLIDATION_LOCK = path.join(DATA_DIR, '.consolidate-lock')

export class Store {
  readonly db: Db
  readonly library: Library
  private version: string
  private activeScan: Promise<ScanResponse> | null = null
  private scanning = false

  constructor(version: string) {
    ensureDirs()
    this.version = version
    this.db = new Db()
    this.library = new Library()
  }

  init(): void {
    this.library.syncToDb(this.db)
    refreshAgents(this.db)
    this.bootstrapSourceRecords()
  }

  state(): AppState {
    const agents = refreshAgents(this.db)
    return {
      agents,
      memories: this.db.listMemories({ limit: 90 }),
      pulseMemories: this.db.listPulseMemories(),
      counts: this.db.counts(),
      health: this.db.health(),
      libraryPath: LIBRARY_DIR,
      onboarded: this.db.getMeta('onboarded') === '1',
      scanning: this.scanning,
      sync: this.syncState(),
      version: this.version
    }
  }

  syncState(): SyncState {
    return {
      autoSync: this.db.getMeta('autoSync') === '1',
      intervalMinutes: SYNC_INTERVAL_MINUTES,
      lastSyncAttemptAt: this.metaNumber('lastSyncAttemptAt'),
      lastSuccessfulSyncAt: this.metaNumber('lastSuccessfulSyncAt'),
      lastResult: this.lastScanResult(),
      scanning: this.scanning
    }
  }

  setAutoSync(enabled: boolean): AppState {
    this.db.setMeta('autoSync', enabled ? '1' : '0')
    return this.state()
  }

  search(query: SearchQuery): MemorySummary[] {
    return this.db.search(query)
  }

  getMemory(id: string): MemoryDetail | null {
    return this.db.getMemory(id)
  }

  /**
   * Read-only in spirit: consolidation never edits another agent's files, it
   * only marks echoes as superseded by the record dachshund already chose as
   * canonical. The library copy records that pointer in frontmatter.
   */
  consolidate(options: { dryRun?: boolean } = {}): ConsolidationResult {
    const startedAt = Date.now()
    const dryRun = options.dryRun === true
    const candidates = this.db.consolidationCandidates()
    const groups = planConsolidation(candidates)
    let merged = 0
    if (!dryRun) {
      for (const group of groups) {
        for (const memberId of group.members) {
          if (memberId === group.canonical) continue
          if (this.supersede(memberId, group.canonical)) merged += 1
        }
      }
    }
    const result: ConsolidationResult = {
      startedAt,
      finishedAt: Date.now(),
      dryRun,
      candidates: candidates.length,
      groups: groups.length,
      merged
    }
    this.db.recordConsolidation(result)
    if (!dryRun) {
      this.db.setMeta('lastConsolidationAt', String(result.finishedAt))
      this.db.setMeta('lastConsolidationResult', JSON.stringify(result))
    }
    return result
  }

  private supersede(memoryId: string, canonicalId: string): boolean {
    if (memoryId === canonicalId) return false
    const current = this.db.getMemory(memoryId)
    const canonical = this.db.getMemory(canonicalId)
    if (!current || !canonical || current.supersededBy || current.archived || canonical.archived) {
      return false
    }
    this.db.update(memoryId, { supersededBy: canonicalId, status: 'superseded' })
    const file = this.db.getMemoryFile(memoryId)
    const filePath = this.db.getMemoryPath(memoryId)
    if (file && filePath) this.library.write({ ...file, supersededBy: canonicalId }, filePath)
    return true
  }

  /**
   * Mirrors Claude's autoDream thresholds: at most once a day, only after a
   * clean scan, only when there is enough material, and never concurrently.
   */
  private maybeConsolidate(): void {
    if (IS_DEMO) return
    try {
      if (this.db.counts().memories < CONSOLIDATION_MIN_RECORDS) return
      const lastAt = Number(this.db.getMeta('lastConsolidationAt') ?? 0) || 0
      const now = Date.now()
      if (lastAt > 0 && now - lastAt < CONSOLIDATION_MIN_HOURS * 3_600_000) return
      if (lastAt > 0 && this.db.countSourceRecordsUpdatedSince(lastAt) === 0) return
      if (!this.acquireConsolidationLock()) return
      try {
        this.consolidate()
      } finally {
        this.releaseConsolidationLock()
      }
    } catch {
      // Consolidation is background tidying; it must never fail a scan.
    }
  }

  private acquireConsolidationLock(): boolean {
    try {
      fs.mkdirSync(path.dirname(CONSOLIDATION_LOCK), { recursive: true })
      fs.writeFileSync(CONSOLIDATION_LOCK, String(process.pid), { flag: 'wx' })
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return false
      try {
        // A lock older than ten minutes belongs to a run that died; Claude's
        // autoDream uses the same escape hatch.
        if (Date.now() - fs.statSync(CONSOLIDATION_LOCK).mtimeMs < 10 * 60_000) return false
        fs.rmSync(CONSOLIDATION_LOCK, { force: true })
        fs.writeFileSync(CONSOLIDATION_LOCK, String(process.pid), { flag: 'wx' })
        return true
      } catch {
        return false
      }
    }
  }

  private releaseConsolidationLock(): void {
    try {
      fs.rmSync(CONSOLIDATION_LOCK, { force: true })
    } catch {
      // A lock left behind expires on its own after ten minutes.
    }
  }

  scan(reason: ScanReason = 'manual', onProgress?: (progress: ScanProgress) => void): Promise<ScanResponse> {
    if (this.activeScan) return this.activeScan
    this.scanning = true
    this.activeScan = this.performScan(reason, onProgress).finally(() => {
      this.scanning = false
      this.activeScan = null
    })
    return this.activeScan
  }

  private async performScan(
    reason: ScanReason,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResponse> {
    const startedAt = Date.now()
    const result: ScanResult = {
      startedAt,
      finishedAt: startedAt,
      reason,
      added: 0,
      updated: 0,
      unchanged: 0,
      redacted: 0,
      failures: [],
      changes: [],
      ok: true
    }
    let attemptedAgents = 0
    let fatal = false
    const changeKeys = new Set<string>()
    // Count memories, not import operations: several sources can echo one
    // memory during a single scan and that must still read as one change.
    const addedIds = new Set<string>()
    const updatedIds = new Set<string>()

    try {
      this.library.syncToDb(this.db)
      const agents = refreshAgents(this.db)
      if (!DISABLE_IMPORT && !IS_DEMO) {
        const definitions = discoverAgents()
        for (const agent of agents) {
          if (!agent.installed || !agent.shared) continue
          attemptedAgents += 1
          onProgress?.({
            agentId: agent.id,
            agentName: agent.name,
            status: 'scanning'
          })
          try {
            const definition = definitions.find((item) => item.id === agent.id)
            if (!definition) throw new Error('Agent definition was not found')
            const imported = importAgentMemories(definition)
            let changed = 0
            for (const memory of imported) {
              const outcome = this.ingestImport(memory)
              if (outcome.status === 'unchanged') result.unchanged += 1
              if (outcome.redacted) result.redacted += 1
              if (outcome.change) {
                const key = `${outcome.change.change}:${outcome.change.memoryId}`
                if (!changeKeys.has(key)) {
                  changeKeys.add(key)
                  if (outcome.change.change === 'added') addedIds.add(outcome.change.memoryId)
                  else updatedIds.add(outcome.change.memoryId)
                  changed += 1
                  if (result.changes.length < MAX_SCAN_CHANGES) result.changes.push(outcome.change)
                }
              }
            }
            this.markSourceMissingForAgent(agent.id, startedAt)
            onProgress?.({
              agentId: agent.id,
              agentName: agent.name,
              status: 'ready',
              memories: changed
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not read this agent'
            result.failures.push({ agentId: agent.id, agentName: agent.name, message })
            onProgress?.({
              agentId: agent.id,
              agentName: agent.name,
              status: 'error',
              message
            })
          }
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
      }
    } catch (error) {
      fatal = true
      result.failures.push({
        agentId: 'dachshund',
        agentName: 'dachshund',
        message: error instanceof Error ? error.message : 'Synchronization failed'
      })
    }

    result.added = addedIds.size
    result.updated = updatedIds.size
    result.finishedAt = Date.now()
    result.ok = !fatal && (attemptedAgents === 0 || result.failures.length < attemptedAgents)
    this.db.setMeta('lastSyncAttemptAt', String(result.finishedAt))
    if (result.ok) {
      this.db.setMeta('lastSuccessfulSyncAt', String(result.finishedAt))
      this.db.setMeta('lastScan', String(result.finishedAt))
    }
    this.db.setMeta('lastScanResult', JSON.stringify(result))
    this.scanning = false
    if (result.ok && result.failures.length === 0) {
      this.maybeConsolidate()
    }
    return { state: this.state(), result }
  }

  ingestImport(input: ImportedMemory): IngestOutcome {
    // The Markdown frontmatter round-trip trims titles, so compare the
    // normalized form or an unchanged source would look edited on every scan.
    const incoming = { ...input, title: input.title.trim() }
    const rawContent = incoming.content.trim()
    if (rawContent.length < 30) return { status: 'skipped' }
    const redacted = redactSecrets(rawContent)
    const content = redacted.text.trim()
    const redactedAny = redacted.kinds.length > 0
    const memory: ImportedMemory = {
      ...incoming,
      content,
      summary: incoming.summary ?? deriveSummary(content),
      tags: redactedAny
        ? [...new Set([...incoming.tags, 'redacted-secret'])].slice(0, 12)
        : incoming.tags
    }
    const hash = contentHash(content)
    const now = Date.now()
    const sourceKey = sourceKeyFor(memory.agentId, memory.sourcePath, memory.sourceRef)
    const record = this.db.getSourceRecord(sourceKey)
    const previousId = record?.memoryId ?? this.db.findMemoryIdBySource(
      memory.agentId,
      memory.sourcePath,
      memory.sourceRef
    )

    if (record?.contentHash === hash) {
      const current = this.db.getMemory(record.memoryId)
      if (current) {
        const nextKind = normalizeMemoryKind(memory.kind, content)
        const nextScope = normalizeMemoryScope(memory.scope, memory.project)
        const nextAuthority = normalizeMemoryAuthority(memory.authority)
        const nextStatus = normalizeMemoryStatus(
          current.archived
            ? 'archived'
            : current.supersededBy
              ? 'superseded'
              : memory.status,
          nextKind
        )
        // Identical content may arrive from several sources with different
        // titles, tags or kinds. Only the source that created the memory (or,
        // for older records without a source-derived id, the source seen first)
        // may restamp it; otherwise echoes would alternate the metadata on every
        // scan and each refresh would report phantom updates.
        const ownsPresentation =
          current.id === memoryIdForSource(sourceKey) ||
          this.db.oldestSourceKeyFor(current.id) === sourceKey
        const metadataChanged =
          ownsPresentation &&
          (current.kind !== nextKind ||
            current.scope !== nextScope ||
            current.authority !== nextAuthority ||
            current.status !== nextStatus ||
            current.project !== memory.project ||
            current.title !== memory.title ||
            current.summary !== memory.summary ||
            JSON.stringify([...current.tags].sort()) !==
              JSON.stringify([...memory.tags.slice(0, 12)].sort()))
        this.attachImportedSource(current.id, memory)
        if (metadataChanged) {
          const updated = this.updateImportedMemory(current, memory, content, false)
          this.recordSource(memory, sourceKey, current.id, hash, updated.title, record, now)
          return {
            status: 'updated',
            change: changeFor(updated, memory, 'updated'),
            redacted: redactedAny
          }
        }
        this.recordSource(memory, sourceKey, current.id, hash, current.title, record, now)
        return { status: 'unchanged', redacted: redactedAny }
      }
    }

    if (previousId) {
      const previous = this.db.getMemory(previousId)
      if (previous) {
        const matching = this.db.findByHash(hash)
        if (matching && matching.id !== previous.id) {
          this.attachImportedSource(matching.id, memory)
          this.recordSource(memory, sourceKey, matching.id, hash, matching.title, record, now)
          return {
            status: 'updated',
            change: changeFor(matching, memory, 'updated'),
            redacted: redactedAny
          }
        }
        this.attachImportedSource(previous.id, memory)
        const updated = this.updateImportedMemory(previous, memory, content)
        this.recordSource(memory, sourceKey, previous.id, hash, updated.title, record, now)
        return {
          status: 'updated',
          change: changeFor(updated, memory, 'updated'),
          redacted: redactedAny
        }
      }
    }

    const existing = this.db.findByHash(hash)
    if (existing) {
      this.attachImportedSource(existing.id, memory)
      this.recordSource(memory, sourceKey, existing.id, hash, existing.title, record, now)
      return { status: 'unchanged', redacted: redactedAny }
    }

    const id = memoryIdForSource(sourceKey)
    const file: MemoryFile = {
      id,
      title: memory.title,
      summary: memory.summary ?? deriveSummary(content),
      content,
      kind: normalizeMemoryKind(memory.kind, content),
      scope: normalizeMemoryScope(memory.scope, memory.project),
      authority: normalizeMemoryAuthority(memory.authority),
      status: normalizeMemoryStatus(memory.status, normalizeMemoryKind(memory.kind, content)),
      project: memory.project,
      tags: memory.tags.slice(0, 12),
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      archived: false,
      pinned: false,
      sources: [
        {
          agentId: memory.agentId,
          path: memory.sourcePath,
          ref: memory.sourceRef
        }
      ]
    }
    this.db.upsertMemory({ ...file })
    const filePath = this.library.write(file)
    this.db.upsertMemory({ ...file, filePath })
    this.db.attachSource(id, {
      agentId: memory.agentId,
      agentName: memory.agentName,
      path: memory.sourcePath,
      ref: memory.sourceRef,
      importedAt: now
    })
    this.recordSource(memory, sourceKey, id, hash, memory.title, record, now)
    return {
      status: 'added',
      change: changeFor(file as MemoryFile & { id: string; title: string }, memory, 'added'),
      redacted: redactedAny
    }
  }

  private attachImportedSource(memoryId: string, memory: ImportedMemory): void {
    this.db.attachSource(memoryId, {
      agentId: memory.agentId,
      agentName: memory.agentName,
      path: memory.sourcePath,
      ref: memory.sourceRef,
      importedAt: Date.now()
    })
  }

  private updateImportedMemory(
    previous: MemoryDetail,
    memory: ImportedMemory,
    content: string,
    touchUpdatedAt = true
  ): MemoryDetail {
    const sources = new Map(
      previous.sources.map((source) => [
        sourceKeyFor(source.agentId, source.path, source.ref),
        {
          agentId: source.agentId,
          path: source.path,
          ref: source.ref
        }
      ])
    )
    sources.set(sourceKeyFor(memory.agentId, memory.sourcePath, memory.sourceRef), {
      agentId: memory.agentId,
      path: memory.sourcePath,
      ref: memory.sourceRef
    })
    const file: MemoryFile = {
      id: previous.id,
      title: memory.title,
      summary: memory.summary ?? deriveSummary(content),
      content,
      kind: normalizeMemoryKind(memory.kind, content),
      scope: normalizeMemoryScope(memory.scope, memory.project),
      authority: normalizeMemoryAuthority(memory.authority),
      status: normalizeMemoryStatus(
        previous.archived
          ? 'archived'
          : previous.supersededBy
            ? 'superseded'
            : memory.status,
        normalizeMemoryKind(memory.kind, content)
      ),
      project: memory.project,
      tags: memory.tags.slice(0, 12),
      createdAt: previous.createdAt,
      updatedAt: touchUpdatedAt ? Math.max(memory.updatedAt, Date.now()) : previous.updatedAt,
      archived: previous.archived,
      pinned: previous.pinned,
      supersededBy: previous.supersededBy,
      sourceMissing: previous.sourceMissing,
      sources: [...sources.values()]
    }
    const filePath = this.library.write(file, this.db.getMemoryPath(previous.id))
    this.db.upsertMemory({ ...file, filePath })
    return this.db.getMemory(previous.id) as MemoryDetail
  }

  private recordSource(
    memory: ImportedMemory,
    sourceKey: string,
    memoryId: string,
    hash: string,
    title: string,
    previous: SourceRecord | null,
    now: number
  ): void {
    this.db.upsertSourceRecord({
      sourceKey,
      agentId: memory.agentId,
      agentName: memory.agentName,
      path: memory.sourcePath,
      ref: memory.sourceRef,
      memoryId,
      contentHash: hash,
      title,
      firstSeenAt: previous?.firstSeenAt ?? now,
      lastSeenAt: now,
      updatedAt: now
    })
    // Seeing the source again disproves an earlier "source vanished" mark; the
    // row only keeps it until a scan actually reaches this agent.
    if (this.db.clearSourceMissing(memoryId)) {
      const file = this.db.getMemoryFile(memoryId)
      const filePath = this.db.getMemoryPath(memoryId)
      if (file && filePath) this.library.write({ ...file, sourceMissing: false }, filePath)
    }
  }

  /**
   * Marks memories whose source vanished from a completed agent scan. The
   * tombstone is persisted to the library file so a database rebuild and the
   * next startup agree with the scan that observed it.
   */
  markSourceMissingForAgent(agentId: string, since: number): string[] {
    const ids = this.db.markSourceMissingForAgent(agentId, since)
    for (const id of ids) {
      const file = this.db.getMemoryFile(id)
      const filePath = this.db.getMemoryPath(id)
      if (file && filePath) this.library.write({ ...file, sourceMissing: true }, filePath)
    }
    return ids
  }

  private bootstrapSourceRecords(): void {
    const seen = new Set<string>()
    for (const link of this.db.sourceLinksForBootstrap()) {
      const sourceKey = sourceKeyFor(link.agentId, link.path, link.ref)
      if (seen.has(sourceKey) || this.db.getSourceRecord(sourceKey)) continue
      seen.add(sourceKey)
      this.db.upsertSourceRecord({
        sourceKey,
        agentId: link.agentId,
        agentName: link.agentName,
        path: link.path,
        ref: link.ref,
        memoryId: link.memoryId,
        contentHash: link.contentHash,
        title: link.title,
        firstSeenAt: link.importedAt,
        lastSeenAt: link.importedAt,
        updatedAt: link.updatedAt
      })
    }
  }

  private metaNumber(key: string): number | null {
    const value = Number(this.db.getMeta(key))
    return Number.isFinite(value) && value > 0 ? value : null
  }

  private lastScanResult(): ScanResult | null {
    const raw = this.db.getMeta('lastScanResult')
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as ScanResult
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.finishedAt !== 'number' ||
        !Array.isArray(parsed.changes) ||
        !Array.isArray(parsed.failures)
      ) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  create(input: CreateMemoryInput): MemoryDetail {
    const content = input.content.trim()
    assertShareable(`${input.title}\n${content}`)
    const summary = input.summary?.trim() || deriveSummary(content)
    const sourceAgentId = input.sourceAgentId?.trim() || 'dachshund'
    const sourceAgentName =
      input.sourceAgentName?.trim() || (sourceAgentId === 'dachshund' ? 'dachshund' : sourceAgentId)
    const sourcePath = sourceAgentId === 'dachshund' ? '' : `mcp://${sourceAgentId}`
    const title =
      input.title.trim() ||
      content.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').slice(0, 90) ||
      'Untitled memory'
    const now = Date.now()
    const file: MemoryFile = {
      id: makeId('mem'),
      title,
      summary,
      content,
      kind: normalizeMemoryKind(input.kind, content),
      scope: normalizeMemoryScope(input.scope, input.project ?? null),
      authority: normalizeMemoryAuthority(input.authority ?? 'user_explicit'),
      status: normalizeMemoryStatus(
        input.status ?? 'active',
        normalizeMemoryKind(input.kind, content)
      ),
      project: input.project ?? null,
      tags: (input.tags ?? []).slice(0, 12),
      createdAt: now,
      updatedAt: now,
      archived: false,
      pinned: false,
      sources: [{ agentId: sourceAgentId, path: sourcePath }]
    }
    const filePath = this.library.write(file)
    if (sourceAgentId === 'dachshund') {
      file.sources = [{ agentId: 'dachshund', path: filePath }]
      this.library.write(file, filePath)
    }
    this.db.upsertMemory({ ...file, filePath })
    this.db.attachSource(file.id, {
      agentId: sourceAgentId,
      agentName: sourceAgentName,
      path: sourceAgentId === 'dachshund' ? filePath : sourcePath,
      importedAt: now
    })
    return this.db.getMemory(file.id) as MemoryDetail
  }

  rememberShared(input: CreateMemoryInput): MemoryDetail {
    const content = input.content.trim()
    assertShareable(`${input.title}\n${content}`)
    const sourceAgentId = input.sourceAgentId?.trim() || 'mcp-client'
    const sourceAgentName = input.sourceAgentName?.trim() || sourceAgentId
    const existing = this.db.findByHash(contentHash(content))
    if (existing) {
      return this.attachSharedSource(existing.id, {
        agentId: sourceAgentId,
        agentName: sourceAgentName,
        path: `mcp://${sourceAgentId}`
      })
    }
    return this.create({
      ...input,
      content,
      sourceAgentId,
      sourceAgentName
    })
  }

  promoteMemory(id: string): MemoryDetail | null {
    const current = this.db.getMemory(id)
    if (!current) return null
    const filePath = this.db.getMemoryPath(id) ?? `dachshund://${id}`
    return this.attachSharedSource(id, {
      agentId: 'dachshund',
      agentName: 'dachshund',
      path: filePath
    })
  }

  private attachSharedSource(
    memoryId: string,
    source: { agentId: string; agentName: string; path: string }
  ): MemoryDetail {
    const current = this.db.getMemory(memoryId)
    if (!current) throw new Error('Memory not found')
    const sources = new Map(
      current.sources.map((item) => [
        sourceKeyFor(item.agentId, item.path, item.ref),
        {
          agentId: item.agentId,
          path: item.path,
          ref: item.ref
        }
      ])
    )
    sources.set(sourceKeyFor(source.agentId, source.path), {
      agentId: source.agentId,
      path: source.path,
      ref: undefined
    })
    const file: MemoryFile = {
      id: current.id,
      title: current.title,
      summary: current.summary,
      content: current.content,
      kind: current.kind,
      scope: current.scope,
      authority: current.authority,
      status: current.status,
      project: current.project,
      tags: current.tags,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      archived: current.archived,
      pinned: current.pinned,
      supersededBy: current.supersededBy,
      sourceMissing: current.sourceMissing,
      sources: [...sources.values()]
    }
    const filePath = this.library.write(file, this.db.getMemoryPath(current.id))
    this.db.upsertMemory({ ...file, filePath })
    this.db.attachSource(current.id, {
      agentId: source.agentId,
      agentName: source.agentName,
      path: source.path,
      importedAt: Date.now()
    })
    return this.db.getMemory(current.id) as MemoryDetail
  }

  update(id: string, patch: UpdateMemoryInput): MemoryDetail | null {
    const current = this.db.getMemory(id)
    if (!current) return null
    const content = patch.content?.trim() ?? current.content
    assertShareable(`${patch.title?.trim() || current.title}\n${content}`)
    const filePath = this.db.getMemoryPath(id)
    const file: MemoryFile = {
      id,
      title: patch.title?.trim() || current.title,
      summary:
        patch.summary !== undefined
          ? patch.summary.trim() || deriveSummary(content)
          : patch.content !== undefined
            ? deriveSummary(content)
            : current.summary,
      content,
      kind: normalizeMemoryKind(
        patch.kind || current.kind,
        patch.content?.trim() ?? current.content
      ),
      scope: normalizeMemoryScope(
        patch.scope ?? current.scope,
        patch.project !== undefined ? patch.project : current.project
      ),
      authority: normalizeMemoryAuthority(patch.authority ?? current.authority),
      status: normalizeMemoryStatus(
        patch.status ?? current.status,
        patch.kind || current.kind
      ),
      project: patch.project !== undefined ? patch.project : current.project,
      tags: patch.tags ?? current.tags,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      archived: current.archived,
      pinned: patch.pinned ?? current.pinned,
      supersededBy: current.supersededBy,
      sourceMissing: current.sourceMissing,
      sources: current.sources.map((source) => ({
        agentId: source.agentId,
        path: source.path,
        ref: source.ref
      }))
    }
    const nextPath = this.library.write(file, filePath)
    this.db.upsertMemory({ ...file, filePath: nextPath })
    return this.db.getMemory(id)
  }

  archive(id: string): boolean {
    const current = this.db.getMemory(id)
    if (!current) return false
    const filePath = this.db.getMemoryPath(id)
    const file: MemoryFile = {
      id,
      title: current.title,
      summary: current.summary,
      content: current.content,
      kind: current.kind,
      scope: current.scope,
      authority: current.authority,
      status: 'archived',
      project: current.project,
      tags: current.tags,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      archived: true,
      pinned: current.pinned,
      supersededBy: current.supersededBy,
      sourceMissing: current.sourceMissing,
      sources: current.sources.map((source) => ({
        agentId: source.agentId,
        path: source.path,
        ref: source.ref
      }))
    }
    this.library.write(file, filePath)
    this.db.upsertMemory({ ...file, filePath })
    return true
  }

  setShared(agentId: string, shared: boolean): AppState {
    this.db.setAgentShared(agentId, shared)
    return this.state()
  }

  async installAgentMcp(
    agentId: string,
    bridgePath: string,
    dryRun = false
  ): Promise<McpInstallResult> {
    const result = installMcp(agentId, { bridgePath, dryRun })
    if (result.ok && !dryRun) {
      this.db.setAgentMcp(agentId, true, result.configPath)
    }
    return result
  }

  markOnboarded(): AppState {
    this.db.setMeta('onboarded', '1')
    return this.state()
  }

  libraryPathFor(id: string): string | null {
    return this.db.getMemoryPath(id) ?? null
  }

  fileNameFor(title: string): string {
    return slugify(title)
  }
}

function assertShareable(text: string): void {
  const kinds = findSecretKinds(text)
  if (kinds.length) throw new SecretContentError(kinds)
}

function changeFor(
  memory: { id: string; title: string },
  imported: ImportedMemory,
  change: ScanChange['change']
): ScanChange {
  return {
    memoryId: memory.id,
    title: memory.title || imported.title,
    agentId: imported.agentId,
    agentName: imported.agentName,
    change
  }
}
