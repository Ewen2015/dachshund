import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { zstdCompressSync } from 'node:zlib'
import { parse as parseYaml } from 'yaml'
import { importAgentMemories } from '../src/main/agents/importers'
import {
  upsertDeepSeekCordis,
  upsertHermesYaml,
  upsertJsonMcp
} from '../src/main/agents/mcp-install'
import type { AgentDefinition } from '../src/main/agents/registry'
import {
  MEMORY_CATEGORIES,
  categoryForKind,
  normalizeMemoryKind
} from '../src/shared/memory-taxonomy'

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
    mcp: { type: 'json-mcpServers', path: mcpPath }
  }
}

function testHermes(): void {
  const home = path.join(root, 'hermes')
  const agent = definition('hermes', 'Hermes', home, path.join(home, 'config.yaml'))
  write(
    path.join(home, 'memories', 'MEMORY.md'),
    [
      '# Project context',
      '',
      'Hermes should keep the local project path and release conventions.',
      '§',
      'The shared memory library lives in the user Documents directory.'
    ].join('\n')
  )
  write(
    path.join(home, 'memories', 'USER.md'),
    '*Learn about the person you\'re helping. Update this as you go.*\n§\n**Preferred language:** concise Chinese'
  )
  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 3)
  assert.ok(memories.some((memory) => memory.title === 'Project context'))
  assert.ok(memories.some((memory) => memory.kind === 'profile'))
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
  assert.equal(memories.length, 3)
  assert.ok(memories.some((memory) => memory.tags.includes('compaction')))
  assert.equal(
    memories.filter((memory) => memory.kind === 'episode').length,
    2
  )
  assert.ok(memories.some((memory) => memory.kind === 'preference'))
  assert.ok(!memories.some((memory) => memory.content.includes('system prompt')))
}

function testClaudeTaxonomy(): void {
  const home = path.join(root, 'claude')
  const agent = definition('claude-code', 'Claude Code', home, path.join(home, 'mcp.json'))
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

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 1)
  assert.equal(memories[0].kind, 'profile')
  assert.equal(categoryForKind(memories[0].kind), 'about')
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
  assert.equal(normalizeMemoryKind('correction'), 'feedback')
  assert.equal(normalizeMemoryKind('task-group'), 'project')
  assert.equal(normalizeMemoryKind('link'), 'reference')
  assert.equal(normalizeMemoryKind('session_memory'), 'episode')
  assert.equal(categoryForKind('feedback'), 'working')
  assert.equal(categoryForKind('decision'), 'projects')
  assert.equal(categoryForKind('reference'), 'knowledge')
  assert.equal(categoryForKind('episode'), 'timeline')
  assert.equal(categoryForKind('unrecognized-kind'), 'knowledge')

  const kinds = MEMORY_CATEGORIES.flatMap((category) => category.kinds)
  assert.equal(kinds.length, 11)
  assert.equal(new Set(kinds).size, 11)
  for (const category of MEMORY_CATEGORIES) {
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

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 1)
  assert.equal(memories[0].project, 'zcode-project')
  assert.ok(memories[0].content.includes('以后所有项目文档'))
}

function testDeepSeekHarness(): void {
  const home = path.join(root, 'dsh')
  const agent = definition('deepseek-harness', 'DeepSeek Harness', home, path.join(home, 'patch.yml'))
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
      type: 'user/message',
      seq: 1,
      time: 1793404801000,
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
      data: {
        role: 'user',
        content: [{ type: 'text', text: 'ABO是啥' }],
        source: { kind: 'user' },
        id: 'dsh-user-2'
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
  assert.equal(memories.length, 1)
  assert.equal(memories[0].project, 'beta')
  assert.ok(memories[0].content.includes('可验证的本地文件'))
}

function testWriters(): void {
  const bridgePath = path.join(root, 'out', 'mcp', 'index.cjs')
  const hermesPath = path.join(root, 'writer-hermes', 'config.yaml')
  write(hermesPath, 'memory:\n  enabled: true\n')
  upsertHermesYaml(hermesPath, bridgePath)
  upsertHermesYaml(hermesPath, bridgePath)
  const hermes = parseYaml(fs.readFileSync(hermesPath, 'utf8')) as {
    memory: { enabled: boolean }
    mcp_servers: { dachshund: { command: string; enabled: boolean } }
  }
  assert.equal(hermes.memory.enabled, true)
  assert.equal(hermes.mcp_servers.dachshund.command, '/usr/bin/env')
  assert.equal(hermes.mcp_servers.dachshund.enabled, true)

  const piPath = path.join(root, 'writer-pi', 'mcp.json')
  upsertJsonMcp(piPath, bridgePath, false, 'mcpServers')
  const pi = JSON.parse(fs.readFileSync(piPath, 'utf8')) as {
    mcpServers: { dachshund: { command: string } }
  }
  assert.equal(pi.mcpServers.dachshund.command, '/usr/bin/env')

  const zcodePath = path.join(root, 'writer-zcode', 'config.json')
  write(zcodePath, '{"plugins":{"enabledPlugins":{"example":true}}}\n')
  upsertJsonMcp(zcodePath, bridgePath, false, 'zcode')
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

  const dshPath = path.join(root, 'writer-dsh', 'cordis.patch.yml')
  write(dshPath, '- id: locale\n  name: "@example/locale"\n')
  upsertDeepSeekCordis(dshPath, bridgePath)
  upsertDeepSeekCordis(dshPath, bridgePath)
  const dsh = fs.readFileSync(dshPath, 'utf8')
  assert.equal(dsh.match(/id: dachshund-mcp/g)?.length, 1)
  assert.ok(dsh.includes('serverName: dachshund'))
  assert.ok(dsh.includes('name: "@example/locale"'))
}

try {
  testHermes()
  testPi()
  testZCode()
  testDeepSeekHarness()
  testClaudeTaxonomy()
  testGeminiTaxonomy()
  testKindNormalization()
  testWriters()
  console.log('Agent import and memory taxonomy fixtures passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
