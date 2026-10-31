export type MemoryCategoryId = 'about' | 'working' | 'projects' | 'knowledge' | 'timeline'

export interface MemoryCategoryDefinition {
  id: MemoryCategoryId
  label: string
  shortLabel: string
  description: string
  color: string
  kinds: string[]
}

export interface AgentMemoryMapping {
  native: string
  description: string
  category: MemoryCategoryId
  kinds: string[]
}

export interface AgentMemoryModel {
  title: string
  summary: string
  path: string
  mappings: AgentMemoryMapping[]
}

export const MEMORY_CATEGORIES: MemoryCategoryDefinition[] = [
  {
    id: 'about',
    label: 'About me',
    shortLabel: 'Identity',
    description: 'Who you are, how you work, and the preferences that should follow you.',
    color: '#B5542F',
    kinds: ['profile', 'preference']
  },
  {
    id: 'working',
    label: 'Working together',
    shortLabel: 'Working',
    description: 'Rules, corrections, lessons, and repeatable ways of getting work done.',
    color: '#55745F',
    kinds: ['rule', 'feedback', 'lesson', 'workflow']
  },
  {
    id: 'projects',
    label: 'Projects',
    shortLabel: 'Projects',
    description: 'Current goals, constraints, project context, and decisions already made.',
    color: '#5F7089',
    kinds: ['project', 'decision']
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    shortLabel: 'Knowledge',
    description: 'Facts worth keeping and pointers to documents, links, and external systems.',
    color: '#9B7A4D',
    kinds: ['fact', 'reference']
  },
  {
    id: 'timeline',
    label: 'Timeline',
    shortLabel: 'Timeline',
    description: 'Session summaries and task episodes kept as evidence rather than durable facts.',
    color: '#8B6D76',
    kinds: ['episode']
  }
]

const KIND_ALIASES: Record<string, string> = {
  user: 'profile',
  identity: 'profile',
  personal: 'profile',
  preference: 'preference',
  preferences: 'preference',
  feedback: 'feedback',
  correction: 'feedback',
  instruction: 'rule',
  instructions: 'rule',
  guideline: 'rule',
  convention: 'rule',
  policy: 'rule',
  task: 'project',
  'task-group': 'project',
  task_group: 'project',
  project_memory: 'project',
  decision: 'decision',
  fact: 'fact',
  reference: 'reference',
  link: 'reference',
  doc: 'reference',
  lesson: 'lesson',
  workflow: 'workflow',
  session: 'episode',
  session_memory: 'episode',
  topic: 'episode',
  rollout: 'episode',
  compaction: 'episode',
  history: 'episode',
  episode: 'episode'
}

export const MEMORY_KIND_LABELS: Record<string, string> = {
  profile: 'Profile',
  preference: 'Preference',
  rule: 'Rule',
  feedback: 'Feedback',
  lesson: 'Lesson',
  workflow: 'Workflow',
  project: 'Project',
  decision: 'Decision',
  fact: 'Fact',
  reference: 'Reference',
  episode: 'Episode'
}

export function normalizeMemoryKind(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return 'fact'
  const key = raw.replace(/\s+/g, '-')
  return KIND_ALIASES[key] ?? KIND_ALIASES[raw] ?? key
}

export function categoryForKind(value: unknown): MemoryCategoryId {
  const kind = normalizeMemoryKind(value)
  return MEMORY_CATEGORIES.find((category) => category.kinds.includes(kind))?.id ?? 'knowledge'
}

export function categoryDefinition(value: unknown): MemoryCategoryDefinition {
  return (
    MEMORY_CATEGORIES.find((category) => category.id === value) ??
    MEMORY_CATEGORIES[MEMORY_CATEGORIES.length - 1]
  )
}

export function kindLabel(value: unknown): string {
  const kind = normalizeMemoryKind(value)
  return MEMORY_KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
}

export const AGENT_MEMORY_MODELS: Record<string, AgentMemoryModel> = {
  'claude-code': {
    title: 'Typed auto memory + CLAUDE.md',
    summary:
      'Claude Code keeps written instructions separate from four typed auto-memory files scoped to each repository.',
    path: '~/.claude/projects/<repo>/memory + CLAUDE.md',
    mappings: [
      { native: 'user', description: 'Role, expertise, and working preferences', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'feedback', description: 'Corrections and approved methods', category: 'working', kinds: ['feedback', 'lesson'] },
      { native: 'project', description: 'Goals, deadlines, and decisions', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'reference', description: 'Where external context lives', category: 'knowledge', kinds: ['reference', 'fact'] }
    ]
  },
  'claude-desktop': {
    title: 'Account topics + project memory',
    summary:
      'Claude Desktop stores individual topics and project memory on the account. dachshund can reach only local MCP configuration.',
    path: 'Account memory + claude_desktop_config.json',
    mappings: [
      { native: 'topic', description: 'A remembered subject from chat', category: 'knowledge', kinds: ['fact', 'reference'] },
      { native: 'preference', description: 'Stable user expectations', category: 'about', kinds: ['preference', 'profile'] },
      { native: 'project memory', description: 'Context scoped to one project', category: 'projects', kinds: ['project', 'decision'] }
    ]
  },
  codex: {
    title: 'Task groups, summaries, rollouts',
    summary:
      'Codex is organized around work threads. dachshund reads merged summaries and rollout evidence as local files.',
    path: '~/.codex/memories + rollouts',
    mappings: [
      { native: 'task group', description: 'A durable project workstream', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'summary', description: 'Merged user and workflow context', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'rollout', description: 'Evidence from a completed task', category: 'timeline', kinds: ['episode'] },
      { native: 'lesson', description: 'A reusable correction', category: 'working', kinds: ['lesson', 'feedback'] }
    ]
  },
  cursor: {
    title: 'Rules first, memory by scope',
    summary:
      'Cursor durable context is mainly project, user, and team instruction. Automation memory is a separate scoped layer.',
    path: '.cursor/rules + AGENTS.md',
    mappings: [
      { native: 'rule', description: 'Project, user, or team instruction', category: 'working', kinds: ['rule', 'workflow'] },
      { native: 'AGENTS.md', description: 'Shared repository guidance', category: 'projects', kinds: ['project', 'workflow'] },
      { native: 'automation memory', description: 'Named MEMORIES.md entries', category: 'knowledge', kinds: ['reference', 'fact'] }
    ]
  },
  'deepseek-harness': {
    title: 'Event log + MCP memory',
    summary:
      'The core session is append-only historical evidence. Durable memory is supplied by plugins or an MCP memory backend.',
    path: '~/.dsh/sessions + cordis.patch.yml',
    mappings: [
      { native: 'session event', description: 'Append-only task history', category: 'timeline', kinds: ['episode'] },
      { native: 'compaction', description: 'Projected working context', category: 'timeline', kinds: ['episode'] },
      { native: 'MCP memory', description: 'Externally stored durable context', category: 'knowledge', kinds: ['fact', 'reference'] },
      { native: 'durable cue', description: 'Explicit preference or correction', category: 'about', kinds: ['preference', 'feedback'] }
    ]
  },
  doubao: {
    title: 'Account memory + Agent Mode',
    summary:
      'Doubao manages account memory as independent, probabilistic topics. Agent Mode adds locally available workspace context.',
    path: 'Account memory + Doubao Agent Mode workspace',
    mappings: [
      { native: 'account memory', description: 'Probabilistic user-level recall', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'agent memory', description: 'Context isolated per assistant', category: 'knowledge', kinds: ['fact', 'reference'] },
      { native: 'Agent Mode', description: 'Local task workspace context', category: 'projects', kinds: ['project', 'episode'] }
    ]
  },
  'gemini-cli': {
    title: 'Instructions + added memories',
    summary:
      'Gemini CLI separates layered GEMINI.md context from facts explicitly appended by save_memory.',
    path: '~/.gemini/GEMINI.md + workspace GEMINI.md',
    mappings: [
      { native: 'GEMINI.md', description: 'Global, workspace, and path context', category: 'working', kinds: ['rule', 'workflow'] },
      { native: 'added memory', description: 'Facts appended by save_memory', category: 'knowledge', kinds: ['fact', 'reference'] },
      { native: 'session', description: 'Command and conversation history', category: 'timeline', kinds: ['episode'] }
    ]
  },
  copilot: {
    title: 'Instructions + CLI sessions',
    summary:
      'Copilot does not expose a four-type durable memory model. Instructions and local CLI history remain distinct.',
    path: '.github/instructions + Copilot CLI sessions',
    mappings: [
      { native: 'instructions', description: 'Repository and path-level guidance', category: 'working', kinds: ['rule', 'workflow'] },
      { native: 'AGENTS.md', description: 'Cross-tool project instruction', category: 'projects', kinds: ['project', 'workflow'] },
      { native: 'session', description: 'Local CLI conversation history', category: 'timeline', kinds: ['episode'] }
    ]
  },
  hermes: {
    title: 'User file + memory file',
    summary:
      'Hermes classifies by ownership first: USER.md describes the person, while MEMORY.md holds the agent’s own notes.',
    path: '~/.hermes/memories/USER.md + MEMORY.md',
    mappings: [
      { native: 'USER.md', description: 'Profile, communication, and expectations', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'MEMORY.md', description: 'Environment and learned facts', category: 'knowledge', kinds: ['fact', 'reference'] },
      { native: 'MEMORY.md', description: 'Project conventions and outcomes', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'session history', description: 'Evidence not imported as durable memory', category: 'timeline', kinds: ['episode'] }
    ]
  },
  opencode: {
    title: 'AGENTS.md + local sessions',
    summary:
      'OpenCode durable context is instruction-first. Local memory and session records are read as a compatibility layer.',
    path: '~/.config/opencode/AGENTS.md + project AGENTS.md',
    mappings: [
      { native: 'AGENTS.md', description: 'Global and project behavior', category: 'working', kinds: ['rule', 'workflow'] },
      { native: 'instructions', description: 'Referenced additional guidance', category: 'projects', kinds: ['project', 'workflow'] },
      { native: 'session', description: 'Local interaction history', category: 'timeline', kinds: ['episode'] }
    ]
  },
  pi: {
    title: 'Session tree and summaries',
    summary:
      'Pi records execution history. Compaction and branch summaries are episodes; only explicit durable cues become long-term memory.',
    path: '~/.pi/agent/sessions/*.jsonl',
    mappings: [
      { native: 'session', description: 'A branch of work in one directory', category: 'timeline', kinds: ['episode'] },
      { native: 'compaction', description: 'Compressed earlier context', category: 'timeline', kinds: ['episode'] },
      { native: 'branch summary', description: 'Work left behind when switching', category: 'timeline', kinds: ['episode'] },
      { native: 'durable cue', description: 'Explicit remember, always, or never', category: 'about', kinds: ['preference', 'feedback'] }
    ]
  },
  trae: {
    title: 'Profile, project, topics, sessions',
    summary:
      'Trae separates persistent profile and project memory from chronological topic and session summaries.',
    path: '~/.trae/memory/user_profile.md + projects',
    mappings: [
      { native: 'user_profile', description: 'Global identity and preferences', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'project_memory', description: 'Durable project context', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'topics.md', description: 'Topic summaries over time', category: 'timeline', kinds: ['episode'] },
      { native: 'session_memory', description: 'One task’s outcome and actions', category: 'timeline', kinds: ['episode'] }
    ]
  },
  workbuddy: {
    title: 'Four typed memory kinds',
    summary:
      'WorkBuddy chooses a native kind before dachshund files the entry into a broader memory category.',
    path: '~/.workbuddy/memory + MEMORY.md',
    mappings: [
      { native: 'user', description: 'Identity and stable preferences', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'feedback', description: 'Corrections and approved methods', category: 'working', kinds: ['feedback', 'lesson'] },
      { native: 'project', description: 'Goals, constraints, and active work', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'reference', description: 'Where to find external context', category: 'knowledge', kinds: ['reference', 'fact'] }
    ]
  },
  zcode: {
    title: 'Project typed memory',
    summary:
      'ZCode uses the same four native memory kinds as Claude Code and WorkBuddy, scoped to one project.',
    path: '~/.zcode/cli/memories/projects/<project>/memory',
    mappings: [
      { native: 'user', description: 'Stable user context', category: 'about', kinds: ['profile', 'preference'] },
      { native: 'feedback', description: 'Corrections to preserve', category: 'working', kinds: ['feedback', 'lesson'] },
      { native: 'project', description: 'Project decisions and constraints', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'reference', description: 'External context locations', category: 'knowledge', kinds: ['reference', 'fact'] }
    ]
  },
  windsurf: {
    title: 'Workspace memories + rules',
    summary:
      'Cascade memories are workspace-scoped. Rules remain explicit instructions and take a different path through dachshund.',
    path: '~/.codeium/windsurf/memories + rules',
    mappings: [
      { native: 'memory', description: 'A workspace-scoped Cascade memory', category: 'projects', kinds: ['project', 'decision'] },
      { native: 'rule', description: 'User, workspace, or system guidance', category: 'working', kinds: ['rule', 'workflow'] },
      { native: 'AGENTS.md', description: 'Location-scoped project instruction', category: 'projects', kinds: ['project', 'workflow'] }
    ]
  }
}

export function agentMemoryModel(agentId: string): AgentMemoryModel {
  return (
    AGENT_MEMORY_MODELS[agentId] ?? {
      title: 'Local agent memory',
      summary:
        'This agent exposes local memory files without a documented native taxonomy. dachshund classifies each imported entry by its kind.',
      path: 'Local memory files',
      mappings: [{ native: 'memory', description: 'Imported local context', category: 'knowledge', kinds: ['fact', 'reference'] }]
    }
  )
}
