import type { MemoryAuthority, MemoryScope, MemoryStatus } from './types'

export type MemoryCategoryId =
  | 'identity'
  | 'guidance'
  | 'knowledge'
  | 'current'
  | 'evidence'

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
  correction_event: 'feedback_event'
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
  feedback_event: 'Feedback event'
}

function classifyFeedback(content: string, fallback = 'fact'): string {
  if (/(偏好|更喜欢|prefer|preference|default|默认|倾向于)/i.test(content)) {
    return 'preference'
  }
  if (
    /(必须|始终|永远|禁止|不要|不能|不得|never|must|always|do not|don't|avoid)/i.test(content)
  ) {
    return 'rule'
  }
  if (/(失败|教训|原因|导致|根因|learned|lesson|failed|because|root cause)/i.test(content)) {
    return 'insight'
  }
  return fallback
}

function classifyProject(content: string, fallback = 'fact'): string {
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
  if (
    /(链接|路径|资料|参考|reference|https?:\/\/|file:\/\/|\/Users\/|~\/|\bpath\b|directory|folder)/i.test(
      content
    )
  ) {
    return 'reference'
  }
  return fallback
}

function classifyText(value: string, fallback = 'fact'): string {
  const feedback = classifyFeedback(value, '')
  if (feedback) return feedback
  if (
    /(我的名字|我叫|姓名|时区|timezone|time zone|称呼| pronouns?|role|职位|身份|expertise|专业领域|about me|关于我)/i.test(
      value
    )
  ) {
    return 'profile'
  }
  if (/(流程|步骤|工作流|procedure|workflow|steps|playbook|runbook)/i.test(value)) {
    return 'procedure'
  }
  if (/(决定|已确定|采用|decision|decided|we chose|chosen approach)/i.test(value)) {
    return 'decision'
  }
  if (/(目标|里程碑|计划|下一步|goal|objective|milestone|next step)/i.test(value)) {
    return 'goal'
  }
  if (
    /(约束|限制|截止|constraint|constrained to|limited to|out of scope|deadline|blocked|requires?|is due)/i.test(
      value
    )
  ) {
    return 'constraint'
  }
  if (
    /(链接|路径|资料|参考|reference|https?:\/\/|file:\/\/|\/Users\/|~\/|\bpath\b|directory|folder)/i.test(
      value
    )
  ) {
    return 'reference'
  }
  if (/(失败|教训|原因|导致|根因|learned|lesson|failed|because|root cause)/i.test(value)) {
    return 'insight'
  }
  return fallback
}

export function inferTextKind(value: string, fallback = 'fact'): string {
  return classifyText(value, fallback)
}

export function normalizeMemoryKind(value: unknown, content = ''): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw || raw === 'unknown' || raw === 'unclassified') {
    return inferTextKind(content, 'fact')
  }
  const key = raw.replace(/\s+/g, '-')
  if (key === 'feedback' || key === 'correction') return classifyFeedback(content, 'fact')
  if (
    key === 'project' ||
    key === 'task' ||
    key === 'task-group' ||
    key === 'task_group' ||
    key === 'project_memory'
  ) {
    return classifyProject(content, 'fact')
  }
  return KIND_ALIASES[key] ?? KIND_ALIASES[raw] ?? inferTextKind(content, 'fact')
}

export function categoryForKind(value: unknown): MemoryCategoryId {
  const kind = normalizeMemoryKind(value)
  return (
    ALL_MEMORY_CATEGORIES.find((category) => category.kinds.includes(kind))?.id ??
    'knowledge'
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
    MEMORY_CATEGORIES.find((category) => category.id === 'knowledge') ??
    ALL_MEMORY_CATEGORIES[0]
  )
}

export function kindLabel(value: unknown): string {
  const kind = normalizeMemoryKind(value)
  return MEMORY_KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function isEvidenceKind(value: unknown): boolean {
  return categoryForKind(value) === 'evidence'
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

export function normalizeMemoryStatus(value: unknown, _kind?: unknown): MemoryStatus {
  if (value === 'active' || value === 'superseded' || value === 'archived') return value
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
    archived: 'Archived'
  }[value]
}

export const AGENT_MEMORY_MODELS: Record<string, AgentMemoryModel> = {
  claude: {
    title: 'Injected index + notes on demand',
    summary:
      'Claude Code injects the first 200 lines or 25 KB of a MEMORY.md index into every session and keeps typed topic notes on disk for on-demand reading; session transcripts remain the ground truth that offline consolidation (dreaming) checks those notes against. Claude Desktop keeps the same index-and-topic layout for account, agent, and Space topics. Account Chat and cloud project memory stay server-side and reach dachshund over MCP.',
    path: '~/.claude/projects/<repo>/memory/MEMORY.md + topics + CLAUDE.md · Claude-3p/.../memory/MEMORY.md',
    mappings: [
      { native: 'MEMORY.md index', description: 'Injected top layer: first 200 lines or 25 KB, linking to notes read on demand', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'user', description: 'Role, expertise, and stable user context in a Claude Code note or Desktop topic', category: 'identity', kinds: ['profile'], imported: true },
      { native: 'feedback', description: 'Explicit corrections become rules or preferences', category: 'guidance', kinds: ['preference', 'rule'], imported: true },
      { native: 'feedback outcome', description: 'A failed approach, correction, or trap becomes an insight', category: 'knowledge', kinds: ['insight'], imported: true },
      { native: 'project', description: 'Goals, constraints, and decisions under repository or Space scope', category: 'current', kinds: ['goal', 'constraint', 'decision'], imported: true },
      { native: 'reference', description: 'Where external context lives', category: 'knowledge', kinds: ['reference'], imported: true },
      { native: 'CLAUDE.md / rules', description: 'Written global and project instructions from Claude Code', category: 'guidance', kinds: ['rule'], imported: true },
      { native: 'local Desktop topic', description: 'Untyped account, agent, or Space topic resolved into a durable kind', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: true },
      { native: 'session transcript', description: 'Ground truth for offline consolidation (dreaming); read or searched instead of imported as a note', category: 'evidence', kinds: ['session_summary'], imported: false },
      { native: 'server-side Chat memory', description: 'Ordinary Chat and cloud project memory stored on the account', category: 'knowledge', kinds: ['fact'], imported: false }
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
      { native: 'automation memory', description: 'Named MEMORIES.md entries owned by a cloud automation', category: 'knowledge', kinds: ['fact', 'reference'], imported: false }
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
      { native: 'MCP shared memory', description: 'dachshund tools expose the same shared library to DeepSeek Harness', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: false },
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
      { native: 'assistant memory', description: 'Context isolated per Doubao assistant', category: 'knowledge', kinds: ['fact'], imported: false },
      { native: 'Agent Mode memory', description: 'Local workspace and session context resolved into a durable kind', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: true }
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
      { native: 'local memory', description: 'Untyped local memory Markdown resolved into a durable kind', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: true },
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
      { native: 'MEMORY.md', description: 'Agent notes split by heading and resolved into durable kinds', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: true },
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
      { native: 'memory Markdown', description: 'Untyped observed local memory files resolved into durable kinds', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: true },
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
      mappings: [{ native: 'memory', description: 'Recognized local context resolved into a durable kind', category: 'knowledge', kinds: ['fact', 'reference', 'insight'], imported: false }]
    }
  )
}
