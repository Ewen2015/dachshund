import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dachshund-integration-'))
const dataDir = path.join(workspace, 'data')
const libraryDir = path.join(workspace, 'library')
const serverPath = path.join(workspace, 'test-server.cjs')
const runtimePath = path.join(dataDir, 'runtime.json')
const env = {
  ...process.env,
  DACHSHUND_HOME: dataDir,
  DACHSHUND_LIBRARY: libraryDir,
  DACHSHUND_DISABLE_IMPORT: '1',
  DACHSHUND_AUTOLAUNCH: '0'
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.stdout ?? ''}${result.stderr ?? ''}`
    )
  }
  return result
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRuntime(server) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) break
    if (fs.existsSync(runtimePath)) return
    await sleep(100)
  }
  throw new Error('dachshund test server did not start')
}

let server
try {
  run(path.join(root, 'node_modules', '.bin', 'esbuild'), [
    'scripts/test-server.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node24',
    `--outfile=${serverPath}`
  ])

  server = spawn(process.execPath, [serverPath], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let serverOutput = ''
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk
  })
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk
  })

  await waitForRuntime(server)
  const runtimeMode = fs.statSync(runtimePath).mode & 0o777
  if (runtimeMode !== 0o600) {
    throw new Error(`runtime.json permissions are ${runtimeMode.toString(8)}, expected 600`)
  }
  const result = run(process.execPath, ['scripts/test-mcp.mjs'], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('MCP smoke test failed')
  console.log(`Integration passed with isolated data: ${workspace}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM')
    await sleep(200)
  }
  if (!process.exitCode) fs.rmSync(workspace, { recursive: true, force: true })
}
