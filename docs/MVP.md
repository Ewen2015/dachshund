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
- Local discovery for eleven agent families.
- Agent-specific read-only importers for ten of them.
- Markdown library with YAML frontmatter.
- SQLite index with FTS5 and BM25 search.
- Exact content deduplication with multiple source echoes.
- Loopback-only HTTP service with a random bearer token.
- MCP bridge with five tools.
- MCP config installation for JSON, Codex TOML, and OpenCode.
- macOS app icon, tray template icon, and brand mark.
- In-app update download, digest verification, in-place replacement, rollback,
  and automatic relaunch.
- Automated MCP integration smoke test.

## Acceptance Checks

The MVP is considered healthy when:

1. `npm run typecheck` passes.
2. `npm run build` completes.
3. `npm run test:mcp` passes in an isolated temporary home.
4. Search finds a memory created through `memory_remember`.
5. `memory_context` returns a labeled prompt block.
6. `memory_forget` archives the memory and removes it from default search.
7. The compact panel remains usable at 420 x 620 logical pixels.
8. The settings screen reports the correct MCP bridge path.
9. `npm run dist:mac` produces a DMG.
10. A packaged previous version can download a newer release, replace itself
    in place, pass code-signature verification, and reopen.

## Current Verification

Verified in this repository:

- TypeScript checks pass.
- Production build passes.
- Isolated MCP integration passes for search, context, remember, forget, and
  stats.
- Screenshot capture passes for all main views and the compact panel.
- The packaged 22 px and 44 px menu bar templates keep transparent margins and
  are rejected by the build if the mark is clipped.
- An isolated real scan identified 61 importable memories across 10 installed
  agents, including 6 Trae entries from the China and international homes.
- An end-to-end MCP query against that imported library found a Trae-authored
  memory through `memory_search` and returned it through `memory_context`.
- The development settings screen reports
  `/Users/ewen/Documents/GitHub/dachshund/out/mcp/index.cjs`.
- `release/dachshund-0.1.3-arm64.dmg` was produced on 2026-10-31.
- The packaged app launched against an isolated data directory and reported a
  healthy loopback service at version `0.1.3`.
- A packaged `0.1.2` build containing the new installer downloaded a local
  `0.1.3` DMG, reached the installing state, replaced its bundle, passed
  `codesign --verify --deep --strict`, and reopened at version `0.1.3`.
- The installer log reported `installed 0.1.3`.
- The packaged `Contents/Resources/mcp/index.cjs` passed the same five-tool MCP
  smoke test.
- The packaged app is ad-hoc signed only; Gatekeeper assessment fails because it
  has no Developer ID signature or notarization.

The DMG SHA-256 from this build is:

```text
6375529f5868864d9f9e4729ad772edb828bcc0a215b5ce75d7a7e14ba8f0cc1
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
action.

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

### 0.1.4: Trustworthy Incremental Import

- persist per-source mtime, size, and hash;
- update an existing memory when its source changes;
- mark removed sources;
- expose source status in the detail view;
- add importer fixtures and regression tests.

### 0.1.5: Reviewable Consolidation

- near-duplicate suggestions;
- merge and split flows;
- conflict review;
- preserved supersession history;
- user-approved cleanup rather than automatic silent rewrites.

### 0.1.6: Recall Quality

- optional local embeddings;
- hybrid lexical and semantic ranking;
- query explanation;
- context budget controls;
- retrieval evaluation corpus.

### 0.1.7: Distribution

- signed and notarized universal build;
- update channel;
- first-run migration and backup checks;
- crash and migration diagnostics without telemetry.
