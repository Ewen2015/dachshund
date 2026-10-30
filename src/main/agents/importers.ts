import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { DatabaseSync } from 'node:sqlite'
import type { ImportedMemory } from '../../shared/types'
import { expandHome } from '../paths'
import type { AgentDefinition } from './registry'

const MAX_FILE_BYTES = 1_200_000
const MAX_FILES = 1200

function walk(
  root: string,
  predicate: (file: string) => boolean,
  maxFiles = MAX_FILES
): string[] {
  const out: string[] = []
  const visit = (current: string): void => {
    if (out.length >= maxFiles) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile() && predicate(full)) out.push(full)
      if (out.length >= maxFiles) return
    }
  }
  visit(root)
  return out
}

function readText(file: string): string | null {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_FILE_BYTES) return null
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function times(file: string): { created: number; updated: number } {
  try {
    const stat = fs.statSync(file)
    return {
      created: stat.birthtimeMs || stat.mtimeMs,
      updated: stat.mtimeMs
    }
  } catch {
    const now = Date.now()
    return { created: now, updated: now }
  }
}

function firstHeading(content: string): string | null {
  const match = content.match(/^#{1,3}\s+(.+)$/m)
  return match ? match[1].trim() : null
}

function humanize(input: string): string {
  const cleaned = input
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Memory'
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim().replace(/^#/, ''))
      .filter(Boolean)
  }
  return []
}

function toTime(value: unknown, fallback: number): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value < 10_000_000_000 ? value * 1000 : value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

function parseMarkdownFile(
  file: string,
  agent: AgentDefinition,
  defaults: { kind?: string; project?: string | null; tags?: string[] } = {}
): ImportedMemory | null {
  const raw = readText(file)
  if (!raw) return null
  return parseMarkdownRaw(file, agent, raw, defaults)
}

function parseMarkdownRaw(
  file: string,
  agent: AgentDefinition,
  raw: string,
  defaults: { kind?: string; project?: string | null; tags?: string[] } = {}
): ImportedMemory | null {
  const parsed = matter(raw)
  const body = parsed.content.trim()
  if (!body) return null
  const data = parsed.data as Record<string, unknown>
  const { created, updated } = times(file)
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {}
  const title =
    (typeof data.title === 'string' && data.title.trim()) ||
    (typeof data.description === 'string' && data.description.trim()) ||
    (typeof data.name === 'string' && humanize(data.name)) ||
    firstHeading(body) ||
    humanize(path.basename(file, path.extname(file)))
  return {
    title: title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title,
    content: body,
    kind:
      (typeof data.kind === 'string' && data.kind) ||
      (typeof data.type === 'string' && data.type) ||
      (typeof meta.type === 'string' && meta.type) ||
      defaults.kind ||
      'fact',
    project:
      (typeof data.project === 'string' && data.project) ||
      defaults.project ||
      null,
    tags: [...new Set([...asTags(data.tags ?? meta.tags), ...(defaults.tags ?? [])])],
    createdAt: toTime(data.created, created),
    updatedAt: toTime(data.updated, updated),
    agentId: agent.id,
    agentName: agent.name,
    sourcePath: file,
    sourceRef:
      (typeof meta.originSessionId === 'string' && meta.originSessionId) ||
      (typeof data.session === 'string' && data.session) ||
      undefined
  }
}

function stripWorkBuddyMetadata(raw: string): string {
  return raw
    .replace(/\n?<!--\s*RAW_JSON_START[\s\S]*?RAW_JSON_END\s*-->\s*$/m, '')
    .trim()
}

function workBuddyWorkspaces(agent: AgentDefinition): string[] {
  const dbFile = path.join(agent.home, 'workbuddy.db')
  if (!fs.existsSync(dbFile)) return []
  let db: DatabaseSync | null = null
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    const rows = db.prepare('SELECT path FROM workspaces ORDER BY last_opened_at DESC').all() as Array<
      Record<string, unknown>
    >
    return [...new Set(rows.map((row) => row.path).filter((value): value is string => typeof value === 'string'))]
  } catch {
    return []
  } finally {
    try {
      db?.close()
    } catch {
      // WorkBuddy may hold the database while running.
    }
  }
}

function importWorkBuddy(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const seen = new Set<string>()

  const addFile = (
    file: string,
    defaults: { kind?: string; project?: string | null; tags?: string[] }
  ): void => {
    if (seen.has(file)) return
    const raw = readText(file)
    if (!raw) return
    const memory = parseMarkdownRaw(file, agent, stripWorkBuddyMetadata(raw), defaults)
    if (!memory) return
    seen.add(file)
    out.push(memory)
  }

  addFile(path.join(agent.home, 'IDENTITY.md'), {
    kind: 'profile',
    tags: ['workbuddy', 'assistant-identity']
  })
  addFile(path.join(agent.home, 'USER.md'), {
    kind: 'profile',
    tags: ['workbuddy', 'user-profile']
  })
  for (const file of walk(path.join(agent.home, 'memory'), (item) => item.endsWith('.md'), 120)) {
    addFile(file, { kind: 'profile', tags: ['workbuddy', 'user-memory'] })
  }

  try {
    for (const entry of fs.readdirSync(agent.home, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('user-')) continue
      addFile(path.join(agent.home, entry.name, 'USER.md'), {
        kind: 'profile',
        tags: ['workbuddy', 'user-profile']
      })
    }
  } catch {
    // The root memory files above are still useful without a user directory.
  }

  for (const workspace of workBuddyWorkspaces(agent)) {
    const project = path.basename(workspace)
    const memoryRoot = path.join(workspace, '.workbuddy', 'memory')
    for (const file of walk(memoryRoot, (item) => item.endsWith('.md'), 160)) {
      addFile(file, { kind: 'project', project, tags: ['workbuddy', 'workspace-memory'] })
    }
  }

  return out
}

function importDoubao(agent: AgentDefinition): ImportedMemory[] {
  const workspace = path.join(agent.home, 'Default', '.doubao', 'agent_mode', 'workspace')
  const files: Array<{ file: string; session?: string }> = []
  const globalMemory = path.join(workspace, 'memory', 'MEMORY.md')
  if (fs.existsSync(globalMemory)) files.push({ file: globalMemory })

  const sessionsRoot = path.join(workspace, '.sessions')
  try {
    for (const entry of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const memoryRoot = path.join(sessionsRoot, entry.name, 'memory')
      for (const file of walk(memoryRoot, (item) => item.endsWith('.md'), 40)) {
        files.push({ file, session: entry.name })
      }
    }
  } catch {
    // Older Doubao builds may not have Agent Mode sessions.
  }

  return files
    .map(({ file, session }) =>
      parseMarkdownFile(file, agent, {
        kind: 'project',
        project: session ? `Doubao session ${session.slice(-6)}` : null,
        tags: ['doubao', 'agent-mode']
      })
    )
    .filter((item): item is ImportedMemory => Boolean(item))
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

function projectFromTraeDir(file: string): string | null {
  // ~/.trae-cn/memory/projects/<encoded-cwd>/<date>/session_memory_*.jsonl
  const encoded = path.basename(path.dirname(path.dirname(file)))
  const stripped = encoded.replace(/--p2-[a-z0-9]+$/i, '').replace(/^-/, '')
  const decoded = stripped.replace(/-/g, '/')
  if (decoded.includes('TRAE/SOLO/CN')) return 'TRAE SOLO'
  const parts = decoded.split('/').filter(Boolean)
  return parts.length ? parts.slice(-2).join('/') : null
}

function traeSessionMemory(
  file: string,
  line: string,
  lineNumber: number,
  agent: AgentDefinition,
  project: string | null
): ImportedMemory | null {
  let entry: Record<string, unknown>
  try {
    const parsed = JSON.parse(line) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    entry = parsed as Record<string, unknown>
  } catch {
    return null
  }

  const intent = typeof entry.intent === 'string' ? entry.intent.trim() : ''
  const outcome = typeof entry.outcome === 'string' ? entry.outcome.trim() : ''
  const actions = stringList(entry.actions)
  const learned = stringList(entry.learned)
  if (!intent && !outcome && actions.length === 0 && learned.length === 0) return null

  const sections: string[] = []
  if (outcome) sections.push(`## Outcome\n\n${outcome}`)
  if (learned.length) {
    sections.push(`## Learned\n\n${learned.map((item) => `- ${item}`).join('\n')}`)
  }
  if (actions.length) {
    sections.push(`## Actions\n\n${actions.map((item) => `- ${item}`).join('\n')}`)
  }
  const content = sections.join('\n\n').trim()
  if (!content) return null

  const meta =
    entry.compact_summary_meta &&
    typeof entry.compact_summary_meta === 'object' &&
    !Array.isArray(entry.compact_summary_meta)
      ? (entry.compact_summary_meta as Record<string, unknown>)
      : {}
  const { created, updated } = times(file)
  const timestamp = toTime(
    meta.created_at_ms,
    toTime(entry.message_summary_time, updated || created)
  )
  const messageId = typeof entry.message_id === 'string' ? entry.message_id.trim() : ''
  const title =
    intent || outcome || learned[0] || `Trae session ${messageId.slice(-6) || lineNumber}`

  return {
    title: title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title,
    content,
    kind: 'project',
    project,
    tags: ['trae', 'session-memory'],
    createdAt: timestamp,
    updatedAt: timestamp,
    agentId: agent.id,
    agentName: agent.name,
    sourcePath: file,
    sourceRef: messageId || `${path.basename(file)}:${lineNumber}`
  }
}

function importTraeTopics(
  file: string,
  agent: AgentDefinition,
  project: string | null
): ImportedMemory[] {
  const raw = readText(file)
  if (!raw) return []
  const { created, updated } = times(file)
  const memories: ImportedMemory[] = []
  const lines = raw.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue
    const match = line.match(
      /^\[session_id:\s*([^|\]]+)\|\s*topic_summary_time:\s*([^\]]+)\]\s*(.+)$/
    )
    const sessionId = match ? match[1].trim() : ''
    const summary = (match ? match[3] : line).trim()
    if (summary.length <= 20) continue
    const timestamp = toTime(match ? match[2] : '', updated || created)
    memories.push({
      title: summary.length > 110 ? `${summary.slice(0, 107).trimEnd()}…` : summary,
      content: summary,
      kind: 'project',
      project,
      tags: ['trae', 'topic-summary'],
      createdAt: timestamp,
      updatedAt: timestamp,
      agentId: agent.id,
      agentName: agent.name,
      sourcePath: file,
      sourceRef: sessionId || `topics:${index + 1}`
    })
  }
  return memories
}

function importTrae(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const roots = [...new Set([agent.home, ...(agent.homes ?? [])])]
  for (const root of roots) {
    const projectsRoot = path.join(root, 'memory', 'projects')
    const files = walk(
      projectsRoot,
      (file) => file.endsWith('.jsonl') || path.basename(file) === 'topics.md',
      400
    )
    for (const file of files) {
      const project = projectFromTraeDir(file)
      if (path.basename(file) === 'topics.md') {
        out.push(...importTraeTopics(file, agent, project))
        continue
      }
      const raw = readText(file)
      if (!raw) continue
      raw.split('\n').forEach((line, index) => {
        if (!line.trim()) return
        const memory = traeSessionMemory(file, line, index + 1, agent, project)
        if (memory) out.push(memory)
      })
    }
  }
  return out
}

function projectFromClaudeDir(memoryFile: string): string | null {
  // ~/.claude/projects/<encoded-cwd>/memory/<file>.md
  const encoded = path.basename(path.dirname(path.dirname(memoryFile)))
  if (!encoded) return null
  const human = encoded
    .replace(/^-/, '')
    .replace(/^Users-[^-]+-/, '~/')
    .replace(/-/g, '/')
  const parts = human.split('/').filter(Boolean)
  return parts.length ? parts.slice(-2).join('/') : human
}

function importClaude(agent: AgentDefinition): ImportedMemory[] {
  const root = path.join(agent.home, 'projects')
  const memoryFiles = walk(
    root,
    (file) => file.endsWith('.md') && file.includes(`${path.sep}memory${path.sep}`)
  )
  const globalFiles = [
    path.join(agent.home, 'CLAUDE.md'),
    ...walk(path.join(agent.home, 'memory'), (file) => file.endsWith('.md'), 80)
  ].filter((file) => fs.existsSync(file))
  const files = [...memoryFiles, ...globalFiles]
  return files
    .map((file) =>
      parseMarkdownFile(file, agent, {
        kind: 'project',
        project: projectFromClaudeDir(file)
      })
    )
    .filter((item): item is ImportedMemory => Boolean(item))
}

function codexTags(section: string): string[] {
  const match = section.match(/^## keywords\s*\n+([\s\S]*?)(?=\n## |\n*$)/m)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .flatMap((line) => line.split(','))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function codexProject(section: string): string | null {
  const match = section.match(/cwd=([^;,\n]+)/)
  if (!match) return null
  return match[1].trim()
}

function importCodexMarkdown(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const memoriesDir = path.join(agent.home, 'memories')
  const mainFile = path.join(memoriesDir, 'MEMORY.md')
  const rawMain = readText(mainFile)
  if (rawMain) {
    const { created, updated } = times(mainFile)
    const groups = rawMain.split(/^## Task Group:\s*/m).slice(1)
    for (const group of groups) {
      const lines = group.split('\n')
      const title = (lines.shift() ?? '').trim() || 'Codex task memory'
      const body = lines.join('\n').trim()
      if (!body) continue
      out.push({
        title,
        content: body,
        kind: 'project',
        project: codexProject(group),
        tags: codexTags(group),
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: mainFile,
        sourceRef: `codex:group:${title}`
      })
    }
  }

  const rawFile = path.join(memoriesDir, 'raw_memories.md')
  const raw = readText(rawFile)
  if (raw) {
    const { created, updated } = times(rawFile)
    const threads = raw.split(/^## Thread\s+`?/m).slice(1)
    for (const thread of threads) {
      const [idLine, ...rest] = thread.split('\n')
      const threadId = idLine.replace(/`$/, '').trim()
      const body = rest.join('\n').trim()
      if (!body) continue
      const description = body.match(/^description:\s*(.+)$/m)?.[1]?.trim()
      out.push({
        title: description ? description.slice(0, 110) : `Codex thread ${threadId.slice(0, 8)}`,
        content: body,
        kind: 'lesson',
        project: body.match(/^cwd:\s*(.+)$/m)?.[1]?.trim() ?? null,
        tags: body.match(/^keywords:\s*(.+)$/m)?.[1]?.split(',').map((t) => t.trim()).filter(Boolean) ?? [],
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: rawFile,
        sourceRef: threadId
      })
    }
  }

  const summaryFile = path.join(memoriesDir, 'memory_summary.md')
  const summary = readText(summaryFile)
  if (summary) {
    const { created, updated } = times(summaryFile)
    out.push({
      title: 'Codex profile and preferences',
      content: summary,
      kind: 'profile',
      project: null,
      tags: ['profile', 'preferences'],
      createdAt: created,
      updatedAt: updated,
      agentId: agent.id,
      agentName: agent.name,
      sourcePath: summaryFile,
      sourceRef: 'codex:memory-summary'
    })
  }
  return out
}

function importCodexSqlite(agent: AgentDefinition): ImportedMemory[] {
  const candidates = [
    path.join(agent.home, 'sqlite', 'memories_1.sqlite'),
    path.join(agent.home, 'memories_1.sqlite')
  ].filter((file) => fs.existsSync(file))
  const out: ImportedMemory[] = []
  for (const file of candidates) {
    let db: DatabaseSync | null = null
    try {
      db = new DatabaseSync(file, { readOnly: true })
      const rows = db
        .prepare(
          'SELECT thread_id, raw_memory, rollout_summary, rollout_slug, generated_at FROM stage1_outputs'
        )
        .all() as Array<Record<string, unknown>>
      for (const row of rows) {
        const raw = typeof row.raw_memory === 'string' ? row.raw_memory.trim() : ''
        const summary = typeof row.rollout_summary === 'string' ? row.rollout_summary.trim() : ''
        const content = [summary, raw].filter(Boolean).join('\n\n')
        if (!content) continue
        const threadId = String(row.thread_id ?? '')
        const slug = typeof row.rollout_slug === 'string' ? row.rollout_slug : ''
        const generated = toTime(row.generated_at, Date.now())
        out.push({
          title: slug ? humanize(slug) : `Codex thread ${threadId.slice(0, 8)}`,
          content,
          kind: 'lesson',
          project: null,
          tags: ['codex', 'rollout'],
          createdAt: generated,
          updatedAt: generated,
          agentId: agent.id,
          agentName: agent.name,
          sourcePath: file,
          sourceRef: threadId
        })
      }
    } catch {
      // Codex may be holding a write lock or the schema may be newer.
    } finally {
      try {
        db?.close()
      } catch {
        // ignore
      }
    }
  }
  return out
}

function importGemini(agent: AgentDefinition): ImportedMemory[] {
  const files = [
    path.join(agent.home, 'GEMINI.md'),
    ...walk(agent.home, (file) => path.basename(file) === 'GEMINI.md', 40)
  ]
  return [...new Set(files)]
    .filter((file) => fs.existsSync(file))
    .map((file) => parseMarkdownFile(file, agent, { kind: 'profile' }))
    .filter((item): item is ImportedMemory => Boolean(item))
}

function importCursor(agent: AgentDefinition): ImportedMemory[] {
  const roots = [path.join(agent.home, 'rules'), path.join(agent.home, 'agents')]
  const files = roots.flatMap((root) =>
    walk(root, (file) => file.endsWith('.mdc') || file.endsWith('.md'), 300)
  )
  return files
    .map((file) => parseMarkdownFile(file, agent, { kind: 'rule' }))
    .filter((item): item is ImportedMemory => Boolean(item))
}

function importGeneric(agent: AgentDefinition, roots: string[]): ImportedMemory[] {
  const files = roots.flatMap((root) =>
    walk(root, (file) => file.endsWith('.md') || file.endsWith('.mdc'), 300)
  )
  return files
    .map((file) => parseMarkdownFile(file, agent))
    .filter((item): item is ImportedMemory => Boolean(item))
}

export function importAgentMemories(agent: AgentDefinition): ImportedMemory[] {
  let memories: ImportedMemory[] = []
  switch (agent.id) {
    case 'claude-code':
      memories = importClaude(agent)
      break
    case 'codex':
      memories = [...importCodexMarkdown(agent), ...importCodexSqlite(agent)]
      break
    case 'gemini-cli':
      memories = importGemini(agent)
      break
    case 'cursor':
      memories = importCursor(agent)
      break
    case 'copilot':
      memories = importGeneric(agent, [
        path.join(agent.home, 'memories'),
        path.join(agent.home, 'instructions')
      ])
      break
    case 'opencode':
      memories = importGeneric(agent, [
        path.join(agent.home, 'memory'),
        expandHome('~/.local/share/opencode/memory')
      ])
      break
    case 'windsurf':
      memories = importGeneric(agent, [path.join(agent.home, 'memories')])
      break
    case 'workbuddy':
      memories = importWorkBuddy(agent)
      break
    case 'doubao':
      memories = importDoubao(agent)
      break
    case 'trae':
      memories = importTrae(agent)
      break
    default:
      memories = []
  }
  const seen = new Set<string>()
  return memories.filter((memory) => {
    const key = `${memory.agentId}:${memory.sourcePath}:${memory.sourceRef ?? ''}:${memory.content}`
    if (seen.has(key)) return false
    seen.add(key)
    return memory.content.trim().length > 20
  })
}
