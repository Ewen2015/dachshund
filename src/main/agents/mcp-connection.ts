import type { McpConnectionStatus, McpSetup } from '../../shared/types'
import { latestMcpClientReceipt } from '../../shared/mcp-client-receipts'
import { DATA_DIR } from '../paths'
import { findDefinition, isMcpInstalled } from './discovery'
import { nodeRuntime } from './node-runtime'

export function buildMcpSetup(agentId: string, bridgePath: string): McpSetup | null {
  const definition = findDefinition(agentId)
  const manualOnly =
    Boolean(definition?.mcp.length) &&
    definition!.mcp.every((target) => target.type === 'manual')
  if (!definition || !manualOnly) return null
  return {
    agentId,
    agentName: definition.name,
    name: 'dachshund',
    transport: 'stdio',
    command: nodeRuntime(),
    args: [bridgePath],
    env: {
      DACHSHUND_HOME: DATA_DIR,
      DACHSHUND_CLIENT_AGENT: agentId
    }
  }
}

export function getMcpConnectionStatus(agentId: string): McpConnectionStatus {
  const definition = findDefinition(agentId)
  if (!definition) {
    return {
      connected: false,
      clientName: null,
      clientVersion: null,
      connectedAt: null
    }
  }

  if (definition.mcp.length && definition.mcp.every((target) => target.type === 'manual')) {
    const receipt = latestMcpClientReceipt(DATA_DIR, agentId)
    return {
      connected: Boolean(receipt),
      clientName: receipt?.name ?? null,
      clientVersion: receipt?.version ?? null,
      connectedAt: receipt?.connectedAt ?? null
    }
  }

  return {
    connected: isMcpInstalled(definition),
    clientName: null,
    clientVersion: null,
    connectedAt: null
  }
}
