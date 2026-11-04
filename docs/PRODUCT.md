# Product

## Thesis

Agent memory should belong to the person using the agents, not to the first
harness that happened to write it.

dachshund is a local memory switchboard for macOS. It discovers what agents
already remember, gives those memories one inspectable home, and exposes the
result to every agent through MCP. The product is designed to feel like a quiet
system utility: small when you want it, legible when you open it, and absent
when you do not.

## Problem

People now use multiple coding and knowledge agents on the same machine. Each
agent accumulates a partial model of the user:

- Claude Code may know a project convention.
- Codex may know the reason a previous implementation failed.
- Cursor may know a typography rule.
- Gemini CLI may know a preference from a global instruction file.

Switching agents means losing context or repeating it. Hosted memory layers
solve part of this problem, but often introduce an account, API key, LLM
extraction pipeline, telemetry surface, or new proprietary store.

## User

The primary user is a macOS power user who:

- runs two or more coding or desktop agents;
- cares about data ownership and offline operation;
- already has memory scattered across agent-specific files;
- wants recall across tools without maintaining a server stack;
- values a small native-feeling interface over a large knowledge-management
  dashboard.

Secondary users include developers evaluating local-first AI infrastructure and
people who want a portable Markdown memory library that remains useful without
dachshund.

## Job To Be Done

> When I switch from one agent to another, help me carry forward the
> preferences, decisions, active project context, and insights already learned, without
> uploading my memory or adopting a new model provider.

## Product Principles

1. **Import before adoption.** dachshund should be useful because of memories
   that already exist, not only memories created after installation.
2. **Local by architecture.** The macOS app, database, and MCP service stay on
   the machine. There is no cloud fallback.
3. **Files over opaque state.** Markdown is the durable source of truth. Search
   indexes are disposable.
4. **One memory, visible echoes.** The same memory from multiple agents should
   appear once, with provenance retained.
5. **Deterministic core.** Capture, import, search, and recall do not require an
   LLM, API key, or background inference job.
6. **Quiet by default.** dachshund stays in the menu bar, does not add a second
   notification stream, and does not make itself the center of the workflow.
7. **Human-readable recovery.** A user can inspect, copy, edit, move, or back up
   the library without dachshund.

## Product Surfaces

### Full Window

The full window opens as a compact 920 x 700 Mac app rather than a browser-sized
workspace. It can be resized, maximized, or sent full screen when the user wants
the wider library view. It is the library and control surface:

- Memory feed grouped by recency, with a compact legend for Identity, Guidance,
  Knowledge, Current work, and populated Evidence.
- Search and agent filters.
- Memory detail with Markdown rendering and source provenance, as a right-side
  inspector that can expand into a full-window reading view.
- Agent memory views that explain each native model, show its storage path,
  map it against the fixed dachshund categories, and expose an expandable
  mechanism diagram.
- A clickable brand mark that returns to the first-run landing view without
  resetting onboarding or local data.
- Pulse: growth, agent contribution, overlap, category mix and freshness.
- Guide: a visual explanation of how native memory signals become durable
  kinds and how those kinds map into the four fixed dachshund categories.
- New-memory composer.
- Agent discovery, sharing toggles, and MCP connection controls.
- Connectors, library path, privacy model, and index rebuild.

### Menu Bar Popover

The 420 x 620 compact surface is optimized for a quick glance:

- latest memories;
- search;
- recent cross-agent echoes;
- installed agents and sharing toggles;
- one-click return to the full app.

### MCP

dachshund is not only a viewer. Once connected, agents can:

- search shared memory;
- request a prompt-ready context block;
- write a durable memory;
- archive a shared memory;
- inspect index statistics.

## Differentiation

The local agent-memory category is already crowded. Link, ai-memory, Basic
Memory, Beacon, agentmemory, and mcp-memory-service all overlap with parts of
this problem. LinkBar and AI Memory already provide macOS menu bar access.

dachshund should therefore not claim to invent "local memory for agents." Its
wedge is narrower:

> An import-first, zero-cloud, zero-model memory library that treats existing
> agent memory as the starting point and presents the result as a compact macOS
> utility.

The distinguishing product choices are:

- first-run discovery and import, rather than requiring every agent to adopt a
  new memory protocol first;
- a unified library where identical memories become one item with multiple
  source echoes;
- an explicit Markdown-plus-derived-index storage model;
- no account, telemetry, model dependency, or hosted tier;
- a Magpie-like compact interface and menu bar presence;
- a deliberately small tool surface rather than a broad agent platform.

This is a product wedge, not a claim that no similar project exists. See
[cross-agent memory product research](../research/cross-agent-memory-products.md)
for the current landscape.

## Non-Goals

dachshund is not currently:

- a new autonomous agent;
- an LLM memory-extraction service;
- a vector database or knowledge-graph platform;
- a cross-device sync service;
- a team collaboration server;
- a replacement for an agent's native memory system;
- a security boundary against a compromised local account;
- a notarized production distribution.

## Success Signals

- A new user sees useful imported memories without writing one first.
- The same fact from two agents appears once and still shows both sources.
- A connected agent can recall a memory written by a different connected agent.
- Users can find and understand their memory library without any proprietary
  export step.
- A new user can explain the difference between kind, category, scope, and
  evidence after opening Guide, without reading repository documentation.
- The core workflow works with networking disabled except loopback.
- The app remains understandable in the 420 x 620 menu bar surface.

## Current Product Boundary

The current repository is an MVP prototype. It proves the local discovery,
library, search, tray, MCP, and in-place update loop. It does not yet provide
production-grade incremental source synchronization, conflict review, or
notarized distribution.

## Memory Synchronization Direction

This section is future product planning, not a description of shipped behavior.
It exists so later work can build on a precise boundary.

### Current behavior

- Import runs at app startup and on an explicit scan. Users can also opt into
  automatic sync, which runs the same pipeline every 60 minutes while the app is
  running. There is no continuous filesystem watcher.
- Agent-owned source files are opened read-only. dachshund copies their content
  into its own Markdown library and keeps the source path as provenance.
- Exact normalized-content duplicates become multiple source echoes on one
  dachshund memory.
- Stable source identity is persisted. If a native source changes, the next scan
  updates the existing memory in place and reports it as updated.
- Automatic sync pauses while the app quits or the system sleeps, schedules at
  most one catch-up scan after resume, and reports added, updated, unchanged, and
  failed states without blocking the interface.
- Memory written through dachshund's MCP `memory_remember` tool goes directly
  into the dachshund library and is immediately available to agents connected
  to that MCP service. It is not written back into an agent's private memory.
- Memory that exists only in a cloud account is outside the local scanner's
  reach unless the agent also maintains a supported local artifact.

### Future discussion

Any stronger synchronization model should preserve the local-only boundary and
make every automated change reviewable.

- Add debounced file watching with a bounded rescan on wake or reconnect.
- Define archive and removal-tombstone semantics for source records that
  disappear.
- Keep revision history and provenance so a user can compare the old and new
  source records before accepting a change.
- Add explicit conflict review when both dachshund and a native source changed
  the same memory.
- Treat native-source writeback as a separate, opt-in capability. It requires
  per-agent adapters, backups, and explicit approval before changing files.
- Do not infer cloud-account memory or add a hosted synchronization service as
  part of this work.

The remaining direction is not scheduled. Automatic sync and source-version
replacement are implemented; revision history, removal tombstones, conflict
review, and native writeback are not.
