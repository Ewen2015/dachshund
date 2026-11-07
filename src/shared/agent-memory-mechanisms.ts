export type MemoryEvidence = 'official' | 'partial' | 'observed' | 'inferred'

export interface AgentMemoryMechanismSource {
  label: string
  url: string
  kind: 'official' | 'community'
}

export interface AgentMemoryMechanism {
  evidence: MemoryEvidence
  /** Short stages for agents that do not have a full mechanism illustration. */
  flow: string[]
  forms: string
  updates: string
  recalls: string
  notes: string[]
  sources: AgentMemoryMechanismSource[]
  caveat?: string
}

export const MEMORY_EVIDENCE_LABELS: Record<MemoryEvidence, string> = {
  official: 'Official docs',
  partial: 'Partly documented',
  observed: 'Observed locally',
  inferred: 'Inferred'
}

export const MEMORY_EVIDENCE_DESCRIPTIONS: Record<MemoryEvidence, string> = {
  official: 'The mechanism is described in the vendor’s own documentation.',
  partial:
    'Part of the mechanism is documented, but the local files dachshund reads are not.',
  observed:
    'No public vendor documentation was found for this mechanism. The description comes from local files and observed behavior.',
  inferred: 'The description is inferred from related documentation and behavior.'
}

/**
 * How each agent forms, updates, and recalls memory. The short lifecycle rows
 * stay visible on the agent page; the notes and sources sit behind a
 * disclosure so the illustration and the three answers remain the focus.
 *
 * Evidence is deliberately conservative: a card is never labelled official
 * when the local store dachshund reads is undocumented.
 */
export const AGENT_MEMORY_MECHANISMS: Record<string, AgentMemoryMechanism> = {
  claude: {
    evidence: 'official',
    flow: ['Sessions + corrections', 'Auto memory notes', 'MEMORY.md index', 'Injected next session'],
    forms:
      'On by default. Claude writes a note when a correction, preference, or project fact looks reusable; you can also ask it to remember.',
    updates:
      'Claude edits topic notes and the MEMORY.md index in place. Anthropic’s research describes a background “dreaming” pass that rechecks notes against transcripts and consolidates duplicates.',
    recalls:
      'CLAUDE.md loads every session. Only the first 200 lines or 25 KB of MEMORY.md are injected; topic notes are read on demand.',
    notes: [
      'Two layers: CLAUDE.md is human-authored instruction, while auto memory is Claude-written knowledge in ~/.claude/projects/<repo>/memory/.',
      'Session transcripts stay the ground truth; notes are a derived index, not the full record.',
      'Claude Desktop keeps local Space and agent topics in the same index-and-topic layout. Account Chat and cloud project memory stay server-side and reach dachshund only over MCP.'
    ],
    sources: [
      {
        label: 'Claude Code — How Claude remembers your project',
        url: 'https://code.claude.com/docs/en/memory',
        kind: 'official'
      },
      {
        label: 'Anthropic Research — The components of agent memory',
        url: 'https://www.anthropic.com/research/components-of-agent-memory',
        kind: 'official'
      },
      {
        label: 'Claude Desktop — Data storage',
        url: 'https://claude.com/docs/third-party/claude-desktop/data-storage',
        kind: 'official'
      }
    ]
  },
  codex: {
    evidence: 'official',
    flow: ['Eligible chats', 'Background distiller', '~/.codex/memories', 'Recalled next chat'],
    forms:
      'Off by default. Once enabled, Codex distills eligible chats after they have been idle; short, active, or rate-limited sessions are skipped.',
    updates:
      'A background pipeline regenerates summaries, durable entries, and evidence under ~/.codex/memories. Manual edits are not the intended control; /memories toggles use and contribution per chat.',
    recalls:
      'Generated memory is recalled into later eligible chats as background context. AGENTS.md remains the always-on rule layer; ChatGPT web memory is separate.',
    notes: [
      'Memory is generated state, not a hand-written file. Inspect it before sharing a Codex home.',
      'Secrets are redacted from generated fields, but redaction is best-effort; required guidance belongs in AGENTS.md.',
      'The IDE extension uses the connected Codex host’s local store.'
    ],
    sources: [
      {
        label: 'Codex — Memories',
        url: 'https://learn.chatgpt.com/codex/customization/memories',
        kind: 'official'
      }
    ]
  },
  cursor: {
    evidence: 'official',
    flow: ['Agent chats', 'Extract', 'Repo memories', 'Next chat'],
    forms:
      'Cursor extracts durable facts and preferences from Agent conversations, scoped to one repository; you can also create memories manually.',
    updates:
      'Later conversations refresh the repo-scoped set. Review, edit, or delete memories in Settings → Rules; rules and memories remain separate layers.',
    recalls:
      'Relevant memories are added to the agent context for the matching repository, alongside rules and workspace context.',
    notes: [
      'Memories are conversation-derived context; rules are deliberately authored instructions and stay authoritative.',
      'Cursor cloud automations can keep their own MEMORIES.md; dachshund does not scan that cloud store.',
      'dachshund currently imports local rules and agent definitions, not Cursor’s generated memories.'
    ],
    sources: [
      {
        label: 'Cursor — Memories',
        url: 'https://cursor.com/docs/context/memories',
        kind: 'official'
      },
      {
        label: 'Cursor — Cloud agent automations',
        url: 'https://cursor.com/docs/cloud-agent/automations',
        kind: 'official'
      }
    ]
  },
  copilot: {
    evidence: 'official',
    flow: ['Copilot work', 'Cited memory', 'Revalidate', 'Cloud agent · review · CLI'],
    forms:
      'Copilot writes memories automatically while the cloud agent, code review, or CLI works, for users with memory enabled and repository write access.',
    updates:
      'Each memory keeps citations to code or your own words. Before use, Copilot rechecks them against the current branch; unverified memories are ignored, and unused memories expire after 28 days.',
    recalls:
      'Recalled only in supported surfaces after verification. Repository facts are shared with everyone with repo access; user preferences apply across repositories to that user.',
    notes: [
      'Two scopes: repository facts such as conventions, architecture, and build commands; and user preferences about how you like to work.',
      'The feature is a public preview on paid plans. Business and Enterprise admins can review and delete memories.',
      'CLI session history and /chronicle are a separate evidence layer, not the same store as Copilot memory.'
    ],
    sources: [
      {
        label: 'GitHub Docs — About Copilot memory',
        url: 'https://docs.github.com/copilot/concepts/agents/copilot-memory',
        kind: 'official'
      },
      {
        label: 'GitHub Docs — Copilot CLI session data',
        url: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle',
        kind: 'official'
      }
    ]
  },
  'gemini-cli': {
    evidence: 'official',
    flow: ['GEMINI.md layers', 'Session context', 'save_memory', 'Global file next session'],
    forms:
      'Memory forms only when the agent calls save_memory, usually because you asked it to remember a fact or preference. GEMINI.md is authored instruction, generated by /init or by hand.',
    updates:
      'save_memory appends a bullet under “## Gemini Added Memories” in the global GEMINI.md. Edits are manual; there is no merge or automatic consolidation step.',
    recalls:
      'Global, workspace, and path GEMINI.md files are combined hierarchically into every session, so saved facts are available next time. /memory show inspects the active files.',
    notes: [
      'save_memory is for small, self-contained facts, not conversation history or large documents.',
      'The memory file is plain Markdown and can be edited, diffed, and versioned like any other file.',
      'Session history is stored separately and is not durable memory.'
    ],
    sources: [
      {
        label: 'Gemini CLI — Memory tool (save_memory)',
        url: 'https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/memory.md',
        kind: 'official'
      },
      {
        label: 'Gemini CLI — GEMINI.md context files',
        url: 'https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md',
        kind: 'official'
      }
    ]
  },
  opencode: {
    evidence: 'official',
    flow: ['Global + project AGENTS.md', 'Configured instructions', 'Session prompt', 'Manual edits only'],
    forms:
      'Memory does not form automatically. Durable context exists only when a person writes AGENTS.md or another instruction source; /init can generate a starting file.',
    updates:
      'Manual edits, commits, or /init regeneration. Global, project, and nested AGENTS.md files are concatenated with no conflict resolution.',
    recalls:
      'Instruction files are loaded into the prompt every session; @file references are read on demand. Persisted sessions replay separately and are not user memory.',
    notes: [
      'Global file: ~/.config/opencode/AGENTS.md. Project file: ./AGENTS.md; nested files apply to their subtree.',
      'CLAUDE.md is a compatibility fallback, and extra files or URLs can be merged through the instructions array.',
      'dachshund imports the global AGENTS.md and observed memory Markdown, not project instructions or sessions.'
    ],
    sources: [
      {
        label: 'OpenCode — Rules',
        url: 'https://opencode.ai/docs/rules/',
        kind: 'official'
      }
    ]
  },
  workbuddy: {
    evidence: 'official',
    flow: ['Day’s conversations', 'Nightly extraction', 'Private memory summary', 'Injected next chat'],
    forms:
      'The desktop app reviews the day’s conversations every night and extracts facts, preferences, relationships, and follow-ups.',
    updates:
      'The nightly job rebuilds the private summary. You can edit, remove, or disable memory in Settings → Memory.',
    recalls:
      'Relevant memories are injected into later chats as background context. Past sessions can also be searched directly, separately from the summary.',
    notes: [
      'Extraction is time-driven, not turn-driven: a conversation affects memory after the nightly pass.',
      'The summary is private to the user and is not a shared team store.',
      'Dated workspace logs remain evidence in dachshund and are not treated as rules.'
    ],
    sources: [
      {
        label: 'WorkBuddy — 记忆',
        url: 'https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Memory',
        kind: 'official'
      }
    ]
  },
  doubao: {
    evidence: 'partial',
    flow: ['Chats', 'Probabilistic extraction', 'Account memory', 'Next chat'],
    forms:
      'Account memory extracts profiles, preferences, interests, and habits from chats automatically. Extraction is probabilistic and does not include uploaded images, files, or links.',
    updates:
      'New memories accumulate as you chat. Updates are not real-time, and at the cap the newest entries overwrite the oldest. Correct or forget by telling it, or delete in Settings → Memory.',
    recalls:
      'Relevant account memories are combined into later chats. Assistant memory is isolated per assistant; Agent Mode reads its local workspace files.',
    notes: [
      'Two layers: short-term session context and long-term cross-session memory.',
      'Turning memory off or deleting a chat does not automatically erase stored memories; delete them explicitly.',
      'Agent Mode’s local workspace files are observed on disk, not documented as a public memory format.'
    ],
    caveat:
      'Account memory is documented by ByteDance. The Agent Mode workspace files that dachshund imports are observed, not documented.',
    sources: [
      {
        label: '字节跳动帮助中心 — 如何让豆包记忆内容、更新记忆',
        url: 'https://helpdesk.bytedance.com/sites/standalone/helpcenter/question-detail/index.html?biz_id=65&question_id=13385',
        kind: 'official'
      },
      {
        label: '豆包官方帮助中心手册（beta）',
        url: 'https://lf9-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/grace_legal/doubao_member_copywrite_for_ai.html',
        kind: 'official'
      }
    ]
  },
  trae: {
    evidence: 'official',
    flow: ['Conversations + explicit asks', 'Agent judges', 'Profile + project memory', 'Injected into task'],
    forms:
      'The agent judges which preferences and project facts are worth keeping and writes them; explicitly saying “remember…” also works. Temporary or sensitive information is not auto-saved.',
    updates:
      'The agent updates the Markdown files automatically. You can also edit them directly or ask it to add, change, or remove an item.',
    recalls:
      'The global user profile and the current project’s memory are injected into Agent tasks. Topic and session JSONL remain separate evidence.',
    notes: [
      'Global memory: ~/.trae/memory/user_profile.md (the CN build uses ~/.trae-cn). Project memory lives under projects/<project>/project_memory.md.',
      'Memory stays on the local machine and is not shared across devices.',
      'Rules are a separate instruction system, not memory.'
    ],
    sources: [
      {
        label: 'TRAE — Memories',
        url: 'https://docs.trae.ai/ide/memories',
        kind: 'official'
      },
      {
        label: 'TRAE — Rules',
        url: 'https://docs.trae.ai/ide/rules',
        kind: 'official'
      }
    ]
  },
  hermes: {
    evidence: 'official',
    flow: ['Memory tool', 'MEMORY.md + USER.md', 'Frozen snapshot', 'Next session sees writes'],
    forms:
      'The agent writes through its memory tool when it learns a durable fact or the user asks it to remember. Memory is facts; procedures belong in skills.',
    updates:
      'The tool adds, replaces, or removes entries immediately on disk. Each file has a hard character budget; an overflow fails loudly and the agent must consolidate and retry.',
    recalls:
      'Both files are injected into the system prompt as a frozen snapshot at session start. Mid-session writes become visible only in a later session.',
    notes: [
      'MEMORY.md is the agent’s own notes (2,200 characters); USER.md is the user profile (1,375 characters).',
      'There is no automatic compression: the agent has to free space explicitly.',
      'AGENTS.md and SOUL.md are separate instruction and personality layers; session history is a separate SQLite store.'
    ],
    sources: [
      {
        label: 'Hermes — Persistent memory',
        url: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/memory',
        kind: 'official'
      }
    ]
  },
  pi: {
    evidence: 'official',
    flow: ['Session entries', 'Active branch', 'Model context', 'Compaction summary'],
    forms:
      'Pi does not form typed long-term user memory. Every turn is recorded in a session tree; compaction and branch summaries are generated when context fills or you switch branches.',
    updates:
      'New entries append to the session JSONL. Compaction writes a summary and keeps recent messages; original entries stay on disk. /tree, /fork, and /clone create branches instead of overwriting history.',
    recalls:
      'The active branch from root to leaf is rebuilt for the next model request. A compaction summary stands in for older visible context; raw entries remain available.',
    notes: [
      'The session tree is an execution record, not a user profile.',
      'Compaction changes what the model sees, not what Pi stores.',
      'dachshund imports compaction and branch summaries as evidence and only promotes explicit durable cues.'
    ],
    sources: [
      {
        label: 'Pi — Sessions and context',
        url: 'https://pi.dev/docs/latest/sessions',
        kind: 'official'
      },
      {
        label: 'Pi — Compaction',
        url: 'https://pi.dev/docs/latest/compaction',
        kind: 'official'
      }
    ]
  },
  zcode: {
    evidence: 'official',
    flow: ['Finished round', 'Background review', 'Project memory', 'Next same-project session'],
    forms:
      'Off by default and requires v3.6.4+. After each successfully finished round, ZCode reviews it in the background and keeps preferences, corrections, goals, and references, scoped to the project.',
    updates:
      'Later rounds add, update, or remove entries. Files can be edited or deleted directly; there is no in-app management UI yet.',
    recalls:
      'The project’s MEMORY.md index is auto-loaded into later sessions of the same project, subject to a size cap. Other projects are isolated.',
    notes: [
      'Storage is plain Markdown: ~/.zcode/cli/memories/projects/<project>/memory/MEMORY.md plus one file per fact.',
      'The setting applies only to new or restored sessions; in-progress conversations keep their original setting.',
      'AGENTS.md is a separate instruction layer, and MCP memory servers are also separate.'
    ],
    sources: [
      {
        label: 'ZCode — Memory',
        url: 'https://zcode.z.ai/en/docs/memory',
        kind: 'official'
      },
      {
        label: 'ZCode — Agents and instructions',
        url: 'https://zcode-ai.com/newdocs/agents',
        kind: 'official'
      }
    ]
  },
  'deepseek-harness': {
    evidence: 'observed',
    flow: ['Session events', 'Compaction', 'AGENTS.md', 'MCP library'],
    forms:
      'No public vendor documentation. Locally, sessions are append-only and compaction summaries are written when context is compacted; there is no documented long-term memory writer.',
    updates:
      'Session events append; compaction replaces a shadowed range with a summary event. AGENTS.md edits are manual. dachshund’s MCP tools can write the shared library.',
    recalls:
      'AGENTS.md and retained compaction context are read into the session. Raw sessions stay local evidence; the MCP connector exposes dachshund’s library.',
    notes: [
      'Workspace instructions load hierarchically from AGENTS.md; CLAUDE.md is also read for compatibility.',
      'Compaction can summarize or prune, triggered by token pressure or context overflow.',
      'This card is Observed: the description comes from local files and public code behavior, not vendor documentation.'
    ],
    caveat:
      'No public DeepSeek Harness documentation for memory was found (checked November 2026).',
    sources: [
      {
        label: 'Independent source-code analysis',
        url: 'https://www.iceyao.com.cn/post/2026-08-13-deepseek-harness%E6%BA%90%E7%A0%81%E6%B7%B1%E5%BA%A6%E8%A7%A3%E6%9E%90',
        kind: 'community'
      }
    ]
  }
}

export function agentMemoryMechanism(agentId: string): AgentMemoryMechanism | null {
  return AGENT_MEMORY_MECHANISMS[agentId] ?? null
}
