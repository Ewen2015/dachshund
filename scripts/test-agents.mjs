import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dachshund-agent-test-'))
const bundle = path.join(workspace, 'test-agents.cjs')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result
}

try {
  run(path.join(root, 'node_modules', '.bin', 'esbuild'), [
    'scripts/test-agents.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node24',
    `--outfile=${bundle}`
  ])
  run(process.execPath, [bundle])
} finally {
  fs.rmSync(workspace, { recursive: true, force: true })
}
