# Agent Icons

dachshund uses the real product marks for the agents it discovers. The visual
language follows Magpie's approach of giving each agent a recognizable identity
at small sizes, but dachshund does not reuse Magpie's own brand assets.

## Source

Icons come from the open-source
[`lobehub/lobe-icons`](https://github.com/lobehub/lobe-icons) collection:

- npm package: `@lobehub/icons-static-svg`
- pinned version: `1.101.0`
- upstream commit: `aea0ecb0fe1439467219197c52ffaeb579dfe33f`
- license: MIT, Copyright (c) 2023 LobeHub

The ZCode entry uses the official Z.ai brand SVG published at
`https://z-cdn.chatglm.cn/z-ai/static/logo.svg`. Z.ai has no corresponding
ZCode entry in the pinned LobeHub package. Product names and logos remain
trademarks of their respective owners. dachshund uses them only to identify the
local agent a memory came from.

## Local Asset Pipeline

```bash
npm run icons:agents
```

`scripts/fetch-agent-icons.mjs` downloads the pinned LobeHub SVGs and the
official Z.ai SVG into
`src/renderer/src/assets/agent-icons/`. Vite bundles those files into the
renderer. The app never requests an icon from the network at runtime.

The generated `manifest.json` records the package version, upstream commit,
source URL, and SHA-256 for every cached SVG. A normal `npm run build` reuses the
validated cache and does not need network access.

To refresh after deliberately changing the pinned package version:

```bash
npm run icons:agents -- --force
```

## Mapping

| Agent | LobeHub icon |
| --- | --- |
| Claude Code | `claudecode-color.svg` |
| Claude Desktop | `claude-color.svg` |
| Codex | `codex-color.svg` |
| Gemini CLI | `geminicli-color.svg` |
| Cursor | `cursor.svg` |
| GitHub Copilot | `githubcopilot.svg` |
| OpenCode | `opencode.svg` |
| Windsurf | `windsurf.svg` |
| WorkBuddy | `workbuddy-color.svg` |
| Doubao | `doubao-color.svg` |
| Trae | `trae-color.svg` |
| Hermes | `hermesagent.svg` |
| Pi | `pi.svg` |
| ZCode | `zai.svg` (official Z.ai asset) |
| DeepSeek Harness | `deepseek-color.svg` |

Unknown future agents fall back to a text monogram. dachshund itself uses the
local dachshund mark.

## UI Rules

- Brand SVGs sit inside restrained white tiles with a 1 px neutral border.
- Colored marks are never used as large background fills.
- Overlapping source stacks keep a white separation ring.
- Icons must remain recognizable at 14 to 24 px.
- Decorative repeats are hidden from assistive technology; identity-bearing
  instances retain the agent name as their accessible label.

See [third-party/lobe-icons-LICENSE.txt](third-party/lobe-icons-LICENSE.txt) for
the upstream license text.
