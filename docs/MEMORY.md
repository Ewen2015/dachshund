# Memory Taxonomy

dachshund joins memory written under different assumptions: typed project
files, instruction documents, chronological session logs, account-level memory,
and databases with their own schemas. It does not flatten those differences
away.

Every imported item keeps three dimensions:

1. **Native model**: what the source agent calls the memory, where it came from,
   and why that agent stored it there.
2. **dachshund category**: the stable knowledge type used to browse the shared
   library.
3. **Project scope**: the repository, workspace, or task range the memory
   belongs to. Scope is an independent filter and does not decide the category.

The native model is evidence. Category and project scope are separate
organizing layers.

```text
agent file or database
        |
        v
agent-specific importer
        |
        v
native kind / section / record type
        |
        +--> kind normalization -> dachshund category
        |
        +--> cwd / workspace metadata -> project scope
        |
        v
Markdown memory + SQLite index + independent filters
```

Classification is deterministic. It does not call an LLM, generate embeddings,
or upload memory for inference.

## Categories and kinds

There are five top-level categories and eleven concrete kinds. The category
answers “what kind of knowledge is this?”, the kind names the concrete type
under that category, and the project scope answers “what work does it belong
to?”.

| Category | Kind | Use for | Not for |
| --- | --- | --- | --- |
| **About me** | `profile` | Stable identity, role, expertise, and personal context | Temporary task details |
| **About me** | `preference` | Desired tone, tools, defaults, and ways of working | One-off corrections |
| **Ways of working** | `rule` | Explicit instructions, constraints, and policies | A reason a decision was made |
| **Ways of working** | `feedback` | Corrections, approval signals, and rejected approaches | General reference material |
| **Ways of working** | `lesson` | A reusable conclusion learned from an attempt | Raw event history |
| **Ways of working** | `workflow` | A repeatable sequence, command, or method | A single project fact |
| **Projects** | `project` | Goals, scope, constraints, and current project context | Long-term personal identity |
| **Projects** | `decision` | A choice already made and the rationale worth preserving | Open questions |
| **Facts & references** | `fact` | A durable fact worth recalling later | An event that only matters as history |
| **Facts & references** | `reference` | A pointer to a document, link, path, or external system | The full external document |
| **History** | `episode` | Session summaries, topic summaries, compactions, and task history | Promoted durable knowledge |

### Why these boundaries

- **About me** is portable across projects. It should remain useful when the
  repository changes.
- **Ways of working** shapes behavior. Rules and feedback are separated
  because one is an instruction and the other is evidence that an instruction
  worked or failed.
- **Projects** contains current project state. A record can belong to a project
  scope without becoming current project state; in that case category and scope
  deliberately differ.
- The **Facts & references** category contains durable information that is not necessarily
  personal. It includes both facts and references to information kept elsewhere.
- The **History** category is the historical-evidence layer. Session logs are deliberately not mixed
  into durable facts by recency alone.

An `episode` can later be expressed as a `lesson`, `decision`, or `fact` through
an explicit write. dachshund does not silently promote a summary into a durable
claim.

The History filter is hidden while the library has no episode records, so an
empty evidence layer does not add a permanent empty control to the interface.
Codex task-group and raw-thread records remain episodes even when they have a
project scope. Only an explicit `Reusable knowledge` section is imported as a
separate lesson.

## Normalization

Importers retain the source's native meaning, then normalize common aliases into
one of the eleven kinds:

| Native signal | Normalized kind |
| --- | --- |
| `user`, `identity`, `personal` | `profile` |
| `preferences`, `preference` | `preference` |
| `instruction`, `instructions`, `guideline`, `convention`, `policy` | `rule` |
| `correction`, `feedback` | `feedback` |
| `task`, `project_memory` | `project` |
| `decision` | `decision` |
| `link`, `doc`, `reference` | `reference` |
| `session`, `session_memory`, `topic`, `rollout`, `compaction`, `history` | `episode` |
| explicit `fact`, `lesson`, `workflow` | unchanged |

Scope does not override knowledge type. A Codex `cwd`, `task_group`, WorkBuddy
workspace, or other workstream identifier is stored as project scope while the
record keeps the kind implied by its content and native structure. Codex task
groups therefore default to `episode`, not `project`.

If a source has no usable type metadata, the importer classifies by the role of
the file. An empty or unknown kind falls back to `fact`; an unknown kind is not
discarded.

The implementation lives in
[`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts).

Research notes are separate from this contract. The implemented model is
documented here; [dachshund-memory-taxonomy.md](../research/dachshund-memory-taxonomy.md)
records the alternatives that were evaluated, including `authority`, generic
`scope`, and `confidence`. Those fields are not part of the current schema.

## Agent mapping

The detail page for an installed agent shows its native structure, the path
dachshund reads, and how each native section maps into the shared taxonomy.
Rows explicitly marked **Not imported** describe the native model without
claiming that dachshund currently has access to that data.

| Agent | Native organization | Imported now | Native but not imported |
| --- | --- | --- | --- |
| **Claude Code** | `user`, `feedback`, `project`, `reference`, plus written instructions | Typed auto memory maps to About me, Ways of working, Projects, and Facts & references; `CLAUDE.md` and rules map to Ways of working | Session transcripts |
| **Claude Desktop** | Local Cowork Space and local account/agent topic files plus server-side Chat memory | Typed local topics map to About me, Ways of working, Projects, and Facts & references; `MEMORY.md` is only an index | Ordinary Chat memory and cloud Project memory that are not present locally |
| **Codex** | Task groups, merged summaries, rollouts | Task groups and rollouts to History with cwd scope; summary to About me; only explicit `Reusable knowledge` to Ways of working | Nothing in the documented local store |
| **Cursor** | Rules, `AGENTS.md`, automation memory | Local rules and agent definitions to Ways of working | Repository `AGENTS.md` and cloud automation `MEMORIES.md` |
| **DeepSeek Harness** | Append-only session events; durable memory comes from plugins or MCP | Explicit durable cues to About me or Ways of working; compaction summaries to History; `~/.dsh/AGENTS.md` to Ways of working | Raw session events, tool output, `@session` snapshots, and native MCP memory stores |
| **Doubao** | Account memory, assistant memory, Agent Mode workspace | Locally observable Agent Mode workspace and session memory to Projects | Account memory and per-assistant memory |
| **Gemini CLI** | `GEMINI.md` instructions and `save_memory` entries | Instructions to Ways of working; added memories to Facts & references | CLI session history |
| **GitHub Copilot** | Instructions, `AGENTS.md`, local CLI sessions | Local instruction Markdown to Ways of working; local memory Markdown to Facts & references | `AGENTS.md` and CLI session history |
| **Hermes** | `USER.md` and `MEMORY.md` | `USER.md` to About me; untyped `MEMORY.md` entries conservatively to Facts & references | SQLite session history |
| **OpenCode** | Global and project `AGENTS.md`, observed memory Markdown, sessions | Global `AGENTS.md` to Ways of working; observed memory Markdown to Facts & references | Project `AGENTS.md` and session history |
| **Pi** | Session tree, compaction, branch summaries | Compaction and branch summaries to History; explicit durable cues to About me or Ways of working | Raw session branches and ordinary messages |
| **TRAE** | `user_profile.md`, `project_memory.md`, `topics.md`, session JSONL | Profile to About me; project memory to Projects; topics and session summaries to History | Rules and transient cache/log data |
| **WorkBuddy** | Typed `user`, `feedback`, `project`, `reference` memory, identity files, and dated workspace logs | Typed memory maps to About me, Ways of working, Projects, and Facts & references; `YYYY-MM-DD.md` workspace logs map to History with a session scope; assistant identity maps to Ways of working | Undated session internals |
| **ZCode** | Project-scoped typed Markdown memory plus session evidence | Typed Markdown maps to About me, Ways of working, Projects, and Facts & references; explicit session cues map to About me or Ways of working | Global and project `AGENTS.md` |
| **Windsurf** | Workspace memories, rules, `AGENTS.md` | Workspace memory Markdown to Projects | Rules and `AGENTS.md` |

This table describes the current adapters, not a claim that every agent exposes
the same five categories natively. A mapping row and an imported record are
different claims: the UI shows **Not imported** whenever the native concept is
visible but no adapter reads it yet.

The same rule applies inside the code. A native signal has exactly one
dachshund category, so a source that can produce both a preference and a
correction is represented as two native mapping rows rather than one row with
kinds from two categories.

## Interface contract

The shared library and the per-agent view use the taxonomy differently:

- **All memory** is one timeline sorted by `updatedAt` descending. Agent and
  date are not separate sections, so recent cross-agent work stays together.
- **The category legend** filters the visible timeline without consuming the
  space of a dashboard. Every card still carries its category tag, kind, time,
  and sources.
- **Type and scope are separate labels.** Cards and details show `Type` for the
  knowledge category and `Scope` for the project or workspace, and the timeline
  exposes an independent scope filter. A History episode may therefore have a
  project scope without moving into Projects.
- **An agent page** explains that agent's native model first, then shows the
  mapping into dachshund. Its timeline contains only memories with a source from
  that agent and remains sorted newest first.
- **Changing agents resets the category filter.** Native categories and counts
  are not carried across incompatible source models.
- **An echo is not a second memory.** Identical content from several agents
  remains one item with multiple sources; it does not receive conflicting
  categories based on which agent was read last.

## Boundaries

- The taxonomy is curated, not learned. Adding a new agent or memory format is a
  code change with tests, not an opaque model update.
- Exact duplicate detection is separate from classification. Echo merging does
  not perform semantic deduplication.
- The mapping is intentionally conservative. If a source does not make its
  meaning clear, dachshund preserves the content rather than inventing a
  stronger category.
- Source files remain read-only. Updating or reclassifying a shared memory
  changes the dachshund copy, not the agent's native memory.
