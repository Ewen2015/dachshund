import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import type { AgentKind } from '../../shared/types'

export type McpTargetType =
  | 'json-mcpServers'
  | 'trae-json'
  | 'codex-toml'
  | 'opencode-json'
  | 'hermes-yaml'
  | 'pi-json'
  | 'zcode-json'
  | 'deepseek-cordis'
  | 'manual'

export interface McpTarget {
  type: McpTargetType
  path?: string
}

export interface AgentDefinition {
  id: string
  name: string
  kind: AgentKind
  home: string
  homes?: string[]
  description: string
  accent: string
  mcp: McpTarget[]
  instructionPath?: string
  appPath?: string
  appPaths?: string[]
  appVersion?: string
}

const home = os.homedir()
const claudeCodeHome = path.join(home, '.claude')
const claudeDesktopLegacyHome = path.join(
  home,
  'Library',
  'Application Support',
  'Claude'
)
const claudeDesktopCurrentHome = path.join(
  home,
  'Library',
  'Application Support',
  'Claude-3p'
)
const claudeAppPath = '/Applications/Claude.app'
const claudeDesktopHome = fs.existsSync(claudeDesktopCurrentHome)
  ? claudeDesktopCurrentHome
  : claudeDesktopLegacyHome
const claudeHome =
  [claudeCodeHome, claudeDesktopCurrentHome, claudeDesktopLegacyHome].find((candidate) =>
    fs.existsSync(candidate)
  ) ?? claudeCodeHome
const claudeCodeConfigPath = path.join(home, '.claude.json')
const claudeDesktopConfigPath = path.join(
  claudeDesktopHome,
  'claude_desktop_config.json'
)

const TRAE_APP_NAMES = ['Trae CN.app', 'Trae.app', 'TRAE SOLO CN.app', 'TRAE SOLO.app']
const TRAE_SUPPORT_NAMES = ['Trae CN', 'Trae', 'TRAE SOLO CN', 'TRAE SOLO']

export interface TraeInstallation {
  appPath: string | null
  appVersion: string | null
  supportHome: string | null
  mcpPath: string
  legacy: boolean
}

function exists(target: string): boolean {
  try {
    return fs.existsSync(target)
  } catch {
    return false
  }
}

export function readAppVersion(appPath: string): string | null {
  const infoPlist = path.join(appPath, 'Contents', 'Info.plist')
  try {
    const raw = fs.readFileSync(infoPlist, 'utf8')
    const match = raw.match(
      /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
    )
    if (match?.[1]) return match[1].trim()
  } catch {
    // Fall back to plutil for binary plists.
  }
  try {
    return execFileSync(
      '/usr/bin/plutil',
      ['-extract', 'CFBundleShortVersionString', 'raw', infoPlist],
      { encoding: 'utf8' }
    ).trim()
  } catch {
    return null
  }
}

export function resolveTraeInstallation(
  userHome = home,
  applicationsDir = '/Applications'
): TraeInstallation {
  const appPaths = TRAE_APP_NAMES.map((name) => path.join(applicationsDir, name))
  const supportHomes = TRAE_SUPPORT_NAMES.map((name) =>
    path.join(userHome, 'Library', 'Application Support', name)
  )

  const installedApps = appPaths.filter(exists)
  const appPath = installedApps[0] ?? null
  const newAppInstalled = installedApps.some((item) =>
    ['Trae CN.app', 'Trae.app'].includes(path.basename(item))
  )
  const newSupportInstalled = supportHomes.slice(0, 2).some(exists)
  const useCurrent = newAppInstalled || newSupportInstalled
  const tier = useCurrent ? TRAE_SUPPORT_NAMES.slice(0, 2) : TRAE_SUPPORT_NAMES.slice(2)

  const mappedSupport = appPath ? path.basename(appPath, '.app') : null
  const supportOrder =
    mappedSupport && tier.includes(mappedSupport)
      ? [mappedSupport, ...tier.filter((item) => item !== mappedSupport)]
      : tier
  const supportHome =
    supportOrder
      .map((name) => path.join(userHome, 'Library', 'Application Support', name))
      .find(exists) ?? path.join(userHome, 'Library', 'Application Support', supportOrder[0])

  return {
    appPath,
    appVersion: appPath ? readAppVersion(appPath) : null,
    supportHome,
    mcpPath: path.join(supportHome, 'User', 'mcp.json'),
    legacy: !useCurrent
  }
}

function claudeSurfaceAvailable(target: McpTarget): boolean {
  if (target.path === claudeDesktopConfigPath) {
    return (
      fs.existsSync(claudeDesktopCurrentHome) ||
      fs.existsSync(claudeDesktopLegacyHome) ||
      fs.existsSync(claudeAppPath)
    )
  }
  if (target.path === claudeCodeConfigPath) {
    return fs.existsSync(claudeCodeHome)
  }
  return true
}

export function resolveAgentDefinition(definition: AgentDefinition): AgentDefinition {
  const resolved: AgentDefinition = {
    ...definition,
    mcp: definition.mcp.map((target) => ({ ...target }))
  }
  if (definition.id === 'trae') {
    const userHome = path.dirname(definition.home)
    const installation = resolveTraeInstallation(userHome)
    resolved.mcp = [{ type: 'trae-json', path: installation.mcpPath }]
    resolved.appVersion = installation.appVersion ?? undefined
    return resolved
  }
  if (definition.id === 'claude') {
    // Connect writes each surface only where that surface is installed.
    resolved.mcp = resolved.mcp.filter(claudeSurfaceAvailable)
    // CLAUDE.md belongs to Claude Code; a Desktop-only Mac has no instruction layer to merge.
    if (!fs.existsSync(claudeCodeHome)) resolved.instructionPath = undefined
  }
  return resolved
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'claude',
    name: 'Claude',
    kind: 'cli',
    home: claudeHome,
    homes: [claudeCodeHome, claudeDesktopCurrentHome, claudeDesktopLegacyHome].filter(
      (candidate) => candidate !== claudeHome
    ),
    description: 'Claude Code project memory and instructions, plus Cowork Space topics',
    accent: '#C0663B',
    mcp: [
      { type: 'json-mcpServers', path: claudeCodeConfigPath },
      { type: 'json-mcpServers', path: claudeDesktopConfigPath }
    ],
    instructionPath: path.join(claudeCodeHome, 'CLAUDE.md'),
    appPath: claudeAppPath
  },
  {
    id: 'codex',
    name: 'Codex',
    kind: 'cli',
    home: path.join(home, '.codex'),
    description: 'Task memories, rollouts, and preferences',
    accent: '#2E2B27',
    mcp: [{ type: 'codex-toml', path: path.join(home, '.codex', 'config.toml') }],
    instructionPath: path.join(home, '.codex', 'AGENTS.md')
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    kind: 'cli',
    home: path.join(home, '.gemini'),
    description: 'Global instructions and project context',
    accent: '#4C6F91',
    mcp: [{ type: 'json-mcpServers', path: path.join(home, '.gemini', 'settings.json') }],
    instructionPath: path.join(home, '.gemini', 'GEMINI.md')
  },
  {
    id: 'cursor',
    name: 'Cursor',
    kind: 'editor',
    home: path.join(home, '.cursor'),
    description: 'Rules, agents, and editor context',
    accent: '#66765A',
    mcp: [{ type: 'json-mcpServers', path: path.join(home, '.cursor', 'mcp.json') }],
    appPath: '/Applications/Cursor.app'
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    kind: 'cli',
    home: path.join(home, '.copilot'),
    description: 'Copilot CLI sessions and instructions',
    accent: '#5C6570',
    mcp: [{ type: 'json-mcpServers', path: path.join(home, '.copilot', 'mcp-config.json') }],
    instructionPath: path.join(home, '.copilot', 'instructions', 'dachshund.md')
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    kind: 'cli',
    home: path.join(home, '.config', 'opencode'),
    description: 'Agent sessions and local configuration',
    accent: '#8A6A4F',
    mcp: [{ type: 'opencode-json', path: path.join(home, '.config', 'opencode', 'opencode.json') }],
    instructionPath: path.join(home, '.config', 'opencode', 'AGENTS.md')
  },
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    kind: 'desktop',
    home: path.join(home, '.workbuddy'),
    description: 'User memory and workspace notes',
    accent: '#01C886',
    mcp: [{ type: 'json-mcpServers', path: path.join(home, '.workbuddy', 'mcp.json') }],
    appPath: '/Applications/WorkBuddy.app'
  },
  {
    id: 'doubao',
    name: 'Doubao',
    kind: 'desktop',
    home: path.join(home, 'Library', 'Application Support', 'Doubao'),
    description: 'Shared memory over MCP and Agent Mode files',
    accent: '#1E37FC',
    mcp: [{ type: 'manual' }],
    appPath: '/Applications/Doubao.app'
  },
  {
    id: 'trae',
    name: 'TRAE',
    kind: 'editor',
    home: path.join(home, '.trae-cn'),
    homes: [path.join(home, '.trae')],
    description: 'Agent and IDE modes with durable profile, project, and session memory',
    accent: '#111111',
    mcp: [
      {
        type: 'trae-json',
        path: path.join(home, 'Library', 'Application Support', 'Trae CN', 'User', 'mcp.json')
      }
    ],
    appPath: '/Applications/Trae CN.app',
    appPaths: ['/Applications/Trae.app', '/Applications/TRAE SOLO CN.app', '/Applications/TRAE SOLO.app']
  },
  {
    id: 'hermes',
    name: 'Hermes',
    kind: 'desktop',
    home: path.join(home, '.hermes'),
    description: 'Native memory files and local sessions',
    accent: '#D45B90',
    mcp: [{ type: 'hermes-yaml', path: path.join(home, '.hermes', 'config.yaml') }],
    appPath: '/Applications/Hermes Agent.app',
    appPaths: ['/Applications/Hermes.app']
  },
  {
    id: 'pi',
    name: 'Pi',
    kind: 'cli',
    home: path.join(home, '.pi', 'agent'),
    description: 'Session summaries and durable instructions',
    accent: '#1C1C1C',
    mcp: [{ type: 'pi-json', path: path.join(home, '.pi', 'agent', 'mcp.json') }]
  },
  {
    id: 'zcode',
    name: 'ZCode',
    kind: 'editor',
    home: path.join(home, '.zcode'),
    description: 'Session history and durable user context',
    accent: '#2D2D2D',
    mcp: [{ type: 'zcode-json', path: path.join(home, '.zcode', 'cli', 'config.json') }],
    appPath: '/Applications/ZCode.app'
  },
  {
    id: 'deepseek-harness',
    name: 'DeepSeek Harness',
    kind: 'desktop',
    home: path.join(home, '.dsh'),
    description: 'Event evidence and shared MCP memory',
    accent: '#4D6BFE',
    mcp: [
      {
        type: 'deepseek-cordis',
        path: path.join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
      }
    ],
    instructionPath: path.join(home, '.dsh', 'AGENTS.md'),
    appPath: '/Applications/DeepSeek Harness.app'
  }
]

export const DEMO_AGENT_IDS = [
  'claude',
  'codex',
  'gemini-cli',
  'cursor',
  'workbuddy',
  'doubao',
  'trae',
  'hermes',
  'pi',
  'zcode',
  'deepseek-harness',
  'copilot',
  'opencode'
]
