import { app } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface InstallLaunchResult {
  ok: boolean
  message: string
}

export function currentAppBundlePath(): string {
  return path.resolve(process.execPath, '../../..')
}

export async function launchUpdateInstaller(input: {
  dmgPath: string
  version: string
  digest: string | null
  targetAppPath: string
}): Promise<InstallLaunchResult> {
  if (process.platform !== 'darwin') {
    return { ok: false, message: 'Automatic installation is only available on macOS' }
  }
  if (!input.targetAppPath.endsWith('.app')) {
    return { ok: false, message: 'The running app is not inside a macOS app bundle' }
  }

  try {
    await fs.promises.access(input.dmgPath, fs.constants.R_OK)
    await fs.promises.access(path.dirname(input.targetAppPath), fs.constants.W_OK)
  } catch {
    return {
      ok: false,
      message: 'dachshund cannot replace the current app in its install location'
    }
  }

  const workspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dachshund-installer-'))
  const scriptPath = path.join(workspace, 'install.sh')
  const logDir = app.getPath('logs')
  const logPath = path.join(logDir, 'update-install.log')
  await fs.promises.mkdir(logDir, { recursive: true })

  const shouldRelaunch = process.env.DACHSHUND_UPDATE_INSTALL_OPEN !== '0'
  const script = `#!/bin/sh
set -u

parent_pid=$1
dmg=$2
target=$3
expected_version=$4
expected_digest=$5
log=$6
relaunch=$7
staging="\${target}.update-staging-\$\$"
backup="\${target}.update-backup-\$\$"
mountpoint=$(/usr/bin/mktemp -d "\${TMPDIR:-/tmp}/dachshund-update-mount.XXXXXX")
attached=0

exec >>"$log" 2>&1
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] installer started for $expected_version"

cleanup() {
  if [ "$attached" = "1" ]; then
    /usr/bin/hdiutil detach "$mountpoint" -force >/dev/null 2>&1 || true
  fi
  /bin/rmdir "$mountpoint" >/dev/null 2>&1 || true
}
fallback() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1"
  /usr/bin/open "$dmg" >/dev/null 2>&1 || true
  exit 1
}
trap cleanup EXIT HUP INT TERM

for _ in $(/usr/bin/seq 1 100); do
  if ! /bin/kill -0 "$parent_pid" >/dev/null 2>&1; then
    break
  fi
  /bin/sleep 0.2
done
if /bin/kill -0 "$parent_pid" >/dev/null 2>&1; then
  fallback "dachshund did not exit before installation"
fi

if [ -n "$expected_digest" ]; then
  actual_digest=$(/usr/bin/shasum -a 256 "$dmg" | /usr/bin/awk '{print "sha256:"$1}')
  if [ "$actual_digest" != "$expected_digest" ]; then
    fallback "the downloaded disk image did not match the release digest"
  fi
fi

if ! /usr/bin/hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mountpoint" >/dev/null; then
  fallback "could not mount the downloaded disk image"
fi
attached=1

source_app="$mountpoint/dachshund.app"
if [ ! -d "$source_app" ]; then
  fallback "dachshund.app was not found in the disk image"
fi
if ! /usr/bin/codesign --verify --deep --strict "$source_app"; then
  fallback "the downloaded app did not pass code-signature verification"
fi

bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$source_app/Contents/Info.plist" 2>/dev/null)
source_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$source_app/Contents/Info.plist" 2>/dev/null)
if [ "$bundle_id" != "com.ewen.dachshund" ] || [ "$source_version" != "$expected_version" ]; then
  fallback "the downloaded app identity or version did not match"
fi

if ! /usr/bin/ditto "$source_app" "$staging"; then
  fallback "the downloaded app could not be staged"
fi
if ! /usr/bin/codesign --verify --deep --strict "$staging"; then
  /bin/rm -rf "$staging"
  fallback "the staged app did not pass code-signature verification"
fi

if ! /bin/mv "$target" "$backup"; then
  /bin/rm -rf "$staging"
  fallback "the current app could not be moved aside"
fi
if ! /bin/mv "$staging" "$target"; then
  /bin/mv "$backup" "$target"
  fallback "the new app could not replace the current app"
fi

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] installed $expected_version"
if [ "$relaunch" = "1" ]; then
  if ! /usr/bin/open "$target"; then
    "$target/Contents/MacOS/dachshund" >/dev/null 2>&1 &
  fi
fi
/bin/sleep 3
/bin/rm -rf "$backup"
exit 0
`

  await fs.promises.writeFile(scriptPath, script, { mode: 0o700 })
  const child = spawn(
    '/bin/sh',
    [
      scriptPath,
      String(process.pid),
      input.dmgPath,
      input.targetAppPath,
      input.version,
      input.digest ?? '',
      logPath,
      shouldRelaunch ? '1' : '0'
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env }
    }
  )
  child.unref()
  return { ok: true, message: 'The update installer is ready' }
}

export function installerLogPath(): string {
  return path.join(app.getPath('logs'), 'update-install.log')
}
