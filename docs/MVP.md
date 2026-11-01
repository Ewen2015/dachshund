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
- Full desktop library view, agent view, settings, detail inspector, and
  composer.
- Local discovery for fifteen agent families.
- Agent-specific read-only importers for fourteen of them.
- Markdown library with YAML frontmatter.
- SQLite index with FTS5 and BM25 search.
- Exact content deduplication with multiple source echoes.
- Loopback-only HTTP service with a random bearer token.
- MCP bridge with five tools.
- MCP config installation for JSON, Codex TOML, OpenCode, Hermes YAML, and
  DeepSeek Harness Cordis patches.
- Guided app-managed MCP setup for Doubao with verified client handshakes.
- macOS app icon, tray template icon, and brand mark.
- In-app update download, digest verification, in-place replacement, rollback,
  and automatic relaunch.
- Automated MCP integration smoke test.

## Acceptance Checks

The MVP is considered healthy when:

1. `npm run typecheck` passes.
2. `npm run test:agents` passes fixture and config-writer checks.
3. `npm run build` completes.
4. `npm run test:mcp` passes in an isolated temporary home.
5. Search finds a memory created through `memory_remember`.
6. `memory_context` returns a labeled prompt block.
7. `memory_forget` archives the memory and removes it from default search.
8. The compact panel remains usable at 420 x 620 logical pixels.
9. The settings screen reports the correct MCP bridge path.
10. `npm run dist:mac` produces a DMG.
11. A packaged previous version can download a newer release, replace itself
    in place, pass code-signature verification, and reopen.

## Current Verification

Verified in this repository:

- TypeScript checks pass.
- `npm run test:agents` passes fixture and config-writer checks for Hermes, Pi,
  ZCode, and DeepSeek Harness.
- Production build passes.
- Isolated MCP integration passes for search, context, remember, forget, and
  stats.
- Screenshot capture passes for all main views and the compact panel.
- The packaged 22 px and 44 px menu bar templates keep transparent margins and
  are rejected by the build if the mark is clipped.
- An isolated real scan identified 80 importable memories across 14 installed
  agents. Hermes contributed 17 native entries. Pi, ZCode, and DeepSeek
  Harness were detected and parsed; their transcript adapters correctly skipped
  ordinary task prompts with no durable-memory signal.
- An end-to-end MCP query against that imported library found a Trae-authored
  memory through `memory_search` and returned it through `memory_context`.
- The development settings screen reports
  `/Users/ewen/Documents/GitHub/dachshund/out/mcp/index.cjs`.
- `release/dachshund-0.1.11-arm64.dmg` was produced on 2026-11-01.
- The packaged app launched against an isolated data directory and reported a
  healthy loopback service at version `0.1.11`.
- A packaged `0.1.2` build containing the new installer downloaded a local
  `0.1.3` DMG, reached the installing state, replaced its bundle, passed
  `codesign --verify --deep --strict`, and reopened at version `0.1.3`.
- The installer log reported `installed 0.1.3`.
- The packaged `Contents/Resources/mcp/index.cjs` from `0.1.11` passed the same
  five-tool MCP smoke test.
- Closing or minimizing a fullscreen main window exits the macOS fullscreen
  Space before hiding, with no blank fullscreen surface left behind.
- Main-window and compact-panel screenshots pass at 920 x 700 and 420 x 620
  with the larger typography and complete category labels.
- A packaged Doubao setup session accepted a real
  `Doubao MCP Client` `2.33.5` stdio handshake and updated the UI to the
  verified connected state.
- The packaged app is ad-hoc signed only; Gatekeeper assessment fails because it
  has no Developer ID signature or notarization.

The DMG SHA-256 from this build is:

```text
3f21098b8c84c16d040e3f96d9c0dbe9e20ad6c2b2b40236572da7419df6f935
```

## Known Limitations

### Import Reconciliation

The current scanner identifies memories by content hash and source identity.
If an agent edits a source memory, the new text becomes a new library item while
the old item remains active. There is no source tombstone, supersession chain, or
conflict review yet.

### Deduplication

Duplicates are detected only when normalized content is identical. Similar but
non-identical knowledge is not merged.

### File Watching

There is no live filesystem watcher. Scans run on startup and on explicit user
action. A future watcher and source-revision model is described in
[Product](PRODUCT.md#memory-synchronization-direction), but it is not
implemented.

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
  Windsurf, Claude Code, Codex, Gemini, Hermes, Pi, ZCode, and DeepSeek Harness.

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

### Next

#### 0.1.12: Trustworthy Incremental Import

- persist per-source mtime, size, and hash;
- update an existing memory when its source changes;
- mark removed sources;
- expose source status in the detail view;
- add importer fixtures and regression tests.

#### 0.1.13: Reviewable Consolidation

- near-duplicate suggestions;
- merge and split flows;
- conflict review;
- preserved supersession history;
- user-approved cleanup rather than automatic silent rewrites.

#### 0.1.14: Recall Quality

- optional local embeddings;
- hybrid lexical and semantic ranking;
- query explanation;
- context budget controls;
- retrieval evaluation corpus.

### 0.1.15: Distribution

- signed and notarized universal build;
- update channel;
- first-run migration and backup checks;
- crash and migration diagnostics without telemetry.
