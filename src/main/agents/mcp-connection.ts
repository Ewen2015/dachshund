import type { McpConnectionStatus, McpSetup } from '../../shared/types'
import { latestMcpClientReceipt } from '../../shared/mcp-client-receipts'
import { DATA_DIR } from '../paths'
import { findDefinition, isMcpInstalled } from './discovery'

export function buildMcpSetup(agentId: string, bridgePath: string): McpSetup | null {
  const definition = findDefinition(agentId)
  if (!definition || definition.mcp?.type !== 'manual') return null
  return {
    agentId,
    agentName: definition.name,
    name: 'dachshund',
    transport: 'stdio',
    command: '/usr/bin/env',
    args: ['node', bridgePath],
    env: { DACHSHUND_HOME: DATA_DIR }
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

  if (definition.mcp?.type === 'manual') {
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
