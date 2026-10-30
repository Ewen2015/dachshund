import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type {
  AgentSummary,
  Counts,
  MemoryDetail,
  MemoryFile,
  MemorySource,
  MemorySummary
} from '../../shared/types'
import { DB_PATH } from '../paths'

type Row = Record<string, unknown>

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return fallback
}

function bool(value: unknown): boolean {
  return num(value) === 1
}

export function normalizeForHash(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
}

export function contentHash(content: string): string {
  return createHash('sha1').update(normalizeForHash(content)).digest('hex')
}

export function makeId(prefix = 'mem'): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
}

export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerptOf(content: string, limit = 190): string {
  const plain = stripMarkdown(content)
  if (plain.length <= limit) return plain
  return `${plain.slice(0, limit).trimEnd()}…`
}

export interface UpsertMemoryInput {
  id: string
  title: string
  content: string
  kind: string
  project: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  archived?: boolean
  pinned?: boolean
  filePath?: string | null
}

export class Db {
  private db: DatabaseSync

  constructor(file = DB_PATH) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        home TEXT,
        installed INTEGER NOT NULL DEFAULT 0,
        shared INTEGER NOT NULL DEFAULT 1,
        mcp_installed INTEGER NOT NULL DEFAULT 0,
        mcp_config_path TEXT,
        last_scan_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'fact',
        project TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        hash TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'shared',
        file_path TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(hash);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);

      CREATE TABLE IF NOT EXISTS sources (
        memory_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        path TEXT NOT NULL,
        ref TEXT,
        imported_at INTEGER NOT NULL,
        PRIMARY KEY (memory_id, agent_id, path)
      );
      CREATE INDEX IF NOT EXISTS idx_sources_agent ON sources(agent_id);
      CREATE INDEX IF NOT EXISTS idx_sources_memory ON sources(memory_id);

      CREATE TABLE IF NOT EXISTS imports (
        path TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        hash TEXT NOT NULL,
        imported_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        tags,
        project
      );
    `)
  }

  close(): void {
    try {
      this.db.close()
    } catch {
      // already closed
    }
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as Row | undefined
    return row ? str(row.value) : null
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }

  upsertAgent(input: {
    id: string
    name: string
    kind: string
    home: string | null
    installed: boolean
    mcpInstalled: boolean
    mcpConfigPath: string | null
  }): void {
    this.db
      .prepare(`
        INSERT INTO agents(id, name, kind, home, installed, mcp_installed, mcp_config_path, last_scan_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          kind = excluded.kind,
          home = excluded.home,
          installed = excluded.installed,
          mcp_installed = excluded.mcp_installed,
          mcp_config_path = excluded.mcp_config_path,
          last_scan_at = excluded.last_scan_at
      `)
      .run(
        input.id,
        input.name,
        input.kind,
        input.home,
        input.installed ? 1 : 0,
        input.mcpInstalled ? 1 : 0,
        input.mcpConfigPath,
        Date.now()
      )
  }

  setAgentShared(id: string, shared: boolean): void {
    this.db.prepare('UPDATE agents SET shared = ? WHERE id = ?').run(shared ? 1 : 0, id)
  }

  setAgentMcp(id: string, installed: boolean, configPath: string | null): void {
    this.db
      .prepare('UPDATE agents SET mcp_installed = ?, mcp_config_path = ? WHERE id = ?')
      .run(installed ? 1 : 0, configPath, id)
  }

  listAgents(): AgentSummary[] {
    const rows = this.db.prepare('SELECT * FROM agents ORDER BY installed DESC, name ASC').all() as Row[]
    const counts = this.db
      .prepare(
        'SELECT agent_id, COUNT(DISTINCT memory_id) AS memories, COUNT(*) AS sources FROM sources GROUP BY agent_id'
      )
      .all() as Row[]
    const countMap = new Map(
      counts.map((c) => [str(c.agent_id), { memories: num(c.memories), sources: num(c.sources) }])
    )
    return rows.map((row) => {
      const id = str(row.id)
      const count = countMap.get(id)
      return {
        id,
        name: str(row.name),
        monogram: monogramForId(str(row.name), id),
        kind: (str(row.kind) || 'cli') as AgentSummary['kind'],
        accent: accentFor(id),
        description: '',
        installed: bool(row.installed),
        home: str(row.home) || null,
        memoryCount: count?.memories ?? 0,
        sourceCount: count?.sources ?? 0,
        shared: bool(row.shared),
        mcpInstalled: bool(row.mcp_installed),
        mcpConfigPath: str(row.mcp_config_path) || null,
        note: null
      }
    })
  }

  upsertMemory(input: UpsertMemoryInput): void {
    const hash = contentHash(input.content)
    this.db
      .prepare(`
        INSERT INTO memories(id, title, content, kind, project, tags, created_at, updated_at, archived, pinned, hash, origin, file_path)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shared', ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          kind = excluded.kind,
          project = excluded.project,
          tags = excluded.tags,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          archived = excluded.archived,
          pinned = excluded.pinned,
          hash = excluded.hash,
          file_path = COALESCE(excluded.file_path, memories.file_path)
      `)
      .run(
        input.id,
        input.title,
        input.content,
        input.kind,
        input.project,
        JSON.stringify(input.tags),
        input.createdAt,
        input.updatedAt,
        input.archived ? 1 : 0,
        input.pinned ? 1 : 0,
        hash,
        input.filePath ?? null
      )
    this.reindex(input.id)
  }

  private reindex(id: string): void {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Row | undefined
    this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id)
    if (!row) return
    this.db
      .prepare('INSERT INTO memories_fts(id, title, content, tags, project) VALUES(?, ?, ?, ?, ?)')
      .run(id, str(row.title), str(row.content), str(row.tags), str(row.project))
  }

  findByHash(hash: string): MemoryDetail | null {
    const row = this.db
      .prepare('SELECT * FROM memories WHERE hash = ? AND archived = 0 LIMIT 1')
      .get(hash) as Row | undefined
    return row ? this.rowToDetail(row) : null
  }

  getMemory(id: string): MemoryDetail | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Row | undefined
    return row ? this.rowToDetail(row) : null
  }

  getMemoryFile(id: string): MemoryFile | null {
    const memory = this.getMemory(id)
    if (!memory) return null
    return {
      id: memory.id,
      title: memory.title,
      content: memory.content,
      kind: memory.kind,
      project: memory.project,
      tags: memory.tags,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      archived: memory.archived,
      pinned: memory.pinned,
      sources: memory.sources.map((s) => ({
        agentId: s.agentId,
        path: s.path,
        ref: s.ref
      }))
    }
  }

  getMemoryPath(id: string): string | null {
    const row = this.db.prepare('SELECT file_path FROM memories WHERE id = ?').get(id) as Row | undefined
    return row ? str(row.file_path) || null : null
  }

  attachSource(memoryId: string, source: MemorySource): void {
    this.db
      .prepare(`
        INSERT INTO sources(memory_id, agent_id, agent_name, path, ref, imported_at)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(memory_id, agent_id, path) DO UPDATE SET
          agent_name = excluded.agent_name,
          ref = excluded.ref,
          imported_at = excluded.imported_at
      `)
      .run(memoryId, source.agentId, source.agentName, source.path, source.ref ?? null, source.importedAt)
  }

  archive(id: string): boolean {
    const result = this.db.prepare('UPDATE memories SET archived = 1, updated_at = ? WHERE id = ?').run(Date.now(), id)
    this.reindex(id)
    return result.changes > 0
  }

  update(id: string, patch: Partial<UpsertMemoryInput>): MemoryDetail | null {
    const current = this.getMemory(id)
    if (!current) return null
    this.upsertMemory({
      id,
      title: patch.title ?? current.title,
      content: patch.content ?? current.content,
      kind: patch.kind ?? current.kind,
      project: patch.project !== undefined ? patch.project : current.project,
      tags: patch.tags ?? current.tags,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      archived: patch.archived ?? current.archived,
      pinned: patch.pinned ?? current.pinned,
      filePath: patch.filePath
    })
    return this.getMemory(id)
  }

  listMemories(limit = 100, includeArchived = false): MemorySummary[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM memories ${includeArchived ? '' : 'WHERE archived = 0'}
         ORDER BY pinned DESC, updated_at DESC LIMIT ?`
      )
      .all(limit) as Row[]
    return this.rowsToSummaries(rows)
  }

  search(query: string, agentId?: string, limit = 60, includeArchived = false): MemorySummary[] {
    const trimmed = query.trim()
    if (!trimmed) {
      const all = this.listMemories(limit, includeArchived)
      return agentId ? all.filter((m) => m.sources.some((s) => s.agentId === agentId)) : all
    }

    const results = new Map<string, MemorySummary>()
    const ftsQuery = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token.replace(/"/g, '""')}"*`)
      .join(' OR ')

    try {
      const rows = this.db
        .prepare(
          `SELECT m.*, bm25(memories_fts) AS score
           FROM memories_fts JOIN memories m ON m.id = memories_fts.id
           WHERE memories_fts MATCH ? ${includeArchived ? '' : 'AND m.archived = 0'}
           ORDER BY score LIMIT ?`
        )
        .all(ftsQuery, limit * 2) as Row[]
      for (const memory of this.rowsToSummaries(rows, true)) {
        results.set(memory.id, memory)
      }
    } catch {
      // Malformed FTS query: fall through to LIKE search.
    }

    const like = `%${trimmed.replace(/[%_]/g, '')}%`
    const rows = this.db
      .prepare(
        `SELECT * FROM memories
         WHERE ${includeArchived ? '1 = 1' : 'archived = 0'}
           AND (title LIKE ? OR content LIKE ? OR tags LIKE ? OR project LIKE ?)
         ORDER BY updated_at DESC LIMIT ?`
      )
      .all(like, like, like, like, limit) as Row[]
    for (const memory of this.rowsToSummaries(rows)) {
      if (!results.has(memory.id)) results.set(memory.id, memory)
    }

    let list = [...results.values()]
    if (agentId) list = list.filter((m) => m.sources.some((s) => s.agentId === agentId))
    return list.slice(0, limit)
  }

  counts(): Counts {
    const memories = this.db
      .prepare('SELECT COUNT(*) AS c FROM memories WHERE archived = 0')
      .get() as Row
    const agents = this.db
      .prepare('SELECT COUNT(*) AS c FROM agents WHERE installed = 1 AND shared = 1')
      .get() as Row
    const sources = this.db.prepare('SELECT COUNT(*) AS c FROM sources').get() as Row
    const echoes = this.db
      .prepare(
        'SELECT COUNT(*) AS c FROM (SELECT memory_id FROM sources GROUP BY memory_id HAVING COUNT(DISTINCT agent_id) > 1)'
      )
      .get() as Row
    return {
      memories: num(memories.c),
      agents: num(agents.c),
      sources: num(sources.c),
      echoes: num(echoes.c)
    }
  }

  recordImport(pathValue: string, agentId: string, mtime: number, size: number, hash: string): void {
    this.db
      .prepare(`
        INSERT INTO imports(path, agent_id, mtime, size, hash, imported_at)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          agent_id = excluded.agent_id,
          mtime = excluded.mtime,
          size = excluded.size,
          hash = excluded.hash,
          imported_at = excluded.imported_at
      `)
      .run(pathValue, agentId, mtime, size, hash, Date.now())
  }

  importSeen(pathValue: string, mtime: number, size: number): boolean {
    const row = this.db
      .prepare('SELECT mtime, size FROM imports WHERE path = ?')
      .get(pathValue) as Row | undefined
    return Boolean(row && num(row.mtime) === mtime && num(row.size) === size)
  }

  private rowsToSummaries(rows: Row[], withScore = false): MemorySummary[] {
    if (!rows.length) return []
    const ids = rows.map((r) => str(r.id))
    const sourceMap = this.sourcesFor(ids)
    return rows.map((row) => {
      const id = str(row.id)
      const sources = sourceMap.get(id) ?? []
      return {
        id,
        title: str(row.title),
        excerpt: excerptOf(str(row.content)),
        kind: str(row.kind, 'fact'),
        project: str(row.project) || null,
        tags: parseTags(row.tags),
        createdAt: num(row.created_at),
        updatedAt: num(row.updated_at),
        archived: bool(row.archived),
        pinned: bool(row.pinned),
        sources,
        echoCount: new Set(sources.map((s) => s.agentId)).size,
        score: withScore && row.score !== undefined ? num(row.score) : undefined
      }
    })
  }

  private rowToDetail(row: Row): MemoryDetail {
    const summary = this.rowsToSummaries([row])[0]
    return { ...summary, content: str(row.content) }
  }

  private sourcesFor(ids: string[]): Map<string, MemorySource[]> {
    const map = new Map<string, MemorySource[]>()
    for (let i = 0; i < ids.length; i += 300) {
      const chunk = ids.slice(i, i + 300)
      const placeholders = chunk.map(() => '?').join(',')
      const rows = this.db
        .prepare(
          `SELECT * FROM sources WHERE memory_id IN (${placeholders}) ORDER BY imported_at ASC`
        )
        .all(...chunk) as Row[]
      for (const row of rows) {
        const id = str(row.memory_id)
        const list = map.get(id) ?? []
        list.push({
          agentId: str(row.agent_id),
          agentName: str(row.agent_name),
          path: str(row.path),
          ref: str(row.ref) || undefined,
          importedAt: num(row.imported_at)
        })
        map.set(id, list)
      }
    }
    return map
  }
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function monogramFor(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function monogramForId(name: string, id: string): string {
  const known: Record<string, string> = {
    'claude-code': 'CL',
    'claude-desktop': 'CD',
    codex: 'CX',
    'gemini-cli': 'GM',
    cursor: 'CU',
    copilot: 'GH',
    opencode: 'OC',
    windsurf: 'WS',
    workbuddy: 'WB',
    doubao: 'DB',
    trae: 'TR',
    dachshund: 'DD'
  }
  return known[id] ?? monogramFor(name)
}

export function accentFor(id: string): string {
  const colors: Record<string, string> = {
    'claude-code': '#C0663B',
    'claude-desktop': '#B86A3F',
    codex: '#2E2B27',
    'gemini-cli': '#4C6F91',
    cursor: '#66765A',
    copilot: '#5C6570',
    opencode: '#8A6A4F',
    windsurf: '#3F7A6E',
    workbuddy: '#01C886',
    doubao: '#1E37FC',
    trae: '#32F08C',
    dachshund: '#B5542F'
  }
  return colors[id] ?? '#7A7064'
}
