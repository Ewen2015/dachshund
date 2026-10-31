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
5. the completed file is checked against the release digest when GitHub
   provides one;
6. dachshund arms a detached installer and quits;
7. the installer mounts the DMG, verifies the app signature, bundle identifier
   and version, stages the new bundle, and replaces the installed app;
8. the new version opens automatically.

The download is streamed to:

```text
~/Downloads/dachshund-<version>-arm64.dmg
```

The user does not mount the DMG or drag the app into Applications during a
normal update. That first-install step remains necessary for a new installation
or manual recovery.

If automatic replacement fails, dachshund restores the previous bundle, opens
the downloaded DMG for manual recovery, and writes diagnostics to:

```text
~/Library/Logs/dachshund/update-install.log
```

Automatic replacement begins with `0.1.3`. A copy of `0.1.2` predates the
installer helper, so that version must install `0.1.3` once from the DMG.

## Release Contract

Every release must follow this contract:

- tag: `v0.1.x`;
- `package.json` version: matching `0.1.x`;
- asset: `dachshund-0.1.x-arm64.dmg`;
- checksum asset: `SHA256SUMS`;
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
| `src/main/updater.ts` | GitHub lookup, version comparison, download stream and digest verification |
| `src/main/installer.ts` | Detached mount, signature checks, atomic replacement, rollback and relaunch |
| `src/main/index.ts` | Startup checks, tray menu, install orchestration, dialogs and IPC |
| `src/preload/index.ts` | Typed update bridge |
| `src/renderer/src/lib/useUpdater.ts` | Renderer state and dismissal |
| `src/renderer/src/components/UpdateNotice.tsx` | Full app and compact panel notice |

Rendered update state is pushed to both windows through `update:changed`. The
renderer never calls GitHub directly.

## Security And Privacy

- The only update network request is the public GitHub Releases endpoint.
- Release downloads must come from the URL returned by GitHub.
- The downloaded filename is sanitized before writing to disk.
- No update is marked ready until the response stream finishes and the file is
  renamed from `.part` to `.dmg`.
- If GitHub exposes an asset digest, the streamed SHA-256 must match it.
- The installer verifies the downloaded app's code signature, bundle identifier
  (`com.ewen.dachshund`) and version before touching the installed app.
- The replacement uses a staged copy and a backup. The previous bundle is
  restored if the move fails.
- The app does not send account, memory, machine, or usage data.

The current build is ad-hoc signed and not notarized. Signature verification
proves the bundle is internally intact and came from the checked DMG; it does
not establish a verified publisher identity. A future distribution milestone
should add Developer ID signing, notarization and a hardened update trust model.

## Local Testing

Override the release endpoint with a local JSON file or URL:

```bash
export DACHSHUND_UPDATE_MANIFEST=/tmp/dachshund-update.json
export DACHSHUND_UPDATE_DELAY_MS=50
export DACHSHUND_DOWNLOAD_DIR=/tmp/dachshund-downloads
export DACHSHUND_UPDATE_INSTALL_OPEN=0
```

`DACHSHUND_UPDATE_INSTALL_OPEN=0` runs replacement without relaunching the app.
Omit it when testing the complete restart flow.

The manifest uses GitHub's release shape:

```json
{
  "tag_name": "v0.1.9",
  "name": "dachshund v0.1.9",
  "body": "Release notes",
  "html_url": "https://github.com/Ewen2015/dachshund/releases/tag/v0.1.9",
  "assets": [
    {
      "name": "dachshund-0.1.9-arm64.dmg",
      "browser_download_url": "http://127.0.0.1:8000/dachshund-0.1.9-arm64.dmg",
      "digest": "sha256:<sha256-hex>"
    }
  ]
}
```

Set `DACHSHUND_UPDATE_DISABLED=1` to suppress update checks in isolated tests.

## End-To-End Verification

The in-place update path is exercised by:

1. building a packaged `0.1.2` app from source containing the new installer;
2. packaging a signed `0.1.3` app in a DMG;
3. serving a local release manifest and DMG;
4. clicking **Download** in the packaged `0.1.2` interface;
5. waiting for the interface to reach the installing state;
6. confirming the target bundle becomes `0.1.3`;
7. running `codesign --verify --deep --strict`;
8. confirming `update-install.log` reports `installed 0.1.3`;
9. confirming the updated app reopened.
