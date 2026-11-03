import fs from 'node:fs'
import path from 'node:path'
import { parseDocument } from 'yaml'
import type { McpInstallResult } from '../../shared/types'
import { DATA_DIR } from '../paths'
import { mergeDeepSeekInstructions } from './deepseek-instructions'
import { findDefinition } from './discovery'
import { resolveAgentDefinition } from './registry'
import { nodeRuntime } from './node-runtime'
import { mergeSharedMemoryInstructions } from './shared-memory-instructions'

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

function writeFileAtomic(file: string, value: string): void {
  const existingMode = (() => {
    try {
      return fs.statSync(file).mode & 0o777
    } catch {
      return 0o600
    }
  })()
  const temporary = `${file}.dachshund.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporary, value, { encoding: 'utf8', mode: existingMode })
    fs.renameSync(temporary, file)
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true })
    } catch {
      // Preserve the original write error.
    }
    throw error
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

export function mcpEntry(bridgePath: string, agentId = ''): Record<string, unknown> {
  return {
    command: '/usr/bin/env',
    args: ['node', bridgePath],
    env: {
      DACHSHUND_HOME: DATA_DIR,
      ...(agentId ? { DACHSHUND_CLIENT_AGENT: agentId } : {})
    }
  }
}

export function upsertJsonMcp(
  file: string,
  bridgePath: string,
  dryRun = false,
  mode: 'mcpServers' | 'trae' | 'opencode' | 'zcode' = 'mcpServers',
  agentId = ''
): McpInstallResult {
  const config = readJson(file)
  if (mode === 'opencode') {
    const mcp = (config.mcp && typeof config.mcp === 'object' ? config.mcp : {}) as Record<string, unknown>
    mcp.dachshund = {
      type: 'local',
      command: ['/usr/bin/env', 'node', bridgePath],
      enabled: true,
      environment: {
        DACHSHUND_HOME: DATA_DIR,
        ...(agentId ? { DACHSHUND_CLIENT_AGENT: agentId } : {})
      }
    }
    config.mcp = mcp
  } else if (mode === 'zcode') {
    const mcp = (
      config.mcp && typeof config.mcp === 'object' ? config.mcp : {}
    ) as Record<string, unknown>
    const servers = (
      mcp.servers && typeof mcp.servers === 'object' ? mcp.servers : {}
    ) as Record<string, unknown>
    servers.dachshund = {
      type: 'stdio',
      command: '/usr/bin/env',
      args: ['node', bridgePath],
      env: {
        DACHSHUND_HOME: DATA_DIR,
        ...(agentId ? { DACHSHUND_CLIENT_AGENT: agentId } : {})
      },
      enabled: true
    }
    mcp.servers = servers
    config.mcp = mcp
  } else if (mode === 'trae') {
    const servers = (
      config.servers && typeof config.servers === 'object' ? config.servers : null
    ) as Record<string, unknown> | null
    const mcpServers = (
      config.mcpServers && typeof config.mcpServers === 'object' ? config.mcpServers : null
    ) as Record<string, unknown> | null
    const key =
      servers && 'dachshund' in servers
        ? 'servers'
        : mcpServers && 'dachshund' in mcpServers
          ? 'mcpServers'
          : servers && !mcpServers
            ? 'servers'
            : 'mcpServers'
    const target = (
      key === 'servers' ? servers ?? {} : mcpServers ?? {}
    ) as Record<string, unknown>
    target.dachshund = mcpEntry(bridgePath, agentId)
    config[key] = target
  } else {
    const servers = (
      config.mcpServers && typeof config.mcpServers === 'object' ? config.mcpServers : {}
    ) as Record<string, unknown>
    servers.dachshund = mcpEntry(bridgePath, agentId)
    config.mcpServers = servers
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    backup(file)
    writeFileAtomic(file, `${JSON.stringify(config, null, 2)}\n`)
  }
  return {
    ok: true,
    agentId: '',
    configPath: file,
    message: dryRun ? 'Configuration is valid (dry run)' : 'Connected to dachshund',
    dryRun
  }
}

export function upsertHermesYaml(
  file: string,
  bridgePath: string,
  dryRun = false,
  agentId = ''
): McpInstallResult {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const document = parseDocument(existing.trim() ? existing : '{}\n')
  if (document.errors.length) {
    throw new Error(`Hermes config is not valid YAML: ${document.errors[0].message}`)
  }
  document.setIn(['mcp_servers', 'dachshund'], {
    ...mcpEntry(bridgePath, agentId),
    enabled: true
  })
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    backup(file)
    writeFileAtomic(file, document.toString({ lineWidth: 0 }))
  }
  return {
    ok: true,
    agentId: 'hermes',
    configPath: file,
    message: dryRun ? 'Hermes config is valid (dry run)' : 'Connected to dachshund',
    dryRun
  }
}

function tomlBlock(bridgePath: string, agentId: string): string {
  const env = [
    `DACHSHUND_HOME = ${JSON.stringify(DATA_DIR)}`,
    ...(agentId ? [`DACHSHUND_CLIENT_AGENT = ${JSON.stringify(agentId)}`] : [])
  ].join(', ')
  return [
    '# >>> dachshund (managed by dachshund)',
    '[mcp_servers.dachshund]',
    'command = "/usr/bin/env"',
    `args = ["node", ${JSON.stringify(bridgePath)}]`,
    `env = { ${env} }`,
    '# <<< dachshund',
    ''
  ].join('\n')
}

export function upsertCodexToml(
  file: string,
  bridgePath: string,
  dryRun = false,
  agentId = ''
): McpInstallResult {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const block = tomlBlock(bridgePath, agentId)
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
    writeFileAtomic(file, next)
  }
  return {
    ok: true,
    agentId: 'codex',
    configPath: file,
    message: dryRun ? 'Codex config is valid (dry run)' : 'Connected to dachshund',
    dryRun
  }
}

function deepSeekCordisBlock(bridgePath: string): string {
  return [
    '# >>> dachshund (managed by dachshund)',
    '- insert:',
    '    - id: dachshund-mcp',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        serverName: dachshund',
    '        transport: stdio',
    `        command: ${JSON.stringify(nodeRuntime())}`,
    `        args: [${JSON.stringify(bridgePath)}]`,
    `        cwd: ${JSON.stringify(path.dirname(bridgePath))}`,
    '        env:',
    `          DACHSHUND_HOME: ${JSON.stringify(DATA_DIR)}`,
    '          DACHSHUND_CLIENT_AGENT: "deepseek-harness"',
    '# <<< dachshund',
    ''
  ].join('\n')
}

export function upsertDeepSeekCordis(
  file: string,
  bridgePath: string,
  dryRun = false,
  agentHome?: string
): McpInstallResult {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const block = deepSeekCordisBlock(bridgePath)
  const marker = existing.match(/# >>> dachshund[\s\S]*?# <<< dachshund\n?/)
  const next = marker
    ? existing.replace(marker[0], block)
    : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${block}`

  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    backup(file)
    writeFileAtomic(file, next)
    if (agentHome) {
      const instructionsPath = path.join(agentHome, 'AGENTS.md')
      const existingInstructions = fs.existsSync(instructionsPath)
        ? fs.readFileSync(instructionsPath, 'utf8')
        : ''
      const mergedInstructions = mergeDeepSeekInstructions(existingInstructions)
      if (mergedInstructions !== existingInstructions) {
        fs.mkdirSync(agentHome, { recursive: true })
        backup(instructionsPath)
        writeFileAtomic(instructionsPath, mergedInstructions)
      }
    }
  }
  return {
    ok: true,
    agentId: 'deepseek-harness',
    configPath: file,
    message: dryRun
      ? 'DeepSeek Harness Cordis config is valid (dry run)'
      : 'Connected to dachshund',
    dryRun
  }
}

export function installMcp(agentId: string, options: InstallOptions): McpInstallResult {
  const source = findDefinition(agentId)
  const definition = source ? resolveAgentDefinition(source) : null
  if (!definition?.mcp) {
    return {
      ok: false,
      agentId,
      configPath: null,
      message: 'This agent does not expose an MCP configuration'
    }
  }
  if (definition.mcp.type === 'manual') {
    return {
      ok: false,
      agentId,
      configPath: null,
      message: `Add the dachshund connector inside ${definition.name}`
    }
  }
  if (!definition.mcp.path) {
    return {
      ok: false,
      agentId,
      configPath: null,
      message: 'This agent does not expose an MCP configuration path'
    }
  }
  const target = definition.mcp
  const configPath = target.path as string
  try {
    let result: McpInstallResult
    switch (target.type) {
      case 'codex-toml':
        result = upsertCodexToml(configPath, options.bridgePath, options.dryRun, agentId)
        break
      case 'hermes-yaml':
        result = upsertHermesYaml(configPath, options.bridgePath, options.dryRun, agentId)
        break
      case 'zcode-json':
        result = upsertJsonMcp(
          configPath,
          options.bridgePath,
          options.dryRun,
          'zcode',
          agentId
        )
        break
      case 'deepseek-cordis':
        result = upsertDeepSeekCordis(
          configPath,
          options.bridgePath,
          options.dryRun,
          definition.home
        )
        break
      case 'opencode-json':
        result = upsertJsonMcp(
          configPath,
          options.bridgePath,
          options.dryRun,
          'opencode',
          agentId
        )
        break
      case 'pi-json':
      case 'json-mcpServers':
        result = upsertJsonMcp(
          configPath,
          options.bridgePath,
          options.dryRun,
          'mcpServers',
          agentId
        )
        break
      case 'trae-json':
        result = upsertJsonMcp(
          configPath,
          options.bridgePath,
          options.dryRun,
          'trae',
          agentId
        )
        break
      case 'manual':
        throw new Error(`Add the dachshund connector inside ${definition.name}`)
    }
    let instructionInstalled = false
    if (result.ok && !options.dryRun && definition.instructionPath) {
      try {
        const existing = fs.existsSync(definition.instructionPath)
          ? fs.readFileSync(definition.instructionPath, 'utf8')
          : ''
        const merged = mergeSharedMemoryInstructions(existing)
        if (merged !== existing) {
          fs.mkdirSync(path.dirname(definition.instructionPath), { recursive: true })
          backup(definition.instructionPath)
          writeFileAtomic(definition.instructionPath, merged)
        }
        instructionInstalled = true
      } catch {
        // The MCP connection is still valid if an optional instruction file cannot be updated.
      }
    }
    return {
      ...result,
      agentId,
      message:
        result.message +
        (instructionInstalled ? ' with shared-memory instructions' : '')
    }
  } catch (error) {
    return {
      ok: false,
      agentId,
      configPath,
      message: error instanceof Error ? error.message : 'Could not update the MCP config'
    }
  }
}
