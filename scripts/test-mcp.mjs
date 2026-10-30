import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import assert from 'node:assert/strict'
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

const tools = await client.listTools()
console.log('tools:', tools.tools.map((tool) => tool.name).join(', '))
assert.deepEqual(
  tools.tools.map((tool) => tool.name).sort(),
  ['memory_context', 'memory_forget', 'memory_remember', 'memory_search', 'memory_stats']
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

await client.close()
