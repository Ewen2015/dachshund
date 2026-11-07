import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import matter from 'gray-matter'
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
    scope: 'user' as const,
    authority: 'agent_observed' as const,
    status: 'active' as const,
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
  const initialMemory = store.getMemory(memoryId)
  assert.equal(initialMemory?.scope, 'user')
  assert.equal(initialMemory?.authority, 'agent_observed')
  assert.equal(initialMemory?.status, 'active')

  const duplicate = store.ingestImport({
    ...base,
    title: 'Use pnpm for this repository',
    content: 'Always use pnpm for package installation in this repository. Do not use npm.'
  })
  assert.equal(duplicate.status, 'unchanged')

  const reclassified = store.ingestImport({
    ...base,
    kind: 'workspace_log',
    scope: 'session',
    authority: 'inferred',
    project: 'dachshund',
    tags: ['test', 'daily-log'],
    title: 'Use pnpm for this repository',
    content: 'Always use pnpm for package installation in this repository. Do not use npm.'
  })
  assert.equal(reclassified.status, 'updated')
  const reclassifiedMemory = store.getMemory(memoryId)
  assert.equal(reclassifiedMemory?.kind, 'workspace_log')
  assert.equal(reclassifiedMemory?.scope, 'session')
  assert.equal(reclassifiedMemory?.authority, 'inferred')
  assert.equal(reclassifiedMemory?.status, 'active')
  assert.equal(reclassifiedMemory?.project, 'dachshund')
  assert.equal(reclassifiedMemory?.updatedAt, base.updatedAt)
  assert.equal(reclassifiedMemory?.sources.length, 1)

  const reclassifiedAgain = store.ingestImport({
    ...base,
    kind: 'workspace_log',
    scope: 'session',
    authority: 'inferred',
    project: 'dachshund',
    tags: ['test', 'daily-log'],
    title: 'Use pnpm for this repository',
    content: 'Always use pnpm for package installation in this repository. Do not use npm.'
  })
  assert.equal(reclassifiedAgain.status, 'unchanged')

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
    agentId: 'claude',
    agentName: 'Claude',
    sourcePath: '/tmp/fixture/CLAUDE.md',
    sourceRef: undefined,
    title: 'Use pnpm and never npm',
    content: 'Always use pnpm for package installation in this repository. Never invoke npm.'
  })
  assert.equal(echo.status, 'unchanged')

  const echoVariant = {
    ...base,
    agentId: 'opencode',
    agentName: 'OpenCode',
    sourcePath: '/tmp/fixture/AGENTS.md',
    sourceRef: 'opencode:instructions',
    title: 'An echo must not rename the memory',
    kind: 'fact' as const,
    tags: ['test', 'echo'],
    content: 'Always use pnpm for package installation in this repository. Never invoke npm.'
  }
  assert.equal(store.ingestImport(echoVariant).status, 'unchanged')
  assert.equal(store.getMemory(memoryId)?.title, 'Use pnpm and never npm')
  assert.equal(store.ingestImport(echoVariant).status, 'unchanged')
  assert.equal(store.getMemory(memoryId)?.title, 'Use pnpm and never npm')

  const paddedTitle = store.ingestImport({
    ...base,
    updatedAt: now,
    title: 'Use pnpm and never npm   ',
    content: 'Always use pnpm for package installation in this repository. Never invoke npm.'
  })
  assert.equal(paddedTitle.status, 'unchanged')

  const active = store.search({ limit: 10 })
  assert.equal(active.length, 1)
  assert.equal(active[0].sources.length, 3)

  const agentWrite = store.rememberShared({
    title: 'MCP attribution probe',
    content:
      'MCP attribution probe: durable project context should keep the agent that wrote it.',
    kind: 'fact',
    sourceAgentId: 'codex',
    sourceAgentName: 'Codex'
  })
  const agentEcho = store.rememberShared({
    title: 'MCP attribution probe from Hermes',
    content:
      'MCP attribution probe: durable project context should keep the agent that wrote it.',
    kind: 'fact',
    sourceAgentId: 'hermes',
    sourceAgentName: 'Hermes'
  })
  assert.equal(agentEcho.id, agentWrite.id)
  assert.equal(agentEcho.echoCount, 2)
  assert.deepEqual(
    agentEcho.sources.map((source) => source.agentId).sort(),
    ['codex', 'hermes']
  )

  const promoted = store.promoteMemory(agentWrite.id)
  assert.equal(promoted?.echoCount, 3)
  assert.ok(promoted?.sources.some((source) => source.agentId === 'dachshund'))
  assert.equal(store.archive(agentWrite.id), true)
  assert.equal(store.getMemory(agentWrite.id)?.status, 'archived')

  assert.equal(store.archive(memoryId), true)
  assert.equal(store.getMemory(memoryId)?.status, 'archived')
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

  const olderTrae = store.ingestImport({
    ...base,
    agentId: 'trae',
    agentName: 'TRAE',
    sourcePath: '/tmp/fixture/trae-memory.md',
    sourceRef: 'trae:older',
    title: 'Older TRAE memory',
    content: 'TRAE keeps this older memory even when newer cursor sources fill the global limit.',
    updatedAt: now - 120_000
  })
  assert.equal(olderTrae.status, 'added')

  for (let index = 0; index < 130; index += 1) {
    store.ingestImport({
      ...base,
      agentId: 'cursor',
      agentName: 'Cursor',
      sourcePath: `/tmp/fixture/cursor-${index}.md`,
      sourceRef: `cursor:${index}`,
      title: `Cursor memory ${index}`,
      content: `Cursor memory ${index} is newer than the TRAE record and should not hide it from an agent-scoped search.`,
      updatedAt: now + index * 1_000
    })
  }

  const traeOnly = store.search({ query: '', agentId: 'trae', limit: 120 })
  assert.equal(traeOnly.length, 1)
  assert.equal(traeOnly[0].id, olderTrae.change?.memoryId)

  const state = store.state()
  assert.equal(state.memories.length, 90)
  assert.equal(state.pulseMemories.length, state.counts.memories)
  assert.equal(state.pulseMemories.length, 132)
  const pulseTrae = state.pulseMemories.find((memory) => memory.id === olderTrae.change?.memoryId)
  assert.equal(pulseTrae?.sources[0]?.agentId, 'trae')
  const installedAgents = state.agents.filter((agent) => agent.installed)
  for (let index = 1; index < installedAgents.length; index += 1) {
    assert.ok(
      installedAgents[index - 1].memoryCount >= installedAgents[index].memoryCount,
      'installed agents must be ordered by memory count'
    )
  }

  const { Library } = await import('../src/main/store/library.ts')
  const legacyFile = path.join(
    process.env.DACHSHUND_LIBRARY!,
    'memory',
    'legacy-feedback.md'
  )
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true })
  fs.writeFileSync(
    legacyFile,
    [
      '---',
      'id: mem_legacy_feedback',
      'title: Legacy feedback',
      'kind: feedback',
      'scope: workspace',
      'authority: project_declared',
      'status: active',
      'project: dachshund',
      'tags: [legacy]',
      '---',
      '',
      'Always verify the packaged artifact before reporting a release as complete.'
    ].join('\n')
  )
  const legacy = new Library().readFile(legacyFile)
  assert.equal(legacy?.kind, 'rule')
  assert.equal(legacy?.scope, 'workspace')
  assert.equal(legacy?.authority, 'project_declared')
  assert.equal(legacy?.status, 'active')

  const unknownFile = path.join(process.env.DACHSHUND_LIBRARY!, 'memory', 'legacy-unknown.md')
  fs.writeFileSync(
    unknownFile,
    [
      '---',
      'id: mem_legacy_unknown',
      'title: Legacy unknown',
      'kind: mystery-type',
      '---',
      '',
      'This source does not provide a defensible knowledge type.'
    ].join('\n')
  )
  const unknownLibrary = new Library()
  assert.equal(unknownLibrary.readFile(unknownFile)?.kind, 'fact')
  assert.equal(unknownLibrary.readFile(unknownFile)?.status, 'active')
  unknownLibrary.syncToDb(store.db)
  const normalizedUnknown = matter(fs.readFileSync(unknownFile, 'utf8')).data as Record<
    string,
    unknown
  >
  assert.equal(normalizedUnknown.kind, 'fact')
  assert.equal(normalizedUnknown.status, 'active')

  const legacyReviewFile = path.join(
    process.env.DACHSHUND_LIBRARY!,
    'memory',
    'legacy-unclassified.md'
  )
  fs.writeFileSync(
    legacyReviewFile,
    [
      '---',
      'id: mem_legacy_unclassified',
      'title: Legacy unclassified',
      'kind: unclassified',
      'status: unclassified',
      '---',
      '',
      'The local release archive lives at /Users/example/releases/dachshund.'
    ].join('\n')
  )
  unknownLibrary.syncToDb(store.db)
  const normalizedReview = matter(fs.readFileSync(legacyReviewFile, 'utf8')).data as Record<
    string,
    unknown
  >
  assert.equal(normalizedReview.kind, 'reference')
  assert.equal(normalizedReview.status, 'active')

  const codexKnowledgeFile = path.join(
    process.env.DACHSHUND_LIBRARY!,
    'memory',
    'codex-knowledge.md'
  )
  fs.writeFileSync(
    codexKnowledgeFile,
    [
      '---',
      'id: mem_codex_knowledge',
      'title: Reusable rollout knowledge',
      'kind: insight',
      'tags: [codex, rollout, reusable-knowledge]',
      'sources:',
      '  - agent: codex',
      '    path: /tmp/raw_memories.md',
      '    ref: "thread:knowledge:1"',
      '---',
      '',
      'Reusable knowledge extracted from a Codex rollout thread.'
    ].join('\n')
  )
  assert.equal(new Library().readFile(codexKnowledgeFile)?.kind, 'insight')

  const codexThreadFile = path.join(process.env.DACHSHUND_LIBRARY!, 'memory', 'codex-thread.md')
  fs.writeFileSync(
    codexThreadFile,
    [
      '---',
      'id: mem_codex_thread',
      'title: Legacy Codex rollout',
      'kind: insight',
      'tags: [codex, rollout]',
      'sources:',
      '  - agent: codex',
      '    path: /tmp/raw_memories.md',
      '    ref: thread-1',
      '---',
      '',
      'A whole-thread rollout record that predates the task_rollout kind.'
    ].join('\n')
  )
  assert.equal(new Library().readFile(codexThreadFile)?.kind, 'task_rollout')

  // An existing database from before the lifecycle columns must upgrade in
  // place. The 0.1.27 build created an index on superseded_by before adding
  // the column, which crashed startup for every upgraded install.
  const legacyDbFile = path.join(root, 'legacy-data', 'dachshund.db')
  fs.mkdirSync(path.dirname(legacyDbFile), { recursive: true })
  const legacyDb = new DatabaseSync(legacyDbFile)
  legacyDb.exec(`
    CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'fact',
      project TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      hash TEXT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'shared',
      file_path TEXT
    );
    INSERT INTO memories(id, title, content, kind, created_at, updated_at, hash)
    VALUES('mem_legacy_upgrade', 'Legacy record', 'Body', 'fact', 1, 2, 'h');
  `)
  legacyDb.close()
  const { Db } = await import('../src/main/store/db.ts')
  new Db(legacyDbFile)
  const upgradedDb = new DatabaseSync(legacyDbFile)
  const migratedRow = upgradedDb
    .prepare(
      'SELECT title, summary, scope, authority, status, superseded_by, source_missing FROM memories WHERE id = ?'
    )
    .get('mem_legacy_upgrade') as Record<string, unknown>
  assert.equal(migratedRow.title, 'Legacy record')
  assert.equal(migratedRow.summary, '')
  assert.equal(migratedRow.scope, 'user')
  assert.equal(migratedRow.authority, 'agent_observed')
  assert.equal(migratedRow.status, 'active')
  assert.equal(migratedRow.superseded_by, null)
  assert.equal(migratedRow.source_missing, 0)
  const supersededIndex = upgradedDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_memories_superseded'"
    )
    .get() as Record<string, unknown> | undefined
  assert.ok(supersededIndex)
  upgradedDb.close()

  store.db.close()
  fs.rmSync(root, { recursive: true, force: true })
  console.log('Sync source versioning fixtures passed')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
