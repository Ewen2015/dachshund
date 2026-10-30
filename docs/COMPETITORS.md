# Competitor Research

Research date: 2026-10-30

## TL;DR

Yes. Local, non-cloud memory across multiple agents already exists, and the
category is crowded.

The closest products are:

- **Link**: import-first local Markdown memory across coding agents, plus MCP,
  review-gated writes, and **LinkBar**, a macOS menu bar app.
- **ai-memory**: a broader local or self-hosted shared memory server for more
  than twenty coding harnesses, with a macOS menu bar companion.
- **Basic Memory**: local Markdown plus a knowledge graph and MCP, with an
  optional paid cloud.
- **Beacon**: cross-harness session capture with a local mode, but interactive
  setup preselects its cloud destination.
- **agentmemory** and **mcp-memory-service**: local-first shared memory servers
  with hooks, dashboards, and broader memory infrastructure.

There is also already a **Magpie-like menu bar memory app**: LinkBar. AI Memory
also ships a macOS menu bar companion.

Therefore, dachshund cannot honestly position itself as the first local
cross-agent memory product. Its defensible wedge is narrower:

> Import what agents already wrote, preserve provenance, present one unified
> Markdown library in a compact Magpie-like desktop utility, and require no
> cloud, account, model, or new agent workflow.

That is a product distinction, not a category moat.

## Mem0: The "Cloud" Assumption Needs Correction

Mem0 is primarily known through its managed memory platform, but the repository
also includes:

- an open-source Python library;
- a self-hosted server with Docker Compose;
- configurable LLM and embedding providers.

So the accurate statement is not "Mem0 can only run in the cloud." It is:

- the managed platform is Mem0's zero-ops production path;
- self-hosting exists but requires more infrastructure and configuration;
- the default memory algorithm expects an LLM and embeddings;
- the managed platform includes proprietary optimizations not available in the
  open-source SDK;
- it is not a zero-configuration, file-first macOS utility.

This matters because dachshund's promise is not merely "self-hostable." It is
"local by architecture, with no model or server setup on the core path."

## Comparison Table

GitHub stars are rounded and directional only. They were read from the GitHub
API on 2026-10-30.

| Project | Local / no cloud | Cross-agent | Primary memory model | Interface | What it means for dachshund |
| --- | --- | --- | --- | --- | --- |
| [Link](https://github.com/gowtham0992/link) (~219 stars, MIT) | Yes, local Markdown; optional user-controlled git sync | Yes, Claude Code, Codex, Cursor, Kiro, Gemini CLI, and more | Source-backed Markdown wiki plus reviewable memories, deterministic recall | CLI, MCP, local viewer, **LinkBar macOS menu bar** | Closest direct overlap. Link is much broader and more mature in review, hooks, rules, receipts, and sync. dachshund differentiates through import-first aggregation and an extremely small utility surface. |
| [ai-memory](https://github.com/akitaonrails/ai-memory) (~14.6k stars, MIT) | Yes on one machine; can self-host on a homelab or LAN | Yes, 20+ harnesses | Git-backed Markdown wiki with derived search, hooks, handoffs, optional embeddings | CLI, MCP, web UI, macOS menu bar companion | Strongest broad open-source alternative. Much heavier scope and infrastructure. dachshund competes on zero-setup discovery and compact UI, not feature depth. |
| [Basic Memory](https://github.com/basicmachines-co/basic-memory) (~4.4k stars, AGPL-3.0) | Yes; cloud is optional | Yes, via MCP across Claude, Codex, Cursor, ChatGPT, and others | Markdown files plus observations, wikilinks, and a knowledge graph | MCP, CLI, optional cloud web app | Closest file-first knowledge model. It is a knowledge graph for humans and agents; dachshund is a switchboard over memories already produced by agents. |
| [Beacon](https://github.com/Asymptote-Labs/agent-beacon) (~3.0k stars, MIT) | Yes, explicit Local mode | Yes, 20+ harnesses | Full session traces normalized into knowledge | CLI, local dashboard, MCP, cloud option | Much deeper capture and replay. Interactive setup preselects Beacon Cloud unless the user explicitly chooses Local, so its default posture is not no-cloud. |
| [agentmemory](https://github.com/rohitg00/agentmemory) (~30k stars, Apache-2.0) | Yes by default; local embeddings optional | Yes | Hook-captured sessions, graph, hybrid retrieval | CLI, MCP, live viewer | Much broader memory infrastructure and benchmark work. dachshund is smaller, deterministic, and centered on imported memory plus a macOS library. |
| [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) (~2.1k stars, Apache-2.0) | Yes; cloud/self-hosted sync optional | Yes, REST + MCP | SQLite/vector/hybrid memory service with graph, consolidation, and dashboard | HTTP, MCP, web dashboard | Strong backend for agent pipelines. It is a service to adopt, not an import-first desktop browser for existing agent files. |
| [MCP Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | Yes | Shared file can be used by multiple MCP clients | Local JSONL knowledge graph | MCP only | Useful primitive, but agents start a new graph rather than dachshund's discover-and-unify flow. |
| [Mem0](https://github.com/mem0ai/mem0) (~68k stars, Apache-2.0) | Open-source library and self-hosted server; managed cloud is the primary product | Integrations exist, but not a macOS import-first utility | Atomic memory extraction, embeddings, hybrid retrieval | SDK, API, CLI, cloud platform | Powerful memory layer, but requires more model and infrastructure setup. Its managed platform is the main experience. |
| [Letta](https://github.com/letta-ai/letta) (~25k stars, Apache-2.0) | Self-hostable | Agents within Letta | Stateful agent memory and self-editing memory OS | Platform, API, agent runtime | Broader agent platform, not a neutral cross-harness memory browser. |
| [Cognee](https://github.com/topoteretes/cognee) (~33k stars, Apache-2.0) | Self-hostable | Yes, via memory pipelines and integrations | Knowledge graph and vector memory pipeline | Python platform, APIs, integrations | Infrastructure for memory engineering; much heavier than a menu bar utility. |
| [Magpie](https://github.com/yetone/magpie) (~26k stars, MIT) | Local gateway and menu bar app | Routes multiple agents to models | No memory product; agent/model gateway | macOS menu bar app | Product design reference only. Do not copy its name, assets, or exact visual identity. |

## Magpie-Like Applications For Memory

### LinkBar

[LinkBar](https://github.com/gowtham0992/link/tree/main/apps/LinkBar) is the
closest existing product to the requested shape:

- native macOS menu bar app;
- backed by Link's local Markdown memory;
- review inbox with approve and archive;
- quick recall;
- status and last-session receipt;
- no server or socket beyond the Link CLI;
- Homebrew cask, version 1.5.0 at research time.

Its emphasis is **reviewing and approving durable memory**, not browsing all
existing agent memory as one library.

### AI Memory macOS Companion

The [AI Memory macOS companion](https://github.com/akitaonrails/ai-memory/tree/main/companions/ai-memory-macos)
is a menu bar wrapper for installing, starting, and opening the larger
ai-memory system. It is closer to a control plane than a compact memory browser.

### dachshund

dachshund sits between those approaches:

- closer to LinkBar in visual scale and ambient behavior;
- closer to an import-first aggregator than a review workflow;
- narrower than ai-memory or agentmemory;
- stricter than Beacon's cloud-preselected setup;
- no knowledge graph or LLM extraction in the MVP.

## Competitive Map

```text
                       broader memory platform
                                ^
                                |
                    ai-memory   |   Mem0 / Cognee / Letta
                 agentmemory    |
                                |
machine-local  <----------------+----------------> cloud-first
                                |
                  Link          |
                  Basic Memory  |   Beacon Cloud
                  dachshund     |   Basic Memory Cloud
                  LinkBar       |
                                |
                                v
                      compact personal utility
```

The horizontal axis is deployment posture, not whether self-hosting is
technically possible. The vertical axis reflects product scope.

## Where dachshund Is Weak

These gaps should remain explicit:

- Less mature than Link, ai-memory, Basic Memory, and agentmemory.
- No lifecycle hooks or session capture.
- No semantic retrieval, embeddings, graph, or reranking.
- No review workflow for agent-proposed writes.
- No incremental source reconciliation or conflict resolution.
- No multi-device sync, team mode, audit log, or permissions.
- No benchmarks.
- Unsigned distribution.

A user who wants automatic session capture, advanced retrieval, handoffs, or
team infrastructure should use one of the mature alternatives.

## Where dachshund Can Win

- The first useful screen appears from existing agent memory, not after a long
  setup or a new memory habit.
- The entire core loop is understandable and local.
- The Markdown library is portable and inspectable.
- The UI is small, fast to open, and appropriate for frequent ambient use.
- Exact duplicates become one memory with visible provenance.
- There is no account, cloud tier, API key, model choice, or telemetry decision.

## Product Implications

1. Avoid generic positioning such as "local memory for agents." It is already
   occupied by credible projects.
2. Lead with "import what your agents already know" and "one library, many
   echoes."
3. Treat LinkBar as a direct design and behavior benchmark.
4. Do not compete on number of hooks, graph features, or benchmarks in the MVP.
5. Prioritize incremental reconciliation, reviewable consolidation, and trust
   over broad platform expansion.
6. Publish precise local/cloud distinctions for competitors. Incorrect claims
   about Mem0 or Beacon would undermine the research.

## Sources

- Mem0 repository: https://github.com/mem0ai/mem0
- Link repository: https://github.com/gowtham0992/link
- LinkBar source: https://github.com/gowtham0992/link/tree/main/apps/LinkBar
- ai-memory repository: https://github.com/akitaonrails/ai-memory
- AI Memory macOS companion:
  https://github.com/akitaonrails/ai-memory/tree/main/companions/ai-memory-macos
- Basic Memory repository: https://github.com/basicmachines-co/basic-memory
- Beacon repository: https://github.com/Asymptote-Labs/agent-beacon
- agentmemory repository: https://github.com/rohitg00/agentmemory
- mcp-memory-service repository: https://github.com/doobidoo/mcp-memory-service
- MCP Memory Server:
  https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- Letta repository: https://github.com/letta-ai/letta
- Cognee repository: https://github.com/topoteretes/cognee
- Magpie repository: https://github.com/yetone/magpie
- Magpie product site: https://usemagpie.ai/
