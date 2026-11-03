# Development

## Requirements

- macOS
- Node.js 22 or newer
- npm

The project uses Electron's bundled Node runtime for the app. The MCP bridge is
a bundled CommonJS file and runs with the system Node executable used in the
agent's MCP configuration.

## Install

```bash
npm install
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run icons:agents` | Refresh the pinned local cache of agent brand SVGs |
| `npm run dev` | Build the MCP bridge and start Electron Vite |
| `npm run build` | Build icons, main, preload, renderer, and MCP bridge |
| `npm start` | Preview the production Electron build |
| `npm run typecheck` | Type-check main and renderer projects |
| `npm run test:agents` | Validate the Hermes, Pi, ZCode and DeepSeek Harness importers and MCP writers |
| `npm run test:panel` | Validate menu bar placement across displays and stale tray bounds |
| `npm run test:mcp` | Run isolated HTTP and MCP integration tests |
| `npm run demo:seed` | Seed the stable demo memory library |
| `npm run screenshot` | Capture the documented app screenshots |
| `npm run dist:mac` | Build an Apple Silicon DMG |

## Documentation Sync

Every change to code, taxonomy, agent support, interface behavior, or release
metadata must update every affected document in the same change. Do not leave a
stale description in a secondary folder.

At minimum, check:

- `README.md` and `README.zh-CN.md`;
- the relevant files under `docs/`;
- the relevant evidence and conclusions under `research/`;
- `site/index.html` and `site/zh/index.html` for user-facing changes;
- `docs/screenshots/` when the interface changes;
- download links, version numbers, checksums, and release notes when shipping.

`docs/MEMORY.md` and `src/shared/memory-taxonomy.ts` are the source of truth for
the memory model. Research documents may contain future proposals, but every
proposal must be clearly separated from implemented behavior.

## Data Isolation

Tests and screenshots must not use the real user library.

Use environment variables:

```bash
export DACHSHUND_HOME=/tmp/dachshund-data
export DACHSHUND_LIBRARY=/tmp/dachshund-library
```

Additional switches:

- `DACHSHUND_DEMO=1` uses demo agent IDs and avoids real imports.
- `DACHSHUND_DISABLE_IMPORT=1` disables source import.
- `DACHSHUND_AUTOLAUNCH=0` prevents the MCP bridge from opening the app.
- `DACHSHUND_MCP_BRIDGE=/absolute/path/to/mcp/index.cjs` overrides the bridge.
- `DACHSHUND_MCP_ENTRY=/absolute/path/to/index.cjs` makes the smoke test exercise
  a specific bridge bundle.
- `DACHSHUND_UPDATE_DISABLED=1` suppresses update checks.
- `DACHSHUND_UPDATE_MANIFEST=/absolute/path/to/release.json` mocks GitHub
  Releases for update UI and download tests.
- `DACHSHUND_UPDATE_DELAY_MS=50` makes the startup update check immediate.
- `DACHSHUND_DOWNLOAD_DIR=/tmp/dachshund-downloads` isolates downloaded update
  files.
- `DACHSHUND_UPDATE_INSTALL_OPEN=0` performs an automatic replacement without
  reopening the app, for isolated update tests.

`npm run test:mcp` creates its own temporary workspace and cleans it up after a
successful run.

`npm run test:agents` creates temporary homes for all four transcript-based
integrations, including concatenated Zstandard frames and a read-only SQLite
fixture. It also verifies each new MCP writer against a copied configuration and
never touches a real agent home.

## Build Sequence

`npm run build` performs:

1. `scripts/fetch-agent-icons.mjs`: validates the local cache of agent brand
   SVGs and fetches any missing pinned asset.
2. `scripts/make-icons.mjs`: renders the SVG icon to PNG and ICNS and produces
   the template tray images.
3. `electron-vite build`: builds main, preload, and renderer.
4. `scripts/build-mcp.mjs`: bundles the MCP bridge with esbuild.

Agent icons are local build assets, not runtime dependencies. See
[AGENT_ICONS.md](AGENT_ICONS.md) for provenance and licensing.

The MCP bridge must contain exactly one shebang line. The source intentionally
does not include one because esbuild supplies it as a banner.

## MCP Integration Test

Run:

```bash
npm run build
npm run test:mcp
```

The test:

1. creates a temporary data directory and library;
2. bundles and starts the loopback test server;
3. starts the real MCP bridge over stdio;
4. verifies the five-tool surface;
5. creates and searches a memory;
6. builds context;
7. archives the memory;
8. verifies that default search no longer returns it;
9. shuts down and removes the temporary workspace.

A separate real-import acceptance run scans the current Mac into an isolated
library, starts the loopback server, and verifies that the MCP bridge can recall
a TRAE-authored memory through both `memory_search` and `memory_context`.

## Screenshots

```bash
npm run demo:seed
npm run build
npm run screenshot
```

Output: `docs/screenshots/`

Expected capture sizes:

- full app window: configured at 920 x 700; the current 2x capture is
  1840 x 1400 device pixels including native window chrome;
- compact panel: 420 x 620 logical, 840 x 1240 device pixels on a 2x display.

Review both information hierarchy and legibility. Do not judge card quality from
the cover screenshot alone.

## Packaging

```bash
npm run dist:mac
```

Output directory: `release/`

Before tagging a release:

- update `package.json`, `package-lock.json`, README download links, and both
  `site/index.html` and `site/zh/index.html`;
- update both the website hero version and the download-card version;
- after GitHub Pages deploys, verify the live English and Chinese pages no
  longer show the previous release version.

The builder targets `dmg` for `arm64`. The app is unsigned and not notarized.
That limitation must remain explicit in user-facing documentation.

`scripts/after-pack.cjs` applies an ad-hoc signature after Electron packaging.
This keeps the bundle internally valid without pretending it has a Developer ID.
Gatekeeper still rejects the app until it is signed with an Apple Developer ID
and notarized.

Verified build:

- output: `release/dachshund-0.1.18-arm64.dmg`
- SHA-256:
  `bee18516aa14c90e40cedfe67b82516140b2b2f781c9d707ed8f603f465ee3b8`
- packaged app launch and packaged MCP bridge smoke test pass
- code signing: ad-hoc only
- Gatekeeper assessment: fails without Developer ID signing and notarization

Automatic update diagnostics are written to
`~/Library/Logs/dachshund/update-install.log`. The installer verifies the DMG
digest when available, the app's ad-hoc signature, bundle identifier and
version, stages a replacement, keeps a rollback copy, and relaunches the app.

Packaged resource paths:

- `Contents/Resources/mcp/index.cjs`
- `Contents/Resources/assets/icon.png`
- `Contents/Resources/assets/trayTemplate.png`
- `Contents/Resources/assets/trayTemplate@2x.png`

During development, the MCP bridge path is resolved from
`process.cwd()/out/mcp/index.cjs`.

## Code Map

| Path | Responsibility |
| --- | --- |
| `src/main/index.ts` | Electron lifecycle, windows, tray, shortcuts, IPC |
| `src/main/server.ts` | Authenticated loopback HTTP API |
| `src/main/updater.ts` | GitHub Release lookup and streamed update downloads |
| `src/main/installer.ts` | DMG mount, signature checks, atomic replacement and relaunch |
| `src/main/store/` | Markdown library, SQLite schema, search, counts |
| `src/main/agents/` | Discovery, importers, MCP config writers |
| `src/mcp/index.ts` | MCP stdio bridge |
| `src/renderer/src/App.tsx` | Full application |
| `src/renderer/src/PanelApp.tsx` | Menu bar popover |
| `src/renderer/src/styles.css` | Design tokens and layouts |
| `scripts/` | Icon generation, MCP build, screenshots, tests, demo data |

## Troubleshooting

### MCP bridge exits with a shebang error

Ensure `src/mcp/index.ts` has no shebang and `scripts/build-mcp.mjs` owns the
single banner line.

### MCP bridge cannot find the app

Open the app once, then retry. In development, start the app with the same
`DACHSHUND_HOME` used by the agent configuration.

### The Connectors screen shows the wrong bridge path

Development should show `<repo>/out/mcp/index.cjs`. A packaged build should show
`<app>/Contents/Resources/mcp/index.cjs`.

### `npm audit` reports development-only findings

Production dependencies and the full audit should both be checked. Do not
silently ignore a high-severity finding.
