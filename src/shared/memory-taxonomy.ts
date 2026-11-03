export type MemoryCategoryId = 'about' | 'working' | 'projects' | 'knowledge' | 'episodes'

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
  imported: boolean
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
    label: 'Ways of working',
    shortLabel: 'Working',
    description:
      'Rules, corrections, reusable lessons, and repeatable workflows that shape how agents work with you.',
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
    label: 'Facts & references',
    shortLabel: 'Facts',
    description: 'Durable facts and pointers to documents, links, and external systems.',
    color: '#9B7A4D',
    kinds: ['fact', 'reference']
  },
  {
    id: 'episodes',
    label: 'History',
    shortLabel: 'History',
    description:
      'Chronological session summaries, task rollouts, and workspace logs kept as evidence rather than current project state.',
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
    title: 'Typed auto memory + written instructions',
    summary:
      'Claude Code keeps CLAUDE.md and rules separate from four typed auto-memory files scoped to each repository.',
    path: '~/.claude/projects/<repo>/memory + CLAUDE.md + rules',
    mappings: [
      { native: 'user', description: 'Role, expertise, and working preferences', category: 'about', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Corrections and approved methods', category: 'working', kinds: ['feedback'], imported: true },
      { native: 'project', description: 'Goals, deadlines, and decisions', category: 'projects', kinds: ['project'], imported: true },
      { native: 'reference', description: 'Where external context lives', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'CLAUDE.md / rules', description: 'Written global and project instructions', category: 'working', kinds: ['rule'], imported: true }
    ]
  },
  'claude-desktop': {
    title: 'Local Space memory + account topics',
    summary:
      'Claude Desktop keeps Cowork Space memory in local Markdown topic files. Account and ordinary Chat memory remain server-side; dachshund reads the local Space files and connects the rest over MCP.',
    path: '~/Library/Application Support/Claude-3p/local-agent-mode-sessions/.../spaces/<id>/memory',
    mappings: [
      { native: 'user topic', description: 'Role, goals, preferences, and knowledge', category: 'about', kinds: ['profile'], imported: true },
      { native: 'feedback topic', description: 'Corrections and confirmed working methods', category: 'working', kinds: ['feedback'], imported: true },
      { native: 'project topic', description: 'Ongoing work, decisions, and deadlines', category: 'projects', kinds: ['project'], imported: true },
      { native: 'reference topic', description: 'Where external information lives', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'local account topic', description: 'Topic files under the local account memory directory', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'local agent topic', description: 'Topic files under the local agent memory directory', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'MEMORY.md', description: 'Index only; topic files hold the memory bodies', category: 'knowledge', kinds: ['fact'], imported: false },
      { native: 'server-side Chat memory', description: 'Ordinary Chat topics and preferences stored on the account', category: 'knowledge', kinds: ['fact'], imported: false },
      { native: 'cloud project memory', description: 'Project memory that is not present as a local topic file', category: 'projects', kinds: ['project'], imported: false }
    ]
  },
  codex: {
    title: 'Scoped task history + explicit lessons',
    summary:
      'Codex task groups and rollouts stay in History while cwd or task-group metadata supplies their project scope. Only explicit reusable-knowledge sections become Ways of working.',
    path: '~/.codex/memories + rollouts',
    mappings: [
      { native: 'task group', description: 'A workstream summary and project scope; not automatically current project state', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'summary', description: 'Merged user and workflow context', category: 'about', kinds: ['profile'], imported: true },
      { native: 'rollout / raw thread', description: 'Evidence from a completed task with cwd scope', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'Reusable knowledge', description: 'An explicitly extracted reusable lesson', category: 'working', kinds: ['lesson'], imported: true }
    ]
  },
  cursor: {
    title: 'Rules and agent definitions',
    summary:
      'dachshund imports the local Cursor rules and agent definitions. Project AGENTS.md files and cloud automation memories are not scanned.',
    path: '~/.cursor/rules + ~/.cursor/agents',
    mappings: [
      { native: 'rule', description: 'Local user or project rule', category: 'working', kinds: ['rule'], imported: true },
      { native: 'agent definition', description: 'Markdown or MDC agent guidance', category: 'working', kinds: ['rule'], imported: true },
      { native: 'AGENTS.md', description: 'Repository instruction outside the local Cursor home', category: 'working', kinds: ['rule'], imported: false },
      { native: 'automation memory', description: 'Named MEMORIES.md entries owned by a cloud automation', category: 'knowledge', kinds: ['fact'], imported: false }
    ]
  },
  'deepseek-harness': {
    title: 'Event evidence + shared MCP memory',
    summary:
      'DeepSeek Harness keeps append-only session evidence. dachshund derives durable cues from human user events, imports compaction summaries as history, and reads the user-global AGENTS.md instructions. Raw sessions and tool output stay evidence; the MCP connector shares dachshund’s library.',
    path: '~/.dsh/sessions + AGENTS.md + cordis.patch.yml',
    mappings: [
      { native: 'session event', description: 'Append-only task history used only as scan input', category: 'episodes', kinds: ['episode'], imported: false },
      { native: 'compaction summary', description: 'Model-generated summary of a shadowed context range', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'user-global AGENTS.md', description: 'Instructions loaded from ~/.dsh/AGENTS.md', category: 'working', kinds: ['rule'], imported: true },
      { native: 'MCP shared memory', description: 'dachshund tools expose the same shared library to DeepSeek Harness', category: 'knowledge', kinds: ['fact'], imported: false },
      { native: 'durable preference', description: 'Explicit remember, always, or preference cue', category: 'about', kinds: ['preference'], imported: true },
      { native: 'durable correction', description: 'Explicit never, do not, or correction cue', category: 'working', kinds: ['feedback'], imported: true }
    ]
  },
  doubao: {
    title: 'MCP shared memory + local Agent Mode files',
    summary:
      'Doubao account memory is probabilistic and account-scoped, while Agent Mode workspace files may be imported locally. After MCP setup, Doubao can also search and write dachshund’s shared library.',
    path: '~/Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace',
    mappings: [
      { native: 'account memory', description: 'Probabilistic user-level recall', category: 'about', kinds: ['profile'], imported: false },
      { native: 'assistant memory', description: 'Context isolated per Doubao assistant', category: 'knowledge', kinds: ['fact'], imported: false },
      { native: 'Agent Mode memory', description: 'Local workspace and session task context', category: 'projects', kinds: ['project'], imported: true }
    ]
  },
  'gemini-cli': {
    title: 'Instructions + added memories',
    summary:
      'Gemini CLI separates layered GEMINI.md context from facts explicitly appended by save_memory.',
    path: '~/.gemini/GEMINI.md + workspace GEMINI.md',
    mappings: [
      { native: 'GEMINI.md', description: 'Global, workspace, and path instructions', category: 'working', kinds: ['rule'], imported: true },
      { native: 'added memory', description: 'Facts appended by save_memory', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'session', description: 'Command and conversation history', category: 'episodes', kinds: ['episode'], imported: false }
    ]
  },
  copilot: {
    title: 'Local memory + instructions',
    summary:
      'Copilot does not expose a four-type durable memory model. dachshund imports local memory and instruction Markdown but does not import CLI sessions.',
    path: '~/.copilot/memories + ~/.copilot/instructions',
    mappings: [
      { native: 'instructions', description: 'Local instruction Markdown', category: 'working', kinds: ['rule'], imported: true },
      { native: 'local memory', description: 'Untyped local memory Markdown', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'AGENTS.md', description: 'Tool-native repository instruction', category: 'working', kinds: ['rule'], imported: false },
      { native: 'CLI session', description: 'Local and account-synced conversation history', category: 'episodes', kinds: ['episode'], imported: false }
    ]
  },
  hermes: {
    title: 'User file + memory file',
    summary:
      'Hermes classifies by ownership first: USER.md describes the person, while MEMORY.md holds the agent’s own notes.',
    path: '~/.hermes/memories/USER.md + MEMORY.md',
    mappings: [
      { native: 'USER.md', description: 'Profile, communication, and expectations', category: 'about', kinds: ['profile'], imported: true },
      { native: 'MEMORY.md', description: 'Untyped agent notes, conservatively imported as facts', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'session history', description: 'Evidence not imported as durable memory', category: 'episodes', kinds: ['episode'], imported: false }
    ]
  },
  opencode: {
    title: 'Global instructions + observed memory',
    summary:
      'OpenCode durable context is instruction-first. dachshund imports the global AGENTS.md and observed local memory Markdown, but not project instructions or sessions.',
    path: '~/.config/opencode/AGENTS.md + memory',
    mappings: [
      { native: 'global AGENTS.md', description: 'Global OpenCode behavior', category: 'working', kinds: ['rule'], imported: true },
      { native: 'memory Markdown', description: 'Untyped observed local memory files', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'project AGENTS.md', description: 'Repository-scoped instructions', category: 'working', kinds: ['rule'], imported: false },
      { native: 'session', description: 'Local interaction history', category: 'episodes', kinds: ['episode'], imported: false }
    ]
  },
  pi: {
    title: 'Session tree and summaries',
    summary:
      'Pi records execution history. Compaction and branch summaries are episodes; only explicit durable cues become long-term memory.',
    path: '~/.pi/agent/sessions/*.jsonl',
    mappings: [
      { native: 'session', description: 'A branch of work in one directory', category: 'episodes', kinds: ['episode'], imported: false },
      { native: 'compaction', description: 'Compressed earlier context', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'branch summary', description: 'Work left behind when switching', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'durable preference', description: 'Explicit remember, always, or preference cue', category: 'about', kinds: ['preference'], imported: true },
      { native: 'durable correction', description: 'Explicit never, do not, or correction cue', category: 'working', kinds: ['feedback'], imported: true }
    ]
  },
  trae: {
    title: 'Agent + IDE memory',
    summary:
      'TRAE combines Agent and IDE modes while keeping durable profile and project memory separate from chronological topic and session summaries.',
    path: '~/.trae-cn or ~/.trae / memory/user_profile.md + projects',
    mappings: [
      { native: 'user_profile', description: 'Global identity and preferences', category: 'about', kinds: ['profile'], imported: true },
      { native: 'project_memory', description: 'Durable project context', category: 'projects', kinds: ['project'], imported: true },
      { native: 'topics.md', description: 'Topic summaries over time', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'session_memory', description: 'One task’s outcome and actions', category: 'episodes', kinds: ['episode'], imported: true }
    ]
  },
  workbuddy: {
    title: 'Four typed memory kinds',
    summary:
      'WorkBuddy chooses a native kind before dachshund files the entry into a broader memory category. Dated workspace logs remain chronological History while the workspace name becomes their scope.',
    path: '~/.workbuddy/IDENTITY.md + USER.md + memory',
    mappings: [
      { native: 'user', description: 'Identity and stable preferences', category: 'about', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Corrections and approved methods', category: 'working', kinds: ['feedback'], imported: true },
      { native: 'project', description: 'Goals, constraints, and active work', category: 'projects', kinds: ['project'], imported: true },
      { native: 'reference', description: 'Where to find external context', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'YYYY-MM-DD workspace log', description: 'Dated workspace evidence with a session scope', category: 'episodes', kinds: ['episode'], imported: true },
      { native: 'assistant identity', description: 'How the assistant presents itself', category: 'working', kinds: ['rule'], imported: true }
    ]
  },
  zcode: {
    title: 'Project typed memory + session cues',
    summary:
      'ZCode writes project-scoped Markdown memory with four native kinds. dachshund also scans the local session database for explicit durable cues.',
    path: '~/.zcode/cli/memories/projects/<project>/memory + db.sqlite',
    mappings: [
      { native: 'user', description: 'Stable user context', category: 'about', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Corrections to preserve', category: 'working', kinds: ['feedback'], imported: true },
      { native: 'project', description: 'Project decisions and constraints', category: 'projects', kinds: ['project'], imported: true },
      { native: 'reference', description: 'External context locations', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'durable preference', description: 'Explicit preference found in session text', category: 'about', kinds: ['preference'], imported: true },
      { native: 'durable correction', description: 'Explicit correction found in session text', category: 'working', kinds: ['feedback'], imported: true }
    ]
  },
  windsurf: {
    title: 'Workspace memories',
    summary:
      'Cascade memories are workspace-scoped. dachshund imports the local memories directory; current Devin Local rules and project AGENTS.md files are not scanned.',
    path: '~/.codeium/windsurf/memories',
    mappings: [
      { native: 'memory', description: 'A workspace-scoped Cascade memory', category: 'projects', kinds: ['project'], imported: true },
      { native: 'rule', description: 'User, workspace, or system guidance', category: 'working', kinds: ['rule'], imported: false },
      { native: 'AGENTS.md', description: 'Location-scoped project instruction', category: 'working', kinds: ['rule'], imported: false }
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
      mappings: [{ native: 'memory', description: 'Recognized local context', category: 'knowledge', kinds: ['fact'], imported: false }]
    }
  )
}
