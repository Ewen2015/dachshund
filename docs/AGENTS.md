# Agent Integrations

Agent brand marks are sourced and cached locally from LobeHub and the official
Z.ai brand endpoint. See
[AGENT_ICONS.md](AGENT_ICONS.md) for the exact mapping, pinned version, license,
and build-time fetching rules.

## Support Matrix

| Agent | Local memory import | MCP config | Imported sources |
| --- | --- | --- | --- |
| Claude Code | Yes | `~/.claude.json` | Project topic memory, written instructions, rules, and global memory |
| Codex | Yes | `~/.codex/config.toml` | Codex memory Markdown and readable memory SQLite |
| Gemini CLI | Yes | `~/.gemini/settings.json` | `GEMINI.md` files |
| Cursor | Yes | `~/.cursor/mcp.json` | Rules and agent Markdown/MDC files |
| GitHub Copilot | Yes | `~/.copilot/mcp-config.json` | Memory and instruction Markdown |
| OpenCode | Yes | `~/.config/opencode/opencode.json` | Global `AGENTS.md` and observed memory Markdown |
| Windsurf | Yes | `~/.codeium/windsurf/mcp_config.json` | Windsurf memory Markdown |
| Claude Desktop | Connect only | Claude Desktop MCP config | No importer in the current MVP |
| WorkBuddy | Yes | `~/.workbuddy/mcp.json` | Identity, user memory, and workspace memory Markdown |
| Doubao | Yes | Guided STDIO connector | Agent Mode global and session memory Markdown |
| Trae | Yes | `~/Library/Application Support/TRAE SOLO CN/User/mcp.json` | User profile, project memory, topics, and session memory JSONL |
| Hermes | Yes | `~/.hermes/config.yaml` | Native `MEMORY.md` and `USER.md` entries |
| Pi | Yes | `~/.pi/agent/mcp.json` | Compaction summaries and durable user context |
| ZCode | Yes | `~/.zcode/cli/config.json` | Project memory Markdown plus read-only SQLite durable user text |
| DeepSeek Harness | Yes | `~/.dsh/profiles/desktop/cordis.patch.yml` | Zstandard session logs and durable user text |

Installation is detected from the agent home directory or known application
path. The UI exposes a sharing toggle and an MCP connect action for each
detected agent.

## Claude Code

Home: `~/.claude`

Imported:

- files under project `memory` directories:
  `~/.claude/projects/<project>/memory/*.md` except the `MEMORY.md` index;
- `~/.claude/CLAUDE.md`;
- Markdown under `~/.claude/rules/`;
- Markdown under `~/.claude/memory/` except the `MEMORY.md` index.

The typed project files retain their native `user`, `feedback`, `project`, and
`reference` frontmatter. Written instructions are imported as rules rather than
as project memory.

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

- `~/.config/opencode/AGENTS.md`;
- Markdown under `~/.config/opencode/memory/`;
- Markdown under `~/.local/share/opencode/memory/`.

Project-level `AGENTS.md` files and session history are not imported.

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
the shared memory. A typed memory file keeps its native `user`, `feedback`,
`project`, or `reference` kind. `IDENTITY.md` is treated as assistant behavior
and maps to Rules; `USER.md` maps to Profile. MCP target: `~/.workbuddy/mcp.json`,
under `mcpServers`.

## Doubao

Home: `~/Library/Application Support/Doubao`

Imported:

- Agent Mode `memory/MEMORY.md`;
- Markdown under Agent Mode `.sessions/<session>/memory/`.

Doubao stores custom connectors in **Plugins / Skills (插件 · 技能) > Add (添加) >
Custom connector (新建自定义连接器)** rather than a stable user-editable JSON
file. The MCP button therefore opens a local setup panel instead of writing
Doubao's internal state.

The connector uses:

- transport: `STDIO`;
- command: `/usr/bin/env`;
- arguments: `node`, followed by the absolute dachshund bridge path;
- environment: `DACHSHUND_HOME=/Users/<user>/Library/Application Support/dachshund`.

dachshund marks Doubao connected only after the bridge receives a real MCP
`initialized` handshake from a client name containing `Doubao` or `豆包`. The
bridge appends only the client name, version, and timestamp to
`mcp-clients.jsonl` in the dachshund data directory. Merely opening or filling in
the Doubao form does not count as connected.

## Trae

Homes:

- China build: `~/.trae-cn`;
- international build: `~/.trae`.

Imported:

- `memory/projects/<project>/<date>/topics.md`;
- `memory/projects/<project>/<date>/session_memory_*.jsonl`;
- `memory/user_profile.md`;
- `memory/projects/<project>/project_memory.md`.

Session JSONL entries are converted into readable memory with `Outcome`,
`Learned`, and `Actions` sections. Profile memory maps to About me; project
memory maps to Projects; topic and session summaries map to History. Trae rules
are not imported. MCP target for the current China build:
`~/Library/Application Support/TRAE SOLO CN/User/mcp.json`, under `mcpServers`.

## Hermes

Homes:

- `~/.hermes`;
- application bundles `Hermes Agent.app` and `Hermes.app`.

Imported:

- `~/.hermes/memories/MEMORY.md`;
- `~/.hermes/memories/USER.md`.

Hermes separates native memory entries with the literal delimiter `\n§\n`.
dachshund splits on that delimiter and creates one shared memory per entry
instead of treating the whole file as one item. Session JSON is intentionally
not imported because it mixes durable context with transient tool output.

MCP target: `~/.hermes/config.yaml`, under `mcp_servers.dachshund`. The YAML
document is parsed before writing and a `.dachshund.bak` copy is created.

## Pi

Home: `~/.pi/agent`

Imported:

- JSONL sessions under `~/.pi/agent/sessions/**`;
- `compaction.summary` entries;
- `branch_summary.summary` entries;
- user messages that contain an explicit durable-memory cue such as “remember”
  or “以后默认”.

System prompts, assistant reasoning, tool results, and ordinary task prompts are
not imported.

MCP target: `~/.pi/agent/mcp.json`, under `mcpServers`.

## ZCode

Home: `~/.zcode`

Imported:

- project memory Markdown under
  `~/.zcode/cli/memories/projects/<project>/memory/`, excluding `MEMORY.md`;
- read-only queries against `~/.zcode/cli/db/db.sqlite`;
- text parts attached to user messages are considered only when they contain an
  explicit durable preference or instruction.

The Markdown files retain native `user`, `feedback`, `project`, and `reference`
metadata when present and otherwise default conservatively to project memory.
The SQLite scan is a compatibility path for explicit durable user cues. Rollout
debug logs are not imported because they duplicate requests and may contain
provider payloads.

MCP target: `~/.zcode/cli/config.json`, under `mcp.servers.dachshund`. ZCode uses
a strict schema, so dachshund writes only `type`, `command`, `args`, `env`, and
`enabled`.

## DeepSeek Harness

Homes:

- `~/.dsh`;
- application bundle `DeepSeek Harness.app`.

Imported:

- JSONL session artifacts under `~/.dsh/sessions/**`;
- each concatenated Zstandard frame is decompressed before parsing;
- user messages whose source is the human user and whose text contains an
  explicit durable-memory cue.

System snapshots, skill reminders, tool output, and task prompts are excluded.

MCP target: `~/.dsh/profiles/desktop/cordis.patch.yml`. dachshund appends a
managed Cordis `insert` row for `@deepseek-ai/dsh-mcp-client` and replaces that
same marked row on later updates.

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

Hermes receives:

```yaml
mcp_servers:
  dachshund:
    command: "/usr/bin/env"
    args:
      - node
      - /path/to/dachshund/out/mcp/index.cjs
    env:
      DACHSHUND_HOME: /Users/example/Library/Application Support/dachshund
    enabled: true
```

ZCode receives:

```json
{
  "mcp": {
    "servers": {
      "dachshund": {
        "type": "stdio",
        "command": "/usr/bin/env",
        "args": ["node", "/path/to/dachshund/out/mcp/index.cjs"],
        "env": {
          "DACHSHUND_HOME": "/Users/example/Library/Application Support/dachshund"
        },
        "enabled": true
      }
    }
  }
}
```

DeepSeek Harness receives a managed Cordis patch row:

```yaml
# >>> dachshund (managed by dachshund)
- insert:
    - id: dachshund-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: dachshund
        transport: stdio
        command: "/usr/bin/env"
        args: [node, "/path/to/dachshund/out/mcp/index.cjs"]
        cwd: "/path/to/dachshund/out/mcp"
        env:
          DACHSHUND_HOME: "/Users/example/Library/Application Support/dachshund"
# <<< dachshund
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
