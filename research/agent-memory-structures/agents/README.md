# Agent Memory Pages

Official-doc-first one-page notes for the eight products in the research report.
Each page has a simple English mechanism diagram and a short Chinese explanation.

| Agent | Native memory focus | Page |
| --- | --- | --- |
| Codex | Generated local memory + evidence | [Codex](codex.md) |
| WorkBuddy Desktop | Nightly summary + session search | [WorkBuddy](workbuddy.md) |
| Claude Code | Instructions + indexed auto memory | [Claude Code](claude-code.md) |
| Claude Desktop | Local project memory + account topics | [Claude Desktop](claude-desktop.md) |
| OpenCode | Instructions-first context | [OpenCode](opencode.md) |
| Trae | Global profile + project memory | [Trae](trae.md) |
| Pi | Session tree + compaction | [Pi](pi.md) |
| Hermes | Two bounded files + frozen snapshot | [Hermes](hermes.md) |

All diagrams are static and labeled in English. The research snapshot is dated
**2026-11-02**.

## Format for dachshund

The diagrams are archived in two formats so the same source works in the app and
in Markdown:

- **App diagram:** a standalone `760 × 300` light-theme SVG in
  `assets/agents/svg/`. The SVG has no `Fig` header, screenshot page border, or
  footer chrome. dachshund renders it at a compact size and opens a larger
  floating view on click.
- **Markdown preview:** a `@2x` PNG in `assets/agents/`. This keeps local
  Markdown reliable in viewers that do not render SVG assets consistently.
- **Page:** one Markdown file per agent, with YAML frontmatter for `name`,
  `memory_model`, `diagram`, and `official_source`.
- **Reading order:** one-sentence summary, “how it flows”, key boundaries, then
  official sources.
- **Motion:** none. Arrows are static and the same flow is repeated as text for
  accessibility, the compact app view, and narrow screens.
- **Theme:** the checked-in diagrams use the light paper treatment. Regenerate
  both formats from `figure/agents/build.mjs` instead of recolouring a
  screenshot.

[Back to the full report](../../agent-memory-structures.md)
