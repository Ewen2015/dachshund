# Memory Taxonomy

dachshund joins memory written under different assumptions: typed project
files, instruction documents, chronological session logs, account-level memory,
and databases with their own schemas. It does not flatten those differences
away.

Every imported item keeps two levels of meaning:

1. **Native model**: what the source agent calls the memory, where it came from,
   and why that agent stored it there.
2. **dachshund category**: the stable, cross-agent grouping used to browse the
   shared library.

The native model is evidence. The dachshund category is an organizing layer.

```text
agent file or database
        |
        v
agent-specific importer
        |
        v
native kind / section / record type
        |
        v
kind normalization -> dachshund category
        |
        v
Markdown memory + SQLite index
```

Classification is deterministic. It does not call an LLM, generate embeddings,
or upload memory for inference.

## Categories and kinds

There are five top-level categories and eleven concrete kinds. The category
answers “where should I look for this?”, while the kind answers “what kind of
knowledge is this?”

| Category | Kind | Use for | Not for |
| --- | --- | --- | --- |
| **About me** | `profile` | Stable identity, role, expertise, and personal context | Temporary task details |
| **About me** | `preference` | Desired tone, tools, defaults, and ways of working | One-off corrections |
| **Working together** | `rule` | Explicit instructions, constraints, and policies | A reason a decision was made |
| **Working together** | `feedback` | Corrections, approval signals, and rejected approaches | General reference material |
| **Working together** | `lesson` | A reusable conclusion learned from an attempt | Raw event history |
| **Working together** | `workflow` | A repeatable sequence, command, or method | A single project fact |
| **Projects** | `project` | Goals, scope, constraints, and current project context | Long-term personal identity |
| **Projects** | `decision` | A choice already made and the rationale worth preserving | Open questions |
| **Knowledge** | `fact` | A durable fact worth recalling later | An event that only matters as history |
| **Knowledge** | `reference` | A pointer to a document, link, path, or external system | The full external document |
| **Timeline** | `episode` | Session summaries, topic summaries, compactions, and task history | Promoted durable knowledge |

### Why these boundaries

- **About me** is portable across projects. It should remain useful when the
  repository changes.
- **Working together** changes behavior. Rules and feedback are separated
  because one is an instruction and the other is evidence that an instruction
  worked or failed.
- **Projects** is scoped context. A project can be active for months without
  becoming a personal preference.
- **Knowledge** is durable but not necessarily personal. It includes both facts
  and references to information kept elsewhere.
- **Timeline** is historical evidence. Session logs are deliberately not mixed
  into durable facts by recency alone.

An `episode` can later be expressed as a `lesson`, `decision`, or `fact` through
an explicit write. dachshund does not silently promote a summary into a durable
claim.

## Normalization

Importers retain the source's native meaning, then normalize common aliases into
one of the eleven kinds:

| Native signal | Normalized kind |
| --- | --- |
| `user`, `identity`, `personal` | `profile` |
| `preferences`, `preference` | `preference` |
| `instruction`, `instructions`, `guideline`, `convention`, `policy` | `rule` |
| `correction`, `feedback` | `feedback` |
| `task`, `task-group`, `task_group`, `project_memory` | `project` |
| `decision` | `decision` |
| `link`, `doc`, `reference` | `reference` |
| `session`, `session_memory`, `topic`, `rollout`, `compaction`, `history` | `episode` |
| explicit `fact`, `lesson`, `workflow` | unchanged |

If a source has no usable type metadata, the importer classifies by the role of
the file. An empty or unknown kind falls back to `fact`; an unknown kind is not
discarded.

The implementation lives in
[`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts).

## Agent mapping

The detail page for an installed agent shows its native structure, the path
dachshund reads, and how each native section maps into the shared taxonomy.

| Agent | Native organization | Primary dachshund landing |
| --- | --- | --- |
| **Claude Code** | `user`, `feedback`, `project`, `reference`, plus `CLAUDE.md` | About me, Working together, Projects, Knowledge |
| **Claude Desktop** | Account topics and project memory; MCP target only | Knowledge, About me, Projects |
| **Codex** | Task groups, merged summaries, rollouts | Projects, About me, Timeline |
| **Cursor** | Rules, `AGENTS.md`, automation memory | Working together, Projects, Knowledge |
| **DeepSeek Harness** | Append-only session events, compaction, MCP memory | Timeline, Knowledge |
| **Doubao** | Account memory, assistant memory, Agent Mode workspace | About me, Knowledge, Projects |
| **Gemini CLI** | `GEMINI.md` instructions and `save_memory` entries | Working together, Knowledge, Timeline |
| **GitHub Copilot** | Instructions, `AGENTS.md`, local CLI sessions | Working together, Projects, Timeline |
| **Hermes** | `USER.md` and `MEMORY.md` | About me, Knowledge, Projects |
| **OpenCode** | `AGENTS.md`, instructions, local sessions | Working together, Projects, Timeline |
| **Pi** | Session tree, compaction, branch summaries | Timeline, with explicit durable cues in About me |
| **Trae** | `user_profile`, `project_memory`, `topics.md`, session memory | About me, Projects, Timeline |
| **WorkBuddy** | Typed `user`, `feedback`, `project`, `reference` memory | About me, Working together, Projects, Knowledge |
| **ZCode** | Project-scoped typed memory | About me, Working together, Projects, Knowledge |
| **Windsurf** | Workspace memories, rules, `AGENTS.md` | Projects, Working together |

This table describes the current adapters, not a claim that every agent exposes
the same five categories natively.

## Interface contract

The shared library and the per-agent view use the taxonomy differently:

- **All memory** is one timeline sorted by `updatedAt` descending. Agent and
  date are not separate sections, so recent cross-agent work stays together.
- **The category legend** filters the visible timeline without consuming the
  space of a dashboard. Every card still carries its category tag, kind, time,
  and sources.
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
