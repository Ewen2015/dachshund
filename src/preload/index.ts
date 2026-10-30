import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppState,
  CreateMemoryInput,
  McpInstallResult,
  MemoryDetail,
  MemorySummary,
  ScanProgress,
  SearchQuery,
  UpdateMemoryInput
} from '../shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('app:state'),
  scan: (): Promise<AppState> => ipcRenderer.invoke('app:scan'),
  markOnboarded: (): Promise<AppState> => ipcRenderer.invoke('app:onboarded'),
  bridgePath: (): Promise<string> => ipcRenderer.invoke('app:bridge-path'),
  libraryPath: (): Promise<string> => ipcRenderer.invoke('app:library-path'),
  openMain: (payload?: { memoryId?: string; action?: 'new' }): Promise<boolean> =>
    ipcRenderer.invoke('app:open-main', payload),
  minimizeToTray: (): Promise<boolean> => ipcRenderer.invoke('app:minimize-to-tray'),
  hidePanel: (): Promise<boolean> => ipcRenderer.invoke('app:hide-panel'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  search: (query: SearchQuery): Promise<MemorySummary[]> =>
    ipcRenderer.invoke('memory:search', query),
  getMemory: (id: string): Promise<MemoryDetail | null> => ipcRenderer.invoke('memory:get', id),
  createMemory: (input: CreateMemoryInput): Promise<MemoryDetail> =>
    ipcRenderer.invoke('memory:create', input),
  updateMemory: (id: string, patch: UpdateMemoryInput): Promise<MemoryDetail | null> =>
    ipcRenderer.invoke('memory:update', id, patch),
  archiveMemory: (id: string): Promise<boolean> => ipcRenderer.invoke('memory:archive', id),
  setAgentShared: (id: string, shared: boolean): Promise<AppState> =>
    ipcRenderer.invoke('agent:shared', id, shared),
  installMcp: (id: string, dryRun = false): Promise<McpInstallResult> =>
    ipcRenderer.invoke('agent:install-mcp', id, dryRun),
  reveal: (target: string): Promise<boolean> => ipcRenderer.invoke('shell:reveal', target),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:open-external', url),
  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress): void =>
      callback(progress)
    ipcRenderer.on('scan:progress', listener)
    return () => ipcRenderer.removeListener('scan:progress', listener)
  },
  onStateChanged: (callback: (state: AppState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState): void => callback(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  },
  onNewMemory: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('ui:new-memory', listener)
    return () => ipcRenderer.removeListener('ui:new-memory', listener)
  },
  onOpenMemory: (callback: (id: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string): void => callback(id)
    ipcRenderer.on('ui:open-memory', listener)
    return () => ipcRenderer.removeListener('ui:open-memory', listener)
  }
}

contextBridge.exposeInMainWorld('dachshund', api)

export type dachshundApi = typeof api
