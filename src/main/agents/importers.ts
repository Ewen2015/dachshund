import fs from 'node:fs'
import path from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import matter from 'gray-matter'
import { DatabaseSync } from 'node:sqlite'
import type {
  ImportedMemory,
  MemoryAuthority,
  MemoryScope,
  MemoryStatus
} from '../../shared/types'
import {
  inferTextKind,
  normalizeMemoryAuthority,
  normalizeMemoryKind,
  normalizeMemoryScope,
  normalizeMemoryStatus
} from '../../shared/memory-taxonomy'
import { expandHome } from '../paths'
import type { AgentDefinition } from './registry'
import { stripSharedMemoryInstructions } from './shared-memory-instructions'

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
  defaults: {
    title?: string
    kind?: string
    scope?: MemoryScope
    authority?: MemoryAuthority
    status?: MemoryStatus
    project?: string | null
    tags?: string[]
  } = {}
): ImportedMemory | null {
  const raw = readText(file)
  if (!raw) return null
  return parseMarkdownRaw(file, agent, raw, defaults)
}

function parseMarkdownRaw(
  file: string,
  agent: AgentDefinition,
  raw: string,
  defaults: {
    title?: string
    kind?: string
    scope?: MemoryScope
    authority?: MemoryAuthority
    status?: MemoryStatus
    project?: string | null
    tags?: string[]
  } = {}
): ImportedMemory | null {
  const parsed = matter(stripSharedMemoryInstructions(raw))
  const body = parsed.content.trim()
  if (!body) return null
  const data = parsed.data as Record<string, unknown>
  const { created, updated } = times(file)
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {}
  const title =
    (defaults.title && defaults.title.trim()) ||
    (typeof data.title === 'string' && data.title.trim()) ||
    (typeof data.description === 'string' && data.description.trim()) ||
    (typeof data.name === 'string' && humanize(data.name)) ||
    firstHeading(body) ||
    humanize(path.basename(file, path.extname(file)))
  const project =
    (typeof data.project === 'string' && data.project) ||
    defaults.project ||
    null
  const kind = normalizeMemoryKind(
    (typeof data.kind === 'string' && data.kind) ||
      (typeof data.type === 'string' && data.type) ||
      (typeof meta.type === 'string' && meta.type) ||
      defaults.kind ||
      '',
    body
  )
  return {
    title: title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title,
    content: body,
    kind,
    scope: normalizeMemoryScope(data.scope || defaults.scope, project),
    authority: normalizeMemoryAuthority(data.authority || defaults.authority),
    status: normalizeMemoryStatus(data.status || defaults.status, kind),
    project,
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

function workBuddyWorkspaceLabel(workspace: string): string {
  const name = path.basename(workspace)
  const match = name.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[-_T ](\d{2})[-_:]?(\d{2})(?:[-_:]?(\d{2}))?)?$/
  )
  if (!match) return name
  const date = `${match[1]}-${match[2]}-${match[3]}`
  return match[4] ? `Session ${date} ${match[4]}:${match[5]}` : `Session ${date}`
}

function isWorkBuddyDailyLog(file: string): boolean {
  return /^\d{4}-\d{2}-\d{2}\.md$/.test(path.basename(file))
}

function importWorkBuddy(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const seen = new Set<string>()

  const addFile = (
    file: string,
    defaults: {
      kind?: string
      scope?: MemoryScope
      authority?: MemoryAuthority
      status?: MemoryStatus
      project?: string | null
      tags?: string[]
      forceKind?: string
    }
  ): void => {
    if (seen.has(file)) return
    const raw = readText(file)
    if (!raw) return
    const memory = parseMarkdownRaw(file, agent, stripWorkBuddyMetadata(raw), defaults)
    if (!memory) return
    if (defaults.forceKind) memory.kind = defaults.forceKind
    seen.add(file)
    out.push(memory)
  }

  addFile(path.join(agent.home, 'IDENTITY.md'), {
    kind: 'rule',
    authority: 'project_declared',
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
    addFile(file, { tags: ['workbuddy', 'user-memory'] })
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
    const project = workBuddyWorkspaceLabel(workspace)
    const memoryRoot = path.join(workspace, '.workbuddy', 'memory')
    for (const file of walk(
      memoryRoot,
      (item) => item.endsWith('.md') && path.basename(item) !== 'MEMORY.md',
      160
    )) {
      const dailyLog = isWorkBuddyDailyLog(file)
      addFile(file, {
        kind: 'workspace_log',
        scope: dailyLog ? 'session' : 'workspace',
        project,
        tags: ['workbuddy', 'workspace-memory', ...(dailyLog ? ['daily-log'] : [])],
        ...(dailyLog ? { forceKind: 'workspace_log' } : {})
      })
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
        scope: session ? 'session' : 'workspace',
        authority: 'agent_observed',
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
    intent || outcome || learned[0] || `TRAE session ${messageId.slice(-6) || lineNumber}`

  return {
    title: title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title,
    content,
    kind: 'session_summary',
    scope: project ? 'project' : 'session',
    authority: 'agent_observed',
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
      kind: 'session_summary',
      scope: project ? 'project' : 'session',
      authority: 'agent_observed',
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
  const byIdentity = new Map<string, ImportedMemory>()
  const add = (memory: ImportedMemory): void => {
    const identity = [
      normalizeMemoryKind(memory.kind),
      memory.project ?? '',
      memory.sourceRef ?? '',
      memory.content.trim().replace(/\s+/g, ' ')
    ].join('\u0000')
    const current = byIdentity.get(identity)
    if (!current || memory.updatedAt > current.updatedAt) byIdentity.set(identity, memory)
  }
  const roots = [...new Set([agent.home, ...(agent.homes ?? [])])]
  for (const root of roots) {
    const projectsRoot = path.join(root, 'memory', 'projects')
    const profile = parseMarkdownFile(
      path.join(root, 'memory', 'user_profile.md'),
      agent,
      { kind: 'profile', authority: 'agent_observed', tags: ['trae', 'user-profile'] }
    )
    if (profile) add(profile)

    const projectMemories = walk(
      projectsRoot,
      (file) => path.basename(file) === 'project_memory.md',
      400
    )
    for (const file of projectMemories) {
      const memory = parseMarkdownFile(file, agent, {
        kind: 'project',
        authority: 'agent_observed',
        project: projectFromTraeDir(file, 1),
        tags: ['trae', 'project-memory']
      })
      if (memory) add(memory)
    }

    const episodeFiles = walk(
      projectsRoot,
      (file) =>
        path.basename(file) === 'topics.md' ||
        (path.basename(file).startsWith('session_memory_') && file.endsWith('.jsonl')),
      400
    )
    for (const file of episodeFiles) {
      const project = projectFromTraeDir(file)
      if (path.basename(file) === 'topics.md') {
        importTraeTopics(file, agent, project).forEach(add)
        continue
      }
      const raw = readText(file)
      if (!raw) continue
      raw.split('\n').forEach((line, index) => {
        if (!line.trim()) return
        const memory = traeSessionMemory(file, line, index + 1, agent, project)
        if (memory) add(memory)
      })
    }
  }
  return [...byIdentity.values()]
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

function isClaudeMemoryIndex(file: string): boolean {
  return path.basename(file).toLowerCase() === 'memory.md'
}

function hasClaudeIndexEntries(content: string): boolean {
  return content.split('\n').some((line) => {
    const trimmed = line.trim()
    return Boolean(trimmed) && !trimmed.startsWith('#')
  })
}

function parseClaudeMemoryIndex(
  file: string,
  agent: AgentDefinition,
  defaults: {
    title: string
    scope: MemoryScope
    project: string | null
    tags: string[]
    sourceRef?: string
  }
): ImportedMemory | null {
  const memory = parseMarkdownFile(file, agent, {
    title: defaults.title,
    kind: 'reference',
    scope: defaults.scope,
    authority: 'agent_observed',
    project: defaults.project,
    tags: defaults.tags
  })
  if (!memory || !hasClaudeIndexEntries(memory.content)) return null
  if (defaults.sourceRef) memory.sourceRef = defaults.sourceRef
  return memory
}

function importClaudeCodeHome(agent: AgentDefinition, root: string): ImportedMemory[] {
  const memoryFiles = walk(
    path.join(root, 'projects'),
    (file) => file.endsWith('.md') && file.includes(`${path.sep}memory${path.sep}`)
  )
  const projectMemories = memoryFiles
    .map((file) => {
      const project = projectFromClaudeDir(file)
      if (isClaudeMemoryIndex(file)) {
        return parseClaudeMemoryIndex(file, agent, {
          title: project ? `Memory index · ${project}` : 'Memory index',
          scope: project ? 'project' : 'user',
          project,
          tags: ['claude-code', 'auto-memory', 'memory-index', 'project-index']
        })
      }
      return parseMarkdownFile(file, agent, {
        authority: 'agent_observed',
        project,
        tags: ['claude-code', 'auto-memory']
      })
    })
  const instructionFiles = [
    path.join(root, 'CLAUDE.md'),
    ...walk(path.join(root, 'rules'), (file) => file.endsWith('.md'), 160)
  ].filter((file) => fs.existsSync(file))
  const instructions = instructionFiles.map((file) =>
    parseMarkdownFile(file, agent, {
      kind: 'rule',
      authority: 'user_explicit',
      tags: ['claude-code', 'instructions']
    })
  )
  const globalMemories = walk(
    path.join(root, 'memory'),
    (file) => file.endsWith('.md'),
    80
  ).map((file) =>
    isClaudeMemoryIndex(file)
      ? parseClaudeMemoryIndex(file, agent, {
          title: 'Global memory index',
          scope: 'user',
          project: null,
          tags: ['claude-code', 'global-memory', 'memory-index', 'global-index']
        })
      : parseMarkdownFile(file, agent, {
          authority: 'agent_observed',
          tags: ['claude-code', 'global-memory']
        })
  )
  return [...projectMemories, ...instructions, ...globalMemories].filter(
    (item): item is ImportedMemory => Boolean(item)
  )
}

type ClaudeDesktopSurface = 'account' | 'agent' | 'space'

function claudeDesktopSurface(file: string): ClaudeDesktopSurface {
  const normalized = file.split(path.sep).join('/')
  if (/\/spaces\/[^/]+\/memory\//i.test(normalized)) return 'space'
  if (/\/agent\/memory\//i.test(normalized)) return 'agent'
  return 'account'
}

function claudeDesktopSurfaceTag(surface: ClaudeDesktopSurface): string {
  return surface === 'space' ? 'space-memory' : 'local-memory'
}

function isClaudeDesktopMemoryFile(file: string): boolean {
  const normalized = file.split(path.sep).join('/')
  return /\/local-agent-mode-sessions\/[^/]+\/[^/]+\/(?:memory|agent\/memory|spaces\/[^/]+\/memory)\/.+\.md$/i.test(
    normalized
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

function importClaudeDesktopHome(agent: AgentDefinition, root: string): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const sessionRoot = path.join(root, 'local-agent-mode-sessions')
  for (const file of walk(sessionRoot, isClaudeDesktopMemoryFile)) {
    const surface = claudeDesktopSurface(file)
    const space = surface === 'space' ? claudeDesktopSpace(file) : null
    const tags = [
      'claude-desktop',
      claudeDesktopSurfaceTag(surface),
      ...(space ? [`space:${space.id}`] : [])
    ]
    const memory = isClaudeMemoryIndex(file)
      ? parseClaudeMemoryIndex(file, agent, {
          title:
            surface === 'space'
              ? `Memory index · ${space?.name ?? 'Space'}`
              : surface === 'agent'
                ? 'Agent memory index'
                : 'Account memory index',
          scope: space ? 'project' : 'user',
          project: space?.name ?? null,
          tags: [
            ...tags,
            'memory-index',
            `${surface}-index`,
            ...(surface === 'agent' ? ['agent-memory'] : [])
          ],
          sourceRef: space ? `space:${space.id}` : undefined
        })
      : parseMarkdownFile(file, agent, {
          scope: space ? 'project' : 'user',
          authority: 'agent_observed',
          project: space?.name ?? null,
          tags
        })
    if (!memory) continue
    if (space && !isClaudeMemoryIndex(file)) memory.sourceRef = `space:${space.id}`
    out.push(memory)
  }
  return out
}

function importClaude(agent: AgentDefinition): ImportedMemory[] {
  const homes = [...new Set([agent.home, ...(agent.homes ?? [])])]
  const out: ImportedMemory[] = []
  for (const root of homes) {
    out.push(...importClaudeCodeHome(agent, root), ...importClaudeDesktopHome(agent, root))
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
  const cwd = section.match(/cwd\s*[:=]\s*([^;,\n]+)/i)?.[1]
    .trim()
    .replace(/^`|`$/g, '')
  if (cwd && cwd.toLowerCase() !== 'any') {
    const label = path.basename(cwd)
    return label || cwd
  }
  return section.match(/^\s*task_group\s*:\s*(.+)$/m)?.[1]?.trim() ?? null
}

function codexReusableKnowledge(section: string): string[] {
  const blocks: string[] = []
  const lines = section.split('\n')
  let current: string[] | null = null
  const finish = (): void => {
    if (!current) return
    const content = current.join('\n').trim()
    if (content) blocks.push(content)
    current = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^#{0,4}\s*Reusable knowledge:?\s*$/i.test(trimmed)) {
      finish()
      current = []
      continue
    }
    if (
      current &&
      (/^#{1,6}\s+/.test(trimmed) ||
        /^(?:References|Preference signals|Key steps|Failures and how to do differently|Outcome|Task \d+):\s*$/i.test(
          trimmed
        ))
    ) {
      finish()
      continue
    }
    if (current) current.push(line)
  }
  finish()
  return blocks
}

function codexTaskGroupKind(section: string): string {
  const explicit = section.match(/^(?:kind|type):\s*([a-z_-]+)\s*$/im)?.[1]
  if (!explicit) return 'task_rollout'
  const kind = normalizeMemoryKind(explicit, section)
  return [
    'goal',
    'constraint',
    'decision',
    'rule',
    'preference',
    'insight',
    'procedure',
    'task_rollout'
  ].includes(kind)
    ? kind
    : 'task_rollout'
}

function codexKnowledgeMemories(input: {
  body: string
  title: string
  project: string | null
  tags: string[]
  file: string
  sourceRef: string
  createdAt: number
  updatedAt: number
  agent: AgentDefinition
}): ImportedMemory[] {
  return codexReusableKnowledge(input.body).map((content, index) => {
    const title = `${input.title} · reusable knowledge`
    const kind = /(^|\n)\s*(?:1\.|[-*]\s+step|##\s+(?:steps|procedure|workflow))/i.test(content)
      ? 'procedure'
      : inferTextKind(content, 'insight')
    return {
      title: title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title,
      content,
      kind,
      scope: input.project ? 'project' : 'user',
      authority: 'agent_observed',
      project: input.project,
      tags: [...new Set([...input.tags, 'codex', 'reusable-knowledge'])],
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      agentId: input.agent.id,
      agentName: input.agent.name,
      sourcePath: input.file,
      sourceRef: `${input.sourceRef}:knowledge:${index + 1}`
    }
  })
}

function importCodexMarkdown(agent: AgentDefinition): ImportedMemory[] {
  const out: ImportedMemory[] = []
  const memoriesDir = path.join(agent.home, 'memories')
  const mainFile = path.join(memoriesDir, 'MEMORY.md')
  const rawMain = readText(mainFile)
  if (rawMain) {
    const { created, updated } = times(mainFile)
    const groups = rawMain.split(/^#{1,2}\s+Task Group:\s*/m).slice(1)
    for (const group of groups) {
      const lines = group.split('\n')
      const title = (lines.shift() ?? '').trim() || 'Codex task memory'
      const body = lines.join('\n').trim()
      if (!body) continue
      const project = codexProject(group)
      const tags = [...new Set(['codex', 'task-group', ...codexTags(group)])]
      out.push({
        title,
        content: body,
        kind: codexTaskGroupKind(body),
        scope: project ? 'project' : 'user',
        authority: 'agent_observed',
        project,
        tags,
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: mainFile,
        sourceRef: `codex:group:${title}`
      })
      out.push(
        ...codexKnowledgeMemories({
          body,
          title,
          project,
          tags,
          file: mainFile,
          sourceRef: `codex:group:${title}`,
          createdAt: created,
          updatedAt: updated,
          agent
        })
      )
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
      const title = description
        ? description.slice(0, 110).trimEnd()
        : `Codex thread ${threadId.slice(0, 8)}`
      const project = codexProject(body)
      const tags = [
        ...new Set([
          'codex',
          'thread',
          ...(body.match(/^keywords:\s*(.+)$/m)?.[1]?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [])
        ])
      ]
      out.push({
        title,
        content: body,
        kind: 'task_rollout',
        scope: project ? 'project' : 'user',
        authority: 'agent_observed',
        project,
        tags,
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: rawFile,
        sourceRef: threadId
      })
      out.push(
        ...codexKnowledgeMemories({
          body,
          title,
          project,
          tags,
          file: rawFile,
          sourceRef: threadId,
          createdAt: created,
          updatedAt: updated,
          agent
        })
      )
    }
  }

  const summaryFile = path.join(memoriesDir, 'memory_summary.md')
  const summary = readText(summaryFile)
  if (summary) {
    const { created, updated } = times(summaryFile)
    const headings = [...summary.matchAll(/^##\s+(.+)$/gm)]
    if (headings.length) {
      headings.forEach((heading, index) => {
        const sectionTitle = heading[1].trim()
        const start = (heading.index ?? 0) + heading[0].length
        const end = headings[index + 1]?.index ?? summary.length
        const content = summary.slice(start, end).trim()
        if (!content) return
        const headingKey = sectionTitle.toLowerCase()
        const kind = /profile|user|about|identity/.test(headingKey)
          ? 'profile'
          : /preference/.test(headingKey)
            ? 'preference'
            : /rule|instruction/.test(headingKey)
              ? normalizeMemoryKind(headingKey, content)
              : /workflow|procedure|steps/.test(headingKey)
                ? 'procedure'
                : /goal|milestone/.test(headingKey)
                  ? 'goal'
                  : /constraint|limit|boundary/.test(headingKey)
                    ? 'constraint'
                    : /decision/.test(headingKey)
                      ? 'decision'
                      : /current|active work|project/.test(headingKey)
                        ? normalizeMemoryKind('project', content)
                        : /index|reference|link/.test(headingKey)
                          ? 'reference'
                  : /fact|knowledge/.test(headingKey)
                    ? 'fact'
                    : inferTextKind(content, 'fact')
        out.push({
          title: sectionTitle.length > 110 ? `${sectionTitle.slice(0, 107)}…` : sectionTitle,
          content,
          kind,
          scope: 'user',
          authority: 'inferred',
          project: null,
          tags: ['codex', 'memory-summary'],
          createdAt: created,
          updatedAt: updated,
          agentId: agent.id,
          agentName: agent.name,
          sourcePath: summaryFile,
          sourceRef: `codex:memory-summary:${index + 1}`
        })
      })
    } else {
      out.push({
        title: 'Codex memory summary',
        content: summary,
        kind: inferTextKind(summary, 'fact'),
        scope: 'user',
        authority: 'inferred',
        project: null,
        tags: ['codex', 'memory-summary'],
        createdAt: created,
        updatedAt: updated,
        agentId: agent.id,
        agentName: agent.name,
        sourcePath: summaryFile,
        sourceRef: 'codex:memory-summary'
      })
    }
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
        const title = slug ? humanize(slug) : `Codex thread ${threadId.slice(0, 8)}`
        const project = codexProject(content)
        const tags = ['codex', 'rollout']
        out.push({
          title,
          content,
          kind: 'task_rollout',
          scope: project ? 'project' : 'user',
          authority: 'agent_observed',
          project,
          tags,
          createdAt: generated,
          updatedAt: generated,
          agentId: agent.id,
          agentName: agent.name,
          sourcePath: file,
          sourceRef: threadId
        })
        out.push(
          ...codexKnowledgeMemories({
            body: content,
            title,
            project,
            tags,
            file,
            sourceRef: threadId,
            createdAt: generated,
            updatedAt: generated,
            agent
          })
        )
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
          authority: 'user_explicit',
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
        scope: 'user',
        authority: 'agent_observed',
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
    .map((file) =>
      parseMarkdownFile(file, agent, { kind: 'rule', authority: 'user_explicit' })
    )
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
        authority: 'user_explicit',
        tags: ['copilot', 'instructions']
      })
    ),
    ...memoryFiles.map((file) =>
      parseMarkdownFile(file, agent, {
        authority: 'agent_observed',
        tags: ['copilot', 'local-memory']
      })
    )
  ].filter((item): item is ImportedMemory => Boolean(item))
}

function importOpenCode(agent: AgentDefinition): ImportedMemory[] {
  const instruction = parseMarkdownFile(path.join(agent.home, 'AGENTS.md'), agent, {
    kind: 'rule',
    authority: 'user_explicit',
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
        authority: 'agent_observed',
        tags: ['opencode', 'local-memory']
      })
    )
  ].filter((item): item is ImportedMemory => Boolean(item))
}

function memoryTitle(text: string, fallback: string): string {
  const firstLine =
    text
      .split('\n')
      .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '').trim())
      .find(Boolean) ?? fallback
  return firstLine.length > 110 ? `${firstLine.slice(0, 107).trimEnd()}…` : firstLine
}

function markdownSubsections(
  content: string
): Array<{ title: string; content: string }> {
  const headings = [...content.matchAll(/^##\s+(.+)$/gm)]
  if (!headings.length) return []
  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[index + 1]?.index ?? content.length
    return {
      title: heading[1].trim(),
      content: content.slice(start, end).trim()
    }
  })
}

function hermesSectionKind(title: string, content: string): string {
  if (/(用户|个人信息|profile|identity|about)/i.test(title)) return 'profile'
  if (/(偏好|preference)/i.test(title)) return inferTextKind(content, 'preference')
  if (/(规则|要求|rule|instruction)/i.test(title)) return inferTextKind(content, 'rule')
  if (/(流程|步骤|procedure|workflow)/i.test(title)) {
    return inferTextKind(content, 'procedure')
  }
  if (/(项目|project|current|当前)/i.test(title)) {
    return normalizeMemoryKind('project', content)
  }
  if (/(环境|集成|integration|environment|setup)/i.test(title)) {
    return inferTextKind(content, 'reference')
  }
  return inferTextKind(content, 'fact')
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
  return inferTextKind(input, fallback)
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
  const sources: Array<{ file: string; kind?: string; tags: string[] }> = [
    {
      file: path.join(agent.home, 'memories', 'MEMORY.md'),
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
      const root = entry.trim()
      if (!root) return
      const rootTitle = memoryTitle(root, path.basename(source.file, '.md'))
      const subsections = markdownSubsections(root)
      const chunks = subsections.length
        ? subsections
        : [{ title: rootTitle, content: root }]
      chunks.forEach((chunk, chunkIndex) => {
        const content = chunk.content.trim()
        if (!content || content.length < (subsections.length ? 3 : 20)) return
        if (
          /^\*Learn about the person you're helping\. Update this as you go\.\*$/i.test(
            content
          )
        ) {
          return
        }
        const title =
          subsections.length && chunk.title !== rootTitle
            ? `${rootTitle} · ${chunk.title}`
            : chunk.title
        out.push({
          title: title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title,
          content: subsections.length ? `## ${chunk.title}\n\n${content}` : content,
          kind:
            source.kind ??
            (subsections.length
              ? hermesSectionKind(chunk.title, content)
              : inferTextKind(content, 'fact')),
          scope: 'user',
          authority: 'agent_observed',
          project: null,
          tags: source.tags,
          createdAt: created,
          updatedAt: updated,
          agentId: agent.id,
          agentName: agent.name,
          sourcePath: source.file,
          sourceRef: `${path.basename(source.file)}:${index + 1}:${chunkIndex + 1}`
        })
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
          kind: event.type === 'compaction' ? 'compaction' : 'session_summary',
          scope: project ? 'project' : 'session',
          authority: 'agent_observed',
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
        scope: project ? 'project' : 'session',
        authority: 'user_explicit',
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
        authority: 'agent_observed',
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
        kind: memoryKind(content, 'fact'),
        scope: directory ? 'project' : 'session',
        authority: 'user_explicit',
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
      stripSharedMemoryInstructions(instructions),
      {
        kind: 'rule',
        authority: 'user_explicit',
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
        scope: snapshot.project ? 'project' : 'session',
        authority: 'user_explicit',
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
        kind: 'compaction',
        scope: snapshot.project ? 'project' : 'session',
        authority: 'inferred',
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
    case 'claude':
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
      memories = importCopilot(agent)
      break
    case 'opencode':
      memories = importOpenCode(agent)
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
    memory.kind = normalizeMemoryKind(memory.kind, memory.content)
    memory.scope = normalizeMemoryScope(memory.scope, memory.project)
    memory.authority = normalizeMemoryAuthority(memory.authority)
    memory.status = normalizeMemoryStatus(memory.status, memory.kind)
    return memory.content.trim().length > 20
  })
}
