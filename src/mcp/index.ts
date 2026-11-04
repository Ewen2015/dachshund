import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import packageJson from '../../package.json'
import { appendMcpClientReceipt } from '../shared/mcp-client-receipts'

interface RuntimeInfo {
  port: number
  token: string
}

const dataDir =
  process.env.DACHSHUND_HOME ?? path.join(os.homedir(), 'Library', 'Application Support', 'dachshund')
const runtimePath = path.join(dataDir, 'runtime.json')
const clientAgentId = process.env.DACHSHUND_CLIENT_AGENT?.trim() || 'mcp-client'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readRuntime(): RuntimeInfo | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(runtimePath, 'utf8')) as RuntimeInfo
    if (!parsed.port || !parsed.token) return null
    return parsed
  } catch {
    return null
  }
}

async function waitForRuntime(ms = 9000): Promise<RuntimeInfo> {
  const deadline = Date.now() + ms
  let launched = false
  while (Date.now() < deadline) {
    const runtime = readRuntime()
    if (runtime) {
      try {
        const response = await fetch(`http://127.0.0.1:${runtime.port}/health`)
        if (response.ok) return runtime
      } catch {
        // App is still starting.
      }
    }
    if (!launched && Date.now() > deadline - ms + 1200) {
      launched = true
      if (process.env.DACHSHUND_AUTOLAUNCH !== '0') {
        try {
          spawn('open', ['-a', 'dachshund'], { detached: true, stdio: 'ignore' }).unref()
        } catch {
          // The app may not be installed yet.
        }
      }
    }
    await sleep(250)
  }
  throw new Error(
    'dachshund is not running. Open the dachshund app once, then retry this tool.'
  )
}

async function call<T>(route: string, payload?: Record<string, unknown>): Promise<T> {
  const runtime = await waitForRuntime()
  const response = await fetch(`http://127.0.0.1:${runtime.port}${route}`, {
    method: payload ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${runtime.token}`,
      'content-type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`dachshund returned ${response.status}: ${text}`)
  }
  return (await response.json()) as T
}

function text(value: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: value }] }
}

const server = new McpServer({
  name: 'dachshund',
  version: packageJson.version
}, {
  instructions:
    'Before answering when prior user preferences, rules, goals, constraints, decisions, facts, or insights could affect the response, call memory_context. Save durable, confirmed information with memory_remember. These memories are local to this Mac and may come from other agents.'
})

server.server.oninitialized = () => {
  const client = server.server.getClientVersion()
  if (!client) return
  try {
    appendMcpClientReceipt(dataDir, {
      name: client.name,
      version: client.version,
      agentId: process.env.DACHSHUND_CLIENT_AGENT
    })
  } catch (error) {
    console.error('[dachshund] Could not record MCP client:', error)
  }
}

server.registerTool(
  'memory_search',
  {
    title: 'Search shared memory',
    description:
      'Search the user’s local dachshund memory. Use this when prior preferences, rules, goals, constraints, decisions, facts, or insights from another AI agent could change the answer. Evidence and unclassified records are excluded by default. Results include which agents remembered each item.',
    inputSchema: {
      query: z.string().describe('What to recall, in natural language or keywords'),
      limit: z.number().int().min(1).max(20).optional().describe('Maximum results (default 8)'),
      agent: z.string().optional().describe('Optional agent id filter, such as codex or claude-code')
    }
  },
  async ({ query, limit, agent }) => {
    const result = await call<{ memories: unknown[] }>('/api/mcp/search', {
      query,
      limit: limit ?? 8,
      agentId: agent
    })
    return text(JSON.stringify(result.memories, null, 2))
  }
)

server.registerTool(
  'memory_context',
  {
    title: 'Build memory context',
    description:
      'Return a compact, prompt-ready block of relevant memories from all agents on this Mac. Prefer this over memory_search when you are about to answer and want to inject context.',
    inputSchema: {
      query: z.string().describe('The topic, task, or question to gather context for'),
      limit: z.number().int().min(1).max(20).optional().describe('Maximum memories (default 8)')
    }
  },
  async ({ query, limit }) => {
    const result = await call<{ context: string }>('/api/mcp/context', {
      query,
      limit: limit ?? 8
    })
    return text(result.context)
  }
)

server.registerTool(
  'memory_remember',
  {
    title: 'Remember something',
    description:
      `Save a durable memory to the user’s local shared memory as ${clientAgentId}. Use for stable preferences, decisions, project facts, and lessons that should survive this session and be visible to other agents. Do not save secrets, transient chatter, or facts that will expire.`,
    inputSchema: {
      content: z.string().min(1).describe('The memory itself. Be specific and self-contained.'),
      title: z.string().optional().describe('Short human-readable title'),
      kind: z
        .enum([
          'profile',
          'preference',
          'rule',
          'procedure',
          'goal',
          'constraint',
          'decision',
          'fact',
          'reference',
          'insight'
        ])
        .optional(),
      scope: z
        .enum(['user', 'project', 'workspace', 'path', 'session'])
        .optional()
        .describe('Optional scope; defaults to project when project is supplied'),
      project: z.string().optional().describe('Project path or short project name'),
      tags: z.array(z.string()).max(12).optional()
    }
  },
  async ({ content, title, kind, scope, project, tags }) => {
    const result = await call<{ id: string; title: string }>('/api/mcp/remember', {
      content,
      title: title ?? '',
      kind: kind ?? 'fact',
      scope,
      project: project ?? null,
      tags: tags ?? [],
      agentId: clientAgentId
    })
    return text(`Remembered “${result.title}” in dachshund (${result.id}).`)
  }
)

server.registerTool(
  'memory_forget',
  {
    title: 'Forget a memory',
    description:
      'Archive a memory in dachshund. This never deletes the original agent memory file; it only removes the shared copy from future recall.',
    inputSchema: {
      id: z.string().describe('Memory id returned by memory_search')
    }
  },
  async ({ id }) => {
    const result = await call<{ ok: boolean }>('/api/mcp/forget', { id })
    return text(result.ok ? `Archived ${id}.` : `Memory ${id} was not found.`)
  }
)

server.registerTool(
  'memory_stats',
  {
    title: 'Memory stats',
    description: 'Show how many memories, agents, sources, and cross-agent echoes dachshund has indexed.',
    inputSchema: {}
  },
  async () => {
    const stats = await call<Record<string, number>>('/api/mcp/stats')
    return text(JSON.stringify(stats, null, 2))
  }
)

const transport = new StdioServerTransport()
void server.connect(transport).catch((error) => {
  console.error('[dachshund] MCP server failed:', error)
  process.exit(1)
})
