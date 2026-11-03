import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

if (process.platform !== 'darwin') process.exit(0)

const root = process.cwd()
const outputDir = path.join(root, 'resources', 'bin')
const appPath = path.join(outputDir, 'DachshundStatus.app')
const contentsPath = path.join(appPath, 'Contents')
const macOSPath = path.join(contentsPath, 'MacOS')
const output = path.join(macOSPath, 'dachshund-status')
fs.mkdirSync(macOSPath, { recursive: true })

execFileSync(
  'swiftc',
  [
    '-O',
    '-whole-module-optimization',
    path.join(root, 'native', 'status-item.swift'),
    '-o',
    output,
    '-framework',
    'AppKit'
  ],
  { stdio: 'inherit' }
)
fs.chmodSync(output, 0o755)

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>dachshund-status</string>
  <key>CFBundleIdentifier</key>
  <string>com.ewen.dachshund.status-item</string>
  <key>CFBundleName</key>
  <string>dachshund</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version}</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`

fs.writeFileSync(path.join(contentsPath, 'Info.plist'), infoPlist)
fs.writeFileSync(path.join(contentsPath, 'PkgInfo'), 'APPL????')
execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
  stdio: 'inherit'
})
console.log(`Built ${path.relative(root, appPath)}`)
