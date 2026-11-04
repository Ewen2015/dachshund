import type { MemoryAuthority, MemoryScope, MemoryStatus } from './types'

export type MemoryCategoryId =
  | 'identity'
  | 'guidance'
  | 'knowledge'
  | 'current'
  | 'evidence'
  | 'unclassified'

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
    id: 'identity',
    label: 'Identity',
    shortLabel: 'Identity',
    description: 'Stable information about the user, role, expertise, and long-lived context.',
    color: '#B5542F',
    kinds: ['profile']
  },
  {
    id: 'guidance',
    label: 'Guidance',
    shortLabel: 'Guidance',
    description: 'Preferences, explicit rules, and repeatable procedures that direct future work.',
    color: '#55745F',
    kinds: ['preference', 'rule', 'procedure']
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    shortLabel: 'Knowledge',
    description: 'Durable facts, references, and insights learned from prior work.',
    color: '#9B7A4D',
    kinds: ['fact', 'reference', 'insight']
  },
  {
    id: 'current',
    label: 'Current work',
    shortLabel: 'Current',
    description: 'Goals, constraints, and decisions that define active work in a project or workspace.',
    color: '#5F7089',
    kinds: ['goal', 'constraint', 'decision']
  }
]

export const AUXILIARY_CATEGORIES: MemoryCategoryDefinition[] = [
  {
    id: 'evidence',
    label: 'Evidence',
    shortLabel: 'Evidence',
    description: 'Session summaries, rollouts, compactions, and logs retained as source evidence.',
    color: '#8B6D76',
    kinds: ['session_summary', 'task_rollout', 'compaction', 'workspace_log', 'feedback_event']
  },
  {
    id: 'unclassified',
    label: 'Unclassified',
    shortLabel: 'Review',
    description: 'Imported content whose native model does not justify a durable knowledge type yet.',
    color: '#77716A',
    kinds: ['unclassified']
  }
]

export const ALL_MEMORY_CATEGORIES = [...MEMORY_CATEGORIES, ...AUXILIARY_CATEGORIES]

const KIND_ALIASES: Record<string, string> = {
  profile: 'profile',
  user: 'profile',
  identity: 'profile',
  personal: 'profile',
  preference: 'preference',
  preferences: 'preference',
  rule: 'rule',
  instruction: 'rule',
  instructions: 'rule',
  guideline: 'rule',
  convention: 'rule',
  policy: 'rule',
  workflow: 'procedure',
  procedure: 'procedure',
  goal: 'goal',
  objective: 'goal',
  target: 'goal',
  constraint: 'constraint',
  limitation: 'constraint',
  decision: 'decision',
  fact: 'fact',
  reference: 'reference',
  link: 'reference',
  doc: 'reference',
  lesson: 'insight',
  takeaway: 'insight',
  insight: 'insight',
  session: 'session_summary',
  session_memory: 'session_summary',
  'session-summary': 'session_summary',
  session_summary: 'session_summary',
  topic: 'session_summary',
  history: 'session_summary',
  episode: 'session_summary',
  branch_summary: 'session_summary',
  'branch-summary': 'session_summary',
  rollout: 'task_rollout',
  thread: 'task_rollout',
  'task-rollout': 'task_rollout',
  task_rollout: 'task_rollout',
  compaction: 'compaction',
  workspace_log: 'workspace_log',
  'workspace-log': 'workspace_log',
  daily_log: 'workspace_log',
  feedback_event: 'feedback_event',
  'feedback-event': 'feedback_event',
  correction_event: 'feedback_event',
  unknown: 'unclassified',
  unclassified: 'unclassified'
}

export const MEMORY_KIND_LABELS: Record<string, string> = {
  profile: 'Profile',
  preference: 'Preference',
  rule: 'Rule',
  procedure: 'Procedure',
  goal: 'Goal',
  constraint: 'Constraint',
  decision: 'Decision',
  fact: 'Fact',
  reference: 'Reference',
  insight: 'Insight',
  session_summary: 'Session summary',
  task_rollout: 'Task rollout',
  compaction: 'Compaction',
  workspace_log: 'Workspace log',
  feedback_event: 'Feedback event',
  unclassified: 'Unclassified'
}

function classifyFeedback(content: string): string {
  if (
    /(必须|始终|永远|禁止|不要|不能|不得|never|must|always|do not|don't|avoid)/i.test(content)
  ) {
    return 'rule'
  }
  if (/(偏好|更喜欢|prefer|preference|default|默认|倾向于)/i.test(content)) {
    return 'preference'
  }
  if (/(失败|教训|原因|导致|根因|learned|lesson|failed|because|root cause)/i.test(content)) {
    return 'insight'
  }
  return 'unclassified'
}

function classifyProject(content: string): string {
  if (/(决定|已确定|采用|decision|decided|we chose|chosen approach)/i.test(content)) {
    return 'decision'
  }
  if (
    /(约束|限制|截止|必须|不能|不得|只能|constraint|constrained to|limited to|out of scope|deadline|blocked|cannot|must not|requires?|\bmust\b|is due)/i.test(content)
  ) {
    return 'constraint'
  }
  if (/(目标|里程碑|计划|下一步|goal|objective|milestone|next step)/i.test(content)) {
    return 'goal'
  }
  if (/(链接|路径|资料|参考|reference|https?:\/\/|file:\/\/)/i.test(content)) {
    return 'reference'
  }
  return 'unclassified'
}

export function inferTextKind(value: string, fallback = 'unclassified'): string {
  const result = classifyFeedback(value)
  return result === 'unclassified' ? fallback : result
}

export function normalizeMemoryKind(value: unknown, content = ''): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return 'unclassified'
  const key = raw.replace(/\s+/g, '-')
  if (key === 'feedback' || key === 'correction') return classifyFeedback(content)
  if (
    key === 'project' ||
    key === 'task' ||
    key === 'task-group' ||
    key === 'task_group' ||
    key === 'project_memory'
  ) {
    return classifyProject(content)
  }
  return KIND_ALIASES[key] ?? KIND_ALIASES[raw] ?? 'unclassified'
}

export function categoryForKind(value: unknown): MemoryCategoryId {
  const kind = normalizeMemoryKind(value)
  return (
    ALL_MEMORY_CATEGORIES.find((category) => category.kinds.includes(kind))?.id ??
    'unclassified'
  )
}

export function memoryCategoryCounts(
  memories: Array<{ kind: string }>
): Record<MemoryCategoryId, number> {
  const counts = Object.fromEntries(
    ALL_MEMORY_CATEGORIES.map((category) => [category.id, 0])
  ) as Record<MemoryCategoryId, number>
  for (const memory of memories) counts[categoryForKind(memory.kind)] += 1
  return counts
}

export function categoryDefinition(value: unknown): MemoryCategoryDefinition {
  return (
    ALL_MEMORY_CATEGORIES.find((category) => category.id === value) ??
    AUXILIARY_CATEGORIES[AUXILIARY_CATEGORIES.length - 1]
  )
}

export function kindLabel(value: unknown): string {
  const kind = normalizeMemoryKind(value)
  return MEMORY_KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function isEvidenceKind(value: unknown): boolean {
  return categoryForKind(value) === 'evidence'
}

export function isUnclassifiedKind(value: unknown): boolean {
  return normalizeMemoryKind(value) === 'unclassified'
}

export function normalizeMemoryScope(value: unknown, project?: string | null): MemoryScope {
  return value === 'user' ||
    value === 'project' ||
    value === 'workspace' ||
    value === 'path' ||
    value === 'session'
    ? value
    : project
      ? 'project'
      : 'user'
}

export function normalizeMemoryAuthority(value: unknown): MemoryAuthority {
  return value === 'user_explicit' ||
    value === 'project_declared' ||
    value === 'agent_observed' ||
    value === 'inferred'
    ? value
    : 'agent_observed'
}

export function normalizeMemoryStatus(value: unknown, kind?: unknown): MemoryStatus {
  if (value === 'active' || value === 'superseded' || value === 'archived') return value
  if (normalizeMemoryKind(kind) === 'unclassified') return 'unclassified'
  return 'active'
}

export function scopeLabel(value: MemoryScope): string {
  return {
    user: 'User',
    project: 'Project',
    workspace: 'Workspace',
    path: 'Path',
    session: 'Session'
  }[value]
}

export function authorityLabel(value: MemoryAuthority): string {
  return {
    user_explicit: 'User explicit',
    project_declared: 'Project declared',
    agent_observed: 'Agent observed',
    inferred: 'Inferred'
  }[value]
}

export function statusLabel(value: MemoryStatus): string {
  return {
    active: 'Active',
    superseded: 'Superseded',
    archived: 'Archived',
    unclassified: 'Needs review'
  }[value]
}

export const AGENT_MEMORY_MODELS: Record<string, AgentMemoryModel> = {
  'claude-code': {
    title: 'Typed auto memory + written instructions',
    summary:
      'Claude Code keeps CLAUDE.md and rules separate from four typed auto-memory files scoped to each repository.',
    path: '~/.claude/projects/<repo>/memory + CLAUDE.md + rules',
    mappings: [
      { native: 'user', description: 'Role, expertise, and stable user context', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Explicit corrections become rules or preferences', category: 'guidance', kinds: ['preference', 'rule'], imported: true },
      { native: 'feedback outcome', description: 'A failed approach or reusable conclusion becomes an insight', category: 'knowledge', kinds: ['insight'], imported: true },
      { native: 'project', description: 'Goals, constraints, and decisions under repository scope', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'reference', description: 'Where external context lives', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'CLAUDE.md / rules', description: 'Written global and project instructions', category: 'guidance', kinds: ['rule'], imported: true }
    ]
  },
  'claude-desktop': {
    title: 'Local Space memory + account topics',
    summary:
      'Claude Desktop keeps Cowork Space memory in local Markdown topic files. Account and ordinary Chat memory remain server-side; dachshund reads the local Space files and connects the rest over MCP.',
    path: '~/Library/Application Support/Claude-3p/local-agent-mode-sessions/.../spaces/<id>/memory',
    mappings: [
      { native: 'user topic', description: 'Stable identity and long-lived user context', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'feedback topic', description: 'Corrections become preferences or rules', category: 'guidance', kinds: ['preference', 'rule'], imported: true },
      { native: 'feedback outcome', description: 'A failed approach or reusable conclusion becomes an insight', category: 'knowledge', kinds: ['insight'], imported: true },
      { native: 'project topic', description: 'Goals, constraints, and decisions under Space scope', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'reference topic', description: 'Where external information lives', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'local account topic', description: 'Untyped local topic without a knowledge type', category: 'unclassified', kinds: ['unclassified'], imported: true },
      { native: 'local agent topic', description: 'Untyped local agent topic without a knowledge type', category: 'unclassified', kinds: ['unclassified'], imported: true },
      { native: 'MEMORY.md', description: 'Index only; topic files hold the memory bodies', category: 'knowledge', kinds: ['reference'], imported: false },
      { native: 'server-side Chat memory', description: 'Ordinary Chat topics stored on the account', category: 'unclassified', kinds: ['unclassified'], imported: false },
      { native: 'cloud project memory', description: 'Cloud project memory absent from the local topic store', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: false }
    ]
  },
  codex: {
    title: 'Scoped task evidence + explicit durable knowledge',
    summary:
      'Codex task groups and rollouts remain evidence while cwd or task-group metadata supplies their project scope. Explicit reusable knowledge becomes an insight or procedure.',
    path: '~/.codex/memories + rollouts',
    mappings: [
      { native: 'task group', description: 'A workstream summary and project scope stored as evidence', category: 'evidence', kinds: ['task_rollout'], imported: true },
      { native: 'summary · identity', description: 'Merged summary identity section', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'summary · guidance', description: 'Preferences, rules, and procedures in a merged summary', category: 'guidance', kinds: ['preference', 'rule', 'procedure'], imported: true },
      { native: 'summary · knowledge', description: 'Facts, references, and insights in a merged summary', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: true },
      { native: 'summary · current', description: 'Goals, constraints, and decisions in a merged summary', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'rollout / raw thread', description: 'Evidence from a completed task with cwd scope', category: 'evidence', kinds: ['task_rollout'], imported: true },
      { native: 'Reusable knowledge', description: 'An explicitly extracted insight or procedure', category: 'knowledge', kinds: ['insight'], imported: true },
      { native: 'Reusable procedure', description: 'Reusable steps extracted from prior work', category: 'guidance', kinds: ['procedure'], imported: true }
    ]
  },
  cursor: {
    title: 'Rules and agent definitions',
    summary:
      'dachshund imports the local Cursor rules and agent definitions. Project AGENTS.md files and cloud automation memories are not scanned.',
    path: '~/.cursor/rules + ~/.cursor/agents',
    mappings: [
      { native: 'rule', description: 'Local user or project rule', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'agent definition', description: 'Markdown or MDC agent guidance', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'AGENTS.md', description: 'Repository instruction outside the local Cursor home', category: 'guidance', kinds: ['rule'], imported: false },
      { native: 'automation memory', description: 'Named MEMORIES.md entries owned by a cloud automation', category: 'unclassified', kinds: ['unclassified'], imported: false }
    ]
  },
  'deepseek-harness': {
    title: 'Event evidence + shared MCP memory',
    summary:
      'DeepSeek Harness keeps append-only session evidence. dachshund derives durable cues from human user events, imports compaction summaries as history, and reads the user-global AGENTS.md instructions. Raw sessions and tool output stay evidence; the MCP connector shares dachshund’s library.',
    path: '~/.dsh/sessions + AGENTS.md + cordis.patch.yml',
    mappings: [
      { native: 'session event', description: 'Append-only task history used only as scan input', category: 'evidence', kinds: ['session_summary'], imported: false },
      { native: 'compaction summary', description: 'Model-generated summary of a shadowed context range', category: 'evidence', kinds: ['compaction'], imported: true },
      { native: 'user-global AGENTS.md', description: 'Instructions loaded from ~/.dsh/AGENTS.md', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'MCP shared memory', description: 'dachshund tools expose the same shared library to DeepSeek Harness', category: 'unclassified', kinds: ['unclassified'], imported: false },
      { native: 'durable preference', description: 'Explicit remember, always, or preference cue', category: 'guidance', kinds: ['preference'], imported: true },
      { native: 'durable correction', description: 'Explicit correction becomes a rule, preference, or insight', category: 'guidance', kinds: ['rule', 'preference'], imported: true }
    ]
  },
  doubao: {
    title: 'MCP shared memory + local Agent Mode files',
    summary:
      'Doubao account memory is probabilistic and account-scoped, while Agent Mode workspace files may be imported locally. After MCP setup, Doubao can also search and write dachshund’s shared library.',
    path: '~/Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace',
    mappings: [
      { native: 'account memory', description: 'Probabilistic user-level recall', category: 'identity', kinds: ['profile'], imported: false },
      { native: 'assistant memory', description: 'Context isolated per Doubao assistant', category: 'unclassified', kinds: ['unclassified'], imported: false },
      { native: 'Agent Mode memory', description: 'Local workspace and session context without a reliable native type', category: 'unclassified', kinds: ['unclassified'], imported: true }
    ]
  },
  'gemini-cli': {
    title: 'Instructions + added memories',
    summary:
      'Gemini CLI separates layered GEMINI.md context from facts explicitly appended by save_memory.',
    path: '~/.gemini/GEMINI.md + workspace GEMINI.md',
    mappings: [
      { native: 'GEMINI.md', description: 'Global, workspace, and path instructions', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'added memory', description: 'Facts appended by save_memory', category: 'knowledge', kinds: ['fact'], imported: true },
      { native: 'session', description: 'Command and conversation history', category: 'evidence', kinds: ['session_summary'], imported: false }
    ]
  },
  copilot: {
    title: 'Local memory + instructions',
    summary:
      'Copilot does not expose a four-type durable memory model. dachshund imports local memory and instruction Markdown but does not import CLI sessions.',
    path: '~/.copilot/memories + ~/.copilot/instructions',
    mappings: [
      { native: 'instructions', description: 'Local instruction Markdown', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'local memory', description: 'Untyped local memory Markdown', category: 'unclassified', kinds: ['unclassified'], imported: true },
      { native: 'AGENTS.md', description: 'Tool-native repository instruction', category: 'guidance', kinds: ['rule'], imported: false },
      { native: 'CLI session', description: 'Local and account-synced conversation history', category: 'evidence', kinds: ['session_summary'], imported: false }
    ]
  },
  hermes: {
    title: 'User file + memory file',
    summary:
      'Hermes classifies by ownership first: USER.md describes the person, while MEMORY.md holds the agent’s own notes.',
    path: '~/.hermes/memories/USER.md + MEMORY.md',
    mappings: [
      { native: 'USER.md', description: 'Profile and stable user context', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'MEMORY.md', description: 'Untyped agent notes remain unclassified until reviewed', category: 'unclassified', kinds: ['unclassified'], imported: true },
      { native: 'session history', description: 'Evidence not imported as durable memory', category: 'evidence', kinds: ['session_summary'], imported: false }
    ]
  },
  opencode: {
    title: 'Global instructions + observed memory',
    summary:
      'OpenCode durable context is instruction-first. dachshund imports the global AGENTS.md and observed local memory Markdown, but not project instructions or sessions.',
    path: '~/.config/opencode/AGENTS.md + memory',
    mappings: [
      { native: 'global AGENTS.md', description: 'Global OpenCode behavior', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'memory Markdown', description: 'Untyped observed local memory files', category: 'unclassified', kinds: ['unclassified'], imported: true },
      { native: 'project AGENTS.md', description: 'Repository-scoped instructions', category: 'guidance', kinds: ['rule'], imported: false },
      { native: 'session', description: 'Local interaction history', category: 'evidence', kinds: ['session_summary'], imported: false }
    ]
  },
  pi: {
    title: 'Session tree and summaries',
    summary:
      'Pi records execution history. Compaction and branch summaries are episodes; only explicit durable cues become long-term memory.',
    path: '~/.pi/agent/sessions/*.jsonl',
    mappings: [
      { native: 'session', description: 'A branch of work in one directory', category: 'evidence', kinds: ['session_summary'], imported: false },
      { native: 'compaction', description: 'Compressed earlier context', category: 'evidence', kinds: ['compaction'], imported: true },
      { native: 'branch summary', description: 'Work left behind when switching', category: 'evidence', kinds: ['session_summary'], imported: true },
      { native: 'durable preference', description: 'Explicit remember, always, or preference cue', category: 'guidance', kinds: ['preference'], imported: true },
      { native: 'durable correction', description: 'Explicit correction becomes a rule, preference, or insight', category: 'guidance', kinds: ['rule', 'preference'], imported: true }
    ]
  },
  trae: {
    title: 'Agent + IDE memory',
    summary:
      'TRAE combines Agent and IDE modes while keeping durable profile and project memory separate from chronological topic and session summaries.',
    path: '~/.trae-cn or ~/.trae / memory/user_profile.md + projects',
    mappings: [
      { native: 'user_profile', description: 'Global identity and stable user context', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'project_memory', description: 'Goals, constraints, and decisions under project scope', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'topics.md', description: 'Topic summaries over time', category: 'evidence', kinds: ['session_summary'], imported: true },
      { native: 'session_memory', description: 'One task’s outcome and actions', category: 'evidence', kinds: ['session_summary'], imported: true }
    ]
  },
  workbuddy: {
    title: 'Four typed memory kinds',
    summary:
      'WorkBuddy chooses a native kind before dachshund files the entry into a broader memory category. Dated workspace logs remain source evidence while the workspace name becomes their scope.',
    path: '~/.workbuddy/IDENTITY.md + USER.md + memory',
    mappings: [
      { native: 'user', description: 'Stable identity and user context', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Corrections become preferences or rules', category: 'guidance', kinds: ['preference', 'rule'], imported: true },
      { native: 'feedback outcome', description: 'A failed approach or reusable conclusion becomes an insight', category: 'knowledge', kinds: ['insight'], imported: true },
      { native: 'project', description: 'Goals, constraints, and decisions under workspace scope', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'reference', description: 'Where to find external context', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'YYYY-MM-DD workspace log', description: 'Dated workspace evidence with a session scope', category: 'evidence', kinds: ['workspace_log'], imported: true },
      { native: 'assistant identity', description: 'How the assistant presents itself', category: 'guidance', kinds: ['rule'], imported: true }
    ]
  },
  zcode: {
    title: 'Project typed memory + session cues',
    summary:
      'ZCode writes project-scoped Markdown memory with four native kinds. dachshund also scans the local session database for explicit durable cues.',
    path: '~/.zcode/cli/memories/projects/<project>/memory + db.sqlite',
    mappings: [
      { native: 'user', description: 'Stable user context', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Corrections become preferences or rules', category: 'guidance', kinds: ['preference', 'rule'], imported: true },
      { native: 'feedback outcome', description: 'A failed approach or reusable conclusion becomes an insight', category: 'knowledge', kinds: ['insight'], imported: true },
      { native: 'project', description: 'Goals, constraints, and decisions under project scope', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'reference', description: 'External context locations', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'durable preference', description: 'Explicit preference found in session text', category: 'guidance', kinds: ['preference'], imported: true },
      { native: 'durable correction', description: 'Explicit correction becomes a rule, preference, or insight', category: 'guidance', kinds: ['rule', 'preference'], imported: true }
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
      mappings: [{ native: 'memory', description: 'Recognized local context', category: 'unclassified', kinds: ['unclassified'], imported: false }]
    }
  )
}
