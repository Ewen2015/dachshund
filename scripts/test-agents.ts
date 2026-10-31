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
  AGENT_MEMORY_MODELS,
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
  assert.equal(
    memories.filter((memory) => memory.kind === 'episode').length,
    2
  )
  assert.ok(memories.some((memory) => memory.kind === 'preference'))
  assert.ok(memories.some((memory) => memory.kind === 'feedback'))
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
  assert.equal(memories.length, 3)
  assert.ok(
    memories.some(
      (memory) => memory.kind === 'profile' && categoryForKind(memory.kind) === 'about'
    )
  )
  assert.equal(
    memories.filter(
      (memory) => memory.kind === 'rule' && categoryForKind(memory.kind) === 'working'
    ).length,
    2
  )
  assert.ok(!memories.some((memory) => memory.content.includes('Memory Index')))
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
    'Raw task evidence for the completed rollout.',
    'The completed rollout shipped the compact panel and verified its category counts.',
    'compact-panel-release',
    1793404800000
  )
  db.prepare(
    'INSERT INTO stage1_outputs(thread_id, raw_memory, rollout_summary, rollout_slug, generated_at) VALUES(?, ?, ?, ?, ?)'
  ).run(
    'thread-raw',
    'A durable lesson without a rollout summary.',
    '',
    'raw-lesson',
    1793404801000
  )
  db.close()

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 2)
  assert.ok(memories.some((memory) => memory.kind === 'episode'))
  assert.ok(memories.some((memory) => memory.kind === 'lesson'))
  assert.equal(categoryForKind('episode'), 'episodes')
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
  assert.equal(categoryForKind('episode'), 'episodes')
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
        categoryForKind(memory.kind) === 'about'
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
    },
    {
      type: 'user/message',
      seq: 3,
      time: 1793404803000,
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
  assert.equal(memories.length, 2)
  assert.ok(memories.every((memory) => memory.project === 'beta'))
  assert.ok(memories.some((memory) => memory.kind === 'preference'))
  assert.ok(memories.some((memory) => memory.kind === 'feedback'))
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
    '---\ntype: feedback\ntitle: Verification\n---\n\nVerify the rendered artifact before claiming the change is complete.'
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

  const memories = importAgentMemories(agent)
  assert.equal(memories.length, 6)
  assert.ok(
    memories.some(
      (memory) => memory.kind === 'rule' && memory.tags.includes('assistant-identity')
    )
  )
  assert.ok(memories.some((memory) => memory.kind === 'profile'))
  assert.ok(memories.some((memory) => memory.kind === 'feedback'))
  assert.ok(memories.some((memory) => memory.kind === 'project'))
  assert.ok(memories.some((memory) => memory.kind === 'reference'))
  assert.ok(!memories.some((memory) => memory.content.includes('Memory Index')))
}

function testTraeTaxonomy(): void {
  const home = path.join(root, 'trae')
  const agent = definition('trae', 'Trae', home, path.join(home, 'mcp.json'))
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
  assert.ok(memories.some((memory) => memory.kind === 'project'))
  assert.equal(memories.filter((memory) => memory.kind === 'episode').length, 2)
  assert.ok(
    memories
      .filter((memory) => memory.kind !== 'profile')
      .every((memory) => memory.project === 'tmp/alpha')
  )
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
  assert.ok(memories.every((memory) => memory.kind === 'project'))
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
  assert.ok(copilotMemories.some((memory) => memory.kind === 'fact'))

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

  const windsurfHome = path.join(root, 'windsurf')
  const windsurf = definition('windsurf', 'Windsurf', windsurfHome, path.join(windsurfHome, 'mcp.json'))
  write(
    path.join(windsurfHome, 'memories', 'workspace.md'),
    'This workspace uses a compact menu bar shell and local-only memory storage.'
  )
  const windsurfMemories = importAgentMemories(windsurf)
  assert.equal(windsurfMemories.length, 1)
  assert.equal(windsurfMemories[0].kind, 'project')
}

function testAgentModelMappings(): void {
  assert.equal(Object.keys(AGENT_MEMORY_MODELS).length, 15)
  for (const [agentId, model] of Object.entries(AGENT_MEMORY_MODELS)) {
    assert.ok(model.title, `${agentId} needs a title`)
    assert.ok(model.mappings.length > 0, `${agentId} needs at least one mapping`)
    for (const mapping of model.mappings) {
      const category = MEMORY_CATEGORIES.find((item) => item.id === mapping.category)
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

  const receipts = readMcpClientReceipts(dataDir)
  assert.equal(receipts.length, 2)
  assert.equal(fs.statSync(mcpClientReceiptPath(dataDir)).mode & 0o777, 0o600)
  const doubao = latestMcpClientReceipt(dataDir, 'doubao')
  assert.equal(doubao?.name, 'Doubao MCP Client')
  assert.equal(doubao?.version, '2.33.5')
  assert.equal(latestMcpClientReceipt(dataDir, 'codex'), null)
}

try {
  testHermes()
  testPi()
  testZCode()
  testDeepSeekHarness()
  testWorkBuddyTaxonomy()
  testTraeTaxonomy()
  testDoubaoTaxonomy()
  testInstructionsAndObservedMemory()
  testClaudeTaxonomy()
  testCodexRolloutTaxonomy()
  testGeminiTaxonomy()
  testKindNormalization()
  testAgentModelMappings()
  testWriters()
  testMcpClientReceipts()
  console.log('Agent import and memory taxonomy fixtures passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
