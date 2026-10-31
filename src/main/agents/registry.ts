import path from 'node:path'
import os from 'node:os'
import type { AgentKind } from '../../shared/types'

export type McpTargetType =
  | 'json-mcpServers'
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
  mcp: McpTarget | null
  appPath?: string
  appPaths?: string[]
}

const home = os.homedir()

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    kind: 'cli',
    home: path.join(home, '.claude'),
    description: 'Project memories and session history',
    accent: '#C0663B',
    mcp: { type: 'json-mcpServers', path: path.join(home, '.claude.json') }
  },
  {
    id: 'codex',
    name: 'Codex',
    kind: 'cli',
    home: path.join(home, '.codex'),
    description: 'Task memories, rollouts, and preferences',
    accent: '#2E2B27',
    mcp: { type: 'codex-toml', path: path.join(home, '.codex', 'config.toml') }
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    kind: 'cli',
    home: path.join(home, '.gemini'),
    description: 'Global instructions and project context',
    accent: '#4C6F91',
    mcp: { type: 'json-mcpServers', path: path.join(home, '.gemini', 'settings.json') }
  },
  {
    id: 'cursor',
    name: 'Cursor',
    kind: 'editor',
    home: path.join(home, '.cursor'),
    description: 'Rules, agents, and editor context',
    accent: '#66765A',
    mcp: { type: 'json-mcpServers', path: path.join(home, '.cursor', 'mcp.json') },
    appPath: '/Applications/Cursor.app'
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    kind: 'cli',
    home: path.join(home, '.copilot'),
    description: 'Copilot CLI sessions and instructions',
    accent: '#5C6570',
    mcp: { type: 'json-mcpServers', path: path.join(home, '.copilot', 'mcp-config.json') }
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    kind: 'cli',
    home: path.join(home, '.config', 'opencode'),
    description: 'Agent sessions and local configuration',
    accent: '#8A6A4F',
    mcp: { type: 'opencode-json', path: path.join(home, '.config', 'opencode', 'opencode.json') }
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    kind: 'editor',
    home: path.join(home, '.codeium', 'windsurf'),
    description: 'Cascade memories and workspace rules',
    accent: '#3F7A6E',
    mcp: { type: 'json-mcpServers', path: path.join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    appPath: '/Applications/Windsurf.app'
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    kind: 'desktop',
    home: path.join(home, 'Library', 'Application Support', 'Claude'),
    description: 'Desktop connector host',
    accent: '#B86A3F',
    mcp: {
      type: 'json-mcpServers',
      path: path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    },
    appPath: '/Applications/Claude.app'
  },
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    kind: 'desktop',
    home: path.join(home, '.workbuddy'),
    description: 'User memory and workspace notes',
    accent: '#01C886',
    mcp: { type: 'json-mcpServers', path: path.join(home, '.workbuddy', 'mcp.json') },
    appPath: '/Applications/WorkBuddy.app'
  },
  {
    id: 'doubao',
    name: 'Doubao',
    kind: 'desktop',
    home: path.join(home, 'Library', 'Application Support', 'Doubao'),
    description: 'Agent Mode session memory',
    accent: '#1E37FC',
    mcp: { type: 'manual' },
    appPath: '/Applications/Doubao.app'
  },
  {
    id: 'trae',
    name: 'Trae',
    kind: 'editor',
    home: path.join(home, '.trae-cn'),
    homes: [path.join(home, '.trae')],
    description: 'Project topic memories and session summaries',
    accent: '#32F08C',
    mcp: {
      type: 'json-mcpServers',
      path: path.join(home, 'Library', 'Application Support', 'TRAE SOLO CN', 'User', 'mcp.json')
    },
    appPath: '/Applications/Trae CN.app',
    appPaths: ['/Applications/Trae.app']
  },
  {
    id: 'hermes',
    name: 'Hermes',
    kind: 'desktop',
    home: path.join(home, '.hermes'),
    description: 'Native memory files and local sessions',
    accent: '#D45B90',
    mcp: { type: 'hermes-yaml', path: path.join(home, '.hermes', 'config.yaml') },
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
    mcp: { type: 'pi-json', path: path.join(home, '.pi', 'agent', 'mcp.json') }
  },
  {
    id: 'zcode',
    name: 'ZCode',
    kind: 'editor',
    home: path.join(home, '.zcode'),
    description: 'Session history and durable user context',
    accent: '#2D2D2D',
    mcp: { type: 'zcode-json', path: path.join(home, '.zcode', 'cli', 'config.json') },
    appPath: '/Applications/ZCode.app'
  },
  {
    id: 'deepseek-harness',
    name: 'DeepSeek Harness',
    kind: 'desktop',
    home: path.join(home, '.dsh'),
    description: 'Session logs and durable user context',
    accent: '#4D6BFE',
    mcp: {
      type: 'deepseek-cordis',
      path: path.join(home, '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
    },
    appPath: '/Applications/DeepSeek Harness.app'
  }
]

export const DEMO_AGENT_IDS = [
  'claude-code',
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
  'opencode',
  'windsurf',
  'claude-desktop'
]
