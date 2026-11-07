# MVP

## Objective

Prove the complete local loop:

```text
discover existing agent memory
  -> import into one Markdown library
  -> index locally
  -> browse in a Magpie-like macOS UI
  -> expose through MCP
  -> recall across agents
```

## Implemented

- Electron, React, TypeScript, and Vite application.
- Native macOS tray icon and 420 x 620 compact popover.
- Full desktop library view, agent view, connectors, detail inspector, and
  composer.
- Per-agent memory mechanism diagrams with expandable full-window viewing.
- A reusable landing view reachable from the brand mark in both app surfaces.
- Local discovery for thirteen agent families.
- Agent-specific read-only importers for all thirteen of them.
- Four fixed knowledge categories, ten durable kinds, and a separate Evidence
  layer. Untyped content resolves into an existing durable kind.
- An in-app Guide with a top-down native-file → kind → category diagram,
  category focus states, classification guardrails, and orthogonal dimensions.
- Orthogonal scope, authority, and lifecycle status on every memory record.
- Markdown library with YAML frontmatter.
- SQLite index with FTS5 and BM25 search.
- Exact content deduplication with multiple source echoes.
- MCP write attribution and exact-content upsert across connected agents.
- Explicit **Share** promotion for a dachshund-owned shared copy.
- Loopback-only HTTP service with a random bearer token.
- MCP bridge with five tools.
- MCP config installation for JSON, Codex TOML, OpenCode, Hermes YAML, and
  DeepSeek Harness Cordis patches.
- Shared-memory instruction blocks for Claude, Codex, Gemini CLI, GitHub
  Copilot, OpenCode, and DeepSeek Harness.
- Guided app-managed MCP setup for Doubao with verified client handshakes.
- macOS app icon, tray template icon, and brand mark.
- In-app update download, digest verification, in-place replacement, rollback,
  and automatic relaunch.
- Automated MCP integration smoke test.

## Acceptance Checks

The MVP is considered healthy when:

1. `npm run typecheck` passes.
2. `npm run test:agents` passes fixture and config-writer checks.
3. `npm run test:sync` passes source-version and lifecycle transition checks.
4. `npm run build` completes.
5. `npm run test:mcp` passes in an isolated temporary home.
6. Search finds a memory created through `memory_remember`.
7. `memory_context` returns a labeled prompt block.
8. `memory_forget` archives the memory and removes it from default search.
9. The compact panel remains usable at 420 x 620 logical pixels.
10. The compact panel opens above a macOS full-screen Space without switching
   away from it.
11. The Connectors screen reports the correct MCP bridge path.
12. `npm run dist:mac` produces a DMG.
13. A packaged previous version can download a newer release, replace itself
    in place, pass code-signature verification, and reopen.

## Current Verification

Verified in this repository:

- TypeScript checks pass.
- `npm run test:agents` passes fixture and config-writer checks for Hermes, Pi,
  ZCode, DeepSeek Harness, and Claude. The DeepSeek Harness fixture
  covers multi-frame Zstandard, surface replacement, compaction summaries,
  user-global instructions, and the managed Cordis writer.
- Agent fixtures cover the four knowledge categories, all six supporting kinds,
  content-aware legacy migration, Codex summary section splitting, and stable
  category ownership for every declared mapping.
- Sync fixtures cover scope, authority, and status transitions, archived-state
  preservation, and stale metadata reconciliation.
- Production build passes.
- Isolated MCP integration passes for search, context, remember, forget, and
  stats.
- Screenshot capture passes for all main views and the compact panel.
- The packaged 22 px and 44 px menu bar templates keep transparent margins and
  are rejected by the build if the mark is clipped.
- A real synchronization after the taxonomy cleanup completed with 246 active
  records and zero records in the removed unresolved category. Hermes
  `MEMORY.md` entries were split and mapped into Identity and Knowledge.
- An end-to-end MCP query against that imported library found a TRAE-authored
  memory through `memory_search` and returned it through `memory_context`.
- The development Connectors screen reports
  `/Users/ewen/Documents/GitHub/dachshund/out/mcp/index.cjs`.
- Three consecutive scans of a cloned real library reported zero additions, zero
  updates, and zero changes after the first post-upgrade presentation pass.
- Two consecutive manual refreshes in the built app reported
  `0 memories added · 0 memories updated`.
- Sync fixtures cover echo metadata ownership, repeated echo imports, trailing
  whitespace in titles, and Codex reusable-knowledge slices that must stay
  `insight`.
- `release/dachshund-0.1.25-arm64.dmg` was produced on 2026-11-06.
- The packaged app launched against an isolated data directory and reported a
  packaged version of `0.1.25` and rendered `.app-shell`; the separate panel
  placement fixture passed with `visibleOnAllWorkspaces: true`.
- The `0.1.25` DMG mounted read-only, contained a valid ad-hoc-signed app at
  version `0.1.25`, and included an executable MCP bridge.
- A packaged `0.1.2` build containing the new installer downloaded a local
  `0.1.3` DMG, reached the installing state, replaced its bundle, passed
  `codesign --verify --deep --strict`, and reopened at version `0.1.3`.
- The installer log reported `installed 0.1.3`.
- The packaged `Contents/Resources/mcp/index.cjs` from `0.1.25` passed the same
  five-tool MCP smoke test.
- `release/dachshund-0.1.26-arm64.dmg` was produced on 2026-11-07 with SHA-256
  `1706b0a5764c46d4dfd1cdfaa6d1a115bfb14f3161748458734f258ba1897617`.
- The packaged `0.1.26` app launched against an isolated data directory, wrote
  its runtime manifest, and reported version `0.1.26`.
- The `0.1.26` DMG mounted read-only, contained a valid ad-hoc-signed app at
  version `0.1.26`, and included an executable MCP bridge.
- The packaged `Contents/Resources/mcp/index.cjs` from `0.1.26` passed the
  five-tool MCP smoke test, including remember, search, context, and forget.
- A read-only import of the current Claude homes found three `MEMORY.md`
  indexes: one repository project, one Desktop account, and one Cowork Space.
- Closing or minimizing a fullscreen main window exits the macOS fullscreen
  Space before hiding, with no blank fullscreen surface left behind.
- The compact panel remained visible, focused, and always on top while the
  main window was in a native macOS full-screen Space.
- Main-window and compact-panel screenshots pass at 920 x 700 and 420 x 620
  with the larger typography and complete category labels.
- Guide screenshots pass for the complete top-down taxonomy figure and a
  focused category route; the default top bar keeps the primary action visible.
- A deterministic 28-heading Contents fixture passes compact, collapsed and
  expanded layout checks; screenshots are written to `release/outline-*.png`.
- The Guide layout remains readable at 800 x 600 without horizontal clipping,
  and its category cards expose distinct hover, focus, and selected states.
- Sync notices dismiss after approximately three seconds and retain their pause
  behavior while hovered or keyboard-focused.
- The full app keeps one active view while switching between compact top tabs
  and the optional Workspace / Insights / App sidebar layout; the same `Cmd+\`
  shortcut toggles both modes.
- Doubao `2.33.5` accepted the guided STDIO setup, reported all five dachshund
  tools as available, and recorded a real `rmcp` `3.2.0` handshake with the
  explicit `doubao` agent identity.
- A live Doubao conversation invoked `memory_stats` successfully. Aggregate
  shared-memory statistics came from the dachshund tool response rather than
  Doubao's account memory.
- Doubao's account and per-assistant memories remain cloud-scoped. Empty local
  Agent Mode memory files do not produce imported records.
- DeepSeek Harness `0.2.1-rc.5` reloaded the managed Cordis row without exiting
  the app and spawned a dachshund MCP child. The bridge recorded a real
  `dsh-mcp-client` `0.0.1` receipt with `agentId=deepseek-harness`.
- Memory details expand from the right inspector into a full-window reading
  view; `Escape` collapses the reader before closing the inspector.
- Compact-panel memory rows expose an explicit open-in-full-app affordance and
  open the selected memory in the full window.
- Development and packaged builds both report the macOS Dock icon hidden.
  The packaged app declares `LSUIElement=true`.
- Agent details render native memory mechanism diagrams, and the enlarged
  diagram dialog closes with `Escape` or its explicit close control.
- The dachshund mark reopens the landing view from both the full app and compact
  panel; landing spacing is stable at the default 920 x 700 window.
- The packaged app is ad-hoc signed only; Gatekeeper assessment fails because it
  has no Developer ID signature or notarization.

The DMG SHA-256 from this build is:

```text
0c2d7c60f75bbbe604e040be61d80cba28e66c51777b36001fb4d0290dd2ac50
```

## Known Limitations

### Import Reconciliation

Stable source identity and content hashes are now persisted, so an edited source
updates its existing memory instead of creating a parallel active copy. There is
still no source tombstone, revision history, or conflict review when two sources
converge on the same content or disappear.

### Deduplication

Duplicates are detected only when normalized content is identical. Similar but
non-identical knowledge is not merged.

### File Watching

There is no live filesystem watcher. Scans run on startup, on explicit user
action, and every 60 minutes when the user enables automatic sync. The timer is
cleared while the app quits or the system sleeps and schedules at most one
catch-up scan after resume. Revision history and conflict review remain future
work described in
[Product](PRODUCT.md#memory-synchronization-direction).

### Local Search Model

Search is lexical, using SQLite FTS5 and BM25. The MVP has no local embedding
model, semantic reranker, or query planner.

### Distribution

The current DMG is unsigned and not notarized. macOS Gatekeeper may require an
explicit override. Production distribution needs Developer ID signing,
notarization, and a release policy.

### Update And Backup

The app update itself is downloaded, verified, and replaced in place from
`0.1.3` onward. There is still no scheduled memory backup or restore UI. Users
can back up the Markdown directory with any normal file-based tool.

### Security

The app assumes a trusted macOS user account. File access and the local bearer
token are not a defense against a compromised account.

## Next Milestones

### Released

#### 0.1.4: More Agent Families

- Hermes native memory entries;
- Pi compaction and branch summaries;
- ZCode read-only SQLite context;
- DeepSeek Harness Zstandard session context.

#### 0.1.5: Memory Taxonomy And Compact Library

- five cross-agent categories and eleven concrete memory kinds;
- native agent model mapping on every agent detail page;
- compact 920 x 700 default window with a responsive wide layout;
- agents with memory prioritized and zero-memory agents collapsed by default;
- Pulse category mix, category growth, and click-through back to filtered memory.

#### 0.1.6: Compact Panel Parity

- five-category filtering in the menu bar panel;
- category and kind labels on every compact memory row;
- category mix in compact Pulse with click-through to the filtered memory list;
- agents with memory prioritized in the compact panel, with the rest collapsed.

#### 0.1.7: Audited Agent Memory Maps

- audited every native memory model against the importer and the shared taxonomy;
- enforced one native signal to one concrete kind and one dachshund category;
- marked native sources that are visible but not yet importable;
- separated Claude Code instructions and rules from typed auto memory;
- added Trae profile and project memory plus ZCode project Markdown memory;
- added importer fixtures for WorkBuddy, Trae, Doubao, Cursor, Copilot, OpenCode,
  Claude Code, Codex, Gemini, Hermes, Pi, ZCode, and DeepSeek Harness.

#### 0.1.8: App-Managed MCP Setup

- the Doubao MCP action now opens a guided local STDIO setup instead of a
  disabled import-only state;
- the bridge records a client name, version, and timestamp after a completed MCP
  initialization handshake;
- Doubao is marked connected only after a real matching handshake;
- Agent controls use a fixed two-column grid for consistent row alignment.

#### 0.1.9: Fullscreen Close Fix

- closing the main window now leaves the macOS fullscreen Space before hiding;
- minimizing to the menu bar uses the same safe fullscreen exit path;
- the compact panel opens only after the main window has left fullscreen.

#### 0.1.10: Calmer Type

- raised the app's text scale toward the Magpie reference, with body copy
  moving from 12-13 px to 14-15 px;
- increased card titles, metadata, navigation, labels, and controls together;
- removed truncation from the compact panel's category filters;
- regenerated the product screenshots at the default window sizes.

#### 0.1.11: Stay On The Current Screen

- the menu bar panel now opens as a non-activating macOS panel and stays on the
  current Space;
- the panel is anchored to the current display and clamped to its work area;
- compact-panel typography is slightly tighter without reducing core body copy.

#### 0.1.12: Local Memory Across A Wider Agent Set

- added a read-only Claude Desktop importer for local Cowork Space memory,
  account topic files, and agent topic files;
- mapped Claude Desktop `user`, `feedback`, `project`, and `reference` topic
  types into the shared memory taxonomy;
- added a persistent top-tab / sidebar navigation switch with `Cmd+\`;
- grouped Pulse under Insights and renamed Settings to Connectors;
- kept the sidebar toggle clear of the macOS window controls at every supported
  window width.

#### 0.1.13: Connected Memory For Doubao And DeepSeek Harness

- verified Doubao's five-tool MCP connection and live `memory_stats` call;
- attributed Doubao's generic `rmcp` client to the correct agent identity;
- made DeepSeek Harness session parsing surface-aware and frame-by-frame;
- imported DeepSeek Harness compaction summaries and user-global rules;
- connected DeepSeek Harness through a managed Cordis MCP row;
- added an idempotent shared-memory instruction block to `~/.dsh/AGENTS.md`.

#### 0.1.14: Full-Window Reading And A Menu Bar Lifecycle

- expanded memory details into a distraction-free full-window reader;
- kept `Escape` progressive: collapse the reader, then close the inspector;
- made compact-panel memory rows explicitly open in the full app;
- removed the macOS Dock icon from development and packaged builds;
- restored and kept the site's floating hero cards fully visible.

#### 0.1.15: Memory Mechanisms And A Reopenable Landing

- added native memory mechanism diagrams for Codex, WorkBuddy, Claude Code,
  Claude Desktop, OpenCode, Trae, Pi, and Hermes;
- paired each diagram with the agent's storage path and dachshund taxonomy
  mapping, with an accessible enlarged reading view;
- made the dachshund mark reopen the landing view from the full app and compact
  panel;
- added explicit landing close behavior through the close button and `Escape`;
- rebalanced the landing layout so agent tags and the CTA footer have stable
  spacing at the default 920 x 700 window.

#### 0.1.16: One Promise Across The Product

- unified the app, English site, Chinese site, and README around “All your
  agents. One memory.”;
- expanded the landing constellation to Claude, Codex, Gemini, Cursor,
  WorkBuddy, Hermes, Pi, and DeepSeek Harness;
- removed the decorative figure index from the landing illustration;
- aligned the landing brand with the native macOS title bar and kept the system
  traffic lights clear at supported window widths.

#### 0.1.17: Trustworthy Incremental Import

- added automatic sync every 60 minutes with sleep-aware pause and resume;
- persisted per-source versions so changed files update existing memories;
- reclassified unchanged sources in place without duplicates or timestamp churn;
- unified current and legacy TRAE discovery, including `Trae CN.app`;
- separated knowledge Type from project Scope in the taxonomy and interface;
- moved WorkBuddy date logs and Codex task history into History while retaining
  their workspace or repository scope;
- added regression fixtures, updated documentation, and refreshed screenshots.

#### 0.1.18: Consistent Counts And Compact Agents

- made Pulse read a lightweight all-active index so its charts and totals match
  the complete memory library;
- filtered agent-scoped memory queries before applying result limits, so agent
  counts and opened lists agree;
- sorted every agent list by memory count, with installed state, source count,
  and name as tie breakers;
- compacted Agents rows to a stable single-line description and path layout;
- replaced the menu bar icon bridge with a native, template-faithful status item.

#### 0.1.19: Clearer Memory Structure And A New Mark

- replaced the dachshund mark, app icon, menu bar template, website assets, and
  documentation screenshots with the new logo;
- restored the menu bar mark to a compact 22 x 22 template asset;
- added a collapsible Contents outline to expanded memory details;
- presented every agent's native categories against dachshund's fixed taxonomy,
  including many-to-one mappings and explicit empty states;
- removed the redundant scope filter from the memory feed and made sync notices
  dismiss automatically after five seconds.

#### 0.1.20: Shared Memory With Provenance

- retained the calling agent on MCP writes and merged exact duplicate content
  into one memory with multiple sources;
- added MCP initialization guidance and idempotent instruction blocks for
  supported agents, so they ask for shared context before answering;
- added explicit **Share** promotion for imported memories while leaving the
  original agent file untouched;
- carried the selected category into agent views and clarified Pulse's shared
  versus source-only labels;
- removed the outdated Windsurf integration and pruned stale discovered agents.

#### 0.1.21: Full-Screen Menu Bar Panel

- made the compact menu bar panel visible above native macOS full-screen
  windows without switching away from the current Space;
- reapplied the full-screen workspace behavior whenever the panel opens;
- added regression coverage and synchronized the window architecture and
  release documentation.

#### 0.1.22: Reviewable Consolidation

- consolidate the memory model into four knowledge categories, ten durable
  kinds, and a separate Evidence layer;
- add an in-app Guide that explains the model with a readable top-down filing
  plan, fixed category cards, and focusable routes;
- dismiss transient sync notices after three seconds, while preserving the
  hover and keyboard pause needed to read details;
- migrate legacy `feedback`, `project`, `episode`, `lesson`, and `workflow`
  values without creating stronger categories than the source supports;
- synchronize every full-app, menu bar, Pulse, agent mapping, documentation,
  seed, and website surface with the same fixed category order;

#### 0.1.23: Complete Durable Classification

- removed the temporary Unclassified category, status, filter, and tag;
- resolved legacy untyped records into existing durable kinds;
- split Hermes `MEMORY.md` by heading for section-level classification;
- kept the inspector from covering category and agent filters in compact mode;
- synchronized the taxonomy contract, screenshots, research notes, and both
  websites.

#### 0.1.24: One Claude Agent

- merged Claude Code and Claude Desktop into one Claude card, importer, taxonomy
  model, icon, and memory diagram;
- connected both installed Claude surfaces through one Connect action while
  keeping a Desktop-only Mac free of Claude Code configuration;
- migrated legacy agent ids, library frontmatter, sources, imports, and source
  identities so rescans stay duplicate-free;
- synchronized the Agent, taxonomy, README, research, screenshot, and website
  surfaces with the merged identity.

#### 0.1.25: Accurate Refresh Counts

- kept one source authoritative for the presentation of a memory echoed by
  several sources, so rescans no longer alternate titles, tags, and kinds;
- narrowed the legacy Codex rollout migration to whole-thread records so
  reusable-knowledge slices stay `insight`;
- normalized titles before comparison so Markdown frontmatter round-trips do not
  count as edits;
- counted unique memories added or updated per scan, and showed an explicit
  `0 memories added · 0 memories updated` when nothing changed;
- added sync fixtures for echo ownership, repeated imports, padded titles, and
  Codex knowledge slices.

#### 0.1.26: Claude Memory Layers

- imported Claude Code project and global `MEMORY.md` indexes, plus Desktop
  account, agent, and Space indexes, as reference memories tagged
  `memory-index`;
- rebuilt the Claude model and mechanism diagram around the injected index,
  on-demand topic notes, and session transcripts as ground truth;
- showed transcripts and other non-imported Claude sources directly in the
  mapping;
- rendered relative Markdown links as inert references so imported indexes
  cannot navigate the app window;
- synchronized fixtures, screenshots, research notes, README, and both
  websites.

### Next

- near-duplicate suggestions;
- merge and split flows;
- conflict review;
- preserved supersession history;
- user-approved cleanup rather than automatic silent rewrites.

#### 0.1.27: Recall Quality

- optional local embeddings;
- hybrid lexical and semantic ranking;
- query explanation;
- context budget controls;
- retrieval evaluation corpus.

#### 0.1.28: Distribution

- signed and notarized universal build;
- update channel;
- first-run migration and backup checks;
- crash and migration diagnostics without telemetry.
