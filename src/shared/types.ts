export type AgentKind = 'cli' | 'editor' | 'desktop'

export interface AgentSummary {
  id: string
  name: string
  monogram: string
  kind: AgentKind
  accent: string
  description: string
  installed: boolean
  home: string | null
  memoryCount: number
  sourceCount: number
  shared: boolean
  mcpInstalled: boolean
  mcpConfigPath: string | null
  note: string | null
}

export interface MemorySource {
  agentId: string
  agentName: string
  path: string
  ref?: string
  importedAt: number
}

export interface MemorySummary {
  id: string
  title: string
  excerpt: string
  kind: string
  project: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  archived: boolean
  pinned: boolean
  sources: MemorySource[]
  echoCount: number
  score?: number
}

export interface MemoryDetail extends MemorySummary {
  content: string
}

export interface Counts {
  memories: number
  agents: number
  sources: number
  echoes: number
}

export interface AppState {
  agents: AgentSummary[]
  memories: MemorySummary[]
  counts: Counts
  libraryPath: string
  onboarded: boolean
  scanning: boolean
  version: string
}

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'up-to-date'
  | 'error'

export interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  latestVersion: string | null
  releaseName: string | null
  releaseNotes: string | null
  releaseUrl: string | null
  downloadUrl: string | null
  assetName: string | null
  downloadDigest: string | null
  downloadedPath: string | null
  progress: number | null
  checkedAt: number | null
  error: string | null
}

export interface SearchQuery {
  query?: string
  agentId?: string
  limit?: number
  includeArchived?: boolean
}

export interface CreateMemoryInput {
  title: string
  content: string
  kind?: string
  project?: string | null
  tags?: string[]
}

export interface UpdateMemoryInput {
  title?: string
  content?: string
  kind?: string
  project?: string | null
  tags?: string[]
  pinned?: boolean
}

export interface ScanProgress {
  agentId: string
  agentName: string
  status: 'scanning' | 'ready' | 'error'
  memories?: number
  message?: string
}

export interface McpInstallResult {
  ok: boolean
  agentId: string
  configPath: string | null
  message: string
  dryRun?: boolean
}

export interface Settings {
  libraryPath: string
  autoImport: boolean
  watchFiles: boolean
}

export interface MemoryFile {
  id: string
  title: string
  content: string
  kind: string
  project: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  archived: boolean
  pinned: boolean
  sources: Array<{ agentId: string; path: string; ref?: string }>
}

export interface ImportedMemory {
  title: string
  content: string
  kind: string
  project: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  agentId: string
  agentName: string
  sourcePath: string
  sourceRef?: string
}
