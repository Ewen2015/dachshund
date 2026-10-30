import fs from 'node:fs'
import path from 'node:path'
import type { McpInstallResult } from '../../shared/types'
import { DATA_DIR } from '../paths'
import { findDefinition } from './discovery'

interface InstallOptions {
  dryRun?: boolean
  bridgePath: string
}

function backup(file: string): void {
  if (!fs.existsSync(file)) return
  try {
    fs.copyFileSync(file, `${file}.dachshund.bak`)
  } catch {
    // best effort
  }
}

function readJson(file: string): Record<string, unknown> {
  if (!fs.existsSync(file)) return {}
  const raw = fs.readFileSync(file, 'utf8').trim()
  if (!raw) return {}
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${path.basename(file)} is not a JSON object`)
  }
  return parsed as Record<string, unknown>
}

export function mcpEntry(bridgePath: string): Record<string, unknown> {
  return {
    command: '/usr/bin/env',
    args: ['node', bridgePath],
    env: { DACHSHUND_HOME: DATA_DIR }
  }
}

export function upsertJsonMcp(
  file: string,
  bridgePath: string,
  dryRun = false,
  mode: 'mcpServers' | 'opencode' = 'mcpServers'
): McpInstallResult {
  const config = readJson(file)
  if (mode === 'opencode') {
    const mcp = (config.mcp && typeof config.mcp === 'object' ? config.mcp : {}) as Record<string, unknown>
    mcp.dachshund = {
      type: 'local',
      command: ['/usr/bin/env', 'node', bridgePath],
      enabled: true,
      environment: { DACHSHUND_HOME: DATA_DIR }
    }
    config.mcp = mcp
  } else {
    const servers = (
      config.mcpServers && typeof config.mcpServers === 'object' ? config.mcpServers : {}
    ) as Record<string, unknown>
    servers.dachshund = mcpEntry(bridgePath)
    config.mcpServers = servers
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    backup(file)
    fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  }
  return {
    ok: true,
    agentId: '',
    configPath: file,
    message: dryRun ? 'Configuration is valid (dry run)' : 'Connected to dachshund',
    dryRun
  }
}

function tomlBlock(bridgePath: string): string {
  return [
    '# >>> dachshund (managed by dachshund)',
    '[mcp_servers.dachshund]',
    'command = "/usr/bin/env"',
    `args = ["node", ${JSON.stringify(bridgePath)}]`,
    `env = { DACHSHUND_HOME = ${JSON.stringify(DATA_DIR)} }`,
    '# <<< dachshund',
    ''
  ].join('\n')
}

export function upsertCodexToml(file: string, bridgePath: string, dryRun = false): McpInstallResult {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const block = tomlBlock(bridgePath)
  let next = existing

  const marker = existing.match(/# >>> dachshund[\s\S]*?# <<< dachshund\n?/)
  if (marker) {
    next = existing.replace(marker[0], block)
  } else {
    const tableStart = existing.search(/^\[mcp_servers\.dachshund\]\s*$/m)
    if (tableStart >= 0) {
      const rest = existing.slice(tableStart)
      const nextHeading = rest.slice(1).search(/^\[/m)
      const end = nextHeading >= 0 ? tableStart + 1 + nextHeading : existing.length
      next = `${existing.slice(0, tableStart).trimEnd()}\n\n${block}${existing.slice(end).trimStart()}`
    } else {
      next = `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${block}`
    }
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    backup(file)
    fs.writeFileSync(file, next, 'utf8')
  }
  return {
    ok: true,
    agentId: 'codex',
    configPath: file,
    message: dryRun ? 'Codex config is valid (dry run)' : 'Connected to dachshund',
    dryRun
  }
}

export function installMcp(agentId: string, options: InstallOptions): McpInstallResult {
  const definition = findDefinition(agentId)
  if (!definition?.mcp) {
    return {
      ok: false,
      agentId,
      configPath: null,
      message: 'This agent does not expose an MCP configuration'
    }
  }
  try {
    const result =
      definition.mcp.type === 'codex-toml'
        ? upsertCodexToml(definition.mcp.path, options.bridgePath, options.dryRun)
        : upsertJsonMcp(
            definition.mcp.path,
            options.bridgePath,
            options.dryRun,
            definition.mcp.type === 'opencode-json' ? 'opencode' : 'mcpServers'
          )
    return { ...result, agentId }
  } catch (error) {
    return {
      ok: false,
      agentId,
      configPath: definition.mcp.path,
      message: error instanceof Error ? error.message : 'Could not update the MCP config'
    }
  }
}
