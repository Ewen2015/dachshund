# Architecture

## Overview

dachshund is one Electron application with three cooperating surfaces and one
MCP bridge:

1. Electron main process: lifecycle, tray, windows, discovery, store, and local
   HTTP service.
2. React renderer: full window and compact menu bar panel.
3. Local HTTP API: loopback-only authenticated memory operations.
4. MCP stdio bridge: translates agent tool calls into authenticated HTTP calls.
5. Update service: checks GitHub Releases and downloads a newer DMG.

```text
Claude Code / Codex / Cursor / ...
                 |
                 | MCP over stdio
                 v
        out/mcp/index.cjs
                 |
                 | HTTP 127.0.0.1 + Bearer token
                 v
       Electron main process
        +- Store
        +- Markdown library
        +- SQLite FTS5 index
        +- Agent discovery/importers

React renderer -- IPC --+
```

## Source Of Truth

The durable memory store is:

```text
~/Documents/dachshund/memory/*.md
```

Each file contains YAML frontmatter and Markdown:

```markdown
---
id: mem_example
title: Paper before pixels
kind: preference
tags:
  - design
  - product
created: 2026-10-30T12:00:00.000Z
updated: 2026-10-30T12:00:00.000Z
status: active
pinned: false
sources:
  - agent: claude-code
    path: /Users/example/.claude/projects/.../memory/design.md
---

The memory body.
```

The SQLite database is a derived index:

```text
~/Library/Application Support/dachshund/dachshund.db
```

It can be rebuilt from Markdown. Deleting the database must not delete durable
memory.

## Memory Taxonomy

Imported memory keeps the source agent's native structure and a normalized
dachshund category. The native model explains why an agent stored something;
the category provides one cross-agent browsing layer. The eleven kinds are
grouped into About me, Ways of working, Projects, Facts & references, and History.

Classification happens during import and is deterministic: no API key, model
call, or embedding is required. See [Memory Taxonomy](MEMORY.md) for the full
kind table, alias rules, and per-agent mapping.

## Data Directories

| Path | Purpose |
| --- | --- |
| `~/Library/Application Support/dachshund/` | App data, SQLite, runtime token |
| `~/Documents/dachshund/memory/` | Markdown memory library |
| `~/Library/Application Support/dachshund/runtime.json` | Active loopback port and token |

The following environment variables override defaults for tests and development:

- `DACHSHUND_HOME`
- `DACHSHUND_LIBRARY`
- `DACHSHUND_USER_DATA`
- `DACHSHUND_DEMO=1`
- `DACHSHUND_DISABLE_IMPORT=1`
- `DACHSHUND_AUTOLAUNCH=0`
- `DACHSHUND_MCP_BRIDGE`
- `DACHSHUND_UPDATE_DISABLED=1`
- `DACHSHUND_UPDATE_MANIFEST`
- `DACHSHUND_UPDATE_DELAY_MS`
- `DACHSHUND_UPDATE_INTERVAL_MS`
- `DACHSHUND_DOWNLOAD_DIR`

See [Updates](UPDATES.md) for the release contract and updater state machine.

## Discovery And Import

On startup, after onboarding, and on manual scan:

1. Known agent homes and application paths are checked for installation.
2. Enabled agents are read using agent-specific importers.
3. Imported records shorter than 30 characters are ignored.
4. A normalized content hash is computed.
5. Exact duplicate content attaches a new source to the existing memory.
6. New content is written to the dachshund Markdown library.
7. The SQLite index is updated.

Source files are opened read-only. dachshund does not move, rewrite, or delete
them.

The `imports` table exists in the schema but incremental source-change tracking
is not yet implemented. A changed source can currently appear as a new memory
while the prior version remains active. See [MVP](MVP.md#known-limitations).

## Deduplication

Deduplication currently uses an exact normalized-content hash:

1. lowercase;
2. remove all characters except letters and numbers;
3. SHA-1 the result.

This is deterministic and catches identical text. It does not perform semantic
near-duplicate detection. The UI calls additional sources "echoes".

## Search

SQLite FTS5 provides lexical search. The implementation supports:

- title, body, tags, and project fields;
- BM25 ranking;
- optional agent filtering;
- active-only results by default;
- a bounded result limit.

There is no vector index and no embedding model in the current MVP.

## Local API

The Electron main process starts an HTTP server on an ephemeral port bound to
`127.0.0.1`.

At startup it:

1. generates a 48-character random hex bearer token;
2. writes `runtime.json` with owner-only permissions;
3. removes the runtime file on shutdown.

Routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check without memory data |
| `GET` | `/api/state` | Full app state |
| `GET` | `/api/memories` | Search/list memories |
| `GET` | `/api/memories/:id` | Memory detail |
| `POST` | `/api/memories` | Create memory |
| `PATCH` | `/api/memories/:id` | Update memory |
| `POST` | `/api/memories/:id/archive` | Archive memory |
| `POST` | `/api/scan` | Scan agents |
| `POST` | `/api/mcp/search` | MCP-shaped search result |
| `POST` | `/api/mcp/context` | Prompt-ready context block |
| `POST` | `/api/mcp/remember` | Create memory |
| `POST` | `/api/mcp/forget` | Archive shared memory |
| `GET` | `/api/mcp/stats` | Counts |

Every route except `/health` requires the bearer token.

## MCP Bridge

The bridge is built as a single CommonJS bundle at `out/mcp/index.cjs`.

It:

1. reads `runtime.json` from the configured data directory;
2. waits for the app and checks `/health`;
3. optionally launches the installed app if it is not running;
4. sends authenticated HTTP requests;
5. exposes five MCP tools over stdio.

Tools:

- `memory_search`
- `memory_context`
- `memory_remember`
- `memory_forget`
- `memory_stats`

`memory_context` explicitly labels result content as context, not instructions.

## Agent MCP Installation

Connecting an agent modifies only its MCP configuration and creates a
`.dachshund.bak` backup when the file already exists.

Six configuration formats are supported:

- JSON `mcpServers` for most clients;
- Codex TOML under `[mcp_servers.dachshund]`;
- OpenCode's `mcp.dachshund` JSON object.
- Hermes YAML under `mcp_servers.dachshund`;
- ZCode's strict `mcp.servers.dachshund` JSON object;
- DeepSeek Harness's managed Cordis patch row.

The installed entry runs Node against the dachshund bridge and sets
`DACHSHUND_HOME` to the active data directory.

## Process And Window Model

- Single-instance Electron app.
- Main window opens at 920 x 700, can shrink to 800 x 600, and remains freely
  resizable and maximizable for the wide library view.
- Main window hides instead of closing unless the user quits.
- Tray click toggles a frameless always-on-top panel.
- Panel hides on blur.
- Panel is positioned relative to tray bounds and clamped to the display work
  area.
- Global shortcuts register while the app is running.

## Security Boundary

dachshund assumes a trusted local macOS account.

Current protections:

- loopback-only HTTP binding;
- random per-launch token;
- owner-only runtime token file;
- context isolation and no renderer Node integration;
- restricted external URL opening to `http` and `https`;
- no remote content in the app shell;
- no analytics or remote API calls on the core path;
- MCP config backups before writes.

dachshund does not defend against a compromised user account, a malicious local
process with the same file access, a compromised Electron distribution, or a
malicious MCP client that has already been granted access.

## Packaging

`electron-builder` creates an Apple Silicon DMG. The packaged app expects:

- `process.resourcesPath/mcp/index.cjs`;
- `process.resourcesPath/assets/icon.png`;
- `process.resourcesPath/assets/trayTemplate.png`.

The current build is unsigned and not notarized.
