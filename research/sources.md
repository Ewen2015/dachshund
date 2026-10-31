# Research Sources

Research date: 2026-10-31

## Official Sources

| Source | URL | Used for |
| --- | --- | --- |
| OpenAI Codex Memories | https://developers.openai.com/codex/memories | Local Codex memory store, separation from `AGENTS.md`, stable context categories |
| OpenAI Codex Customization | https://developers.openai.com/codex/customization/overview | Instructions, memories, skills and MCP as separate customization layers |
| Claude Code Memory | https://code.claude.com/docs/en/memory | `CLAUDE.md` vs auto memory, four typed memory kinds, `MEMORY.md` and topic files |
| Claude chat search and memory | https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context | Account topic memory, per-Project memory and legacy-summary distinction |
| Gemini CLI memory tool | https://google-gemini.github.io/gemini-cli/docs/tools/memory.html | `save_memory` appends facts to `~/.gemini/GEMINI.md` |
| Gemini CLI GEMINI.md | https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html | Global, workspace and just-in-time context hierarchy |
| Cursor Rules | https://cursor.com/docs/rules | Project/User/Team Rules, `.cursor/rules`, `AGENTS.md`, no memory between completions |
| Cursor Automations memory | https://cursor.com/docs/cloud-agent/automations | Per-automation named `MEMORIES.md` |
| GitHub Copilot custom instructions | https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions | Repository and path-specific instruction files |
| GitHub Copilot CLI custom instructions | https://docs.github.com/en/copilot/how-tos/copilot-cli/add-custom-instructions | CLI instruction discovery and merge behavior |
| GitHub Copilot CLI session data | https://docs.github.com/en/copilot/how-tos/copilot-cli/chronicle | Local session data, sync behavior and Chronicle |
| Windsurf legacy Memories URL | https://docs.windsurf.com/windsurf/cascade/memories | Redirects through legacy Cascade documentation to Devin Local customizations; not a current standalone Memories contract |
| Devin Local customizations | https://docs.devin.ai/desktop/devin-local/customizations | Current Rules, Skills, Plugins, MCP and Hooks surfaces |
| OpenCode Rules | https://opencode.ai/docs/rules/ | Project/global `AGENTS.md`, CLAUDE fallback and additional instructions |
| Trae Rules | https://docs.trae.ai/ide/rules | Global/project rules and AGENTS/CLAUDE compatibility |
| Trae Memory | https://docs.trae.ai/ide/memories | Global `user_profile.md`, project `project_memory.md`, local-only scope |
| WorkBuddy / CodeBuddy Memory | https://www.workbuddy.cn/docs/cli/memory | Typed `user` / `feedback` / `project` / `reference`, Markdown frontmatter, Auto Memory paths and `MEMORY.md` loading behavior |
| Doubao memory help | https://helpdesk.bytedance.com/sites/standalone/helpcenter/question-detail/index.html?biz_id=65&question_id=13385 | Natural-language memory management, extraction, limits and overwrite behavior |
| Doubao help manual | https://lf9-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/grace_legal/doubao_member_copywrite_for_ai.html | Settings memory controls, probabilistic recall and agent isolation |
| Hermes persistent memory | https://hermes-agent.nousresearch.com/docs/user-guide/features/memory | `MEMORY.md`, `USER.md`, character limits and frozen prompt injection |
| Pi compaction | https://pi.dev/docs/latest/compaction | Compaction and branch summarization |
| Pi sessions | https://pi.dev/docs/latest/sessions | Tree-structured session history, `~/.pi/agent/sessions/` and compaction behavior |
| Pi Durable | https://earendil.com/posts/pi-durable/ | Experimental durable agent runtime, not a long-term memory product |
| ZCode Memory | https://zcode.z.ai/cn/docs/memory | Project-level Markdown memory, `MEMORY.md` index, topic files, default disabled and v3.6.4+ |
| ZCode Agent instructions | https://zcode.z.ai/cn/newdocs/agents | Global and workspace `AGENTS.md` behavior |
| DeepSeek Harness session system | https://deepseekdocs.com/en/docs/learn/core/session | Append-only session event log and context projection |
| DeepSeek Harness MCP memory | https://deepseekdocs.com/en/docs/guides/mcp-memory | Official reference memory plus Memorix and Engram MCP examples |

## Product Sources

These repository READMEs and product pages were checked on 2026-10-31. They are
product claims or implementation documentation, not independent benchmarks.

| Product | URL | Used for |
| --- | --- | --- |
| Link | https://github.com/gowtham0992/link | Local Markdown memory, agent discovery, MCP, review-gated writes |
| LinkBar | https://github.com/gowtham0992/link/tree/main/apps/LinkBar | macOS menu bar memory surface |
| Memorix | https://github.com/AVIDS2/memorix | Local-first project memory, SQLite/Markdown, broad agent setup matrix |
| agentmemory | https://github.com/rohitg00/agentmemory | Local memory server, hooks, MCP, viewer and session replay |
| ai-memory | https://github.com/akitaonrails/ai-memory | Git-backed Markdown wiki, harness support, handoff and macOS companion |
| EverOS | https://github.com/EverMind-AI/EverOS | Local Markdown + SQLite + LanceDB memory runtime |
| projectmem | https://github.com/riponcm/projectmem | Repo-scoped event memory, MCP and local dashboards |
| Basic Memory | https://github.com/basicmachines-co/basic-memory | Markdown knowledge graph, MCP and optional cloud |
| Beacon | https://github.com/Asymptote-Labs/agent-beacon | Cross-harness session capture with optional local mode |
| mcp-memory-service | https://github.com/doobidoo/mcp-memory-service | Local/self-hosted memory backend with MCP and dashboard |
| Letta | https://github.com/letta-ai/letta | Stateful agent runtime with self-managed memory |
| Cognee | https://github.com/topoteretes/cognee | Memory pipelines and knowledge graph infrastructure |
| Mem0 | https://github.com/mem0ai/mem0 | Open-source library, self-hosted server and managed platform distinction |
| Magpie | https://github.com/yetone/magpie | Product shape: menu bar, local gateway and agent discovery |
| Magpie site | https://usemagpie.ai/ | Visual and interaction reference only |

## dachshund Local Evidence

These files are implementation evidence, not vendor standards:

- `src/main/agents/registry.ts`: supported agent IDs, homes, app paths and MCP targets.
- `src/main/agents/importers.ts`: exact paths, parsing rules and inferred kinds.
- `src/main/agents/discovery.ts`: installation detection.
- `src/main/store/db.ts`: current memory schema, sources and exact-content hash.
- `src/main/store/library.ts`: Markdown frontmatter and file layout.
- `docs/AGENTS.md`: current import support matrix.
- `docs/ARCHITECTURE.md`: durable library and derived SQLite model.

## Evidence Notes

- Product docs change frequently. Re-check official links before using a claim in
  release notes or user-facing copy.
- WorkBuddy documentation currently uses "CodeBuddy" terminology in places; this
  research follows the product name used by dachshund. Its documented
  `~/.codebuddy` Auto Memory paths must not be conflated with the observed
  `~/.workbuddy` desktop-app layout.
- The exact local schema for WorkBuddy, Doubao Agent Mode, Pi, ZCode and DeepSeek
  Harness is partially observed by dachshund importers. Observations should not
  be described as official API contracts.
- Cursor Automations memory is not the same as a general editor-wide long-term
  memory. It is scoped to repeated runs of one cloud automation.
- Windsurf's documented memory behavior changed with the transition from legacy
  Cascade to Devin Local. The old Memories URL redirects to the current
  customizations page, so historical imported memories and current runtime
  behavior must be described separately.
- Pi Durable is an experimental durable-execution runtime. It is not a
  cross-agent long-term memory format and should not be conflated with Pi
  sessions, compaction, or a `MEMORY.md` store.
