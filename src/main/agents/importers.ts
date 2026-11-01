import fs from 'node:fs'
import path from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import matter from 'gray-matter'
import { DatabaseSync } from 'node:sqlite'
import type { ImportedMemory } from '../../shared/types'
import { normalizeMemoryKind } from '../../shared/memory-taxonomy'
import { expandHome } from '../paths'
import { stripDeepSeekInstructions } from './deepseek-instructions'
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
    kind: normalizeMemoryKind(
      (typeof data.kind === 'string' && data.kind) ||
        (typeof data.type === 'string' && data.type) ||
        (typeof meta.type === 'string' && meta.type) ||
        defaults.kind ||
        'fact'
    ),
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
    kind: 'rule',
    tags: ['workbuddy', 'assistant-identity']
  })
  addFile(path.join(agent.home, 'USER.md'), {
    kind: 'profile',
    tags: ['workbuddy', 'user-profile']
  })
  for (const file of walk(
    path.join(agent.home, 'memory'),
    (item) => item.endsWith('.md') && path.basename(item) !== 'MEMORY.md',
    120
  )) {
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
    for (const file of walk(
      memoryRoot,
      (item) => item.endsWith('.md') && path.basename(item) !== 'MEMORY.md',
      160
    )) {
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

function projectFromTraeDir(file: string, levels = 2): string | null {
  // Session files live under <encoded-cwd>/<date>; project_memory.md lives one level up.
  let projectDir = path.dirname(file)
  for (let index = 1; index < levels; index += 1) {
    projectDir = path.dirname(projectDir)
  }
  const encoded = path.basename(projectDir)
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
    kind: 'episode',
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
      kind: 'episode',
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
    const profile = parseMarkdownFile(
      path.join(root, 'memory', 'user_profile.md'),
      agent,
      { kind: 'profile', tags: ['trae', 'user-profile'] }
    )
    if (profile) out.push(profile)

    const projectMemories = walk(
      projectsRoot,
      (file) => path.basename(file) === 'project_memory.md',
      400
    )
    for (const file of projectMemories) {
      const memory = parseMarkdownFile(file, agent, {
        kind: 'project',
        project: projectFromTraeDir(file, 1),
        tags: ['trae', 'project-memory']
      })
      if (memory) out.push(memory)
    }

    const episodeFiles = walk(
      projectsRoot,
      (file) => file.endsWith('.jsonl') || path.basename(file) === 'topics.md',
      400
    )
    for (const file of episodeFiles) {
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
    (file) =>
      file.endsWith('.md') &&
      file.includes(`${path.sep}memory${path.sep}`) &&
      path.basename(file) !== 'MEMORY.md'
  )
  const projectMemories = memoryFiles
    .map((file) =>
      parseMarkdownFile(file, agent, {
        kind: 'project',
        project: projectFromClaudeDir(file),
        tags: ['claude-code', 'auto-memory']
      })
    )
  const instructionFiles = [
    path.join(agent.home, 'CLAUDE.md'),
    ...walk(path.join(agent.home, 'rules'), (file) => file.endsWith('.md'), 160)
  ].filter((file) => fs.existsSync(file))
  const instructions = instructionFiles.map((file) =>
    parseMarkdownFile(file, agent, {
      kind: 'rule',
      tags: ['claude-code', 'instructions']
    })
  )
  const globalMemories = walk(
    path.join(agent.home, 'memory'),
    (file) => file.endsWith('.md') && path.basename(file) !== 'MEMORY.md',
    80
  ).map((file) =>
    parseMarkdownFile(file, agent, {
      kind: 'fact',
      tags: ['claude-code', 'global-memory']
    })
  )
  return [...projectMemories, ...instructions, ...globalMemories].filter(
    (item): item is ImportedMemory => Boolean(item)
  )
}

function isClaudeDesktopMemoryFile(file: string): boolean {
  const normalized = file.split(path.sep).join('/')
  return (
    /\/local-agent-mode-sessions\/[^/]+\/[^/]+\/(?:memory|agent\/memory|spaces\/[^/]+\/memory)\/.+\.md$/i.test(
      normalized
    ) && path.basename(file).toLowerCase() !== 'memory.md'
  )
}

function claudeDesktopSpace(file: string): { id: string; name: string } | null {
  const normalized = file.split(path.sep).join('/')
  const match = normalized.match(
    /\/local-agent-mode-sessions\/[^/]+\/[^/]+\/spaces\/([^/]+)\/memory\//i
  )
  if (!match) return null
  const id = match[1]
  const spacesMarker = `/spaces/${id}/memory/`
  const markerIndex = normalized.indexOf(spacesMarker)
  if (markerIndex < 0) return null
  const spacesFile = path.join(
    normalized.slice(0, markerIndex).split('/').join(path.sep),
    'spaces.json'
  )
  const raw = readText(spacesFile)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { spaces?: unknown }
      if (Array.isArray(parsed.spaces)) {
        for (const item of parsed.spaces) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue
          const space = item as Record<string, unknown>
          if (space.id === id && typeof space.name === 'string' && space.name.trim()) {
            return { id, name: space.name.trim() }
          }
        }
      }
    } catch {
      // A malformed index should not prevent other local memory files being read.
    }
  }
  return { id, name: `Claude Space ${id.slice(0, 8)}` }
}

function importClaudeDesktop(agent: AgentDefinition): ImportedMemory[] {
  const homes = [...new Set([agent.home, ...(agent.homes ?? [])])]
  const out: ImportedMemory[] = []
  for (const home of homes) {
    const sessionRoot = path.join(home, 'local-agent-mode-sessions')
    for (const file of walk(sessionRoot, isClaudeDesktopMemoryFile)) {
      const space = claudeDesktopSpace(file)
      const memory = parseMarkdownFile(file, agent, {
        kind: space ? 'project' : 'fact',
        project: space?.name ?? null,
        tags: [
          'claude-desktop',
          space ? 'space-memory' : 'local-memory',
          ...(space ? [`space:${space.id}`] : [])
        ]
      })
      if (!memory) continue
      if (space) memory.sourceRef = `space:${space.id}`
      out.push(memory)
    }
  }
  return out
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
          kind: summary ? 'episode' : 'lesson',
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
  const out: ImportedMemory[] = []
  for (const file of [...new Set(files)]) {
    const raw = readText(file)
    if (!raw) continue
    const marker = '## Gemini Added Memories'
    const markerIndex = raw.indexOf(marker)
    const added = markerIndex >= 0 ? raw.slice(markerIndex + marker.length).trim() : ''
    const instructions = markerIndex >= 0 ? raw.slice(0, markerIndex).trim() : raw
    const parsed = instructions
      ? parseMarkdownRaw(file, agent, instructions, {
          kind: 'rule',
          tags: ['gemini', 'instructions']
        })
      : null
    if (parsed) {
      parsed.sourceRef = `${path.basename(file)}:instructions`
      out.push(parsed)
    }
    if (added.length > 20) {
      const { created, updated } = times(file)
      out.push({
        title: 'Gemini added memories',
        content: added,
        kind: 'fact',
        project: null,
        tags: ['gemini', 'added-memory'],
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: file,
        sourceRef: `${path.basename(file)}:added-memories`
      })
    }
  }
  return out
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

function importCopilot(agent: AgentDefinition): ImportedMemory[] {
  const instructionFiles = walk(
    path.join(agent.home, 'instructions'),
    (file) => file.endsWith('.md') || file.endsWith('.mdc'),
    300
  )
  const memoryFiles = walk(
    path.join(agent.home, 'memories'),
    (file) => file.endsWith('.md'),
    300
  )
  return [
    ...instructionFiles.map((file) =>
      parseMarkdownFile(file, agent, {
        kind: 'rule',
        tags: ['copilot', 'instructions']
      })
    ),
    ...memoryFiles.map((file) =>
      parseMarkdownFile(file, agent, {
        kind: 'fact',
        tags: ['copilot', 'local-memory']
      })
    )
  ].filter((item): item is ImportedMemory => Boolean(item))
}

function importOpenCode(agent: AgentDefinition): ImportedMemory[] {
  const instruction = parseMarkdownFile(path.join(agent.home, 'AGENTS.md'), agent, {
    kind: 'rule',
    tags: ['opencode', 'instructions']
  })
  const memoryFiles = [
    ...walk(path.join(agent.home, 'memory'), (file) => file.endsWith('.md'), 300),
    ...walk(
      expandHome('~/.local/share/opencode/memory'),
      (file) => file.endsWith('.md'),
      300
    )
  ]
  return [
    ...(instruction ? [instruction] : []),
    ...memoryFiles.map((file) =>
      parseMarkdownFile(file, agent, {
        kind: 'fact',
        tags: ['opencode', 'local-memory']
      })
    )
  ].filter((item): item is ImportedMemory => Boolean(item))
}

function importWindsurf(agent: AgentDefinition): ImportedMemory[] {
  return walk(path.join(agent.home, 'memories'), (file) => file.endsWith('.md'), 300)
    .map((file) =>
      parseMarkdownFile(file, agent, {
        kind: 'project',
        tags: ['windsurf', 'workspace-memory']
      })
    )
    .filter((item): item is ImportedMemory => Boolean(item))
}

function memoryTitle(text: string, fallback: string): string {
  const firstLine =
    text
      .split('\n')
      .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '').trim())
      .find(Boolean) ?? fallback
  return firstLine.length > 110 ? `${firstLine.slice(0, 107).trimEnd()}…` : firstLine
}

function durableMemoryText(input: string): boolean {
  const text = input.trim()
  if (text.length < 24 || text.length > 4000) return false
  if (/<(system-reminder|available_skills)>/i.test(text)) return false
  if (/^Current runtime context\./i.test(text)) return false
  if (
    /^(你是一个|你是|请执行|任务是|任务[:：])/i.test(text) &&
    /(输出|提取|分析|生成|撰写|整理|完成|任务|output|extract|analy[sz]e|generate|write)/i.test(
      text
    )
  ) {
    return false
  }
  return /(请记住|记住|记得|以后(都|所有|默认|请|不|要)|从今以后|我的偏好|偏好是|我喜欢|我不喜欢|不要再|请始终|始终使用|默认使用|不要使用|我的名字|我叫|remember (that|to)|from now on|my preference|always use|never\s+\S|do not\s+\S|don't\s+\S)/i.test(
    text
  )
}

function memoryKind(input: string, fallback: string): string {
  if (
    /(不要再|不要|别用|别改|别再|别把|别在|别对|别只|别直接|禁止|避免|改为|换成|never|do not|don't|avoid|instead of|stop using)/i.test(
      input
    )
  ) {
    return 'feedback'
  }
  if (
    /(prefer|preference|always|以后|记住|偏好|喜欢|总是|默认|始终|from now on|remember)/i.test(
      input
    )
  ) {
    return 'preference'
  }
  return fallback
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!Array.isArray(value)) return ''
  return value
    .map((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return ''
      const item = block as Record<string, unknown>
      return item.type === 'text' && typeof item.text === 'string' ? item.text.trim() : ''
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function importHermes(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const sources = [
    {
      file: path.join(agent.home, 'memories', 'MEMORY.md'),
      kind: 'fact',
      tags: ['hermes', 'memory']
    },
    {
      file: path.join(agent.home, 'memories', 'USER.md'),
      kind: 'profile',
      tags: ['hermes', 'user-profile']
    }
  ]

  for (const source of sources) {
    const raw = readText(source.file)
    if (!raw) continue
    const { created, updated } = times(source.file)
    const entries = raw.split('\n§\n')
    entries.forEach((entry, index) => {
      const content = entry.trim()
      if (!content || content.length <= 20) return
      if (/^\*Learn about the person you're helping\. Update this as you go\.\*$/i.test(content)) {
        return
      }
      out.push({
        title: memoryTitle(content, path.basename(source.file, '.md')),
        content,
        kind: source.kind,
        project: null,
        tags: source.tags,
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: source.file,
        sourceRef: `${path.basename(source.file)}:${index + 1}`
      })
    })
  }
  return out
}

function importPi(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const sessionsRoot = path.join(agent.home, 'sessions')
  const files = walk(sessionsRoot, (file) => file.endsWith('.jsonl'), 600)

  for (const file of files) {
    const raw = readText(file)
    if (!raw) continue
    const fileTimes = times(file)
    let project: string | null = null
    let sessionName = ''
    const entries = raw.split('\n')

    for (let index = 0; index < entries.length; index += 1) {
      if (!entries[index].trim()) continue
      let event: Record<string, unknown>
      try {
        const parsed = JSON.parse(entries[index]) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
        event = parsed as Record<string, unknown>
      } catch {
        continue
      }

      if (event.type === 'session' && typeof event.cwd === 'string') {
        project = path.basename(event.cwd) || null
      }
      if (event.type === 'session_info' && typeof event.name === 'string') {
        sessionName = event.name.trim()
      }

      const timestamp = toTime(event.timestamp, fileTimes.updated)
      const fallbackTitle = sessionName || `Pi session ${path.basename(file, '.jsonl').slice(-8)}`
      if (
        (event.type === 'compaction' || event.type === 'branch_summary') &&
        typeof event.summary === 'string'
      ) {
        const content = event.summary.trim()
        if (content.length <= 20) continue
        out.push({
          title: memoryTitle(content, fallbackTitle),
          content,
          kind: 'episode',
          project,
          tags: ['pi', event.type === 'branch_summary' ? 'branch-summary' : 'compaction'],
          createdAt: timestamp,
          updatedAt: timestamp,
          agentId: agent.id,
          agentName: agent.name,
          sourcePath: file,
          sourceRef:
            typeof event.id === 'string' ? event.id : `${path.basename(file)}:${index + 1}`
        })
        continue
      }

      if (event.type !== 'message' || !event.message || typeof event.message !== 'object') {
        continue
      }
      const message = event.message as Record<string, unknown>
      if (message.role !== 'user') continue
      const content = textContent(message.content)
      if (!durableMemoryText(content)) continue
      out.push({
        title: memoryTitle(content, fallbackTitle),
        content,
        kind: memoryKind(content, 'preference'),
        project,
        tags: ['pi', 'durable-user-context'],
        createdAt: toTime(message.timestamp, timestamp),
        updatedAt: toTime(message.timestamp, timestamp),
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: file,
        sourceRef:
          typeof event.id === 'string' ? event.id : `${path.basename(file)}:${index + 1}`
      })
    }
  }
  return out
}

function importZCodeMarkdown(agent: AgentDefinition): ImportedMemory[] {
  const root = path.join(agent.home, 'cli', 'memories', 'projects')
  const files = walk(
    root,
    (file) => file.endsWith('.md') && path.basename(file) !== 'MEMORY.md',
    1000
  )
  return files
    .map((file) => {
      const relative = path.relative(root, file).split(path.sep)
      const project = relative[0] || null
      return parseMarkdownFile(file, agent, {
        kind: 'project',
        project,
        tags: ['zcode', 'markdown-memory']
      })
    })
    .filter((item): item is ImportedMemory => Boolean(item))
}

function importZCodeSqlite(agent: AgentDefinition): ImportedMemory[] {
  const file = path.join(agent.home, 'cli', 'db', 'db.sqlite')
  if (!fs.existsSync(file)) return []
  const out: ImportedMemory[] = []
  const seenText = new Set<string>()
  let db: DatabaseSync | null = null

  try {
    db = new DatabaseSync(file, { readOnly: true })
    const rows = db
      .prepare(
        `SELECT s.id AS session_id, s.title, s.directory, s.time_updated,
                m.id AS message_id, m.time_created, m.data AS message_data,
                p.data AS part_data
           FROM session s
           JOIN message m ON m.session_id = s.id
           JOIN part p ON p.message_id = m.id
          WHERE m.data LIKE '%"role":"user"%'
            AND p.data LIKE '%"type":"text"%'
          ORDER BY s.time_updated DESC, m.time_created ASC
          LIMIT 5000`
      )
      .all() as Array<Record<string, unknown>>

    for (const row of rows) {
      let message: Record<string, unknown>
      let part: Record<string, unknown>
      try {
        message = JSON.parse(String(row.message_data)) as Record<string, unknown>
        part = JSON.parse(String(row.part_data)) as Record<string, unknown>
      } catch {
        continue
      }
      if (message.role !== 'user' || part.type !== 'text' || typeof part.text !== 'string') {
        continue
      }
      const content = part.text.trim()
      if (!durableMemoryText(content)) continue
      const key = content.replace(/\s+/g, ' ')
      if (seenText.has(key)) continue
      seenText.add(key)
      const timestamp = toTime(
        row.time_created,
        toTime(row.time_updated, times(file).updated)
      )
      const directory = typeof row.directory === 'string' ? row.directory : ''
      out.push({
        title: memoryTitle(content, typeof row.title === 'string' ? row.title : 'ZCode memory'),
        content,
        kind: memoryKind(content, 'project'),
        project: directory ? path.basename(directory) : null,
        tags: ['zcode', 'durable-user-context'],
        createdAt: timestamp,
        updatedAt: timestamp,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: file,
        sourceRef: String(row.message_id ?? row.session_id ?? '')
      })
      if (out.length >= 400) break
    }
  } catch {
    // ZCode may be migrating or holding the database.
  } finally {
    try {
      db?.close()
    } catch {
      // ignore
    }
  }
  return out
}

function importZCode(agent: AgentDefinition): ImportedMemory[] {
  return [...importZCodeMarkdown(agent), ...importZCodeSqlite(agent)]
}

interface ZstdFrame {
  start: number
  end: number
}

function scanZstdFrames(buffer: Buffer): ZstdFrame[] {
  const frames: ZstdFrame[] = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 5 || buffer.readUInt32LE(offset) !== 0xfd2fb528) break
    offset += 4
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes =
      contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes =
      (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes

    let complete = false
    while (offset + 3 <= buffer.length) {
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) break
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) {
        complete = true
        break
      }
    }
    if (!complete) break
    if (checksum) {
      if (buffer.length - offset < 4) break
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

interface DeepSeekUserCue {
  seq: number | null
  time: number
  content: string
  sourceRef: string
}

interface DeepSeekCompaction {
  time: number
  content: string
  sourceRef: string
}

interface DeepSeekSessionSnapshot {
  sessionId: string
  project: string | null
  createdAt: number
  title: string | null
  userMessages: DeepSeekUserCue[]
  compactions: DeepSeekCompaction[]
  visibleSeqs: Set<number>
}

const deepSeekSessionCache = new Map<
  string,
  { cacheKey: string; snapshot: DeepSeekSessionSnapshot }
>()

function visitDeepSeekEvents(
  file: string,
  visit: (event: Record<string, unknown>) => void
): boolean {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size === 0 || stat.size > 32_000_000) return false
    const parse = (text: string): void => {
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line) as unknown
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
          visit(parsed as Record<string, unknown>)
        } catch {
          // A crash can leave one incomplete tail record.
        }
      }
    }
    if (file.endsWith('.jsonl')) {
      parse(fs.readFileSync(file, 'utf8'))
      return true
    }
    const raw = fs.readFileSync(file)
    const frames = scanZstdFrames(raw)
    if (!frames.length) return false
    for (const frame of frames) {
      const decoded = zstdDecompressSync(raw.subarray(frame.start, frame.end))
      parse(decoded.toString('utf8'))
    }
    return true
  } catch {
    return false
  }
}

function applyDeepSeekSurface(
  surfaceOp: unknown,
  seq: number | null,
  visibleSeqs: Set<number>
): void {
  if (seq === null) return
  if (surfaceOp === 'append' || surfaceOp === undefined) {
    visibleSeqs.add(seq)
    return
  }
  if (!surfaceOp || typeof surfaceOp !== 'object' || Array.isArray(surfaceOp)) return
  const replacement = surfaceOp as Record<string, unknown>
  if (replacement.op !== 'replace') return
  const start = typeof replacement.startSeq === 'number' ? replacement.startSeq : null
  const end = typeof replacement.endSeq === 'number' ? replacement.endSeq : start
  if (start !== null && end !== null) {
    for (let index = Math.min(start, end); index <= Math.max(start, end); index += 1) {
      visibleSeqs.delete(index)
    }
  }
  visibleSeqs.add(seq)
}

function deepSeekProject(cwd: unknown): string | null {
  if (typeof cwd !== 'string' || !cwd.trim()) return null
  const normalized = cwd.replace(/[\\/]+$/, '')
  return path.basename(normalized) || null
}

function deepSeekSession(file: string): DeepSeekSessionSnapshot | null {
  let cacheKey: string
  try {
    const stat = fs.statSync(file)
    cacheKey = `${stat.mtimeMs}:${stat.size}`
    const cached = deepSeekSessionCache.get(file)
    if (cached?.cacheKey === cacheKey) return cached.snapshot
  } catch {
    return null
  }

  let sessionId = path.basename(path.dirname(file))
  let project: string | null = null
  let createdAt = times(file).created
  let title: string | null = null
  const userMessages: DeepSeekUserCue[] = []
  const compactions: DeepSeekCompaction[] = []
  const visibleSeqs = new Set<number>()

  const complete = visitDeepSeekEvents(file, (event) => {
    const seq = typeof event.seq === 'number' ? event.seq : null
    applyDeepSeekSurface(event.surfaceOp, seq, visibleSeqs)

    if (event.type === 'session') {
      project = deepSeekProject(event.cwd)
      if (typeof event.id === 'string') sessionId = event.id
      createdAt = toTime(event.createdAt, createdAt)
      return
    }
    if (event.type === 'working-directory/change' && event.data) {
      const data = event.data as Record<string, unknown>
      project = deepSeekProject(data.cwd) ?? project
      return
    }
    if (event.type === 'session/title' && event.data) {
      const data = event.data as Record<string, unknown>
      if (typeof data.title === 'string' && data.title.trim()) {
        title = data.title.trim()
      }
      return
    }
    if (event.type === 'compaction/summary' && event.data) {
      const data = event.data as Record<string, unknown>
      const content = textContent(data.summary)
      if (content.length < 30) return
      const timestamp = toTime(event.time, createdAt)
      compactions.push({
        time: timestamp,
        content,
        sourceRef:
          typeof data.compactionId === 'string'
            ? `compaction:${data.compactionId}`
            : `${sessionId}:compaction:${seq ?? timestamp}`
      })
      return
    }
    if (event.type !== 'user/message' || !event.data) return
    const data = event.data as Record<string, unknown>
    const source =
      data.source && typeof data.source === 'object'
        ? (data.source as Record<string, unknown>)
        : {}
    if (data.role !== 'user' || source.kind !== 'user') return
    const content = textContent(data.content)
    if (!content || userMessages.length >= 5000) return
    userMessages.push({
      seq,
      time: toTime(event.time, createdAt),
      content,
      sourceRef:
        typeof data.id === 'string' ? data.id : `${sessionId}:${seq ?? userMessages.length + 1}`
    })
  })
  if (!complete) return null

  const snapshot: DeepSeekSessionSnapshot = {
    sessionId,
    project,
    createdAt,
    title,
    userMessages,
    compactions,
    visibleSeqs
  }
  deepSeekSessionCache.set(file, { cacheKey, snapshot })
  if (deepSeekSessionCache.size > 1200) {
    const oldest = deepSeekSessionCache.keys().next().value
    if (oldest) deepSeekSessionCache.delete(oldest)
  }
  return snapshot
}

function importDeepSeekHarness(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const seenText = new Set<string>()
  const instructionsPath = path.join(agent.home, 'AGENTS.md')
  const instructions = readText(instructionsPath)
  if (instructions) {
    const rule = parseMarkdownRaw(
      instructionsPath,
      agent,
      stripDeepSeekInstructions(instructions),
      {
        kind: 'rule',
        tags: ['deepseek-harness', 'user-global-instructions']
      }
    )
    if (rule) {
      rule.sourceRef = 'user-global-instructions'
      out.push(rule)
      seenText.add(rule.content.replace(/\s+/g, ' '))
    }
  }

  const sessionsRoot = path.join(agent.home, 'sessions')
  const files = walk(
    sessionsRoot,
    (file) => file.endsWith('.jsonl.zstd') || file.endsWith('.jsonl'),
    800
  )

  for (const file of files) {
    const snapshot = deepSeekSession(file)
    if (!snapshot) continue

    for (const cue of snapshot.userMessages) {
      const content = cue.content
      if (!durableMemoryText(content)) continue
      const key = content.replace(/\s+/g, ' ')
      if (seenText.has(key)) continue
      seenText.add(key)
      const tags = ['deepseek-harness', 'durable-user-context']
      if (cue.seq === null || !snapshot.visibleSeqs.has(cue.seq)) {
        tags.push('surface-shadowed')
      }
      out.push({
        title: memoryTitle(
          content,
          `DeepSeek Harness session ${snapshot.sessionId.slice(-6)}`
        ),
        content,
        kind: memoryKind(content, 'preference'),
        project: snapshot.project,
        tags,
        createdAt: cue.time,
        updatedAt: cue.time,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: file,
        sourceRef: cue.sourceRef
      })
      if (out.length >= 400) return out
    }

    for (const compaction of snapshot.compactions) {
      const content = compaction.content.trim()
      const key = content.replace(/\s+/g, ' ')
      if (seenText.has(key)) continue
      seenText.add(key)
      out.push({
        title: memoryTitle(
          content,
          snapshot.title ?? `DeepSeek Harness session ${snapshot.sessionId.slice(-6)}`
        ),
        content,
        kind: 'episode',
        project: snapshot.project,
        tags: ['deepseek-harness', 'compaction-summary'],
        createdAt: compaction.time,
        updatedAt: compaction.time,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: file,
        sourceRef: compaction.sourceRef
      })
      if (out.length >= 400) return out
    }
  }
  return out
}

export function importAgentMemories(agent: AgentDefinition): ImportedMemory[] {
  let memories: ImportedMemory[] = []
  switch (agent.id) {
    case 'claude-code':
      memories = importClaude(agent)
      break
    case 'claude-desktop':
      memories = importClaudeDesktop(agent)
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
      memories = importCopilot(agent)
      break
    case 'opencode':
      memories = importOpenCode(agent)
      break
    case 'windsurf':
      memories = importWindsurf(agent)
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
    case 'hermes':
      memories = importHermes(agent)
      break
    case 'pi':
      memories = importPi(agent)
      break
    case 'zcode':
      memories = importZCode(agent)
      break
    case 'deepseek-harness':
      memories = importDeepSeekHarness(agent)
      break
    default:
      memories = []
  }
  const seen = new Set<string>()
  return memories.filter((memory) => {
    const key = `${memory.agentId}:${memory.sourcePath}:${memory.sourceRef ?? ''}:${memory.content}`
    if (seen.has(key)) return false
    seen.add(key)
    memory.kind = normalizeMemoryKind(memory.kind)
    return memory.content.trim().length > 20
  })
}
