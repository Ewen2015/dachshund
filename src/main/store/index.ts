import { createHash } from 'node:crypto'
import type {
  AppState,
  CreateMemoryInput,
  ImportedMemory,
  McpInstallResult,
  MemoryDetail,
  MemoryFile,
  MemorySummary,
  ScanProgress,
  SearchQuery,
  UpdateMemoryInput
} from '../../shared/types'
import { DISABLE_IMPORT, IS_DEMO, LIBRARY_DIR, ensureDirs } from '../paths'
import { discoverAgents, refreshAgents } from '../agents/discovery'
import { importAgentMemories } from '../agents/importers'
import { installMcp } from '../agents/mcp-install'
import { Db, contentHash, makeId } from './db'
import { Library, slugify } from './library'

export class Store {
  readonly db: Db
  readonly library: Library
  private version: string
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
  }

  state(): AppState {
    refreshAgents(this.db)
    return {
      agents: this.db.listAgents(),
      memories: this.db.listMemories(90),
      counts: this.db.counts(),
      libraryPath: LIBRARY_DIR,
      onboarded: this.db.getMeta('onboarded') === '1',
      scanning: this.scanning,
      version: this.version
    }
  }

  search(query: SearchQuery): MemorySummary[] {
    return this.db.search(
      query.query ?? '',
      query.agentId,
      query.limit ?? 80,
      query.includeArchived ?? false
    )
  }

  getMemory(id: string): MemoryDetail | null {
    return this.db.getMemory(id)
  }

  async scan(onProgress?: (progress: ScanProgress) => void): Promise<AppState> {
    if (this.scanning) return this.state()
    this.scanning = true
    try {
      this.library.syncToDb(this.db)
      const agents = refreshAgents(this.db)
      if (!DISABLE_IMPORT && !IS_DEMO) {
        for (const agent of agents) {
          if (!agent.installed || !agent.shared) continue
          onProgress?.({
            agentId: agent.id,
            agentName: agent.name,
            status: 'scanning'
          })
          try {
            const definition = discoverAgents().find((item) => item.id === agent.id)
            if (!definition) continue
            const imported = importAgentMemories(definition)
            let accepted = 0
            for (const memory of imported) {
              if (this.ingestImport(memory)) accepted += 1
            }
            onProgress?.({
              agentId: agent.id,
              agentName: agent.name,
              status: 'ready',
              memories: accepted
            })
          } catch (error) {
            onProgress?.({
              agentId: agent.id,
              agentName: agent.name,
              status: 'error',
              message: error instanceof Error ? error.message : 'Could not read this agent'
            })
          }
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
      }
      this.db.setMeta('lastScan', String(Date.now()))
      this.scanning = false
      return this.state()
    } finally {
      this.scanning = false
    }
  }

  private ingestImport(memory: ImportedMemory): boolean {
    const content = memory.content.trim()
    if (content.length < 30) return false
    const hash = contentHash(content)
    const existing = this.db.findByHash(hash)
    if (existing) {
      this.db.attachSource(existing.id, {
        agentId: memory.agentId,
        agentName: memory.agentName,
        path: memory.sourcePath,
        ref: memory.sourceRef,
        importedAt: Date.now()
      })
      return true
    }

    const stable = createHash('sha1')
      .update(`${memory.agentId}|${memory.sourcePath}|${memory.sourceRef ?? ''}|${hash}`)
      .digest('hex')
      .slice(0, 16)
    const id = `mem_${stable}`
    const file: MemoryFile = {
      id,
      title: memory.title,
      content,
      kind: memory.kind,
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
      importedAt: Date.now()
    })
    return true
  }

  create(input: CreateMemoryInput): MemoryDetail {
    const content = input.content.trim()
    const title =
      input.title.trim() ||
      content.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').slice(0, 90) ||
      'Untitled memory'
    const now = Date.now()
    const file: MemoryFile = {
      id: makeId('mem'),
      title,
      content,
      kind: input.kind || 'fact',
      project: input.project ?? null,
      tags: (input.tags ?? []).slice(0, 12),
      createdAt: now,
      updatedAt: now,
      archived: false,
      pinned: false,
      sources: [{ agentId: 'dachshund', path: '' }]
    }
    const filePath = this.library.write(file)
    file.sources = [{ agentId: 'dachshund', path: filePath }]
    this.library.write(file, filePath)
    this.db.upsertMemory({ ...file, filePath })
    this.db.attachSource(file.id, {
      agentId: 'dachshund',
      agentName: 'dachshund',
      path: filePath,
      importedAt: now
    })
    return this.db.getMemory(file.id) as MemoryDetail
  }

  update(id: string, patch: UpdateMemoryInput): MemoryDetail | null {
    const current = this.db.getMemory(id)
    if (!current) return null
    const filePath = this.db.getMemoryPath(id)
    const file: MemoryFile = {
      id,
      title: patch.title?.trim() || current.title,
      content: patch.content?.trim() ?? current.content,
      kind: patch.kind || current.kind,
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
