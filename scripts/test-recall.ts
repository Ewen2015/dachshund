import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import matter from 'gray-matter'

interface ContextResponse {
  context: string
}

interface SearchResponse {
  memories: Array<{
    id: string
    title: string
    summary: string
    kind: string
    agents: string[]
  }>
}

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dachshund-recall-'))
  process.env.HOME = path.join(root, 'home')
  process.env.DACHSHUND_HOME = path.join(root, 'data')
  process.env.DACHSHUND_LIBRARY = path.join(root, 'library')
  fs.mkdirSync(process.env.HOME, { recursive: true })

  const { Store } = await import('../src/main/store/index.ts')
  const { startHttpServer } = await import('../src/main/server.ts')
  const { deriveSummary } = await import('../src/shared/memory-summary.ts')

  assert.equal(
    deriveSummary('# Heading\n\n- Always use pnpm for installs in this repository, never npm.'),
    'Always use pnpm for installs in this repository, never npm.'
  )
  assert.equal(
    deriveSummary('Set DACHSHUND_HOME to ~/.dachshund before running the fixture suite.'),
    'Set DACHSHUND_HOME to ~/.dachshund before running the fixture suite.'
  )

  const store = new Store('test')
  store.init()
  const now = Date.now()
  const base = {
    kind: 'rule',
    scope: 'user' as const,
    authority: 'agent_observed' as const,
    status: 'active' as const,
    project: null,
    tags: ['test'],
    createdAt: now - 60_000,
    updatedAt: now - 30_000,
    agentId: 'codex',
    agentName: 'Codex'
  }

  const rule = store.ingestImport({
    ...base,
    sourcePath: '/tmp/fixture/preference.md',
    sourceRef: 'preference:pnpm',
    title: 'Use pnpm for this repository',
    content:
      'Always use pnpm for package installation in this repository. Never invoke npm, because the lockfile diverges.'
  })
  assert.equal(rule.status, 'added')
  const ruleId = rule.change?.memoryId
  assert.ok(ruleId)
  const ruleMemory = store.getMemory(ruleId)
  assert.ok(ruleMemory)
  assert.ok(ruleMemory.summary.length > 0)
  assert.ok(ruleMemory.summary.includes('pnpm'))

  const echo = store.ingestImport({
    ...base,
    agentId: 'claude',
    agentName: 'Claude',
    sourcePath: '/tmp/fixture/CLAUDE.md',
    sourceRef: undefined,
    title: 'Use pnpm for this repository',
    content:
      'Always use pnpm for package installation in this repository. Never invoke npm, because the lockfile diverges.'
  })
  assert.equal(echo.status, 'unchanged')
  assert.equal(store.getMemory(ruleId)?.echoCount, 2)

  const projectMemory = store.ingestImport({
    ...base,
    scope: 'project',
    project: '/Users/ewen/Documents/GitHub/dachshund',
    sourcePath: '/tmp/fixture/project.md',
    sourceRef: 'project:release',
    title: 'Dachshund release checklist',
    content:
      'Dachshund release checklist: run typecheck, the fixture suites, and the production build before packaging.'
  })
  assert.equal(projectMemory.status, 'added')
  const projectId = projectMemory.change?.memoryId
  assert.ok(projectId)

  const evidence = store.ingestImport({
    ...base,
    kind: 'workspace_log',
    scope: 'session',
    sourcePath: '/tmp/fixture/log.md',
    sourceRef: 'workspace:log',
    title: 'Workspace log for Tuesday',
    content:
      'Workspace log for Tuesday: reviewed the importer fixtures and confirmed the fallback path stayed quiet during the run.'
  })
  assert.equal(evidence.status, 'added')
  const evidenceId = evidence.change?.memoryId
  assert.ok(evidenceId)

  const withEvidence = store.search({ limit: 50 })
  assert.equal(withEvidence.some((memory) => memory.id === evidenceId), true)
  const withoutEvidence = store.search({ limit: 50, includeEvidence: false })
  assert.equal(withoutEvidence.some((memory) => memory.id === evidenceId), false)

  const projectScoped = store.search({
    limit: 50,
    project: '/Users/ewen/Documents/GitHub/dachshund'
  })
  assert.equal(projectScoped.some((memory) => memory.id === projectId), true)
  assert.equal(
    projectScoped.every(
      (memory) =>
        memory.scope === 'user' ||
        (memory.project ?? '').toLowerCase().includes('dachshund')
    ),
    true
  )

  const redacted = store.ingestImport({
    ...base,
    sourcePath: '/tmp/fixture/token.md',
    sourceRef: 'token:deploy',
    title: 'Deploy token note',
    content:
      'The deploy token is ghp_ABCDEFGHIJKLMNOPQRSTUVWX1234 and it must never be shared with other agents.'
  })
  assert.equal(redacted.status, 'added')
  assert.equal(redacted.redacted, true)
  const redactedId = redacted.change?.memoryId
  assert.ok(redactedId)
  const redactedMemory = store.getMemory(redactedId)
  assert.ok(redactedMemory)
  assert.equal(redactedMemory.content.includes('ghp_'), false)
  assert.ok(redactedMemory.content.includes('[redacted:github-token]'))
  assert.ok(redactedMemory.tags.includes('redacted-secret'))

  const longBody =
    'Release builds must run electron-vite build before packaging so the MCP bundle stays current with the app.'
  const supersedeFixtures = [
    { ref: 'thread:knowledge:1', title: 'Release build order', content: longBody },
    {
      ref: 'thread:knowledge:2',
      title: 'Release build order',
      content: `${longBody} Verify the packaged artifact afterward.`
    },
    {
      ref: 'thread:knowledge:3',
      title: 'Release build order',
      content: `${longBody} Verify the packaged artifact afterward and keep the bundle version in sync.`
    }
  ]
  const supersedeIds: string[] = []
  for (const fixture of supersedeFixtures) {
    const outcome = store.ingestImport({
      ...base,
      sourcePath: '/tmp/fixture/raw_memories.md',
      sourceRef: fixture.ref,
      title: fixture.title,
      content: fixture.content
    })
    assert.equal(outcome.status, 'added')
    assert.ok(outcome.change?.memoryId)
    supersedeIds.push(outcome.change.memoryId)
  }

  const dryRun = store.consolidate({ dryRun: true })
  assert.equal(dryRun.dryRun, true)
  assert.ok(dryRun.groups >= 1)
  assert.equal(dryRun.merged, 0)
  assert.equal(store.state().health.lastConsolidationAt, null)

  const consolidation = store.consolidate()
  assert.equal(consolidation.dryRun, false)
  assert.ok(consolidation.merged >= 2)

  const visible = store.search({ limit: 50 })
  const visibleCandidates = visible.filter((memory) => supersedeIds.includes(memory.id))
  assert.equal(visibleCandidates.length, 1)
  const canonicalId = visibleCandidates[0].id
  const includingSuperseded = store.search({ limit: 50, includeSuperseded: true })
  const superseded = includingSuperseded.filter((memory) => memory.supersededBy)
  assert.ok(superseded.length >= 2)
  for (const memory of superseded) {
    assert.equal(memory.supersededBy, canonicalId)
    assert.equal(memory.status, 'superseded')
    const filePath = store.libraryPathFor(memory.id)
    assert.ok(filePath)
    const frontmatter = matter(fs.readFileSync(filePath, 'utf8')).data as Record<string, unknown>
    assert.equal(frontmatter.superseded_by, memory.supersededBy)
  }
  assert.ok(store.state().health.lastConsolidationAt)

  const missingSourceId = redactedId
  const missing = store.markSourceMissingForAgent('codex', Date.now() + 1)
  assert.ok(missing.includes(missingSourceId))
  assert.equal(store.getMemory(missingSourceId)?.sourceMissing, true)
  const missingFile = store.libraryPathFor(missingSourceId)
  assert.ok(missingFile)
  const missingFrontmatter = matter(fs.readFileSync(missingFile, 'utf8')).data as Record<
    string,
    unknown
  >
  assert.equal(missingFrontmatter.source_missing, true)
  const seenAgain = store.ingestImport({
    ...base,
    sourcePath: '/tmp/fixture/token.md',
    sourceRef: 'token:deploy',
    title: 'Deploy token note',
    content:
      'The deploy token is ghp_ABCDEFGHIJKLMNOPQRSTUVWX1234 and it must never be shared with other agents.'
  })
  assert.equal(seenAgain.status, 'unchanged')
  assert.equal(store.getMemory(missingSourceId)?.sourceMissing, false)

  const summaryFile = store.libraryPathFor(ruleId)
  assert.ok(summaryFile)
  const ruleFrontmatter = matter(fs.readFileSync(summaryFile, 'utf8')).data as Record<string, unknown>
  assert.equal(typeof ruleFrontmatter.summary, 'string')
  assert.ok(String(ruleFrontmatter.summary).length > 0)

  const { runtime, close } = await startHttpServer(store, 'test')
  const call = async (
    route: string,
    payload?: Record<string, unknown>
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const response = await fetch(`http://127.0.0.1:${runtime.port}${route}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${runtime.token}`,
        'content-type': 'application/json'
      },
      body: payload ? JSON.stringify(payload) : undefined
    })
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>
    }
  }

  try {
    const search = await call('/api/mcp/search', { query: 'pnpm', limit: 10 })
    assert.equal(search.status, 200)
    const searchBody = search.body as unknown as SearchResponse
    assert.ok(searchBody.memories.length >= 1)
    assert.ok(searchBody.memories[0].summary.length > 0)
    assert.ok(searchBody.memories[0].agents.includes('Claude'))

    const indexContext = await call('/api/mcp/context', {
      query: '',
      limit: 10,
      detail: 'index'
    })
    assert.equal(indexContext.status, 200)
    const indexText = (indexContext.body as unknown as ContextResponse).context
    assert.ok(indexText.startsWith('# dachshund memory index'))
    assert.ok(indexText.includes('## Apply'))
    assert.ok(indexText.includes('id: '))
    assert.ok(indexText.includes('sources: '))
    assert.ok(indexText.includes('_('))

    const fullContext = await call('/api/mcp/context', {
      query: '',
      limit: 10,
      detail: 'full'
    })
    const fullText = (fullContext.body as unknown as ContextResponse).context
    assert.ok(fullText.length > indexText.length)

    const stats = await call('/api/mcp/stats')
    assert.equal(stats.status, 200)
    assert.ok(stats.body.health && typeof stats.body.health === 'object')
    const health = stats.body.health as Record<string, unknown>
    assert.equal(typeof health.superseded, 'number')
    assert.equal(typeof health.lastConsolidationAt, 'number')

    const secret = await call('/api/mcp/remember', {
      content:
        'Here is a token sk-abcdefghijklmnopqrstuvwx1234567890 that should never be stored.',
      title: 'Secret probe',
      agentId: 'codex'
    })
    assert.equal(secret.status, 400)
    assert.deepEqual(secret.body.kinds, ['openai-key'])

    const remembered = await call('/api/mcp/remember', {
      content:
        'Hermes prefers narrow, reversible migrations with a checked rollback path for this repository.',
      title: 'Migration preference',
      summary: 'Hermes wants narrow, reversible migrations with a rollback path.',
      kind: 'preference',
      agentId: 'hermes'
    })
    assert.equal(remembered.status, 200)
    const rememberedId = String(remembered.body.id)
    assert.equal(
      store.getMemory(rememberedId)?.summary,
      'Hermes wants narrow, reversible migrations with a rollback path.'
    )
  } finally {
    close()
  }

  store.db.close()
  fs.rmSync(root, { recursive: true, force: true })
  console.log('Recall, consolidation, and redaction fixtures passed')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
