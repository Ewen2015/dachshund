# Agent Integrations

Agent brand marks are sourced and cached locally from LobeHub. See
[AGENT_ICONS.md](AGENT_ICONS.md) for the exact mapping, pinned version, license,
and build-time fetching rules.

## Support Matrix

| Agent | Local memory import | MCP config | Imported sources |
| --- | --- | --- | --- |
| Claude Code | Yes | `~/.claude.json` | Project memory Markdown and global Claude memory |
| Codex | Yes | `~/.codex/config.toml` | Codex memory Markdown and readable memory SQLite |
| Gemini CLI | Yes | `~/.gemini/settings.json` | `GEMINI.md` files |
| Cursor | Yes | `~/.cursor/mcp.json` | Rules and agent Markdown/MDC files |
| GitHub Copilot | Yes | `~/.copilot/mcp-config.json` | Memory and instruction Markdown |
| OpenCode | Yes | `~/.config/opencode/opencode.json` | OpenCode memory Markdown |
| Windsurf | Yes | `~/.codeium/windsurf/mcp_config.json` | Windsurf memory Markdown |
| Claude Desktop | Connect only | Claude Desktop MCP config | No importer in the current MVP |
| WorkBuddy | Yes | `~/.workbuddy/mcp.json` | Identity, user memory, and workspace memory Markdown |
| Doubao | Yes | Import only | Agent Mode global and session memory Markdown |
| Trae | Yes | `~/Library/Application Support/TRAE SOLO CN/User/mcp.json` | Project topics and session memory JSONL |

Installation is detected from the agent home directory or known application
path. The UI exposes a sharing toggle and an MCP connect action for each
detected agent.

## Claude Code

Home: `~/.claude`

Imported:

- files under project `memory` directories:
  `~/.claude/projects/<project>/memory/*.md`;
- `~/.claude/CLAUDE.md`;
- Markdown under `~/.claude/memory/`.

MCP target: `~/.claude.json`, under `mcpServers`.

## Codex

Home: `~/.codex`

Imported:

- `~/.codex/memories/MEMORY.md`, split by `## Task Group:`;
- `~/.codex/memories/raw_memories.md`, split by `## Thread`;
- `~/.codex/memories/memory_summary.md`;
- read-only query of `~/.codex/sqlite/memories_1.sqlite` when the expected
  `stage1_outputs` schema is present.

MCP target: `~/.codex/config.toml`, as a managed
`[mcp_servers.dachshund]` block.

## Gemini CLI

Home: `~/.gemini`

Imported:

- `~/.gemini/GEMINI.md`;
- nested `GEMINI.md` files found during a bounded scan.

MCP target: `~/.gemini/settings.json`, under `mcpServers`.

## Cursor

Home: `~/.cursor`

Imported:

- `.md` and `.mdc` files under `~/.cursor/rules/`;
- `.md` and `.mdc` files under `~/.cursor/agents/`.

MCP target: `~/.cursor/mcp.json`, under `mcpServers`.

## GitHub Copilot

Home: `~/.copilot`

Imported:

- Markdown under `~/.copilot/memories/`;
- Markdown under `~/.copilot/instructions/`.

MCP target: `~/.copilot/mcp-config.json`, under `mcpServers`.

## OpenCode

Home: `~/.config/opencode`

Imported:

- Markdown under `~/.config/opencode/memory/`;
- Markdown under `~/.local/share/opencode/memory/`.

MCP target: `~/.config/opencode/opencode.json`, as `mcp.dachshund`.

## Windsurf

Home: `~/.codeium/windsurf`

Imported:

- Markdown under `~/.codeium/windsurf/memories/`.

MCP target: `~/.codeium/windsurf/mcp_config.json`, under `mcpServers`.

## Claude Desktop

Home: `~/Library/Application Support/Claude`

No importer is currently registered. Claude Desktop can read the shared library
after dachshund adds an MCP entry to:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

## WorkBuddy

Home: `~/.workbuddy`

Imported:

- `~/.workbuddy/IDENTITY.md` and `~/.workbuddy/USER.md`;
- Markdown under `~/.workbuddy/memory/`;
- `USER.md` files under `~/.workbuddy/user-*/`;
- `.workbuddy/memory/*.md` in workspaces registered in the local WorkBuddy
  database.

The importer strips WorkBuddy's trailing raw JSON metadata block before creating
the shared memory. MCP target: `~/.workbuddy/mcp.json`, under `mcpServers`.

## Doubao

Home: `~/Library/Application Support/Doubao`

Imported:

- Agent Mode `memory/MEMORY.md`;
- Markdown under Agent Mode `.sessions/<session>/memory/`.

Doubao is import-only until a stable global MCP configuration path is verified.

## Trae

Homes:

- China build: `~/.trae-cn`;
- international build: `~/.trae`.

Imported:

- `memory/projects/<project>/<date>/topics.md`;
- `memory/projects/<project>/<date>/session_memory_*.jsonl`.

Session JSONL entries are converted into readable memory with `Outcome`,
`Learned`, and `Actions` sections. MCP target for the current China build:
`~/Library/Application Support/TRAE SOLO CN/User/mcp.json`, under `mcpServers`.

## What "Connect" Writes

Most agents receive:

```json
{
  "mcpServers": {
    "dachshund": {
      "command": "/usr/bin/env",
      "args": ["node", "/path/to/dachshund/out/mcp/index.cjs"],
      "env": {
        "DACHSHUND_HOME": "/Users/example/Library/Application Support/dachshund"
      }
    }
  }
}
```

Codex receives an equivalent managed TOML block:

```toml
# >>> dachshund (managed by dachshund)
[mcp_servers.dachshund]
command = "/usr/bin/env"
args = ["node", "/path/to/dachshund/out/mcp/index.cjs"]
env = { DACHSHUND_HOME = "/Users/example/Library/Application Support/dachshund" }
# <<< dachshund
```

OpenCode receives:

```json
{
  "mcp": {
    "dachshund": {
      "type": "local",
      "command": ["/usr/bin/env", "node", "/path/to/dachshund/out/mcp/index.cjs"],
      "enabled": true,
      "environment": {
        "DACHSHUND_HOME": "/Users/example/Library/Application Support/dachshund"
      }
    }
  }
}
```

The config writer creates a `.dachshund.bak` copy before modifying an existing
file.

## Safety Rules

- Scanning must remain read-only against agent-owned files.
- Tests must use temporary `DACHSHUND_HOME` and `DACHSHUND_LIBRARY` paths.
- Automated tests must never modify a real user agent configuration.
- A failed JSON or TOML parse should abort the write rather than replace the
  file.
- The app should show a visible error when a config cannot be updated.

## Current Importer Limits

- Import is bounded to avoid walking an entire home directory.
- Very large files are skipped.
- Exact duplicate detection only; no semantic consolidation.
- Source edits are not yet reconciled incrementally.
- Agent-specific formats may change upstream and require importer updates.
- A source file is copied into the dachshund library; the source path is
  retained as provenance but the source itself remains immutable.
