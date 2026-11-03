export type AgentKind = 'cli' | 'editor' | 'desktop'
export type McpMode = 'config' | 'manual' | null

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
  mcpMode: McpMode
  appVersion: string | null
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

export interface PulseMemory {
  id: string
  title: string
  kind: string
  createdAt: number
  updatedAt: number
  sources: MemorySource[]
  echoCount: number
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
  pulseMemories: PulseMemory[]
  counts: Counts
  libraryPath: string
  onboarded: boolean
  scanning: boolean
  sync: SyncState
  version: string
}

export type ScanReason = 'startup' | 'manual' | 'automatic' | 'enabled'

export interface ScanChange {
  memoryId: string
  title: string
  agentId: string
  agentName: string
  change: 'added' | 'updated'
}

export interface ScanFailure {
  agentId: string
  agentName: string
  message: string
}

export interface ScanResult {
  startedAt: number
  finishedAt: number
  reason: ScanReason
  added: number
  updated: number
  unchanged: number
  failures: ScanFailure[]
  changes: ScanChange[]
  ok: boolean
}

export interface SyncState {
  autoSync: boolean
  intervalMinutes: number
  lastSyncAttemptAt: number | null
  lastSuccessfulSyncAt: number | null
  lastResult: ScanResult | null
  scanning: boolean
}

export interface ScanResponse {
  state: AppState
  result: ScanResult
}

export interface SyncToggleResponse {
  state: AppState
  result: ScanResult | null
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
  sourceAgentId?: string
  sourceAgentName?: string
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

export interface McpSetup {
  agentId: string
  agentName: string
  name: string
  transport: 'stdio'
  command: string
  args: string[]
  env: Record<string, string>
}

export interface McpConnectionStatus {
  connected: boolean
  clientName: string | null
  clientVersion: string | null
  connectedAt: number | null
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
