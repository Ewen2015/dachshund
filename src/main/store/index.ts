import { createHash } from 'node:crypto'
import type {
  AppState,
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
import { DISABLE_IMPORT, IS_DEMO, LIBRARY_DIR, ensureDirs } from '../paths'
import {
  normalizeMemoryAuthority,
  normalizeMemoryKind,
  normalizeMemoryScope,
  normalizeMemoryStatus
} from '../../shared/memory-taxonomy'
import { discoverAgents, refreshAgents } from '../agents/discovery'
import { importAgentMemories } from '../agents/importers'
import { installMcp } from '../agents/mcp-install'
import { Db, contentHash, makeId, type SourceRecord } from './db'
import { Library, slugify } from './library'

export const SYNC_INTERVAL_MINUTES = 60
const MAX_SCAN_CHANGES = 50

export interface IngestOutcome {
  status: 'added' | 'updated' | 'unchanged' | 'skipped'
  change?: ScanChange
}

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
      memories: this.db.listMemories(90),
      pulseMemories: this.db.listPulseMemories(),
      counts: this.db.counts(),
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
    return this.db.search(
      query.query ?? '',
      query.agentId,
      query.limit ?? 80,
      query.includeArchived ?? false,
      query.includeEvidence ?? true
    )
  }

  getMemory(id: string): MemoryDetail | null {
    return this.db.getMemory(id)
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
      failures: [],
      changes: [],
      ok: true
    }
    let attemptedAgents = 0
    let fatal = false
    const changeKeys = new Set<string>()

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
              if (outcome.status === 'added') result.added += 1
              else if (outcome.status === 'updated') result.updated += 1
              else if (outcome.status === 'unchanged') result.unchanged += 1
              if (outcome.change) {
                const key = `${outcome.change.change}:${outcome.change.memoryId}`
                if (!changeKeys.has(key)) {
                  changeKeys.add(key)
                  changed += 1
                  if (result.changes.length < MAX_SCAN_CHANGES) result.changes.push(outcome.change)
                }
              }
            }
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

    result.finishedAt = Date.now()
    result.ok = !fatal && (attemptedAgents === 0 || result.failures.length < attemptedAgents)
    this.db.setMeta('lastSyncAttemptAt', String(result.finishedAt))
    if (result.ok) {
      this.db.setMeta('lastSuccessfulSyncAt', String(result.finishedAt))
      this.db.setMeta('lastScan', String(result.finishedAt))
    }
    this.db.setMeta('lastScanResult', JSON.stringify(result))
    this.scanning = false
    return { state: this.state(), result }
  }

  ingestImport(memory: ImportedMemory): IngestOutcome {
    const content = memory.content.trim()
    if (content.length < 30) return { status: 'skipped' }
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
          current.archived ? 'archived' : memory.status,
          nextKind
        )
        const metadataChanged =
          current.kind !== nextKind ||
          current.scope !== nextScope ||
          current.authority !== nextAuthority ||
          current.status !== nextStatus ||
          current.project !== memory.project ||
          current.title !== memory.title ||
          JSON.stringify([...current.tags].sort()) !==
            JSON.stringify([...memory.tags.slice(0, 12)].sort())
        this.attachImportedSource(current.id, memory)
        if (metadataChanged) {
          const updated = this.updateImportedMemory(current, memory, content, false)
          this.recordSource(memory, sourceKey, current.id, hash, updated.title, record, now)
          return {
            status: 'updated',
            change: changeFor(updated, memory, 'updated')
          }
        }
        this.recordSource(memory, sourceKey, current.id, hash, current.title, record, now)
        return { status: 'unchanged' }
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
            change: changeFor(matching, memory, 'updated')
          }
        }
        this.attachImportedSource(previous.id, memory)
        const updated = this.updateImportedMemory(previous, memory, content)
        this.recordSource(memory, sourceKey, previous.id, hash, updated.title, record, now)
        return {
          status: 'updated',
          change: changeFor(updated, memory, 'updated')
        }
      }
    }

    const existing = this.db.findByHash(hash)
    if (existing) {
      this.attachImportedSource(existing.id, memory)
      this.recordSource(memory, sourceKey, existing.id, hash, existing.title, record, now)
      return { status: 'unchanged' }
    }

    const stable = createHash('sha1')
      .update(`source|${sourceKey}`)
      .digest('hex')
      .slice(0, 16)
    const id = `mem_${stable}`
    const file: MemoryFile = {
      id,
      title: memory.title,
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
      change: changeFor(file as MemoryFile & { id: string; title: string }, memory, 'added')
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
      content,
      kind: normalizeMemoryKind(memory.kind, content),
      scope: normalizeMemoryScope(memory.scope, memory.project),
      authority: normalizeMemoryAuthority(memory.authority),
      status: normalizeMemoryStatus(
        previous.archived ? 'archived' : memory.status,
        normalizeMemoryKind(memory.kind, content)
      ),
      project: memory.project,
      tags: memory.tags.slice(0, 12),
      createdAt: previous.createdAt,
      updatedAt: touchUpdatedAt ? Math.max(memory.updatedAt, Date.now()) : previous.updatedAt,
      archived: previous.archived,
      pinned: previous.pinned,
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
    const filePath = this.db.getMemoryPath(id)
    const file: MemoryFile = {
      id,
      title: patch.title?.trim() || current.title,
      content: patch.content?.trim() ?? current.content,
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

function sourceKeyFor(agentId: string, sourcePath: string, sourceRef?: string): string {
  return createHash('sha1')
    .update(JSON.stringify([agentId, sourcePath, sourceRef ?? '']))
    .digest('hex')
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
