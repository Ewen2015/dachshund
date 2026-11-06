import fs from 'node:fs'
import path from 'node:path'
import type { AgentSummary } from '../../shared/types'
import { Db, accentFor, monogramForId } from '../store/db'
import { DATA_DIR, IS_DEMO } from '../paths'
import { latestMcpClientReceipt } from '../../shared/mcp-client-receipts'
import {
  AGENT_DEFINITIONS,
  DEMO_AGENT_IDS,
  resolveAgentDefinition,
  type AgentDefinition
} from './registry'

export interface DetectedAgent extends Omit<AgentDefinition, 'appVersion'> {
  installed: boolean
  mcpInstalled: boolean
  mcpConfigPath: string | null
  mcpMode: AgentSummary['mcpMode']
  appVersion?: string
}

function exists(target: string): boolean {
  try {
    return fs.existsSync(target)
  } catch {
    return false
  }
}

function mcpModeFor(targets: AgentDefinition['mcp']): AgentSummary['mcpMode'] {
  if (!targets.length) return null
  if (targets.every((target) => target.type === 'manual')) return 'manual'
  return 'config'
}

export function isMcpInstalled(definition: AgentDefinition): boolean {
  const resolved = resolveAgentDefinition(definition)
  const targets = resolved.mcp
  if (!targets.length) return false
  if (mcpModeFor(targets) === 'manual') {
    return Boolean(latestMcpClientReceipt(DATA_DIR, resolved.id))
  }
  // A merged agent is connected only when every installed surface is configured.
  const configured = targets.filter((target) => target.type !== 'manual' && target.path)
  if (!configured.length) return false
  return configured.every((target) => {
    try {
      const file = target.path as string
      if (!fs.existsSync(file)) return false
      return fs.readFileSync(file, 'utf8').includes('dachshund')
    } catch {
      return false
    }
  })
}

export function discoverAgents(): DetectedAgent[] {
  const definitions = (IS_DEMO
    ? AGENT_DEFINITIONS.filter((definition) => DEMO_AGENT_IDS.includes(definition.id))
    : AGENT_DEFINITIONS
  ).map(resolveAgentDefinition)
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
      mcpConfigPath:
        definition.mcp.find((target) => target.type !== 'manual' && target.path)?.path ??
        null,
      appVersion: definition.appVersion,
      mcpMode: mcpModeFor(definition.mcp)
    }
  })
}

export function refreshAgents(db: Db): AgentSummary[] {
  const detected = discoverAgents()
  db.pruneAgents(detected.map((agent) => agent.id))
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
      appVersion: definition?.appVersion ?? null,
      mcpMode: mcpModeFor(definition?.mcp ?? [])
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
