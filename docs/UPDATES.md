# Updates

## Current Model

dachshund checks the latest stable GitHub Release for
`Ewen2015/dachshund`. The check runs after launch, every six hours, and when the
user chooses **Check for Updates** from the app or tray menu.

When a newer version is available:

1. the compact menu bar panel shows an update card;
2. the full app shows the same update card above its content;
3. the tray context menu adds a download action and the tooltip reports the
   available version;
4. the DMG downloads inside the app with byte progress;
5. the completed installer is opened from the app.

The download is streamed to:

```text
~/Downloads/dachshund-<version>-arm64.dmg
```

The app does not replace itself silently. The current build is ad-hoc signed,
so macOS cannot safely validate an in-place auto-update. The user opens the DMG
and replaces the app instead.

## Release Contract

Every release must follow this contract:

- tag: `v0.1.x`;
- `package.json` version: matching `0.1.x`;
- asset: `dachshund-0.1.x-arm64.dmg`;
- release body: concise Markdown release notes;
- release state: published and stable, not draft or prerelease.

The update checker reads:

```text
GET https://api.github.com/repos/Ewen2015/dachshund/releases/latest
```

It selects the first ARM64 DMG asset, falling back to another DMG asset. The
version comparison accepts an optional leading `v`. If the unauthenticated API
is rate limited or temporarily unavailable, the checker falls back to GitHub's
public `releases.atom` feed and constructs the standard DMG asset URL.

## Version Policy

The current line is `0.1.x`. Normal iteration moves through `0.1.1`, `0.1.2`,
`0.1.3` and so on. Do not move to `0.2.0` or any `0.2.x` release without an
explicit product decision.

## Implementation

| Path | Responsibility |
| --- | --- |
| `src/main/updater.ts` | GitHub lookup, version comparison, download stream, install handoff |
| `src/main/index.ts` | Startup checks, tray menu, app menu, dialogs, IPC |
| `src/preload/index.ts` | Typed update bridge |
| `src/renderer/src/lib/useUpdater.ts` | Renderer state and dismissal |
| `src/renderer/src/components/UpdateNotice.tsx` | Full app and compact panel notice |

Rendered update state is pushed to both windows through `update:changed`. The
renderer never calls GitHub directly.

## Security And Privacy

- The only update network request is the GitHub Release API.
- Release downloads must come from the URL returned by GitHub.
- The app does not send account, memory, machine, or usage data.
- The downloaded filename is sanitized before writing to disk.
- No update is marked ready until the response stream finishes and the file is
  renamed from `.part` to `.dmg`.

## Local Testing

Override the release endpoint with a local JSON file or URL:

```bash
export DACHSHUND_UPDATE_MANIFEST=/tmp/dachshund-update.json
export DACHSHUND_UPDATE_DELAY_MS=50
export DACHSHUND_DOWNLOAD_DIR=/tmp/dachshund-downloads
```

The manifest uses GitHub's release shape:

```json
{
  "tag_name": "v0.1.1",
  "name": "dachshund v0.1.1",
  "body": "Release notes",
  "html_url": "https://github.com/Ewen2015/dachshund/releases/tag/v0.1.1",
  "assets": [
    {
      "name": "dachshund-0.1.1-arm64.dmg",
      "browser_download_url": "https://example.com/dachshund-0.1.1-arm64.dmg"
    }
  ]
}
```

Set `DACHSHUND_UPDATE_DISABLED=1` to suppress update checks in isolated tests.

## Signed Automatic Installation

Silent installation becomes appropriate only after the app has:

1. a stable Developer ID Application identity;
2. Developer ID signing for the app and Sparkle/updater helpers;
3. Apple notarization and stapling;
4. a signed update feed and rollback policy;
5. an update signing key protected outside the repository.

At that point the download-only flow can be replaced with Sparkle or another
signed macOS updater. Until then, the honest behavior is notify, download,
verify transport completion, and let the user install the DMG.
