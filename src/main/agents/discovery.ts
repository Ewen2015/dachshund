import fs from 'node:fs'
import path from 'node:path'
import type { AgentSummary } from '../../shared/types'
import { Db, accentFor, monogramForId } from '../store/db'
import { DATA_DIR, IS_DEMO } from '../paths'
import { latestMcpClientReceipt } from '../../shared/mcp-client-receipts'
import { AGENT_DEFINITIONS, DEMO_AGENT_IDS, type AgentDefinition } from './registry'

export interface DetectedAgent extends AgentDefinition {
  installed: boolean
  mcpInstalled: boolean
  mcpConfigPath: string | null
  mcpMode: AgentSummary['mcpMode']
}

function exists(target: string): boolean {
  try {
    return fs.existsSync(target)
  } catch {
    return false
  }
}

export function isMcpInstalled(definition: AgentDefinition): boolean {
  if (!definition.mcp) return false
  if (definition.mcp.type === 'manual') {
    return Boolean(latestMcpClientReceipt(DATA_DIR, definition.id))
  }
  if (!definition.mcp.path) return false
  try {
    if (!fs.existsSync(definition.mcp.path)) return false
    return fs.readFileSync(definition.mcp.path, 'utf8').includes('dachshund')
  } catch {
    return false
  }
}

export function discoverAgents(): DetectedAgent[] {
  const definitions = IS_DEMO
    ? AGENT_DEFINITIONS.filter((definition) => DEMO_AGENT_IDS.includes(definition.id))
    : AGENT_DEFINITIONS
  return definitions.map((definition) => {
    const homes = [definition.home, ...(definition.homes ?? [])]
    const appPaths = [
      ...(definition.appPath ? [definition.appPath] : []),
      ...(definition.appPaths ?? [])
    ]
    const installed = IS_DEMO
      ? true
      : homes.some(exists) || appPaths.some(exists)
    return {
      ...definition,
      installed,
      mcpInstalled: isMcpInstalled(definition),
      mcpConfigPath: definition.mcp?.path ?? null,
      mcpMode:
        definition.mcp?.type === 'manual'
          ? 'manual'
          : definition.mcp
            ? 'config'
            : null
    }
  })
}

export function refreshAgents(db: Db): AgentSummary[] {
  const detected = discoverAgents()
  for (const agent of detected) {
    db.upsertAgent({
      id: agent.id,
      name: agent.name,
      kind: agent.kind,
      home: agent.installed ? agent.home : null,
      installed: agent.installed,
      mcpInstalled: agent.mcpInstalled,
      mcpConfigPath: agent.mcpConfigPath
    })
  }
  return db.listAgents().map((agent) => {
    const definition = detected.find((item) => item.id === agent.id)
    return {
      ...agent,
      accent: agent.accent || accentFor(agent.id),
      monogram: agent.monogram || monogramForId(agent.name, agent.id),
      description: definition?.description ?? '',
      mcpMode:
        definition?.mcp?.type === 'manual'
          ? 'manual'
          : definition?.mcp
            ? 'config'
            : null
    }
  })
}

export function agentDefinitions(): AgentDefinition[] {
  return AGENT_DEFINITIONS
}

export function findDefinition(id: string): AgentDefinition | null {
  return AGENT_DEFINITIONS.find((agent) => agent.id === id) ?? null
}

export function displayPath(target: string): string {
  const home = process.env.HOME
  if (home && target.startsWith(home)) return `~${target.slice(home.length)}`
  return path.basename(target)
}
