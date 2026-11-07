# Agent Integrations

Agent brand marks are sourced and cached locally from LobeHub and the official
Z.ai brand endpoint. See
[AGENT_ICONS.md](AGENT_ICONS.md) for the exact mapping, pinned version, license,
and build-time fetching rules.

## Support Matrix

For the native-to-shared memory mapping across every supported Agent,
including categories, concrete fields, fallback rules, and current limitations,
see the
[Agent Memory Mapping Matrix](AGENT_MEMORY_MAPPING.md).

| Agent | Local memory import | MCP config | Imported sources |
| --- | --- | --- | --- |
| Claude | Yes | `~/.claude.json` and `Claude(-3p)/claude_desktop_config.json` | Project topic memory with the injected `MEMORY.md` index, written instructions, rules, global memory, and local Cowork account, agent, and Space topics |
| Codex | Yes | `~/.codex/config.toml` | Codex memory Markdown and readable memory SQLite |
| Gemini CLI | Yes | `~/.gemini/settings.json` | `GEMINI.md` files |
| Cursor | Yes | `~/.cursor/mcp.json` | Rules and agent Markdown/MDC files |
| GitHub Copilot | Yes | `~/.copilot/mcp-config.json` | Memory and instruction Markdown |
| OpenCode | Yes | `~/.config/opencode/opencode.json` | Global `AGENTS.md` and observed memory Markdown |
| WorkBuddy | Yes | `~/.workbuddy/mcp.json` | Identity, user memory, and workspace memory Markdown |
| Doubao | Yes | Guided STDIO connector | Agent Mode global and session memory Markdown |
| TRAE | Yes | Detected `Trae CN`, `Trae`, or legacy `TRAE SOLO*` `User/mcp.json` | User profile, project memory, topics, and session memory JSONL |
| Hermes | Yes | `~/.hermes/config.yaml` | Native `MEMORY.md` and `USER.md` entries |
| Pi | Yes | `~/.pi/agent/mcp.json` | Compaction summaries and durable user context |
| ZCode | Yes | `~/.zcode/cli/config.json` | Project memory Markdown plus read-only SQLite durable user text |
| DeepSeek Harness | Yes | `~/.dsh/profiles/desktop/cordis.patch.yml` | Zstandard session logs and durable user text |

Installation is detected from the agent home directory or known application
path. The UI exposes a sharing toggle and an MCP connect action for each
detected agent.

## Claude

One card covers both Claude surfaces: Claude Code and the Claude Desktop app.

Homes:

- `~/.claude` for Claude Code;
- `~/Library/Application Support/Claude-3p` for the current Desktop deployment;
- `~/Library/Application Support/Claude` for the legacy Desktop profile.

Imported from Claude Code:

- the `MEMORY.md` index and topic files under project `memory` directories:
  `~/.claude/projects/<project>/memory/MEMORY.md` and
  `~/.claude/projects/<project>/memory/*.md`;
- `~/.claude/CLAUDE.md`;
- Markdown under `~/.claude/rules/`;
- the global `MEMORY.md` index and topic files under `~/.claude/memory/`.

The typed project files retain their native `user`, `feedback`, `project`, and
`reference` frontmatter as source evidence, then normalize into Identity,
Guidance, Knowledge, or Current work by type and body. Written instructions are
imported as rules rather than as project memory.

Claude Code injects only the first 200 lines or 25 KB of `MEMORY.md` into each
session; the rest of auto memory stays on disk and is read on demand. The index
is imported as a `reference` record tagged `memory-index`, because it is the
injected top layer and the map to the topic notes. An index with no entries
beyond its heading is skipped. Session transcripts are not imported as memories;
they remain the ground truth that notes are checked against.

Imported from Claude Desktop:

- topic Markdown under
  `local-agent-mode-sessions/<account>/<org>/spaces/<space-id>/memory/`;
- topic Markdown under
  `local-agent-mode-sessions/<account>/<org>/memory/memory/` and
  `local-agent-mode-sessions/<account>/<org>/agent/memory/`;
- `user`, `feedback`, `project`, and `reference` frontmatter types through the
  same source-aware taxonomy. Native type is evidence; the resulting kind is
  resolved from type plus body.

The local `MEMORY.md` index in each account, agent, and Space memory directory
is imported as a `reference` record tagged `memory-index`, with the surface
(`account`, `agent`, or `space`) in an additional tag. The Space name in the
sibling `spaces.json` becomes the memory's project label.

Not imported: server-side ordinary Chat memory and cloud Project memory that are
not present as local topic files. Those remain account-side.

MCP targets: `~/.claude.json` under `mcpServers` for Claude Code, and the
matching `claude_desktop_config.json` for Claude Desktop. Connect writes only
the surfaces installed on this Mac, and the merged card is connected only when
every installed surface has the connector. The shared-memory instruction block
is merged into `~/.claude/CLAUDE.md` only when Claude Code is installed.

Surfaces keep their own source tags (`claude-code`, `claude-desktop`), so
provenance stays visible even though they share one agent card.

## Codex

Home: `~/.codex`

Imported:

- `~/.codex/memories/MEMORY.md`, split by `# Task Group:` or
  `## Task Group:`;
- `~/.codex/memories/raw_memories.md`, split by `## Thread`;
- `~/.codex/memories/memory_summary.md`;
- read-only query of `~/.codex/sqlite/memories_1.sqlite` when the expected
  `stage1_outputs` schema is present.

Task-group summaries and raw threads are chronological evidence, so they import
as `task_rollout` in the Evidence layer rather than automatically becoming
current project state. `memory_summary.md` is split by `##` headings and each
section is filed by heading and content. `cwd:` or `cwd=` is extracted as project
scope and displayed separately from the category. A `task_group:` value is used
only when no cwd is available. Explicit `Reusable knowledge` sections become
`insight` or `procedure`; the surrounding thread remains Evidence.

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
`project`, or `reference` type as provenance. The shared kind is resolved from
that type and the body. `IDENTITY.md` maps to a guidance rule; `USER.md` maps to
an identity profile.

Workspace files named `YYYY-MM-DD.md` are dated logs, so they import as
`workspace_log` in the Evidence layer even when they are found in a project
workspace. The workspace name is retained as separate scope. A purely
date/time-named workspace is shown as `Session YYYY-MM-DD HH:mm` instead of
being presented as a fabricated project name. Other workspace Markdown keeps its
typed kind when present and otherwise resolves the closest durable kind from its
body.

MCP target: `~/.workbuddy/mcp.json`, under `mcpServers`.

## Doubao

Home: `~/Library/Application Support/Doubao`

Imported:

- Agent Mode `memory/MEMORY.md`;
- Markdown under Agent Mode `.sessions/<session>/memory/`.

Empty memory files are ignored. Locally visible Agent Mode files enter the
shared model with a durable kind resolved from their body because their native
format does not expose a reliable knowledge type. Doubao account memory and
per-assistant memory remain account-scoped and are not available to a local
filesystem importer. Doubao can still use the shared library through the MCP
connector below.

Doubao stores custom connectors in **Plugins / Skills (插件 · 技能) > Add (添加) >
Custom connector (新建自定义连接器)** rather than a stable user-editable JSON
file. The MCP button therefore opens a local setup panel instead of writing
Doubao's internal state.

The connector uses:

- transport: `STDIO`;
- command: the absolute Node.js path detected by dachshund, with `node` as the
  fallback;
- argument: the absolute dachshund bridge path inside the current app bundle;
- environment: `DACHSHUND_HOME` and `DACHSHUND_CLIENT_AGENT=doubao`.

The connector must point at the bridge inside the app bundle. A path under the
development `out/` directory can be rejected by Doubao's connector sandbox even
when the same command works in Terminal. If dachshund is moved or reinstalled,
reopen the setup panel and replace the saved bridge path.

dachshund marks Doubao connected only after the bridge receives a real MCP
`initialized` handshake. Doubao 2.33.5 identifies itself as the generic
`rmcp 3.2.0`, so the bridge also records the explicit agent identity from
`DACHSHUND_CLIENT_AGENT`; legacy receipts whose client name contains `Doubao`
or `豆包` remain valid. The bridge appends only the client name, version, agent
identity, and timestamp to `mcp-clients.jsonl` in the dachshund data directory.
Merely opening or filling in the Doubao form does not count as connected.

## TRAE

Homes:

- China build: `~/.trae-cn`;
- international build: `~/.trae`.

Product history: TraeWork supplied Agent mode and TraeCode supplied IDE
capabilities. TRAE 3.4.0 unified both modes into one product with shared data;
this is one agent identity in dachshund, not separate TraeWork, TraeCode, and
TRAE cards.

Application candidates, in priority order:

- `/Applications/Trae CN.app`;
- `/Applications/Trae.app`;
- `/Applications/TRAE SOLO CN.app`;
- `/Applications/TRAE SOLO.app`.

Application Support candidates use the matching `Trae CN`, `Trae`,
`TRAE SOLO CN`, and `TRAE SOLO` directories. dachshund selects one active
instance only. A current app or current support directory takes precedence over
legacy SOLO data; when no current installation exists, the legacy instance is
used as a read-only compatibility fallback.

Imported:

- `memory/projects/<project>/<date>/topics.md`;
- `memory/projects/<project>/<date>/session_memory_*.jsonl`;
- `memory/user_profile.md`;
- `memory/projects/<project>/project_memory.md`.

Session JSONL entries are converted into readable memory with `Outcome`,
`Learned`, and `Actions` sections. Profile memory maps to Identity; project
memory is resolved into Current work or Knowledge by its content; topic and
session summaries map to the Evidence layer. TRAE rules are not imported.

When both `~/.trae-cn` and `~/.trae` exist, current durable memory is read first
and normalized by kind, project, source reference, and content. Duplicate
legacy records are collapsed, retaining the newer record. Hidden migration
residue, `Cache`, `Code Cache`, `IndexedDB`, logs, browser storage, workspace MCP
caches, and unversioned JSONL are not imported.

MCP target: dachshund resolves the selected app's matching
`<Application Support>/<build>/User/mcp.json`. Current builds therefore write
to `Trae CN/User/mcp.json` or `Trae/User/mcp.json`; only a legacy-only
installation writes to `TRAE SOLO*/User/mcp.json`. The importer is read-only,
while MCP installation backs up the config and uses an atomic write. TRAE
accepts either `servers` or `mcpServers`; dachshund preserves the existing root
field and never creates both copies. Settings shows the detected app version and
the exact MCP path used.

## Hermes

Homes:

- `~/.hermes`;
- application bundles `Hermes Agent.app` and `Hermes.app`.

Imported:

- `~/.hermes/memories/MEMORY.md`;
- `~/.hermes/memories/USER.md`.

Hermes separates native memory entries with the literal delimiter `\n§\n`.
dachshund splits on that delimiter and creates one shared memory per entry
instead of treating the whole file as one item. `MEMORY.md` entries with `##`
headings are split again by section, so profile, project, environment, and
reference content can be classified independently. Session JSON is
intentionally not imported because it mixes durable context with transient tool
output.

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
metadata as source evidence. Their shared kind is normalized from type and body;
untyped files resolve the closest durable kind from their body. The SQLite scan
is a compatibility path for explicit durable user cues. Rollout debug logs are
not imported because they duplicate requests and may contain provider payloads.

MCP target: `~/.zcode/cli/config.json`, under `mcp.servers.dachshund`. ZCode uses
a strict schema, so dachshund writes only `type`, `command`, `args`, `env`, and
`enabled`.

## DeepSeek Harness

Homes:

- `~/.dsh`;
- application bundle `DeepSeek Harness.app`.

Imported:

- JSONL session artifacts under `~/.dsh/sessions/**`;
- each concatenated Zstandard frame is decoded and parsed independently, so one
  large decoded frame does not truncate the rest of the session;
- user messages whose source is the human user and whose text contains an
  explicit durable-memory cue;
- `compaction/summary` events as `compaction` in the Evidence layer;
- `~/.dsh/AGENTS.md` as a user-global rule, excluding dachshund's own managed
  instruction block.

System snapshots, skill reminders, runtime context, tool output, and ordinary
task prompts are excluded. dachshund replays `surfaceOp` to know which events are
currently visible. A durable user cue preceded by compaction is retained, but
tagged `surface-shadowed` rather than being mistaken for current visible context.

MCP target: `~/.dsh/profiles/desktop/cordis.patch.yml`. dachshund appends a
managed Cordis `insert` row for `@deepseek-ai/dsh-mcp-client` and replaces that
same marked row on later updates. The row uses an absolute Node.js executable,
the current bridge path, `DACHSHUND_HOME`, and
`DACHSHUND_CLIENT_AGENT=deepseek-harness`.

Connecting also maintains a marked instruction block in `~/.dsh/AGENTS.md`. It
tells DeepSeek Harness when to call `memory_context` and restricts
`memory_remember` to durable, user-provided or confirmed information. Repeating
Connect updates the block in place instead of appending duplicates.

With DeepSeek Harness `0.2.1-rc.5`, saving the managed row caused the running app
to spawn the bridge without an app restart and record
`dsh-mcp-client` `0.0.1` with `agentId=deepseek-harness`.

## Shared Memory Protocol

Every config-managed MCP entry sets `DACHSHUND_CLIENT_AGENT` to the agent id.
The bridge forwards that identity on `memory_remember`, so writes remain
attributable and exact duplicate content from another agent attaches a second
source. The MCP initialization response also tells clients to consult
`memory_context` before answering when prior context could change the result.

For agents with a stable global instruction file, Connect maintains an
idempotent managed block:

- Claude: `~/.claude/CLAUDE.md` (Claude Code);
- Codex: `~/.codex/AGENTS.md`;
- Gemini CLI: `~/.gemini/GEMINI.md`;
- GitHub Copilot: `~/.copilot/instructions/dachshund.md`;
- OpenCode: `~/.config/opencode/AGENTS.md`;
- DeepSeek Harness: `~/.dsh/AGENTS.md`.

The block asks the agent to call `memory_context` when identity, preferences,
rules, facts, decisions, current goals, or constraints may matter and to call
`memory_remember` only for durable, user-provided or confirmed information.
Importers strip this block, so it never becomes a self-referential memory.

## What "Connect" Writes

Most agents receive:

```json
{
  "mcpServers": {
    "dachshund": {
      "command": "/usr/bin/env",
      "args": ["node", "/path/to/dachshund/out/mcp/index.cjs"],
      "env": {
        "DACHSHUND_HOME": "/Users/example/Library/Application Support/dachshund",
        "DACHSHUND_CLIENT_AGENT": "claude"
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
env = { DACHSHUND_HOME = "/Users/example/Library/Application Support/dachshund", DACHSHUND_CLIENT_AGENT = "codex" }
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
        "DACHSHUND_HOME": "/Users/example/Library/Application Support/dachshund",
        "DACHSHUND_CLIENT_AGENT": "opencode"
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
      DACHSHUND_CLIENT_AGENT: hermes
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
          "DACHSHUND_HOME": "/Users/example/Library/Application Support/dachshund",
          "DACHSHUND_CLIENT_AGENT": "zcode"
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
          DACHSHUND_CLIENT_AGENT: deepseek-harness
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
- Source edits replace the prior active memory through persisted source identity;
  removed sources have no tombstone yet.
- Agent-specific formats may change upstream and require importer updates.
- A source file is copied into the dachshund library; the source path is
  retained as provenance but the source itself remains immutable.
- Automatic sync runs hourly while enabled, but live file watching, revision
  history, conflict review, and native writeback are future planning only; see
  [Product](PRODUCT.md#memory-synchronization-direction).
