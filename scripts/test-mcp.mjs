import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const home = process.env.DACHSHUND_HOME
if (!home) throw new Error('DACHSHUND_HOME is required')
const bridge =
  process.env.DACHSHUND_MCP_ENTRY ?? path.join(process.cwd(), 'out', 'mcp', 'index.cjs')

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [bridge],
  env: { ...process.env, DACHSHUND_HOME: home, DACHSHUND_AUTOLAUNCH: '0' }
})

const client = new Client({ name: 'dachshund-smoke-test', version: '0.1.0' }, { capabilities: {} })
await client.connect(transport)

const receiptPath = path.join(home, 'mcp-clients.jsonl')
for (let attempt = 0; attempt < 20 && !fs.existsSync(receiptPath); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 25))
}
assert.ok(fs.existsSync(receiptPath), 'MCP handshake receipt should exist')
const receipts = fs
  .readFileSync(receiptPath, 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
assert.equal(receipts.at(-1)?.name, 'dachshund-smoke-test')
assert.equal(receipts.at(-1)?.version, '0.1.0')

const tools = await client.listTools()
console.log('tools:', tools.tools.map((tool) => tool.name).join(', '))
assert.deepEqual(
  tools.tools.map((tool) => tool.name).sort(),
  ['memory_context', 'memory_forget', 'memory_remember', 'memory_search', 'memory_stats']
)
const rememberTool = tools.tools.find((tool) => tool.name === 'memory_remember')
assert.deepEqual(
  rememberTool?.inputSchema.properties.kind.enum,
  [
    'profile',
    'preference',
    'rule',
    'feedback',
    'lesson',
    'workflow',
    'project',
    'decision',
    'fact',
    'reference',
    'episode'
  ]
)

const stats = await client.callTool({ name: 'memory_stats', arguments: {} })
console.log('stats:', stats.content[0].text.trim())

const created = await client.callTool({
  name: 'memory_remember',
  arguments: {
    title: 'dachshund integration probe',
    content:
      'dachshund MVP integration probe: shared local memory is visible to every connected agent through MCP.',
    kind: 'fact',
    tags: ['integration', 'mvp']
  }
})
console.log('remember:', created.content[0].text.trim())

const search = await client.callTool({
  name: 'memory_search',
  arguments: { query: 'integration probe', limit: 5 }
})
const results = JSON.parse(search.content[0].text)
console.log('search results:', results.length, results[0]?.title ?? 'none')
assert.equal(results[0]?.title, 'dachshund integration probe')
assert.ok(results[0]?.id)

const typed = await client.callTool({
  name: 'memory_remember',
  arguments: {
    title: 'dachshund typed memory probe',
    content:
      'dachshund typed memory probe: the mobile release remains behind the desktop release until the reader is finished.',
    kind: 'decision',
    tags: ['integration', 'taxonomy']
  }
})
console.log('typed remember:', typed.content[0].text.trim())

const typedSearch = await client.callTool({
  name: 'memory_search',
  arguments: { query: 'typed memory probe', limit: 5 }
})
const typedResults = JSON.parse(typedSearch.content[0].text)
assert.equal(typedResults[0]?.title, 'dachshund typed memory probe')
assert.equal(typedResults[0]?.kind, 'decision')
assert.ok(typedResults[0]?.id)

const context = await client.callTool({
  name: 'memory_context',
  arguments: { query: 'integration probe', limit: 3 }
})
console.log('context starts:', context.content[0].text.split('\n').slice(0, 4).join(' | '))
assert.match(context.content[0].text, /dachshund integration probe/)

const forgotten = await client.callTool({
  name: 'memory_forget',
  arguments: { id: results[0].id }
})
console.log('forget:', forgotten.content[0].text.trim())
assert.match(forgotten.content[0].text, /^Archived mem_/)

const afterForget = await client.callTool({
  name: 'memory_search',
  arguments: { query: 'integration probe', limit: 5 }
})
const remaining = JSON.parse(afterForget.content[0].text)
console.log('search after forget:', remaining.length)
assert.equal(
  remaining.some((memory) => memory.id === results[0].id),
  false
)

const typedForgotten = await client.callTool({
  name: 'memory_forget',
  arguments: { id: typedResults[0].id }
})
assert.match(typedForgotten.content[0].text, /^Archived mem_/)

await client.close()
