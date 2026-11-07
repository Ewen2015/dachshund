import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type {
  AgentSummary,
  ConsolidationResult,
  Counts,
  MemoryDetail,
  MemoryAuthority,
  MemoryFile,
  MemoryHealth,
  MemoryScope,
  MemorySource,
  MemorySummary,
  MemoryStatus,
  PulseMemory,
  SearchQuery
} from '../../shared/types'
import {
  categoryForKind,
  normalizeMemoryAuthority,
  normalizeMemoryKind,
  normalizeMemoryScope,
  normalizeMemoryStatus
} from '../../shared/memory-taxonomy'
import { deriveSummary, summaryOf } from '../../shared/memory-summary'
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

export function sourceKeyFor(
  agentId: string,
  sourcePath: string,
  sourceRef?: string
): string {
  return createHash('sha1')
    .update(JSON.stringify([agentId, sourcePath, sourceRef ?? '']))
    .digest('hex')
}

/**
 * Imported memories derive their id from the source that created them, so the
 * id is also a durable record of which source owns the memory's presentation.
 */
export function memoryIdForSource(sourceKey: string): string {
  return `mem_${createHash('sha1').update(`source|${sourceKey}`).digest('hex').slice(0, 16)}`
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

function hasIndexEntries(content: string): boolean {
  return content.split('\n').some((line) => {
    const trimmed = line.trim()
    return Boolean(trimmed) && !trimmed.startsWith('#')
  })
}

export interface UpsertMemoryInput {
  id: string
  title: string
  summary?: string
  content: string
  kind: string
  scope: MemoryScope
  authority: MemoryAuthority
  status: MemoryStatus
  project: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  archived?: boolean
  pinned?: boolean
  supersededBy?: string | null
  sourceMissing?: boolean
  filePath?: string | null
}

export interface ConsolidationCandidate {
  id: string
  title: string
  summary: string
  content: string
  kind: string
  authority: MemoryAuthority
  project: string | null
  createdAt: number
  updatedAt: number
  agentIds: string[]
  refs: string[]
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
        summary TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'fact',
        scope TEXT NOT NULL DEFAULT 'user',
        authority TEXT NOT NULL DEFAULT 'agent_observed',
        status TEXT NOT NULL DEFAULT 'active',
        project TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        superseded_by TEXT,
        source_missing INTEGER NOT NULL DEFAULT 0,
        hash TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'shared',
        file_path TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(hash);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind);

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

      CREATE TABLE IF NOT EXISTS source_records (
        source_key TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        path TEXT NOT NULL,
        ref TEXT,
        memory_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        title TEXT NOT NULL,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_source_records_agent ON source_records(agent_id);
      CREATE INDEX IF NOT EXISTS idx_source_records_memory ON source_records(memory_id);

      CREATE TABLE IF NOT EXISTS consolidations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        dry_run INTEGER NOT NULL,
        candidates INTEGER NOT NULL,
        groups INTEGER NOT NULL,
        merged INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        tags,
        project
      );
    `)
    const columns = this.db.prepare('PRAGMA table_info(memories)').all() as Row[]
    const names = new Set(columns.map((column) => str(column.name)))
    if (!names.has('scope')) {
      this.db.exec("ALTER TABLE memories ADD COLUMN scope TEXT NOT NULL DEFAULT 'user'")
    }
    if (!names.has('authority')) {
      this.db.exec(
        "ALTER TABLE memories ADD COLUMN authority TEXT NOT NULL DEFAULT 'agent_observed'"
      )
    }
    if (!names.has('status')) {
      this.db.exec("ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
    }
    if (!names.has('summary')) {
      this.db.exec("ALTER TABLE memories ADD COLUMN summary TEXT NOT NULL DEFAULT ''")
    }
    if (!names.has('superseded_by')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN superseded_by TEXT')
    }
    if (!names.has('source_missing')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN source_missing INTEGER NOT NULL DEFAULT 0')
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
      CREATE INDEX IF NOT EXISTS idx_memories_superseded ON memories(superseded_by);
      UPDATE memories
      SET scope = CASE WHEN project IS NOT NULL AND project != '' THEN 'project' ELSE 'user' END
      WHERE scope IS NULL OR scope = '';
      UPDATE memories SET status = 'archived' WHERE archived = 1 AND status != 'archived';
    `)
    this.migrateClaudeMerge()
  }

  private migrateClaudeMerge(): void {
    // Claude Code and Claude Desktop were separate agents before the Claude merge.
    const legacy = ['claude-code', 'claude-desktop']
    const marks = legacy.map(() => '?').join(',')
    const priorAgents = this.db
      .prepare(`SELECT shared FROM agents WHERE id IN (${marks})`)
      .all(...legacy) as Row[]
    if (priorAgents.length) {
      // Keep sharing on only if every former surface had it on.
      const shared = priorAgents.some((row) => num(row.shared) === 0) ? 0 : 1
      this.db
        .prepare(`
          INSERT INTO agents(id, name, kind, home, installed, shared, mcp_installed, mcp_config_path, last_scan_at)
          VALUES('claude', 'Claude', 'cli', NULL, 0, ?, 0, NULL, NULL)
          ON CONFLICT(id) DO UPDATE SET shared = MIN(shared, excluded.shared)
        `)
        .run(shared)
      this.db.prepare(`DELETE FROM agents WHERE id IN (${marks})`).run(...legacy)
    }
    this.db
      .prepare(`UPDATE sources SET agent_id = 'claude', agent_name = 'Claude' WHERE agent_id IN (${marks})`)
      .run(...legacy)
    this.db
      .prepare(`UPDATE imports SET agent_id = 'claude' WHERE agent_id IN (${marks})`)
      .run(...legacy)
    // Source keys hash the agent id, so they must be recomputed or a rescan duplicates rows.
    const records = this.db
      .prepare(`SELECT * FROM source_records WHERE agent_id IN (${marks})`)
      .all(...legacy) as Row[]
    for (const row of records) {
      const key = sourceKeyFor('claude', str(row.path), str(row.ref) || undefined)
      this.db.prepare('DELETE FROM source_records WHERE source_key = ?').run(key)
      this.db
        .prepare(
          `UPDATE source_records SET source_key = ?, agent_id = 'claude', agent_name = 'Claude' WHERE source_key = ?`
        )
        .run(key, str(row.source_key))
    }
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

  pruneAgents(keepIds: string[]): void {
    const keep = new Set(keepIds)
    const rows = this.db.prepare('SELECT id FROM agents').all() as Row[]
    for (const row of rows) {
      const id = str(row.id)
      if (!keep.has(id)) this.db.prepare('DELETE FROM agents WHERE id = ?').run(id)
    }
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
      .prepare(`
        SELECT s.agent_id,
               COUNT(DISTINCT s.memory_id) AS memories,
               COUNT(*) AS sources
        FROM sources s
        JOIN memories m ON m.id = s.memory_id
        WHERE m.archived = 0 AND (m.superseded_by IS NULL OR m.superseded_by = '')
        GROUP BY s.agent_id
      `)
      .all() as Row[]
    const countMap = new Map(
      counts.map((c) => [str(c.agent_id), { memories: num(c.memories), sources: num(c.sources) }])
    )
    const agents: AgentSummary[] = rows.map((row) => {
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
        mcpMode: str(row.mcp_config_path) ? 'config' : null,
        appVersion: null,
        note: null
      }
    })
    return agents.sort(
      (left, right) =>
        Number(right.installed) - Number(left.installed) ||
        right.memoryCount - left.memoryCount ||
        right.sourceCount - left.sourceCount ||
        left.name.localeCompare(right.name)
    )
  }

  upsertMemory(input: UpsertMemoryInput): void {
    const hash = contentHash(input.content)
    const kind = normalizeMemoryKind(input.kind, input.content)
    const scope = normalizeMemoryScope(input.scope, input.project)
    const authority = normalizeMemoryAuthority(input.authority)
    const status = normalizeMemoryStatus(input.status, kind)
    const summary = summaryOf(input.content, input.summary)
    const supersededBy =
      input.supersededBy === undefined ? null : input.supersededBy || ''
    const sourceMissing =
      input.sourceMissing === undefined ? null : input.sourceMissing ? 1 : 0
    this.db
      .prepare(`
        INSERT INTO memories(id, title, summary, content, kind, scope, authority, status, project, tags, created_at, updated_at, archived, pinned, superseded_by, source_missing, hash, origin, file_path)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), ?, 'shared', ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          content = excluded.content,
          kind = excluded.kind,
          scope = excluded.scope,
          authority = excluded.authority,
          status = excluded.status,
          project = excluded.project,
          tags = excluded.tags,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          archived = excluded.archived,
          pinned = excluded.pinned,
          superseded_by = COALESCE(?, memories.superseded_by),
          source_missing = COALESCE(?, memories.source_missing),
          hash = excluded.hash,
          file_path = COALESCE(excluded.file_path, memories.file_path)
      `)
      .run(
        input.id,
        input.title,
        summary,
        input.content,
        kind,
        scope,
        authority,
        status,
        input.project,
        JSON.stringify(input.tags),
        input.createdAt,
        input.updatedAt,
        input.archived || status === 'archived' ? 1 : 0,
        input.pinned ? 1 : 0,
        supersededBy,
        sourceMissing,
        hash,
        input.filePath ?? null,
        supersededBy,
        sourceMissing
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
      summary: memory.summary,
      content: memory.content,
      kind: memory.kind,
      scope: memory.scope,
      authority: memory.authority,
      status: memory.status,
      project: memory.project,
      tags: memory.tags,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      archived: memory.archived,
      pinned: memory.pinned,
      supersededBy: memory.supersededBy,
      sourceMissing: memory.sourceMissing,
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
    const result = this.db
      .prepare(
        "UPDATE memories SET archived = 1, status = 'archived', updated_at = ? WHERE id = ?"
      )
      .run(Date.now(), id)
    this.reindex(id)
    return result.changes > 0
  }

  update(id: string, patch: Partial<UpsertMemoryInput>): MemoryDetail | null {
    const current = this.getMemory(id)
    if (!current) return null
    this.upsertMemory({
      id,
      title: patch.title ?? current.title,
      summary: patch.summary ?? current.summary,
      content: patch.content ?? current.content,
      kind: normalizeMemoryKind(patch.kind ?? current.kind, patch.content ?? current.content),
      scope: patch.scope ?? current.scope,
      authority: patch.authority ?? current.authority,
      status: patch.status ?? current.status,
      project: patch.project !== undefined ? patch.project : current.project,
      tags: patch.tags ?? current.tags,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      archived: patch.archived ?? current.archived,
      pinned: patch.pinned ?? current.pinned,
      supersededBy: patch.supersededBy,
      sourceMissing: patch.sourceMissing,
      filePath: patch.filePath
    })
    return this.getMemory(id)
  }

  listMemories(options: SearchQuery = {}): MemorySummary[] {
    const limit = options.limit ?? 100
    const filters = this.queryFilters(options)
    const rows = this.db
      .prepare(
        `SELECT m.* FROM memories m
         WHERE ${filters.sql}
         ORDER BY m.updated_at DESC LIMIT ?`
      )
      .all(...filters.params, limit) as Row[]
    return this.filterMemoryLayers(this.rowsToSummaries(rows), options.includeEvidence ?? true)
  }

  listPulseMemories(): PulseMemory[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, content, kind, created_at, updated_at
         FROM memories
         WHERE archived = 0 AND (superseded_by IS NULL OR superseded_by = '')
         ORDER BY updated_at DESC`
      )
      .all() as Row[]
    return this.rowsToPulseMemories(rows)
  }

  search(options: SearchQuery = {}): MemorySummary[] {
    const query = options.query?.trim() ?? ''
    const limit = options.limit ?? 60
    if (!query) return this.listMemories({ ...options, limit })

    const filters = this.queryFilters(options)
    const results = new Map<string, MemorySummary>()
    const ftsQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token.replace(/"/g, '""')}"*`)
      .join(' OR ')

    try {
      const rows = this.db
        .prepare(
          `SELECT m.*, bm25(memories_fts) AS score
           FROM memories_fts JOIN memories m ON m.id = memories_fts.id
           WHERE memories_fts MATCH ? AND ${filters.sql}
           ORDER BY score LIMIT ?`
        )
        .all(ftsQuery, ...filters.params, limit * 2) as Row[]
      for (const memory of this.rowsToSummaries(rows, true)) {
        results.set(memory.id, memory)
      }
    } catch {
      // Malformed FTS query: fall through to LIKE search.
    }

    const like = `%${query.replace(/[%_]/g, '')}%`
    const rows = this.db
      .prepare(
        `SELECT m.* FROM memories m
         WHERE ${filters.sql}
           AND (m.title LIKE ? OR m.content LIKE ? OR m.tags LIKE ? OR m.project LIKE ?)
         ORDER BY m.updated_at DESC LIMIT ?`
      )
      .all(...filters.params, like, like, like, like, limit) as Row[]
    for (const memory of this.rowsToSummaries(rows)) {
      if (!results.has(memory.id)) results.set(memory.id, memory)
    }

    let list = [...results.values()]
    if (options.agentId) {
      list = list.filter((memory) =>
        memory.sources.some((source) => source.agentId === options.agentId)
      )
    }
    return this.filterMemoryLayers(list, options.includeEvidence ?? true).slice(0, limit)
  }

  private queryFilters(options: SearchQuery): { sql: string; params: Array<string | number> } {
    const clauses: string[] = []
    const params: Array<string | number> = []
    if (!options.includeArchived) clauses.push('m.archived = 0')
    if (!options.includeSuperseded) {
      clauses.push("(m.superseded_by IS NULL OR m.superseded_by = '')")
    }
    if (options.agentId) {
      clauses.push(
        'EXISTS (SELECT 1 FROM sources s WHERE s.memory_id = m.id AND s.agent_id = ?)'
      )
      params.push(options.agentId)
    }
    if (options.scope) {
      clauses.push('m.scope = ?')
      params.push(options.scope)
    }
    if (options.project) {
      // A project query means "memories that apply here": the project itself
      // plus user-scope memories that are not tied to another repository.
      clauses.push(`(
        m.scope = 'user' OR (
          m.project IS NOT NULL AND (
            LOWER(m.project) = LOWER(?) OR
            LOWER(m.project) LIKE LOWER(?) OR
            LOWER(?) LIKE '%' || LOWER(m.project) || '%'
          )
        )
      )`)
      params.push(options.project, `%${options.project}%`, options.project)
    }
    return {
      sql: clauses.length ? clauses.join(' AND ') : '1 = 1',
      params
    }
  }

  private filterMemoryLayers(
    memories: MemorySummary[],
    includeEvidence: boolean
  ): MemorySummary[] {
    return memories.filter((memory) => {
      const category = categoryForKind(memory.kind)
      if (!includeEvidence && category === 'evidence') return false
      return true
    })
  }

  counts(): Counts {
    const memories = this.db
      .prepare(
        "SELECT COUNT(*) AS c FROM memories WHERE archived = 0 AND (superseded_by IS NULL OR superseded_by = '')"
      )
      .get() as Row
    const agents = this.db
      .prepare('SELECT COUNT(*) AS c FROM agents WHERE installed = 1 AND shared = 1')
      .get() as Row
    const sources = this.db
      .prepare(`
        SELECT COUNT(*) AS c FROM sources s
        JOIN memories m ON m.id = s.memory_id
        WHERE m.archived = 0 AND (m.superseded_by IS NULL OR m.superseded_by = '')
      `)
      .get() as Row
    const echoes = this.db
      .prepare(`
        SELECT COUNT(*) AS c FROM (
          SELECT s.memory_id FROM sources s
          JOIN memories m ON m.id = s.memory_id
          WHERE m.archived = 0 AND (m.superseded_by IS NULL OR m.superseded_by = '')
          GROUP BY s.memory_id HAVING COUNT(DISTINCT s.agent_id) > 1
        )
      `)
      .get() as Row
    const superseded = this.db
      .prepare(
        "SELECT COUNT(*) AS c FROM memories WHERE archived = 0 AND superseded_by IS NOT NULL AND superseded_by != ''"
      )
      .get() as Row
    const sourceMissing = this.db
      .prepare('SELECT COUNT(*) AS c FROM memories WHERE archived = 0 AND source_missing = 1')
      .get() as Row
    return {
      memories: num(memories.c),
      agents: num(agents.c),
      sources: num(sources.c),
      echoes: num(echoes.c),
      superseded: num(superseded.c),
      sourceMissing: num(sourceMissing.c)
    }
  }

  health(): MemoryHealth {
    const now = Date.now()
    const counts = this.counts()
    const superseded = counts.superseded
    const sourceMissing = counts.sourceMissing
    const oversized = this.db
      .prepare('SELECT COUNT(*) AS c FROM memories WHERE archived = 0 AND length(content) > 8000')
      .get() as Row
    const stale = this.db
      .prepare(`
        SELECT COUNT(*) AS c FROM memories
        WHERE archived = 0 AND (superseded_by IS NULL OR superseded_by = '')
          AND updated_at < ?
      `)
      .get(now - 180 * 86_400_000) as Row
    const indexes = this.db
      .prepare("SELECT content FROM memories WHERE archived = 0 AND tags LIKE '%memory-index%'")
      .all() as Row[]
    const emptyIndexes = indexes.filter((row) => !hasIndexEntries(str(row.content))).length
    return {
      superseded,
      sourceMissing,
      oversized: num(oversized.c),
      stale: num(stale.c),
      emptyIndexes,
      lastConsolidationAt: this.metaNumber('lastConsolidationAt'),
      lastConsolidation: this.lastConsolidation()
    }
  }

  private metaNumber(key: string): number | null {
    const value = Number(this.getMeta(key))
    return Number.isFinite(value) && value > 0 ? value : null
  }

  private lastConsolidation(): ConsolidationResult | null {
    const raw = this.getMeta('lastConsolidationResult')
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as ConsolidationResult
      if (parsed && typeof parsed.finishedAt === 'number') return parsed
    } catch {
      // A malformed result should not hide the rest of the health report.
    }
    return null
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

  getSourceRecord(sourceKey: string): SourceRecord | null {
    const row = this.db
      .prepare('SELECT * FROM source_records WHERE source_key = ?')
      .get(sourceKey) as Row | undefined
    return row ? this.rowToSourceRecord(row) : null
  }

  /**
   * One memory can hold several sources with identical content. Each source may
   * project that content with its own title, tags and kind, so only one of them
   * may define the memory's presentation. For memories without a source-derived
   * id, the source seen first owns it; that choice never changes, so echoes
   * cannot rewrite metadata on every refresh.
   */
  oldestSourceKeyFor(memoryId: string): string | null {
    const row = this.db
      .prepare(`
        SELECT source_key FROM source_records
        WHERE memory_id = ?
        ORDER BY first_seen_at ASC, source_key ASC
        LIMIT 1
      `)
      .get(memoryId) as Row | undefined
    return row ? str(row.source_key) || null : null
  }

  upsertSourceRecord(input: SourceRecord): void {
    this.db
      .prepare(`
        INSERT INTO source_records(
          source_key, agent_id, agent_name, path, ref, memory_id, content_hash,
          title, first_seen_at, last_seen_at, updated_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_key) DO UPDATE SET
          agent_name = excluded.agent_name,
          path = excluded.path,
          ref = excluded.ref,
          memory_id = excluded.memory_id,
          content_hash = excluded.content_hash,
          title = excluded.title,
          last_seen_at = excluded.last_seen_at,
          updated_at = CASE
            WHEN source_records.memory_id != excluded.memory_id
              OR source_records.content_hash != excluded.content_hash
              OR source_records.title != excluded.title
              OR IFNULL(source_records.ref, '') != IFNULL(excluded.ref, '')
            THEN excluded.updated_at
            ELSE source_records.updated_at
          END
      `)
      .run(
        input.sourceKey,
        input.agentId,
        input.agentName,
        input.path,
        input.ref ?? null,
        input.memoryId,
        input.contentHash,
        input.title,
        input.firstSeenAt,
        input.lastSeenAt,
        input.updatedAt
      )
  }

  countSourceRecordsUpdatedSince(since: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM source_records WHERE updated_at >= ?')
      .get(since) as Row
    return num(row.c)
  }

  consolidationCandidates(): ConsolidationCandidate[] {
    const rows = this.db
      .prepare(`
        SELECT m.id, m.title, m.summary, m.content, m.kind, m.authority, m.project,
               m.created_at, m.updated_at, s.agent_id, s.ref
        FROM memories m
        JOIN sources s ON s.memory_id = m.id
        WHERE m.archived = 0
          AND (m.superseded_by IS NULL OR m.superseded_by = '')
          AND m.authority IN ('agent_observed', 'inferred')
        ORDER BY m.id, s.imported_at ASC
      `)
      .all() as Row[]
    const byId = new Map<string, ConsolidationCandidate>()
    for (const row of rows) {
      const id = str(row.id)
      const candidate =
        byId.get(id) ??
        {
          id,
          title: str(row.title),
          summary: str(row.summary),
          content: str(row.content),
          kind: normalizeMemoryKind(str(row.kind), str(row.content)),
          authority: normalizeMemoryAuthority(str(row.authority)),
          project: str(row.project) || null,
          createdAt: num(row.created_at),
          updatedAt: num(row.updated_at),
          agentIds: [],
          refs: []
        }
      const agentId = str(row.agent_id)
      const ref = str(row.ref)
      if (agentId && !candidate.agentIds.includes(agentId)) candidate.agentIds.push(agentId)
      if (ref && !candidate.refs.includes(ref)) candidate.refs.push(ref)
      byId.set(id, candidate)
    }
    return [...byId.values()]
  }

  clearSourceMissing(memoryId: string): boolean {
    const result = this.db
      .prepare('UPDATE memories SET source_missing = 0 WHERE id = ? AND source_missing = 1')
      .run(memoryId)
    return result.changes > 0
  }

  markSourceMissingForAgent(agentId: string, since: number): string[] {
    this.db
      .prepare(`
        UPDATE memories SET source_missing = 0
        WHERE id IN (
          SELECT DISTINCT memory_id FROM source_records
          WHERE agent_id = ? AND last_seen_at >= ?
        )
      `)
      .run(agentId, since)
    const rows = this.db
      .prepare(`
        SELECT id FROM memories
        WHERE archived = 0
          AND source_missing = 0
          AND id IN (
            SELECT memory_id FROM source_records
            WHERE agent_id = ?
            GROUP BY memory_id
            HAVING MAX(last_seen_at) < ?
          )
          AND id NOT IN (
            SELECT DISTINCT memory_id FROM source_records WHERE last_seen_at >= ?
          )
      `)
      .all(agentId, since, since) as Row[]
    const missing = rows.map((row) => str(row.id))
    const update = this.db.prepare('UPDATE memories SET source_missing = 1 WHERE id = ?')
    for (const id of missing) update.run(id)
    return missing
  }

  recordConsolidation(result: ConsolidationResult): void {
    this.db
      .prepare(`
        INSERT INTO consolidations(started_at, finished_at, dry_run, candidates, groups, merged)
        VALUES(?, ?, ?, ?, ?, ?)
      `)
      .run(
        result.startedAt,
        result.finishedAt,
        result.dryRun ? 1 : 0,
        result.candidates,
        result.groups,
        result.merged
      )
  }

  findMemoryIdBySource(agentId: string, pathValue: string, ref?: string): string | null {
    const row = this.db
      .prepare(`
        SELECT memory_id FROM sources
        WHERE agent_id = ? AND path = ? AND ${ref ? 'ref = ?' : 'ref IS NULL'}
        ORDER BY imported_at DESC
        LIMIT 1
      `)
      .get(agentId, pathValue, ...(ref ? [ref] : [])) as Row | undefined
    return row ? str(row.memory_id) || null : null
  }

  sourceLinksForBootstrap(): Array<
    Omit<SourceRecord, 'sourceKey' | 'firstSeenAt' | 'lastSeenAt'> & { importedAt: number }
  > {
    const rows = this.db
      .prepare(`
        SELECT s.agent_id, s.agent_name, s.path, s.ref, s.memory_id, s.imported_at,
               m.hash, m.title
        FROM sources s
        JOIN memories m ON m.id = s.memory_id
        WHERE s.agent_id != 'dachshund'
        ORDER BY s.imported_at DESC
      `)
      .all() as Row[]
    return rows.map((row) => ({
      agentId: str(row.agent_id),
      agentName: str(row.agent_name),
      path: str(row.path),
      ref: str(row.ref) || undefined,
      memoryId: str(row.memory_id),
      contentHash: str(row.hash),
      title: str(row.title),
      updatedAt: num(row.imported_at),
      importedAt: num(row.imported_at)
    }))
  }

  private rowsToSummaries(rows: Row[], withScore = false): MemorySummary[] {
    if (!rows.length) return []
    const ids = rows.map((r) => str(r.id))
    const sourceMap = this.sourcesFor(ids)
    return rows.map((row) => {
      const id = str(row.id)
      const sources = sourceMap.get(id) ?? []
      const content = str(row.content)
      const summary = summaryOf(content, str(row.summary))
      return {
        id,
        title: str(row.title),
        summary,
        excerpt: summary || excerptOf(content),
        kind: normalizeMemoryKind(str(row.kind), content),
        scope: normalizeMemoryScope(str(row.scope), str(row.project) || null),
        authority: normalizeMemoryAuthority(str(row.authority)),
        status: normalizeMemoryStatus(str(row.status), str(row.kind)),
        project: str(row.project) || null,
        tags: parseTags(row.tags),
        createdAt: num(row.created_at),
        updatedAt: num(row.updated_at),
        archived: bool(row.archived),
        pinned: bool(row.pinned),
        supersededBy: str(row.superseded_by) || null,
        sourceMissing: bool(row.source_missing),
        sources,
        echoCount: new Set(sources.map((s) => s.agentId)).size,
        score: withScore && row.score !== undefined ? num(row.score) : undefined
      }
    })
  }

  private rowsToPulseMemories(rows: Row[]): PulseMemory[] {
    if (!rows.length) return []
    const sourceMap = this.sourcesFor(rows.map((row) => str(row.id)))
    return rows.map((row) => {
      const id = str(row.id)
      const sources = sourceMap.get(id) ?? []
      return {
        id,
        title: str(row.title),
        kind: normalizeMemoryKind(str(row.kind), str(row.content)),
        createdAt: num(row.created_at),
        updatedAt: num(row.updated_at),
        sources,
        echoCount: new Set(sources.map((source) => source.agentId)).size
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

  private rowToSourceRecord(row: Row): SourceRecord {
    return {
      sourceKey: str(row.source_key),
      agentId: str(row.agent_id),
      agentName: str(row.agent_name),
      path: str(row.path),
      ref: str(row.ref) || undefined,
      memoryId: str(row.memory_id),
      contentHash: str(row.content_hash),
      title: str(row.title),
      firstSeenAt: num(row.first_seen_at),
      lastSeenAt: num(row.last_seen_at),
      updatedAt: num(row.updated_at)
    }
  }
}

export interface SourceRecord {
  sourceKey: string
  agentId: string
  agentName: string
  path: string
  ref?: string
  memoryId: string
  contentHash: string
  title: string
  firstSeenAt: number
  lastSeenAt: number
  updatedAt: number
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
    claude: 'CL',
    codex: 'CX',
    'gemini-cli': 'GM',
    cursor: 'CU',
    copilot: 'GH',
    opencode: 'OC',
    workbuddy: 'WB',
    doubao: 'DB',
    trae: 'TR',
    hermes: 'HE',
    pi: 'PI',
    zcode: 'ZC',
    'deepseek-harness': 'DS',
    dachshund: 'DD'
  }
  return known[id] ?? monogramFor(name)
}

export function accentFor(id: string): string {
  const colors: Record<string, string> = {
    claude: '#C0663B',
    codex: '#2E2B27',
    'gemini-cli': '#4C6F91',
    cursor: '#66765A',
    copilot: '#5C6570',
    opencode: '#8A6A4F',
    workbuddy: '#01C886',
    doubao: '#1E37FC',
    trae: '#111111',
    hermes: '#D45B90',
    pi: '#1C1C1C',
    zcode: '#2D2D2D',
    'deepseek-harness': '#4D6BFE',
    dachshund: '#B5542F'
  }
  return colors[id] ?? '#7A7064'
}
