import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { zstdCompressSync } from 'node:zlib'
import { parse as parseYaml } from 'yaml'
import { importAgentMemories } from '../src/main/agents/importers'
import { DEEPSEEK_MANAGED_BLOCK } from '../src/main/agents/deepseek-instructions'
import {
  upsertDeepSeekCordis,
  upsertCodexToml,
  upsertHermesYaml,
  upsertJsonMcp
} from '../src/main/agents/mcp-install'
import {
  mergeSharedMemoryInstructions,
  stripSharedMemoryInstructions
} from '../src/main/agents/shared-memory-instructions'
import {
  resolveTraeInstallation,
  type AgentDefinition
} from '../src/main/agents/registry'
import {
  AGENT_MEMORY_MODELS,
  ALL_MEMORY_CATEGORIES,
  MEMORY_CATEGORIES,
  categoryForKind,
  normalizeMemoryKind
} from '../src/shared/memory-taxonomy'
import {
  appendMcpClientReceipt,
  latestMcpClientReceipt,
  mcpClientReceiptPath,
  readMcpClientReceipts
} from '../src/shared/mcp-client-receipts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dachshund-agents-'))

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function definition(
  id: string,
  name: string,
  home: string,
  mcpPath: string
): AgentDefinition {
  return {
    id,
    name,
    kind: 'cli',
    home,
    description: `${name} fixture`,
    accent: '#222222',
    mcp: [{ type: 'json-mcpServers', path: mcpPath }]
  }
}

function testHermes(): void {
  const home = path.join(root, 'hermes')
  const agent = definition('hermes', 'Hermes', home, path.join(home, 'config.yaml'))
  write(
    path.join(home, 'memories', 'MEMORY.md'),
    [
      '# 个人记忆',
      '',
      '## 用户',
      '- 时区: Asia/Shanghai',
      '',
      '## 项目',
      '- Local library: /Users/example/Documents/dachshund',
      '',
      '## 环境与集成',
      '- Release verification uses /Users/example/scripts/verify-local.sh'
    ].join('\n')
  )
  write(
    path.join(home, 'memories', 'USER.md'),
    '*Learn about the person you\'re helping. Update this as you go.*\n§\n**Preferred language:** concise Chinese'
  )
  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 4)
  assert.ok(memories.some((memory) => memory.title === '个人记忆 · 用户'))
  assert.ok(memories.some((memory) => memory.title === '个人记忆 · 项目'))
  assert.ok(memories.filter((memory) => memory.kind === 'profile').length >= 2)
  assert.ok(memories.filter((memory) => memory.kind === 'reference').length >= 2)
  assert.ok(memories.every((memory) => categoryForKind(memory.kind) !== 'evidence'))
  assert.ok(!memories.some((memory) => memory.content.includes('Learn about the person')))
}

function testPi(): void {
  const home = path.join(root, 'pi')
  const agent = definition('pi', 'Pi', home, path.join(home, 'mcp.json'))
  const session = path.join(home, 'sessions', '--tmp-alpha--', 'session.jsonl')
  const lines = [
    {
      type: 'session',
      version: 3,
      id: 'pi-session',
      timestamp: '2026-10-31T00:00:00.000Z',
      cwd: '/tmp/alpha'
    },
    {
      type: 'session_info',
      id: 'info',
      timestamp: '2026-10-31T00:00:01.000Z',
      name: 'Alpha work'
    },
    {
      type: 'message',
      id: 'user-1',
      timestamp: '2026-10-31T00:00:02.000Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Remember that I always prefer concise Chinese answers with concrete file paths.'
          }
        ],
        timestamp: 1793404802000
      }
    },
    {
      type: 'message',
      id: 'user-2',
      timestamp: '2026-10-31T00:00:03.000Z',
      message: { role: 'user', content: [{ type: 'text', text: 'update' }] }
    },
    {
      type: 'message',
      id: 'user-3',
      timestamp: '2026-10-31T00:00:03.500Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Do not mock the database in integration tests; use the real local fixture.'
          }
        ]
      }
    },
    {
      type: 'message',
      id: 'system-1',
      timestamp: '2026-10-31T00:00:04.000Z',
      message: {
        role: 'system',
        content: 'Remember that this system prompt must never become a memory.'
      }
    },
    {
      type: 'compaction',
      id: 'compact-1',
      timestamp: '2026-10-31T00:00:05.000Z',
      summary:
        'The alpha project uses a small command-line runner and keeps release notes in docs.'
    },
    {
      type: 'branch_summary',
      id: 'branch-1',
      timestamp: '2026-10-31T00:00:06.000Z',
      summary:
        'A discarded branch tried a database-backed cache; the filesystem cache remained simpler.'
    }
  ]
  write(session, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`)
  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 4)
  assert.ok(memories.some((memory) => memory.tags.includes('compaction')))
  assert.ok(memories.some((memory) => memory.kind === 'compaction'))
  assert.ok(memories.some((memory) => memory.kind === 'session_summary'))
  assert.ok(memories.some((memory) => memory.kind === 'preference'))
  assert.ok(memories.some((memory) => memory.kind === 'rule'))
  assert.ok(!memories.some((memory) => memory.content.includes('system prompt')))
}

function testClaudeTaxonomy(): void {
  const home = path.join(root, 'claude')
  const agent = definition('claude', 'Claude', home, path.join(home, 'mcp.json'))
  const memoryFile = path.join(
    home,
    'projects',
    '-tmp-claude-project',
    'memory',
    'preference.md'
  )
  write(
    memoryFile,
    [
      '---',
      'type: user',
      'title: Concise delivery',
      '---',
      '',
      'Prefer concise Chinese answers with concrete file paths and verification evidence.'
    ].join('\n')
  )
  write(
    path.join(home, 'CLAUDE.md'),
    [
      '# Global rules',
      '',
      'Always verify generated files and report the exact path used for validation.'
    ].join('\n')
  )
  write(
    path.join(home, 'rules', 'release.md'),
    'Release notes must stay in the local documentation directory and mirror the shipped version.'
  )
  write(path.join(home, 'memory', 'MEMORY.md'), '# Memory Index\n')
  write(
    path.join(home, 'memory', 'environment.md'),
    'The local build uses Node 22.'
  )
  write(
    path.join(
      home,
      'projects',
      '-tmp-claude-project',
      'memory',
      'MEMORY.md'
    ),
    '# Memory Index\n\n- [Concise delivery](preference.md)'
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 5)
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'profile' &&
        categoryForKind(memory.kind) === 'identity' &&
        memory.tags.includes('claude-code')
    )
  )
  assert.equal(
    memories.filter(
      (memory) => memory.kind === 'rule' && categoryForKind(memory.kind) === 'guidance'
    ).length,
    2
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'reference' &&
        memory.title === 'Memory index · claude/project' &&
        memory.scope === 'project' &&
        memory.tags.includes('memory-index') &&
        memory.tags.includes('project-index') &&
        memory.content.includes('[Concise delivery](preference.md)')
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'fact' &&
        memory.tags.includes('global-memory') &&
        memory.content.includes('Node 22')
    )
  )
  assert.ok(!memories.some((memory) => memory.tags.includes('global-index')))
}

function testClaudeDesktopTaxonomy(): void {
  const home = path.join(root, 'claude-desktop')
  const legacyHome = path.join(root, 'claude-desktop-legacy')
  const agent: AgentDefinition = {
    ...definition(
      'claude',
      'Claude',
      home,
      path.join(home, 'claude_desktop_config.json')
    ),
    homes: [legacyHome]
  }
  const organization = path.join(
    home,
    'local-agent-mode-sessions',
    'account',
    'org'
  )
  const spaceId = 'ef7098ea-92cb-4490-b119-484d8a338116'
  const memoryDir = path.join(organization, 'spaces', spaceId, 'memory')
  write(
    path.join(organization, 'spaces.json'),
    JSON.stringify({
      spaces: [{ id: spaceId, name: 'Memory research' }]
    })
  )
  write(
    path.join(memoryDir, 'MEMORY.md'),
    '# Memory index\n\n- [Delivery](feedback_delivery.md) — verified local evidence'
  )
  write(
    path.join(memoryDir, 'feedback_delivery.md'),
    [
      '---',
      'name: delivery',
      'description: Verified local evidence before release',
      'type: feedback',
      '---',
      '',
      'Always report exact local verification evidence before claiming a release is complete.'
    ].join('\n')
  )
  write(
    path.join(memoryDir, 'project_context.md'),
    [
      '---',
      'name: project-context',
      'description: Local memory migration',
      'type: project',
      '---',
      '',
      'The local memory migration is limited to version 0.1.x.'
    ].join('\n')
  )
  write(
    path.join(
      organization,
      'memory',
      'memory',
      'reference_dashboard.md'
    ),
    [
      '---',
      'name: dashboard',
      'description: Release dashboard',
      'type: reference',
      '---',
      '',
      'The release dashboard is the source of truth for shipped artifacts.'
    ].join('\n')
  )
  write(
    path.join(organization, 'memory', 'memory', 'MEMORY.md'),
    '# Memory Index\n\n- [Release dashboard](reference_dashboard.md) — shipped artifacts'
  )
  write(
    path.join(organization, 'agent', 'memory', 'MEMORY.md'),
    '# Memory Index\n\n- [User role](user_role.md) — product direction'
  )
  write(
    path.join(organization, 'agent', 'memory', 'user_role.md'),
    [
      '---',
      'name: user-role',
      'description: Product context',
      'type: user',
      '---',
      '',
      'The user is responsible for product direction and release quality.'
    ].join('\n')
  )
  const legacyOrganization = path.join(
    legacyHome,
    'local-agent-mode-sessions',
    'legacy-account',
    'legacy-org'
  )
  write(
    path.join(legacyOrganization, 'memory', 'memory', 'reference_legacy.md'),
    [
      '---',
      'name: legacy-reference',
      'description: Legacy profile memory',
      'type: reference',
      '---',
      '',
      'The legacy Claude profile keeps its own local memory files.'
    ].join('\n')
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 8)
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'rule' &&
        memory.project === 'Memory research' &&
        memory.sourceRef === `space:${spaceId}`
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'constraint' && memory.project === 'Memory research'
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'reference' &&
        memory.tags.includes('claude-desktop') &&
        memory.tags.includes('local-memory')
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'profile' &&
        memory.sourcePath.includes(`${path.sep}agent${path.sep}memory${path.sep}`)
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'reference' &&
        memory.sourcePath.startsWith(legacyHome)
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'reference' &&
        memory.title === 'Memory index · Memory research' &&
        memory.project === 'Memory research' &&
        memory.sourceRef === `space:${spaceId}` &&
        memory.tags.includes('memory-index') &&
        memory.tags.includes('space-index')
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'reference' &&
        memory.title === 'Account memory index' &&
        memory.scope === 'user' &&
        memory.tags.includes('memory-index') &&
        memory.tags.includes('account-index') &&
        memory.sourcePath.endsWith(
          `${path.sep}memory${path.sep}memory${path.sep}MEMORY.md`
        )
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'reference' &&
        memory.title === 'Agent memory index' &&
        memory.tags.includes('memory-index') &&
        memory.tags.includes('agent-index') &&
        memory.tags.includes('agent-memory')
    )
  )
}

function testCodexRolloutTaxonomy(): void {
  const home = path.join(root, 'codex')
  const agent = definition('codex', 'Codex', home, path.join(home, 'config.toml'))
  const dbPath = path.join(home, 'sqlite', 'memories_1.sqlite')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE stage1_outputs (
      thread_id TEXT,
      raw_memory TEXT,
      rollout_summary TEXT,
      rollout_slug TEXT,
      generated_at INTEGER
    );
  `)
  db.prepare(
    'INSERT INTO stage1_outputs(thread_id, raw_memory, rollout_summary, rollout_slug, generated_at) VALUES(?, ?, ?, ?, ?)'
  ).run(
    'thread-summary',
    [
      'cwd: /Users/example/Documents/dachshun',
      'Raw task evidence for the completed rollout.',
      '',
      'Reusable knowledge:',
      '- Keep source identity stable when re-scanning an imported memory.'
    ].join('\n'),
    'The completed rollout shipped the compact panel and verified its category counts.',
    'compact-panel-release',
    1793404800000
  )
  db.prepare(
    'INSERT INTO stage1_outputs(thread_id, raw_memory, rollout_summary, rollout_slug, generated_at) VALUES(?, ?, ?, ?, ?)'
  ).run(
    'thread-raw',
    'cwd: /Users/example/Documents/CodeHub\nA raw thread without a rollout summary.',
    '',
    'raw-lesson',
    1793404801000
  )
  db.close()

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 3)
  assert.equal(
    memories.filter((memory) => memory.kind === 'task_rollout').length,
    2
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'task_rollout' &&
        memory.project === 'dachshun' &&
        categoryForKind(memory.kind) === 'evidence'
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'insight' &&
        memory.project === 'dachshun' &&
        memory.tags.includes('reusable-knowledge')
    )
  )
  assert.ok(
    !memories.some(
      (memory) =>
        memory.content.includes('raw thread without') && memory.kind === 'insight'
    )
  )
  assert.equal(categoryForKind('episode'), 'evidence')
}

function testCodexMarkdownScope(): void {
  const home = path.join(root, 'codex-markdown-scope')
  const agent = definition('codex', 'Codex', home, path.join(home, 'config.toml'))
  write(
    path.join(home, 'memories', 'MEMORY.md'),
    [
      '# Task Group: Dachsund delivery',
      '',
      'scope: Keep the issue implementation and verification in one source-controlled flow.',
      'applies_to: cwd=/Users/example/Documents/dachshun; reuse_rule=verify every release.',
      '',
      '## Task 1: Ship the implementation',
      '',
      '### keywords',
      '',
      '- release, verification',
      '',
      '## Reusable knowledge',
      '',
      '- Run the importer fixture suite before closing an agent compatibility issue.',
      '',
      '# Task Group: Keep memory local',
      '',
      'kind: decision',
      'cwd: /Users/example/Documents/dachshun',
      '',
      'Keep the shared library local instead of adding a hosted dependency.'
    ].join('\n')
  )
  write(
    path.join(home, 'memories', 'raw_memories.md'),
    [
      '# Raw Memories',
      '',
      '## Thread `codex-scope-thread`',
      'updated_at: 2026-11-03T00:00:00.000Z',
      'cwd: /Users/example/Documents/dachshun',
      '',
      '---',
      'description: Validate Codex project scope extraction',
      'keywords: scope, history',
      '---',
      '',
      'Reusable knowledge:',
      '- History remains the knowledge type while cwd becomes the project scope.',
      '',
      'References:',
      '- `scripts/test-agents.ts`'
    ].join('\n')
  )
  write(
    path.join(home, 'memories', 'memory_summary.md'),
    [
      '## Identity',
      '',
      'The user leads product direction and release quality.',
      '',
      '## Guidance',
      '',
      'Always verify rendered artifacts before reporting completion.',
      '',
      '## Knowledge',
      '',
      'The shared memory library is stored locally in Documents.',
      '',
      '## Current work',
      '',
      'The memory taxonomy migration is limited to the 0.1.x release line.'
    ].join('\n')
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 9)
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'task_rollout' &&
        memory.project === 'dachshun' &&
        memory.title === 'Dachsund delivery'
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'task_rollout' &&
        memory.project === 'dachshun' &&
        memory.title === 'Validate Codex project scope extraction'
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'decision' &&
        memory.project === 'dachshun' &&
        memory.title === 'Keep memory local' &&
        categoryForKind(memory.kind) === 'current'
    )
  )
  assert.equal(
    memories.filter((memory) => memory.kind === 'insight' && memory.project === 'dachshun')
      .length,
    2
  )
  const summaryMemories = memories.filter((memory) =>
    memory.sourcePath.endsWith('memory_summary.md')
  )
  assert.deepEqual(
    summaryMemories.map((memory) => memory.kind),
    ['profile', 'rule', 'fact', 'constraint']
  )
}

function testGeminiTaxonomy(): void {
  const home = path.join(root, 'gemini')
  const agent = definition('gemini-cli', 'Gemini CLI', home, path.join(home, 'mcp.json'))
  write(
    path.join(home, 'GEMINI.md'),
    [
      '# Workspace rules',
      '',
      'Always read AGENTS.md before changing files in this repository.',
      '',
      '## Gemini Added Memories',
      '',
      '- The user timezone is Asia/Shanghai.'
    ].join('\n')
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 2)
  assert.ok(memories.some((memory) => memory.kind === 'rule'))
  assert.ok(memories.some((memory) => memory.kind === 'fact'))
}

function testKindNormalization(): void {
  assert.equal(normalizeMemoryKind('user'), 'profile')
  assert.equal(normalizeMemoryKind('preferences'), 'preference')
  assert.equal(normalizeMemoryKind('instructions'), 'rule')
  assert.equal(normalizeMemoryKind('correction', 'Always verify the local artifact.'), 'rule')
  assert.equal(normalizeMemoryKind('correction', 'Prefer concise Chinese.'), 'preference')
  assert.equal(normalizeMemoryKind('correction', 'The failure revealed the root cause.'), 'insight')
  assert.equal(normalizeMemoryKind('correction', 'A neutral observation.'), 'fact')
  assert.equal(normalizeMemoryKind('unclassified', 'A neutral observation.'), 'fact')
  assert.equal(
    normalizeMemoryKind('unclassified', 'The archive lives at /Users/example/releases.'),
    'reference'
  )
  assert.equal(normalizeMemoryKind('task-group', 'The next goal is the local migration.'), 'goal')
  assert.equal(
    normalizeMemoryKind('task-group', 'The release is limited to version 0.1.x.'),
    'constraint'
  )
  assert.equal(
    normalizeMemoryKind('task-group', 'We decided to keep the library local.'),
    'decision'
  )
  assert.equal(normalizeMemoryKind('link'), 'reference')
  assert.equal(normalizeMemoryKind('lesson'), 'insight')
  assert.equal(normalizeMemoryKind('workflow'), 'procedure')
  assert.equal(normalizeMemoryKind('session_memory'), 'session_summary')
  assert.equal(categoryForKind('preference'), 'guidance')
  assert.equal(categoryForKind('decision'), 'current')
  assert.equal(categoryForKind('reference'), 'knowledge')
  assert.equal(categoryForKind('episode'), 'evidence')
  assert.equal(categoryForKind('unrecognized-kind'), 'knowledge')

  const durableKinds = MEMORY_CATEGORIES.flatMap((category) => category.kinds)
  assert.equal(durableKinds.length, 10)
  assert.equal(new Set(durableKinds).size, 10)
  const allKinds = ALL_MEMORY_CATEGORIES.flatMap((category) => category.kinds)
  assert.equal(allKinds.length, 15)
  assert.equal(new Set(allKinds).size, 15)
  assert.ok(!ALL_MEMORY_CATEGORIES.some((category) => category.id === 'unclassified'))
  for (const category of ALL_MEMORY_CATEGORIES) {
    for (const kind of category.kinds) {
      assert.equal(normalizeMemoryKind(kind), kind)
      assert.equal(categoryForKind(kind), category.id)
    }
  }
}

function testZCode(): void {
  const home = path.join(root, 'zcode')
  const agent = definition('zcode', 'ZCode', home, path.join(home, 'config.json'))
  const dbPath = path.join(home, 'cli', 'db', 'db.sqlite')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      directory TEXT NOT NULL,
      time_updated INTEGER NOT NULL
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `)
  db.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run(
    'session-1',
    'Catalog work',
    '/tmp/zcode-project',
    1793404800000
  )
  db.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run(
    'message-1',
    'session-1',
    1793404801000,
    JSON.stringify({ role: 'user', time: { created: 1793404801000 } })
  )
  db.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run(
    'part-1',
    'message-1',
    'session-1',
    JSON.stringify({
      type: 'text',
      text: '请记住：以后所有项目文档都默认使用中文，并保留明确的技术来源。'
    })
  )
  db.close()
  write(
    path.join(home, 'cli', 'memories', 'projects', 'catalog', 'memory', 'preferences.md'),
    [
      '---',
      'type: user',
      'title: Catalog preferences',
      '---',
      '',
      'The user prefers explicit catalog migration notes in every release.'
    ].join('\n')
  )
  write(
    path.join(home, 'cli', 'memories', 'projects', 'catalog', 'memory', 'MEMORY.md'),
    '# Memory Index\n\n- [Catalog preferences](preferences.md)'
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 2)
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'profile' &&
        memory.project === 'catalog' &&
        categoryForKind(memory.kind) === 'identity'
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.project === 'zcode-project' &&
        memory.kind === 'preference' &&
        memory.content.includes('以后所有项目文档')
    )
  )
  assert.ok(!memories.some((memory) => memory.content.includes('Memory Index')))
}

function testDeepSeekHarness(): void {
  const home = path.join(root, 'dsh')
  const agent = definition('deepseek-harness', 'DeepSeek Harness', home, path.join(home, 'patch.yml'))
  write(
    path.join(home, 'AGENTS.md'),
    [
      '# Harness rules',
      '',
      'Keep repository operations local and verify every release artifact before publishing.',
      '',
      DEEPSEEK_MANAGED_BLOCK
    ].join('\n')
  )
  const session = path.join(home, 'sessions', '--tmp-beta--', 'session.jsonl.zstd')
  const records = [
    {
      type: 'session',
      version: 0,
      id: 'dsh-session',
      createdAt: 1793404800000,
      cwd: '/tmp/beta'
    },
    {
      type: 'session/title',
      seq: 4,
      time: 1793404800500,
      data: {
        title: 'Durable project delivery preferences',
        messageSeqs: [1]
      }
    },
    {
      type: 'user/message',
      seq: 1,
      time: 1793404801000,
      surfaceOp: 'append',
      data: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '以后请记住：所有交付都优先给出可验证的本地文件和真实运行结果。'
          }
        ],
        source: { kind: 'user' },
        id: 'dsh-user-1'
      }
    },
    {
      type: 'user/message',
      seq: 2,
      time: 1793404802000,
      surfaceOp: 'append',
      data: {
        role: 'user',
        content: [{ type: 'text', text: 'ABO是啥' }],
        source: { kind: 'user' },
        id: 'dsh-user-2'
      }
    },
    {
      type: 'user/message',
      seq: 3,
      time: 1793404803000,
      surfaceOp: 'append',
      data: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Never mock the repository database; always use the real local fixture.'
          }
        ],
        source: { kind: 'user' },
        id: 'dsh-user-3'
      }
    },
    {
      type: 'compaction/summary',
      seq: 5,
      time: 1793404804000,
      data: {
        compactionId: 'compact-1',
        summary: [
          {
            type: 'text',
            text: 'The task established durable delivery and verification conventions for the beta project.'
          }
        ],
        shadowedRange: { start: 1, end: 1 },
        shadowedSeqs: [1],
        shadowedTokenCount: 80,
        provider: 'fixture',
        model: 'fixture-model'
      }
    },
    {
      type: 'user/message',
      seq: 6,
      time: 1793404804100,
      surfaceOp: { op: 'replace', startSeq: 1, endSeq: 1 },
      sourceEventSeqs: [1],
      data: {
        role: 'user',
        content: [{ type: 'text', text: '<compacted-summary>fixture</compacted-summary>' }],
        source: { kind: 'compaction' },
        id: 'dsh-compaction-message'
      }
    }
  ]
  const compressed = Buffer.concat(
    records.map((record) =>
      zstdCompressSync(Buffer.from(`${JSON.stringify(record)}\n`, 'utf8'))
    )
  )
  fs.mkdirSync(path.dirname(session), { recursive: true })
  fs.writeFileSync(session, compressed)

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 4)
  assert.ok(
    memories
      .filter((memory) => memory.kind !== 'rule')
      .every((memory) => memory.project === 'beta')
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'rule' &&
        memory.tags.includes('user-global-instructions') &&
        memory.content.includes('verify every release artifact') &&
        !memory.content.includes('memory_remember')
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'preference' && memory.tags.includes('surface-shadowed')
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'compaction' &&
        memory.tags.includes('compaction-summary') &&
        memory.content.includes('durable delivery')
    )
  )
  assert.ok(memories.some((memory) => memory.kind === 'rule'))
}

function testWorkBuddyTaxonomy(): void {
  const home = path.join(root, 'workbuddy')
  const agent = definition('workbuddy', 'WorkBuddy', home, path.join(home, 'mcp.json'))
  write(path.join(home, 'IDENTITY.md'), 'You are Esther, a calm and concise local assistant.')
  write(path.join(home, 'USER.md'), 'The user is Ewen and works on AI transformation at Volvo.')
  write(
    path.join(home, 'memory', 'identity.md'),
    '---\ntype: user\ntitle: Identity\n---\n\nEwen works in AI transformation and prefers concise Chinese.'
  )
  write(
    path.join(home, 'memory', 'feedback.md'),
    '---\ntype: feedback\ntitle: Verification\n---\n\nAlways verify the rendered artifact before claiming the change is complete.'
  )
  write(
    path.join(home, 'memory', 'project.md'),
    '---\ntype: project\ntitle: Launch\n---\n\nThe desktop launch is constrained to version 0.1.x releases.'
  )
  write(
    path.join(home, 'memory', 'reference.md'),
    '---\ntype: reference\ntitle: Design source\n---\n\nThe current design source lives in the team Figma workspace.'
  )
  write(path.join(home, 'memory', 'MEMORY.md'), '# Memory Index\n\n- [Identity](identity.md)')
  const datedWorkspace = path.join(root, 'workbuddy-workspaces', '2026-11-03-15-20-00')
  const namedWorkspace = path.join(root, 'workbuddy-workspaces', 'Budget Planning')
  write(
    path.join(datedWorkspace, '.workbuddy', 'memory', '2026-11-03.md'),
    '# Daily workspace log\n\nReviewed the release checklist and captured the remaining verification steps.'
  )
  write(
    path.join(namedWorkspace, '.workbuddy', 'memory', 'project.md'),
    '---\ntype: project\ntitle: Budget planning\n---\n\nThe budget project is active and the next decision is due Friday.'
  )
  const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
  db.exec('CREATE TABLE workspaces(path TEXT, last_opened_at INTEGER);')
  db.prepare('INSERT INTO workspaces(path, last_opened_at) VALUES(?, ?)').run(
    datedWorkspace,
    2
  )
  db.prepare('INSERT INTO workspaces(path, last_opened_at) VALUES(?, ?)').run(
    namedWorkspace,
    1
  )
  db.close()

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 8)
  assert.ok(
    memories.some(
      (memory) => memory.kind === 'rule' && memory.tags.includes('assistant-identity')
    )
  )
  assert.ok(memories.some((memory) => memory.kind === 'profile'))
  assert.ok(memories.some((memory) => memory.kind === 'rule'))
  assert.ok(memories.some((memory) => memory.kind === 'constraint'))
  assert.ok(memories.some((memory) => memory.kind === 'reference'))
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'workspace_log' &&
        memory.project === 'Session 2026-11-03 15:20' &&
        memory.tags.includes('daily-log')
    )
  )
  assert.ok(
    memories.some(
      (memory) =>
        memory.kind === 'decision' &&
        memory.project === 'Budget Planning' &&
        categoryForKind(memory.kind) === 'current'
    )
  )
  assert.ok(
    !memories.some(
      (memory) =>
        memory.project === 'Session 2026-11-03 15:20' &&
        categoryForKind(memory.kind) === 'current'
    )
  )
  assert.ok(!memories.some((memory) => memory.content.includes('Memory Index')))
}

function testTraeTaxonomy(): void {
  const home = path.join(root, 'trae')
  const agent = definition('trae', 'TRAE', home, path.join(home, 'mcp.json'))
  write(
    path.join(home, 'memory', 'user_profile.md'),
    '# User profile\n\nThe user prefers Chinese product documentation and explicit release notes.'
  )
  write(
    path.join(home, 'memory', 'projects', '-tmp-alpha', 'project_memory.md'),
    '# Project memory\n\nThe alpha project must remain compatible with the local desktop release channel.'
  )
  write(
    path.join(home, 'memory', 'projects', '-tmp-alpha', '2026-10-31', 'topics.md'),
    [
      '# Topics',
      '',
      '[session_id: trae-1 | topic_summary_time: 2026-10-31T10:00:00.000Z] The team reviewed the local memory migration and confirmed the next release step.'
    ].join('\n')
  )
  write(
    path.join(home, 'memory', 'projects', '-tmp-alpha', '2026-10-31', 'session_memory_1.jsonl'),
    JSON.stringify({
      intent: 'Validate the category mapping',
      outcome: 'The category mapping was checked against the source structure.',
      actions: ['Compared native kinds and dachshund categories.'],
      learned: ['A native kind must stay inside exactly one dachshund category.'],
      message_id: 'trae-message-1',
      message_summary_time: '2026-10-31T11:00:00.000Z'
    })
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 4)
  assert.ok(memories.some((memory) => memory.kind === 'profile'))
  assert.ok(memories.some((memory) => memory.kind === 'constraint'))
  assert.equal(memories.filter((memory) => memory.kind === 'session_summary').length, 2)
  assert.ok(
    memories
      .filter((memory) => memory.kind !== 'profile')
      .every((memory) => memory.project === 'tmp/alpha')
  )
}

function testTraeMigrationDedupe(): void {
  const parent = path.join(root, 'trae-migration')
  const currentHome = path.join(parent, '.trae-cn')
  const legacyHome = path.join(parent, '.trae')
  const agent = definition('trae', 'TRAE', currentHome, path.join(currentHome, 'mcp.json'))
  agent.homes = [legacyHome]

  const profile = '# User profile\n\nThe migrated TRAE profile should appear exactly once.'
  write(path.join(currentHome, 'memory', 'user_profile.md'), profile)
  write(path.join(legacyHome, 'memory', 'user_profile.md'), profile)
  fs.utimesSync(path.join(legacyHome, 'memory', 'user_profile.md'), new Date(1000), new Date(1000))

  const session = JSON.stringify({
    intent: 'Validate migration deduplication',
    outcome: 'The newer unified TRAE record is retained.',
    learned: ['Legacy and unified memory share one source identity.'],
    message_id: 'trae-migration-1',
    message_summary_time: '2026-10-31T11:00:00.000Z'
  })
  const sessionDir = path.join('memory', 'projects', '-tmp-migrated', '2026-10-31')
  write(path.join(currentHome, sessionDir, 'session_memory_1.jsonl'), session)
  write(path.join(legacyHome, sessionDir, 'session_memory_1.jsonl'), session)
  fs.utimesSync(
    path.join(legacyHome, sessionDir, 'session_memory_1.jsonl'),
    new Date(1000),
    new Date(1000)
  )
  write(
    path.join(currentHome, sessionDir, 'unstable-cache.jsonl'),
    JSON.stringify({ intent: 'This cache row must not be imported', outcome: 'Ignored' })
  )
  write(
    path.join(currentHome, 'memory', 'projects', '-tmp-migrated', '.cleanup', 'memory.md'),
    '# Hidden cleanup\n\nThis hidden migration residue must not be imported.'
  )
  write(
    path.join(currentHome, 'Cache', 'session_memory_99.jsonl'),
    JSON.stringify({ intent: 'This cache row must not be imported', outcome: 'Ignored' })
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 2)
  const profileMemory = memories.find((memory) => memory.kind === 'profile')
  assert.ok(profileMemory?.sourcePath.startsWith(currentHome))
  assert.equal(
    memories.filter((memory) => memory.sourceRef === 'trae-migration-1').length,
    1
  )
  assert.ok(!memories.some((memory) => memory.content.includes('cache row')))
  assert.ok(!memories.some((memory) => memory.content.includes('cleanup')))

  const legacyOnlyHome = path.join(root, 'trae-legacy-only')
  const legacyOnly = definition(
    'trae',
    'TRAE',
    path.join(legacyOnlyHome, '.trae-cn'),
    path.join(legacyOnlyHome, 'mcp.json')
  )
  legacyOnly.homes = [path.join(legacyOnlyHome, '.trae')]
  write(
    path.join(legacyOnlyHome, '.trae', 'memory', 'user_profile.md'),
    '# User profile\n\nLegacy TRAE data remains readable when no current data exists.'
  )
  assert.equal(importAgentMemories(legacyOnly).length, 1)
}

function writeAppInfoPlist(appPath: string, version: string): void {
  write(
    path.join(appPath, 'Contents', 'Info.plist'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      '<key>CFBundleShortVersionString</key>',
      `<string>${version}</string>`,
      '</dict></plist>'
    ].join('\n')
  )
}

function testTraeInstallationResolution(): void {
  const userHome = path.join(root, 'trae-install-home')
  const applications = path.join(root, 'TraeApplications')
  writeAppInfoPlist(path.join(applications, 'Trae CN.app'), '3.4.9')
  write(
    path.join(
      userHome,
      'Library',
      'Application Support',
      'TRAE SOLO CN',
      'User',
      'mcp.json'
    ),
    '{"mcpServers":{}}\n'
  )

  const current = resolveTraeInstallation(userHome, applications)
  assert.equal(current.appPath, path.join(applications, 'Trae CN.app'))
  assert.equal(current.appVersion, '3.4.9')
  assert.equal(current.legacy, false)
  assert.equal(
    current.mcpPath,
    path.join(
      userHome,
      'Library',
      'Application Support',
      'Trae CN',
      'User',
      'mcp.json'
    )
  )

  fs.rmSync(path.join(applications, 'Trae CN.app'), { recursive: true })
  writeAppInfoPlist(path.join(applications, 'TRAE SOLO CN.app'), '0.1.49')
  write(
    path.join(
      userHome,
      'Library',
      'Application Support',
      'Trae CN',
      'User',
      'settings.json'
    ),
    '{}\n'
  )
  const currentSupportWins = resolveTraeInstallation(userHome, applications)
  assert.equal(currentSupportWins.legacy, false)
  assert.equal(
    currentSupportWins.mcpPath,
    path.join(
      userHome,
      'Library',
      'Application Support',
      'Trae CN',
      'User',
      'mcp.json'
    )
  )

  fs.rmSync(path.join(userHome, 'Library', 'Application Support', 'Trae CN'), {
    recursive: true
  })
  const legacy = resolveTraeInstallation(userHome, applications)
  assert.equal(legacy.appPath, path.join(applications, 'TRAE SOLO CN.app'))
  assert.equal(legacy.appVersion, '0.1.49')
  assert.equal(legacy.legacy, true)
  assert.equal(
    legacy.mcpPath,
    path.join(
      userHome,
      'Library',
      'Application Support',
      'TRAE SOLO CN',
      'User',
      'mcp.json'
    )
  )
}

function testTraeMcpRoot(): void {
  const dir = path.join(root, 'trae-mcp')
  const serversFile = path.join(dir, 'servers.json')
  write(serversFile, '{"servers":{"existing":{"command":"keep-me"}}}\n')
  const serversResult = upsertJsonMcp(
    serversFile,
    path.join(dir, 'bridge.cjs'),
    false,
    'trae'
  )
  assert.equal(serversResult.ok, true)
  const serversConfig = JSON.parse(fs.readFileSync(serversFile, 'utf8'))
  assert.equal(serversConfig.servers.existing.command, 'keep-me')
  assert.ok(serversConfig.servers.dachshund)
  assert.equal(serversConfig.mcpServers, undefined)
  assert.ok(fs.existsSync(`${serversFile}.dachshund.bak`))

  const mcpServersFile = path.join(dir, 'mcp-servers.json')
  write(mcpServersFile, '{"mcpServers":{"existing":{"command":"keep-me"}}}\n')
  upsertJsonMcp(mcpServersFile, path.join(dir, 'bridge.cjs'), false, 'trae')
  const mcpServersConfig = JSON.parse(fs.readFileSync(mcpServersFile, 'utf8'))
  assert.equal(mcpServersConfig.mcpServers.existing.command, 'keep-me')
  assert.ok(mcpServersConfig.mcpServers.dachshund)
  assert.equal(mcpServersConfig.servers, undefined)
  assert.ok(!fs.readdirSync(dir).some((file) => file.includes('.tmp')))
}

function testDoubaoTaxonomy(): void {
  const home = path.join(root, 'doubao')
  const agent = definition('doubao', 'Doubao', home, path.join(home, 'unused.json'))
  const workspace = path.join(home, 'Default', '.doubao', 'agent_mode', 'workspace')
  write(
    path.join(workspace, 'memory', 'MEMORY.md'),
    '# Agent memory\n\nThe Agent Mode workspace keeps the current task constraints and working paths.'
  )
  write(
    path.join(workspace, '.sessions', 'session-123456', 'memory', 'notes.md'),
    '# Session memory\n\nThis session is validating the local Agent Mode memory import path.'
  )

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 2)
  assert.ok(memories.some((memory) => memory.kind === 'constraint'))
  assert.ok(memories.some((memory) => memory.kind === 'reference'))
  assert.ok(memories.every((memory) => categoryForKind(memory.kind) !== 'evidence'))
}

function testInstructionsAndObservedMemory(): void {
  const cursorHome = path.join(root, 'cursor')
  const cursor = definition('cursor', 'Cursor', cursorHome, path.join(cursorHome, 'mcp.json'))
  write(
    path.join(cursorHome, 'rules', 'release.mdc'),
    'Always run the local verification command before proposing a release.'
  )
  write(
    path.join(cursorHome, 'agents', 'reviewer.md'),
    'Review changes for local privacy boundaries and category consistency.'
  )
  const cursorMemories = importAgentMemories(cursor)
  assert.equal(cursorMemories.length, 2)
  assert.ok(cursorMemories.every((memory) => memory.kind === 'rule'))

  const copilotHome = path.join(root, 'copilot')
  const copilot = definition('copilot', 'GitHub Copilot', copilotHome, path.join(copilotHome, 'mcp.json'))
  write(
    path.join(copilotHome, 'instructions', 'global.instructions.md'),
    'Use the repository verification commands before claiming a change is complete.'
  )
  write(
    path.join(copilotHome, 'memories', 'fact.md'),
    'The desktop release artifacts are stored in the local release directory.'
  )
  const copilotMemories = importAgentMemories(copilot)
  assert.equal(copilotMemories.length, 2)
  assert.ok(copilotMemories.some((memory) => memory.kind === 'rule'))
  assert.ok(copilotMemories.some((memory) => memory.kind === 'reference'))

  const openCodeHome = path.join(root, 'opencode')
  const openCode = definition('opencode', 'OpenCode', openCodeHome, path.join(openCodeHome, 'opencode.json'))
  write(
    path.join(openCodeHome, 'AGENTS.md'),
    'Always preserve the existing local design language when changing the interface.'
  )
  write(
    path.join(openCodeHome, 'memory', 'context.md'),
    'The local desktop index is generated from Markdown memory files.'
  )
  const openCodeMemories = importAgentMemories(openCode)
  assert.equal(openCodeMemories.length, 2)
  assert.ok(openCodeMemories.some((memory) => memory.kind === 'rule'))
  assert.ok(openCodeMemories.some((memory) => memory.kind === 'fact'))

}

function testAgentModelMappings(): void {
  assert.equal(Object.keys(AGENT_MEMORY_MODELS).length, 13)
  for (const [agentId, model] of Object.entries(AGENT_MEMORY_MODELS)) {
    assert.ok(model.title, `${agentId} needs a title`)
    assert.ok(model.mappings.length > 0, `${agentId} needs at least one mapping`)
    for (const mapping of model.mappings) {
      const category = ALL_MEMORY_CATEGORIES.find((item) => item.id === mapping.category)
      assert.ok(category, `${agentId} uses an unknown category: ${mapping.category}`)
      assert.equal(typeof mapping.imported, 'boolean', `${agentId} mapping needs import status`)
      assert.ok(mapping.kinds.length > 0, `${agentId} mapping needs at least one kind`)
      for (const kind of mapping.kinds) {
        assert.equal(
          categoryForKind(kind),
          mapping.category,
          `${agentId} maps ${kind} into the wrong category`
        )
      }
    }
  }
}

function testWriters(): void {
  const bridgePath = path.join(root, 'out', 'mcp', 'index.cjs')
  const hermesPath = path.join(root, 'writer-hermes', 'config.yaml')
  write(hermesPath, 'memory:\n  enabled: true\n')
  upsertHermesYaml(hermesPath, bridgePath, false, 'hermes')
  upsertHermesYaml(hermesPath, bridgePath, false, 'hermes')
  const hermes = parseYaml(fs.readFileSync(hermesPath, 'utf8')) as {
    memory: { enabled: boolean }
    mcp_servers: {
      dachshund: { command: string; enabled: boolean; env: Record<string, string> }
    }
  }
  assert.equal(hermes.memory.enabled, true)
  assert.equal(hermes.mcp_servers.dachshund.command, '/usr/bin/env')
  assert.equal(hermes.mcp_servers.dachshund.enabled, true)
  assert.equal(hermes.mcp_servers.dachshund.env.DACHSHUND_CLIENT_AGENT, 'hermes')

  const piPath = path.join(root, 'writer-pi', 'mcp.json')
  upsertJsonMcp(piPath, bridgePath, false, 'mcpServers', 'pi')
  const pi = JSON.parse(fs.readFileSync(piPath, 'utf8')) as {
    mcpServers: { dachshund: { command: string; env: Record<string, string> } }
  }
  assert.equal(pi.mcpServers.dachshund.command, '/usr/bin/env')
  assert.equal(pi.mcpServers.dachshund.env.DACHSHUND_CLIENT_AGENT, 'pi')

  const zcodePath = path.join(root, 'writer-zcode', 'config.json')
  write(zcodePath, '{"plugins":{"enabledPlugins":{"example":true}}}\n')
  upsertJsonMcp(zcodePath, bridgePath, false, 'zcode', 'zcode')
  const zcode = JSON.parse(fs.readFileSync(zcodePath, 'utf8')) as {
    plugins: unknown
    mcp: { servers: { dachshund: Record<string, unknown> } }
  }
  assert.ok(zcode.plugins)
  assert.deepEqual(Object.keys(zcode.mcp.servers.dachshund).sort(), [
    'args',
    'command',
    'enabled',
    'env',
    'type'
  ])
  assert.equal(
    (zcode.mcp.servers.dachshund.env as Record<string, string>).DACHSHUND_CLIENT_AGENT,
    'zcode'
  )

  const codexPath = path.join(root, 'writer-codex', 'config.toml')
  upsertCodexToml(codexPath, bridgePath, false, 'codex')
  const codex = fs.readFileSync(codexPath, 'utf8')
  assert.ok(codex.includes('DACHSHUND_CLIENT_AGENT = "codex"'))

  const originalInstructions = '# Existing instructions\n'
  const mergedInstructions = mergeSharedMemoryInstructions(originalInstructions)
  assert.ok(mergedInstructions.includes('memory_context'))
  assert.equal(
    mergedInstructions.match(/dachshund memory \(managed by dachshund\)/g)?.length,
    1
  )
  assert.equal(stripSharedMemoryInstructions(mergedInstructions), '# Existing instructions')

  const dshHome = path.join(root, 'writer-dsh')
  const dshPath = path.join(dshHome, 'profiles', 'desktop', 'cordis.patch.yml')
  write(dshPath, '- id: locale\n  name: "@example/locale"\n')
  upsertDeepSeekCordis(dshPath, bridgePath, false, dshHome)
  upsertDeepSeekCordis(dshPath, bridgePath, false, dshHome)
  const dsh = fs.readFileSync(dshPath, 'utf8')
  assert.equal(dsh.match(/id: dachshund-mcp/g)?.length, 1)
  assert.ok(dsh.includes('serverName: dachshund'))
  assert.ok(dsh.includes('name: "@example/locale"'))
  const dshConfig = parseYaml(dsh) as Array<{
    insert?: Array<{
      config: {
        command: string
        args: string[]
        env: Record<string, string>
      }
    }>
  }>
  const dshServer = dshConfig.find((entry) => entry.insert)?.insert?.[0]
  assert.ok(dshServer)
  assert.notEqual(dshServer.config.command, '/usr/bin/env')
  assert.deepEqual(dshServer.config.args, [bridgePath])
  assert.equal(dshServer.config.env.DACHSHUND_CLIENT_AGENT, 'deepseek-harness')
  const dshInstructions = fs.readFileSync(path.join(dshHome, 'AGENTS.md'), 'utf8')
  assert.equal(
    dshInstructions.match(/dachshund memory \(managed by dachshund\)/g)?.length,
    1
  )
  assert.ok(dshInstructions.includes('memory_context'))
}

function testMcpClientReceipts(): void {
  const dataDir = path.join(root, 'receipts')
  appendMcpClientReceipt(dataDir, {
    name: 'Some Other Client',
    version: '1.0.0',
    connectedAt: 100
  })
  appendMcpClientReceipt(dataDir, {
    name: 'Doubao MCP Client',
    version: '2.33.5',
    connectedAt: 200
  })
  appendMcpClientReceipt(dataDir, {
    name: 'rmcp',
    version: '3.2.0',
    agentId: 'doubao',
    connectedAt: 300
  })
  appendMcpClientReceipt(dataDir, {
    name: 'dsh-mcp-client',
    version: '0.2.1-rc.5',
    agentId: 'deepseek-harness',
    connectedAt: 400
  })

  const receipts = readMcpClientReceipts(dataDir)
  assert.equal(receipts.length, 4)
  assert.equal(fs.statSync(mcpClientReceiptPath(dataDir)).mode & 0o777, 0o600)
  const doubao = latestMcpClientReceipt(dataDir, 'doubao')
  assert.equal(doubao?.name, 'rmcp')
  assert.equal(doubao?.version, '3.2.0')
  assert.equal(doubao?.agentId, 'doubao')
  const deepSeek = latestMcpClientReceipt(dataDir, 'deepseek-harness')
  assert.equal(deepSeek?.name, 'dsh-mcp-client')
  assert.equal(deepSeek?.agentId, 'deepseek-harness')
  assert.equal(latestMcpClientReceipt(dataDir, 'codex'), null)
}

try {
  testHermes()
  testPi()
  testZCode()
  testDeepSeekHarness()
  testWorkBuddyTaxonomy()
  testTraeTaxonomy()
  testTraeMigrationDedupe()
  testTraeInstallationResolution()
  testTraeMcpRoot()
  testDoubaoTaxonomy()
  testInstructionsAndObservedMemory()
  testClaudeTaxonomy()
  testClaudeDesktopTaxonomy()
  testCodexRolloutTaxonomy()
  testCodexMarkdownScope()
  testGeminiTaxonomy()
  testKindNormalization()
  testAgentModelMappings()
  testWriters()
  testMcpClientReceipts()
  console.log('Agent import and memory taxonomy fixtures passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
