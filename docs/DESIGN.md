# Design

## Direction

dachshund borrows the product posture of Magpie, not its brand assets:

- compact native-tool density;
- near-white surfaces with outlined cards;
- one black primary action;
- restrained color used only for identity and state;
- short navigation labels and tiny metadata;
- a menu bar popover that feels like part of macOS.

The result should read as a calm instrument, not an AI dashboard.

## Principles

1. **Utility first.** Every visible control should help inspect, find, connect,
   or create memory.
2. **Quiet hierarchy.** Large black type establishes the page; metadata stays
   small and secondary.
3. **Outlines, not shadows.** Borders and spacing carry structure. Shadows are
   limited to floating or elevated controls.
4. **Color is a signal.** Agent colors identify provenance. Green communicates
   local readiness. Warm collar orange is reserved for the brand mark.
5. **Compact does not mean cramped.** The menu bar panel keeps the same type
   hierarchy with fewer columns and larger touch targets.

## Visual Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#fafafa` | App and page background |
| `--surface` | `#ffffff` | Cards, inputs, active tabs |
| `--surface-soft` | `#f5f5f6` | Secondary fills |
| `--ink` | `#111112` | Headlines and primary buttons |
| `--ink-soft` | `#29292c` | High-emphasis body text |
| `--muted` | `#4a4a50` | Body copy |
| `--faint` | `#85858c` | Metadata and placeholder text |
| `--line` | `#e4e4e7` | Standard outlines |
| `--line-strong` | `#d3d3d8` | Focus and hover outlines |
| `--green` | `#25845f` | Local and connected state |
| `--warm` | `#b56a3c` | dachshund collar accent |
| `--radius` | `12px` | Main cards and grouped surfaces |

Backgrounds may use a very subtle radial white lift at the top. Avoid saturated
gradients, glass effects inside content areas, and decorative blobs.

## Typography

- UI stack: SF Pro on macOS, with Instrument Sans Variable as a bundled
  cross-platform fallback.
- Monospace: SF Mono or Menlo for paths and memory IDs.
- Page headline: large, tight tracking, around 38 px at the default window
  size in the full app.
- Section title: 16 to 20 px, semibold.
- Body: 12 to 15 px depending on surface.
- Metadata: 9 to 11 px, often uppercase with letter spacing.
- The compact panel never drops core body copy below 12 px.
- Compact-panel type runs about half a pixel tighter than the full app at each
  level. The adjustment should be felt rather than read as a separate scale.

Avoid serif display type. The brand character comes from the dachshund mark and
the collar accent, not from decorative typography.

## Layout

### Full App

- 62 px top chrome with a sidebar toggle, brand, search, menu bar action, and
  one primary button.
- Navigation has two layouts that share the same active view: compact segmented
  tabs in the top chrome, or a 204 px sidebar. The toggle sits between the macOS
  window controls and the brand mark with a 16 px safety gap; the preference
  persists.
- Centered content with a maximum readable width.
- Feed rows use a left rail and a high-density text block.
- Pulse uses a range filter, a four-cell summary strip, one stacked bar chart and
  two compact memory-specific detail cards. See [PULSE.md](PULSE.md).
- Memory detail opens as a right-side inspector rather than replacing the feed.
  The inspector can expand into a full-window reading view; Escape collapses
  the reading view before closing the inspector.
- Connectors use grouped white cards separated by generous vertical space.

### Menu Bar

- The app runs as a macOS menu bar utility: no Dock icon and no app-switcher
  entry. The packaged app declares `LSUIElement`; development builds hide the
  Electron Dock icon at launch.
- Fixed logical size: 420 x 620.
- 24 px outer content inset.
- 58 px header, 51 px tabs, 40 px search field.
- Eight visible memory rows or fewer.
- Footer always shows local-only status and the primary new-memory action.

The window uses native vibrancy, rounded corners, and a transparent background.
It opens on the display where the tray icon was clicked, joins the current
full-screen Space without switching away from it, and hides on blur.

## Components

- **Cards:** 1 px `--line`, white fill, 8 to 14 px radius, no heavy shadow.
- **Primary button:** black fill, white text, 32 px height, short label.
- **Ghost button:** white fill, 1 px border, black text.
- **Tabs:** compact segmented control on `rgba(17,17,18,0.035)`. The optional
  sidebar groups the same destinations into Workspace, Insights and App
  sections. Pulse belongs under Insights.
- **Agent identity:** real product marks in restrained white tiles; never used
  for large background fills.
- **Echo stack:** overlapping product marks plus a count when one memory came
  from multiple agents.
- **Status dots:** green for local readiness, agent-specific accent for
  provenance, warm red only for destructive or error states.

## Brand Mark

The mark is a side-profile dachshund reduced to one filled silhouette:

- long, low body;
- four short legs;
- long tail;
- rounded head and ears;
- white negative-space face, eyes, muzzle, and leg gaps;
- no collar in the icon so it remains a clean monochrome template.

Agent marks are sourced and cached from LobeHub at build time. The exact source,
license, local-only guarantee, and mapping are documented in
[AGENT_ICONS.md](AGENT_ICONS.md).

It must remain recognizable as a single-color silhouette at menu bar scale. Do
not add gradients, outlines around outlines, or text inside the mark.

Assets:

- `docs/brand/dachshund-mark.svg`: transparent line mark for UI and documents.
- `docs/brand/dachshund-menubar.svg`: 24 x 24 solid template icon.
- `docs/brand/dachshund-app-icon.svg`: near-white macOS icon tile.

## Motion

Motion is functional and sparse:

- 140 to 180 ms hover and tab transitions;
- one-page-load fade/slide;
- a rotating refresh icon while scanning;
- a soft pulse on the scan status strip;
- no continuous decorative animation.

The menu bar panel should appear immediately. Do not animate window position.

## Accessibility

- All icon-only buttons require an accessible label.
- Agent sharing uses a switch role with `aria-checked`.
- Body text and controls meet readable contrast against white and `#fafafa`.
- Color is never the only label: state also appears as text such as "MCP on",
  "Local only", or "2 agents".
- Keyboard shortcuts: `Cmd+K` search, `Cmd+N` new memory, `Cmd+\` toggle
  top tabs/sidebar, `Cmd+Shift+M` minimize to menu bar, `Cmd+Shift+D` toggle
  compact panel, `Escape` close.

## Verification

Visual changes should be checked with:

```bash
npm run demo:seed
npm run build
npm run screenshot
```

Review the app at its default 920 x 700 window, then confirm that it still
adapts cleanly when enlarged or maximized. Review the compact panel at a logical
420 x 620. Screenshots are captured at device scale on Retina, so 840 x 1240
pixels is the expected compact-panel file size.
