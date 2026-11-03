import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nextSyncDelay } from '../src/main/sync-schedule.ts'

async function main(): Promise<void> {
  assert.equal(nextSyncDelay(null, 60, 1_000), 1_000)
  assert.equal(nextSyncDelay(1_000, 60, 1_000), 3_600_000)
  assert.equal(nextSyncDelay(1_000, 60, 3_601_000), 1_000)

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dachshund-sync-'))
  const fakeHome = path.join(root, 'home')
  const fakeMemory = path.join(
    fakeHome,
    '.claude',
    'projects',
    'fixture-project',
    'memory',
    'preference.md'
  )
  fs.mkdirSync(path.dirname(fakeMemory), { recursive: true })
  fs.writeFileSync(
    fakeMemory,
    '# Package manager preference\n\nAlways use pnpm for package installation in this repository. Never invoke npm.\n'
  )
  process.env.HOME = fakeHome
  process.env.DACHSHUND_HOME = path.join(root, 'data')
  process.env.DACHSHUND_LIBRARY = path.join(root, 'library')

  const { Store } = await import('../src/main/store/index.ts')
  const store = new Store('test')
  store.init()
  assert.equal(store.syncState().autoSync, false)
  assert.equal(store.setAutoSync(true).sync.autoSync, true)

  const now = Date.now()
  const base = {
    kind: 'preference',
    project: null,
    tags: ['test'],
    createdAt: now - 60_000,
    updatedAt: now - 30_000,
    agentId: 'codex',
    agentName: 'Codex',
    sourcePath: '/tmp/fixture/memory.md',
    sourceRef: 'fixture:one'
  }

  const first = store.ingestImport({
    ...base,
    title: 'Use pnpm for this repository',
    content: 'Always use pnpm for package installation in this repository. Do not use npm.'
  })
  assert.equal(first.status, 'added')
  assert.ok(first.change?.memoryId)

  const memoryId = first.change?.memoryId
  assert.ok(memoryId)

  const duplicate = store.ingestImport({
    ...base,
    title: 'Use pnpm for this repository',
    content: 'Always use pnpm for package installation in this repository. Do not use npm.'
  })
  assert.equal(duplicate.status, 'unchanged')

  const changed = store.ingestImport({
    ...base,
    updatedAt: now,
    title: 'Use pnpm and never npm',
    content: 'Always use pnpm for package installation in this repository. Never invoke npm.'
  })
  assert.equal(changed.status, 'updated')
  assert.equal(changed.change?.memoryId, memoryId)

  const echo = store.ingestImport({
    ...base,
    agentId: 'claude-code',
    agentName: 'Claude Code',
    sourcePath: '/tmp/fixture/CLAUDE.md',
    sourceRef: undefined,
    title: 'Use pnpm and never npm',
    content: 'Always use pnpm for package installation in this repository. Never invoke npm.'
  })
  assert.equal(echo.status, 'unchanged')

  const active = store.search({ limit: 10 })
  assert.equal(active.length, 1)
  assert.equal(active[0].sources.length, 2)

  assert.equal(store.archive(memoryId), true)
  const archivedScan = store.ingestImport({
    ...base,
    updatedAt: now,
    title: 'Use pnpm and never npm',
    content: 'Always use pnpm for package installation in this repository. Never invoke npm.'
  })
  assert.equal(archivedScan.status, 'unchanged')
  assert.equal(store.search({ limit: 10 }).length, 0)

  const firstScan = await store.scan('manual')
  assert.equal(firstScan.result.added, 1)
  assert.equal(firstScan.result.updated, 0)
  assert.equal(firstScan.result.failures.length, 0)

  fs.writeFileSync(
    fakeMemory,
    '# Package manager preference\n\nAlways use pnpm for package installation in this repository. Never invoke npm or yarn.\n'
  )
  const secondScan = await store.scan('manual')
  assert.equal(secondScan.result.added, 0)
  assert.equal(secondScan.result.updated, 1)
  assert.equal(store.search({ limit: 10 }).filter((item) => item.title === 'Package manager preference').length, 1)

  const scan = await store.scan('automatic')
  assert.equal(scan.result.ok, true)
  assert.equal(scan.result.reason, 'automatic')
  assert.ok(scan.state.sync.lastSuccessfulSyncAt)
  assert.equal(store.syncState().lastResult?.reason, 'automatic')

  store.db.close()
  fs.rmSync(root, { recursive: true, force: true })
  console.log('Sync source versioning fixtures passed')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
