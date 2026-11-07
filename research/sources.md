# Agent Memory Sources

Research date: **2026-11-02**

This file accompanies [agent-memory-structures.md](agent-memory-structures.md).
Links were checked against the product documentation or public repository named
in each section. Local observations are evidence from this machine, not vendor
contracts.

## Official Documentation

| Agent | Source | URL | Used for |
| --- | --- | --- | --- |
| Codex | Memories | https://learn.chatgpt.com/docs/customization/memories?surface=app | Soft recall, separation from `AGENTS.md`, local memory enablement, extraction, local artifacts |
| Claude Code | Memory | https://code.claude.com/docs/en/memory | `CLAUDE.md` vs Auto Memory, project identity, index limits, four native types, machine-local scope |
| Claude Desktop | Desktop data storage | https://claude.com/docs/third-party/claude-desktop/data-storage | Local account/Cowork memory, local project memory, project boundary, local-only storage |
| Claude Desktop | Chat search and memory | https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context | Account-side topics, cloud Chat/Cowork sharing, Project memory |
| WorkBuddy | Desktop Memory | https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Memory | Nightly extraction, summary injection, session retrieval, edit/delete, drift warning |
| OpenCode | Rules / instructions | https://opencode.ai/docs/rules/ | Project/global `AGENTS.md`, `CLAUDE.md` fallback, additional instructions |
| Trae | Memories | https://docs.trae.ai/ide/memories | Global profile, project memory, local-only scope, proactive create/update/delete |
| Trae | Rules | https://docs.trae.ai/ide/rules | Global/project rules and compatibility with `AGENTS.md` / `CLAUDE.md` |
| Pi | Sessions | https://pi.dev/docs/latest/sessions | Session files, tree navigation, context building, compaction behavior |
| Pi | Compaction | https://pi.dev/docs/latest/compaction | Compaction trigger, summary entry, retained context, branch summaries |
| Pi | Session format | https://pi.dev/docs/latest/session-format | JSONL v3 header, entry types, `parentId`, `context_edit`, `branch_summary` |
| Hermes | Persistent memory | https://hermes-agent.nousresearch.com/docs/user-guide/features/memory | `MEMORY.md`, `USER.md`, character limits, frozen prompt snapshot, tools, session DB |

## Mechanism Sources

The agent page exposes three lifecycle answers (when memory forms, how it is
updated, and when it is recalled) plus a collapsed source list. The copy and
links live in
[`src/shared/agent-memory-mechanisms.ts`](../src/shared/agent-memory-mechanisms.ts);
this table keeps the research provenance beside the other source notes.
Checked **2026-11-07**.

| Agent | Source | URL | Evidence |
| --- | --- | --- | --- |
| Claude | The components of agent memory | https://www.anthropic.com/research/components-of-agent-memory | Official research; index cap and dreaming |
| Claude Code | How Claude remembers your project | https://code.claude.com/docs/en/memory | Official; auto memory, index, topic notes, limits |
| Claude Desktop | Data storage | https://claude.com/docs/third-party/claude-desktop/data-storage | Official; local topic layout and cloud boundary |
| Codex | Memories | https://learn.chatgpt.com/codex/customization/memories | Official; off by default, background extraction, local artifacts |
| Cursor | Memories | https://cursor.com/docs/context/memories | Official; conversation-derived, repo-scoped memories |
| Cursor | Cloud agent automations | https://cursor.com/docs/cloud-agent/automations | Official; automation-owned `MEMORIES.md` |
| GitHub Copilot | About Copilot memory | https://docs.github.com/copilot/concepts/agents/copilot-memory | Official; citations, verification, 28-day expiry, scopes |
| GitHub Copilot | Copilot CLI session data | https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle | Official; session store and `/chronicle` |
| Gemini CLI | Memory tool | https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/memory.md | Official; `save_memory`, global added-memories section |
| Gemini CLI | GEMINI.md context files | https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md | Official; hierarchical instruction loading |
| OpenCode | Rules | https://opencode.ai/docs/rules/ | Official; global/project/nested instructions, no typed auto memory |
| WorkBuddy | 记忆 | https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Memory | Official; nightly extraction, private summary, session search |
| Doubao | 如何让豆包记忆内容、更新记忆 | https://helpdesk.bytedance.com/sites/standalone/helpcenter/question-detail/index.html?biz_id=65&question_id=13385 | Official; extraction, update/forget controls, caps |
| Doubao | 官方帮助中心手册（beta） | https://lf9-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/grace_legal/doubao_member_copywrite_for_ai.html | Official; short-term and long-term memory layers |
| TRAE | Memories | https://docs.trae.ai/ide/memories | Official; global profile, project memory, local-only storage |
| TRAE | Rules | https://docs.trae.ai/ide/rules | Official; rules as a separate layer |
| Hermes | Persistent memory | https://hermes-agent.nousresearch.com/docs/user-guide/features/memory | Official; bounded files, frozen snapshot, memory tool |
| Pi | Sessions | https://pi.dev/docs/latest/sessions | Official; session tree, active branch, compaction |
| Pi | Compaction | https://pi.dev/docs/latest/compaction | Official; summary entries and retained history |
| ZCode | Memory | https://zcode.z.ai/en/docs/memory | Official; background review, project scope, storage layout |
| ZCode | Agents and instructions | https://zcode-ai.com/newdocs/agents | Official; `AGENTS.md` as a separate layer |
| the agent harness | Source-code analysis (community) | https://www.iceyao.com.cn/post/2026-08-13-deepseek-harness%E6%BA%90%E7%A0%81%E6%B7%B1%E5%BA%A6%E8%A7%A3%E6%9E%90 | Community; session, spill, and compaction behavior. No public vendor memory doc was found. |

Evidence labels are deliberately conservative. Doubao is **Partly documented**
because account memory is documented while the Agent Mode workspace files that
dachshund imports are not. the agent harness is **Observed locally** and has no
public vendor memory documentation.

## Public Code

### Codex

Repository: `openai/codex`

Commit: `ba0d0e1f74ee0f41c27ef24b37ed5fc030b487e7`

| Path | URL | Used for |
| --- | --- | --- |
| `codex-rs/memories/README.md` | https://github.com/openai/codex/blob/ba0d0e1f74ee0f41c27ef24b37ed5fc030b487e7/codex-rs/memories/README.md | Phase 1/2, eligibility, leases, consolidation, no-network agent |
| `codex-rs/memories/write/src/phase1.rs` | https://github.com/openai/codex/blob/ba0d0e1f74ee0f41c27ef24b37ed5fc030b487e7/codex-rs/memories/write/src/phase1.rs | Rollout extraction, structured output, secret redaction |
| `codex-rs/memories/write/src/phase2.rs` | https://github.com/openai/codex/blob/ba0d0e1f74ee0f41c27ef24b37ed5fc030b487e7/codex-rs/memories/write/src/phase2.rs | Global lock, ranking, workspace diff, consolidation agent |
| `codex-rs/memories/write/src/workspace.rs` | https://github.com/openai/codex/blob/ba0d0e1f74ee0f41c27ef24b37ed5fc030b487e7/codex-rs/memories/write/src/workspace.rs | Summary validation, required headings, 10,000-byte bound, git baseline |
| `codex-rs/state/memory_migrations/0001_memories.sql` | https://github.com/openai/codex/blob/ba0d0e1f74ee0f41c27ef24b37ed5fc030b487e7/codex-rs/state/memory_migrations/0001_memories.sql | `stage1_outputs`, jobs, leases, retry and watermark schema |

### OpenCode

Repository: `anomalyco/opencode` (the former `sst/opencode` URL redirects here)

Commit: `67139d6827af3a337c80472c33f9cb7c6c2ce500`

| Path | URL | Used for |
| --- | --- | --- |
| `packages/core/src/instruction-discovery.ts` | https://github.com/anomalyco/opencode/blob/67139d6827af3a337c80472c33f9cb7c6c2ce500/packages/core/src/instruction-discovery.ts | Instruction source discovery and rendering |
| `packages/core/src/instructions/index.ts` | https://github.com/anomalyco/opencode/blob/67139d6827af3a337c80472c33f9cb7c6c2ce500/packages/core/src/instructions/index.ts | Canonical JSON values, SHA-256 content addressing, deltas |
| `specs/v2/session.md` | https://github.com/anomalyco/opencode/blob/67139d6827af3a337c80472c33f9cb7c6c2ce500/specs/v2/session.md | Durable session events, instruction deltas, compaction boundary |
| `packages/core/src/session/sql.ts` | https://github.com/anomalyco/opencode/blob/67139d6827af3a337c80472c33f9cb7c6c2ce500/packages/core/src/session/sql.ts | SQLite projections and durable transcript storage |

### Pi

Repository: `earendil-works/pi` (the former `badlogic/pi-mono` URL redirects here)

Commit: `3e0eec29f50e7861e9db91f2d12723267411b4f3`

| Path | URL | Used for |
| --- | --- | --- |
| `packages/coding-agent/docs/session-format.md` | https://github.com/earendil-works/pi/blob/3e0eec29f50e7861e9db91f2d12723267411b4f3/packages/coding-agent/docs/session-format.md | JSONL v3, entry types, tree structure and context rebuilding |
| `packages/coding-agent/docs/sessions.md` | https://github.com/earendil-works/pi/blob/3e0eec29f50e7861e9db91f2d12723267411b4f3/packages/coding-agent/docs/sessions.md | Session storage and navigation |
| `packages/coding-agent/docs/compaction.md` | https://github.com/earendil-works/pi/blob/3e0eec29f50e7861e9db91f2d12723267411b4f3/packages/coding-agent/docs/compaction.md | Compaction, branch summaries, retained entries |

### Hermes

Repository: `NousResearch/hermes-agent`

Commit: `2b31d7b283191b8069311fd3514ee89419f76516`

| Path | URL | Used for |
| --- | --- | --- |
| `tools/memory_tool.py` | https://github.com/NousResearch/hermes-agent/blob/2b31d7b283191b8069311fd3514ee89419f76516/tools/memory_tool.py | Memory tool actions, frozen prompt contract, batch behavior, defaults |
| `tools/memory_tool_store.py` | https://github.com/NousResearch/hermes-agent/blob/2b31d7b283191b8069311fd3514ee89419f76516/tools/memory_tool_store.py | File format, delimiter, character budgets, snapshots, threat scan, duplicate handling |

## Local Evidence

These observations were collected on **2026-11-02**. They are not public vendor
schemas.

### Codex

- Installed CLI: `codex-cli 0.166.0`
- Active database observed: `~/.codex/memories_v2_1.sqlite`
- Tables observed: `stage1_outputs`, `jobs`, `consolidation_progress`
- Documented artifacts observed under `~/.codex/memories/`

### Claude Code

- Installed version: `2.1.316`
- Observed example:
  `~/.claude/projects/-Users-ewen-Documents-trae-projects-group-debate-hub/memory/`
- Topic frontmatter observed:
  `metadata.type`, `metadata.originSessionId`, `modified`

### Claude Desktop

- Observed Space:
  `.../spaces/ef7098ea-92cb-4490-b119-484d8a338116/memory/`
- Files observed: `MEMORY.md`, `feedback_git_push_credentials.md`
- Topic frontmatter observed: `name`, `description`, nested `metadata.type`,
  `originSessionId`, `modified`

### WorkBuddy desktop

- Installed version: `5.9.3`
- Observed:
  `~/.workbuddy/IDENTITY.md`,
  `~/.workbuddy/USER.md`,
  `~/.workbuddy/memory/<uid>_memory.md`,
  historical `~/.workbuddy/memery/`,
  `~/.workbuddy/workbuddy.db`,
  `<workspace>/.workbuddy/memory/YYYY-MM-DD.md`
- `_memory.md` includes a hidden `RAW_JSON_START ... RAW_JSON_END` block.
- `workbuddy.db` visible tables include `sessions`, `workspaces`, `buddy_snapshots`;
  no dedicated memory table was observed.
- Packaged prompt fragments under
  `~/.workbuddy/plugins/cache/workbuddy-builtin/prompt-common/.../fragments/`
  show older and newer memory surfaces, including `MemoryRecall` / `MemoryUpdate`.

### OpenCode

- Local storage observed at `~/.local/share/opencode/storage/`.
- It contained older session JSON state, not a typed memory store.
- Probed `~/.config/opencode/memory` and `~/.local/share/opencode/memory`; neither
  was observed at research time.

### Trae

- Local CN layout observed:
  `~/.trae-cn/memory/user_profile.md`,
  encoded project directories,
  `topics.md`,
  `session_memory_*.jsonl`
- Session JSONL keys observed:
  `actions`, `compact_summary_meta`, `intent`, `learned`, `message_id`,
  `message_summary_time`, `outcome`
- `project_memory.md` was not found locally, although the official path remains
  documented.

### Pi

- Installed version: `1.4.0`
- Session path pattern observed:
  `~/.pi/agent/sessions/--<encoded-path>--/<timestamp>_<session-id>.jsonl`

### Hermes

- Installed version: `0.16.0`
- Local `MEMORY.md` and `USER.md` were present but small.
- `~/.hermes/state.db` stores sessions with FTS5 search.

## Individual Agent Diagrams

The simplified per-agent figures are generated from:

- `research/agent-memory-structures/figure/agents/build.mjs`
- `research/agent-memory-structures/figure/agents/index.html`
- `research/agent-memory-structures/assets/agents/*.png`

These diagrams are static, labeled in English, and use only the official product
contracts listed above. The longer report keeps public-code and local observations
as separately labeled supporting evidence.

## dachshund Source Evidence

Implementation and product context, not vendor contracts:

| File | Used for |
| --- | --- |
| `src/shared/memory-taxonomy.ts` | Four knowledge categories, one Evidence supporting category, ten durable kinds, five supporting kinds, native mapping structure |
| `src/main/store/library.ts` | Markdown library layout, frontmatter, path generation |
| `src/main/store/db.ts` | SQLite schema, exact-content hash, FTS |
| `src/main/agents/importers.ts` | Product-specific paths and parsing heuristics |
| `docs/ARCHITECTURE.md` | Canonical Markdown and derived SQLite model |
| `docs/MEMORY.md` | Current memory semantics and agent mapping |

## Evidence Notes

- **Claude Desktop local memory and account memory are separate.** The official
  third-party Desktop storage page scopes its local storage model to Claude
  Desktop; it must not be generalized to every cloud configuration.
- **OpenCode persistence is not typed auto memory.** Instructions, sessions,
  compaction and transcript persistence are distinct concepts.
- **Pi compaction is not durable person memory.** Raw session entries remain;
  compaction changes model-visible history.
- **Trae session JSONL is episode evidence.** It is not the same as the
  officially documented `user_profile.md` / `project_memory.md`.
- **Hermes writes can persist during a session while the prompt stays frozen.**
  This distinction is the core of its behavior.
- Product docs and packaged UI behavior change quickly. Re-check before turning
  any observation into a public compatibility claim.
