# Agent Memory Mapping Matrix

This document records how each supported local adapter maps its native memory
model into dachshund's fixed taxonomy. The implementation is the source of
truth; this matrix describes what the current importers actually do.

## Fixed target model

| Order | Category | Kinds | Role |
| --- | --- | --- | --- |
| 1 | **Identity** | `profile` | Stable user and long-lived personal context |
| 2 | **Guidance** | `preference`, `rule`, `procedure` | Defaults, explicit instructions, and repeatable methods |
| 3 | **Knowledge** | `fact`, `reference`, `insight` | Durable information and conclusions |
| 4 | **Current work** | `goal`, `constraint`, `decision` | Active project or workspace state |
| Aux | **Evidence** | `session_summary`, `task_rollout`, `compaction`, `workspace_log`, `feedback_event` | Chronological source material |
| Aux | **Unclassified** | `unclassified` | Content that cannot yet be typed honestly |

The right-hand category order never changes between agents. A native category
can map many-to-one into one target category. A target category with no native
equivalent stays visible and empty.

## Mapping matrix

`Not imported` means the native concept exists or is known but is outside the
current local adapter. `-` means no mapping is needed for that row.

| Agent | Identity | Guidance | Knowledge | Current work | Evidence | Unclassified |
| --- | --- | --- | --- | --- | --- | --- |
| **Codex** | Split `memory_summary.md` identity section | Summary guidance; `Reusable knowledge` may become `procedure` | Summary knowledge; reusable insight | Explicit task-group goal, constraint, or decision | Task groups, raw threads, SQLite rollouts | Unmatched summary sections if no type is clear |
| **Claude Code** | Typed `user` | Typed `feedback` -> preference/rule; `CLAUDE.md` and rules -> rule | Typed `reference`; feedback outcome -> insight | Typed `project` | Session transcripts: not imported | Untyped local memory |
| **Claude Desktop** | Typed `user` topic | Typed `feedback` -> preference/rule or insight | Typed `reference`; feedback outcome -> insight | Typed `project` | - | Untyped local account/agent topics; server Chat memory: not imported |
| **WorkBuddy** | `USER.md`, typed `user` | Typed `feedback`; `IDENTITY.md` -> rule | Typed `reference`; feedback outcome -> insight | Typed `project` | Dated workspace logs | Untyped workspace Markdown |
| **TRAE** | `user_profile.md` | - | - | `project_memory.md` | `topics.md`, `session_memory_*.jsonl` | Rules: not imported |
| **Doubao** | Account memory: not imported | - | - | - | - | Agent Mode workspace/session files; assistant memory: not imported |
| **Hermes** | `USER.md` | - | - | - | Session history: not imported | `MEMORY.md` entries |
| **Pi** | - | Explicit durable preference/rule | - | - | Compaction and branch summaries | - |
| **ZCode** | Typed `user`; explicit preference | Typed `feedback`; explicit correction | Typed `reference`; feedback outcome -> insight | Typed `project` | Session/debug logs: not imported | Untyped project Markdown or durable text |
| **DeepSeek Harness** | - | Durable preference/rule; `AGENTS.md` -> rule | - | `cwd` is scope only | Compaction summaries; raw sessions stay outside the import | - |
| **Gemini CLI** | - | `GEMINI.md` -> rule | Added memories -> fact | - | Session history: not imported | - |
| **Cursor** | - | Rules and agent definitions -> rule | - | - | - | Repository `AGENTS.md`, automation memory: not imported |
| **GitHub Copilot** | - | Local instructions -> rule | - | - | CLI sessions: not imported | Untyped local memory Markdown |
| **OpenCode** | - | Global `AGENTS.md` -> rule | - | - | Sessions: not imported | Observed memory Markdown |

## Native source details

| Agent | Native source | Imported | Target |
| --- | --- | --- | --- |
| **Codex** | `~/.codex/memories/memory_summary.md` | Yes, split by `##` heading | Each section is classified by heading and content |
| **Codex** | `# Task Group:` / `## Task Group:` in `MEMORY.md` | Yes | `task_rollout`, or an explicit narrower kind |
| **Codex** | `Reusable knowledge` section | Yes | `insight` or `procedure` as a separate record |
| **Codex** | `## Thread` in `raw_memories.md` | Yes | `task_rollout` |
| **Codex** | `stage1_outputs` in `memories_1.sqlite` | When schema matches | `task_rollout` plus extracted reusable knowledge |
| **Codex** | `cwd:` / `cwd=` | Metadata | Project scope only |
| **Claude Code** | Project `memory/*.md` except `MEMORY.md` | Yes | Native `user`, `feedback`, `project`, `reference` normalized by content |
| **Claude Code** | `CLAUDE.md`, `rules/*.md`, global memory | Yes | Rules and typed/global memory |
| **Claude Desktop** | Cowork Space, account, and agent topic files | Yes | Typed topics normalized; untyped local topics stay classified conservatively |
| **Claude Desktop** | ordinary Chat and cloud Project memory | No | Not present in the local topic store |
| **WorkBuddy** | `IDENTITY.md`, `USER.md`, `user-*/USER.md` | Yes | Assistant rule and user profile |
| **WorkBuddy** | `memory/*.md` with `user`, `feedback`, `project`, `reference` | Yes | Normalized by native type and body |
| **WorkBuddy** | Workspace `.workbuddy/memory/YYYY-MM-DD.md` | Yes | `workspace_log`; workspace label becomes scope |
| **TRAE** | `memory/user_profile.md` | Yes | `profile` |
| **TRAE** | `project_memory.md` | Yes | Goal, constraint, decision, reference, or unclassified |
| **TRAE** | `topics.md`, `session_memory_*.jsonl` | Yes | `session_summary` |
| **Doubao** | Agent Mode global and session Markdown | Yes | `unclassified` until reviewed |
| **Doubao** | account and per-assistant memory | No | Account-scoped; not exposed as stable local files |
| **Hermes** | `USER.md` | Yes, split on `§` | `profile` |
| **Hermes** | `MEMORY.md` | Yes, split on `§` | `unclassified` |
| **Pi** | `compaction.summary` | Yes | `compaction` |
| **Pi** | `branch_summary.summary` | Yes | `session_summary` |
| **Pi** | User messages with an explicit durable cue | Yes | `preference` or `rule` |
| **ZCode** | Project `memory/*.md` except `MEMORY.md` | Yes | Normalized by typed metadata or body |
| **ZCode** | `cli/db/db.sqlite` user text | Yes | Explicit durable preference/rule only |
| **DeepSeek Harness** | Human user events with durable cues | Yes | `preference`, `rule`, or `insight` |
| **DeepSeek Harness** | `compaction/summary` | Yes | `compaction` |
| **DeepSeek Harness** | `~/.dsh/AGENTS.md` | Yes | `rule`; managed dachshund block stripped |
| **DeepSeek Harness** | Raw session events, snapshots, skills, tool output | No | Evidence remains in the native log |
| **Gemini CLI** | `GEMINI.md` instructions | Yes | `rule` |
| **Gemini CLI** | `## Gemini Added Memories` | Yes | `fact` |
| **Cursor** | `rules/`, `agents/` Markdown and MDC | Yes | `rule` |
| **GitHub Copilot** | `instructions/` | Yes | `rule` |
| **GitHub Copilot** | `memories/` | Yes | `unclassified` |
| **OpenCode** | Global `AGENTS.md` | Yes | `rule` |
| **OpenCode** | Local memory Markdown | Yes | `unclassified` |

## Type resolution

For Markdown-based agents, dachshund resolves kind in this order:

1. frontmatter `kind`;
2. frontmatter `type`;
3. nested `metadata.type`;
4. the adapter's file-role default;
5. `unclassified`.

Legacy values are not copied forward blindly:

- `feedback` / `correction` are classified from explicit rule, preference, and
  insight signals.
- `project` / `task_group` / `project_memory` are classified from goal,
  constraint, decision, and reference signals.
- `episode` becomes `session_summary`.
- `lesson` becomes `insight`.
- `workflow` becomes `procedure`.

## Important boundaries

- **Native does not mean universal.** The same word can mean different things
  across agents; body content and source structure disambiguate it.
- **Scope is not category.** A record can have project scope and belong to
  Evidence, Guidance, or Knowledge.
- **History is not silently promoted.** Compaction and rollout text must be
  reviewed or explicitly rewritten before becoming durable knowledge.
- **Unclassified is honest.** It is not rewritten as `fact` to make the UI look
  complete.
- **Not imported is explicit.** Account-only memory, server-side memory, raw
  transcripts, reasoning, and tool output are not presented as available local
  memory.
- **Agent pages show the relationship.** Native rows appear on the left, fixed
  dachshund categories on the right, and the selected category remains active
  when moving between the library and an agent.

## Implementation references

- Shared categories, aliases, and agent models:
  [`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts)
- Agent readers and fallback rules:
  [`src/main/agents/importers.ts`](../src/main/agents/importers.ts)
- Native paths and formats:
  [`docs/AGENTS.md`](AGENTS.md)
- Product taxonomy contract:
  [`docs/MEMORY.md`](MEMORY.md)
