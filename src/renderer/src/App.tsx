import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppState,
  CreateMemoryInput,
  MemoryDetail as MemoryDetailType,
  MemorySummary,
  ScanProgress
} from '../../shared/types'
import { AgentsView } from './components/AgentsView'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { AgentMemoryView } from './components/AgentMemoryView'
import { MemoryDetail } from './components/MemoryDetail'
import { MemoryFeed } from './components/MemoryFeed'
import { McpSetupDialog } from './components/McpSetupDialog'
import { Onboarding } from './components/Onboarding'
import { PulseView } from './components/PulseView'
import { SettingsView } from './components/SettingsView'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { UpdateNotice } from './components/UpdateNotice'
import { useUpdater } from './lib/useUpdater'
import type { MemoryCategoryId } from '../../shared/memory-taxonomy'

type View = 'memory' | 'pulse' | 'agents' | 'connectors'

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [view, setView] = useState<View>('memory')
  const [memories, setMemories] = useState<MemorySummary[]>([])
  const [query, setQuery] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [memoryCategory, setMemoryCategory] = useState<MemoryCategoryId | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemoryDetailType | null>(null)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [mcpSetupAgentId, setMcpSetupAgentId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<Record<string, ScanProgress>>({})
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)
  const [bridgePath, setBridgePath] = useState('')
  const [sidebarMode, setSidebarMode] = useState(() => {
    try {
      return window.localStorage.getItem('dachshund.sidebar-navigation') === '1'
    } catch {
      return false
    }
  })
  const updater = useUpdater()
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<number | null>(null)

  const closeDetail = useCallback(() => {
    setDetail(null)
    setSelectedId(null)
    setDetailExpanded(false)
  }, [])

  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }, [])

  const refreshState = useCallback(async () => {
    const next = await window.dachshund.getState()
    setState(next)
    return next
  }, [])

  const loadMemories = useCallback(
    async (nextQuery = query, nextAgentId = activeAgentId) => {
      const list = await window.dachshund.search({
        query: nextQuery,
        agentId: nextAgentId ?? undefined,
        limit: 120
      })
      setMemories(list)
    },
    [activeAgentId, query]
  )

  useEffect(() => {
    try {
      window.localStorage.setItem('dachshund.sidebar-navigation', sidebarMode ? '1' : '0')
    } catch {
      // Navigation still works if storage is unavailable.
    }
  }, [sidebarMode])

  useEffect(() => {
    void (async () => {
      const initial = await window.dachshund.getState()
      setState(initial)
      setMemories(initial.memories)
      setBridgePath(await window.dachshund.bridgePath())
    })()

    const offProgress = window.dachshund.onScanProgress((item) => {
      setProgress((current) => ({ ...current, [item.agentId]: item }))
    })
    const offState = window.dachshund.onStateChanged((next) => {
      setState(next)
    })
    const offNew = window.dachshund.onNewMemory(() => setComposerOpen(true))
    const offOpen = window.dachshund.onOpenMemory((id) => {
      void (async () => {
        const memory = await window.dachshund.getMemory(id)
        setView('memory')
        setComposerOpen(false)
        setSelectedId(id)
        setDetail(memory)
        setDetailExpanded(false)
      })()
    })
    return () => {
      offProgress()
      offState()
      offNew()
      offOpen()
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMemories(query, activeAgentId)
    }, 160)
    return () => window.clearTimeout(timer)
  }, [query, activeAgentId, loadMemories])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setView('memory')
        searchRef.current?.focus()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setComposerOpen(true)
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault()
        void window.dachshund.minimizeToTray()
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault()
        setSidebarMode((current) => !current)
      }
      if (event.key === 'Escape') {
        if (mcpSetupAgentId) setMcpSetupAgentId(null)
        else if (composerOpen) setComposerOpen(false)
        else if (detail) {
          if (detailExpanded) setDetailExpanded(false)
          else closeDetail()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDetail, composerOpen, detail, detailExpanded, mcpSetupAgentId])

  const scan = async () => {
    if (scanning) return
    setScanning(true)
    setProgress({})
    try {
      const next = await window.dachshund.scan()
      setState(next)
      await loadMemories(query, activeAgentId)
      notify(
        next.counts.memories === 0
          ? 'No memories found yet'
          : `${next.counts.memories} memories from ${next.counts.agents} agents`
      )
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Scan failed', true)
    } finally {
      setScanning(false)
    }
  }

  const select = async (id: string) => {
    setSelectedId(id)
    setDetailExpanded(false)
    const memory = await window.dachshund.getMemory(id)
    setDetail(memory)
  }

  const save = async (input: CreateMemoryInput) => {
    try {
      const created = await window.dachshund.createMemory(input)
      setComposerOpen(false)
      setActiveAgentId(null)
      setMemoryCategory(null)
      const next = await refreshState()
      setState(next)
      await loadMemories('', null)
      setQuery('')
      setSelectedId(created.id)
      setDetail(created)
      setDetailExpanded(false)
      notify('Memory saved to your library')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save memory', true)
    }
  }

  const archive = async () => {
    if (!detail) return
    const ok = await window.dachshund.archiveMemory(detail.id)
    if (ok) {
      closeDetail()
      const next = await refreshState()
      setState(next)
      await loadMemories(query, activeAgentId)
      notify('Forgotten here — original agent files are untouched')
    }
  }

  const toggleShared = async (id: string, shared: boolean) => {
    const next = await window.dachshund.setAgentShared(id, shared)
    setState(next)
    notify(shared ? 'Sharing turned on' : 'Sharing paused')
  }

  const installMcp = async (id: string) => {
    const agent = state?.agents.find((item) => item.id === id)
    if (agent?.mcpMode === 'manual') {
      setMcpSetupAgentId(id)
      return
    }
    const result = await window.dachshund.installMcp(id)
    notify(result.message, !result.ok)
    if (result.ok) {
      const next = await refreshState()
      setState(next)
    }
  }

  const refreshAfterMcpConnection = useCallback(async () => {
    const next = await refreshState()
    setState(next)
  }, [refreshState])

  const enter = async () => {
    const next = await window.dachshund.markOnboarded()
    setState(next)
  }

  if (!state) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-word">dachshund</div>
      </div>
    )
  }

  const showOnboarding = !state.onboarded
  const activeAgent = activeAgentId
    ? state.agents.find((agent) => agent.id === activeAgentId) ?? null
    : null
  const mcpSetupAgent = mcpSetupAgentId
    ? state.agents.find((agent) => agent.id === mcpSetupAgentId) ?? null
    : null
  const openAgentMemory = (id: string) => {
    setActiveAgentId(id)
    setMemoryCategory(null)
    setQuery('')
    setMemories(
      state.memories.filter((memory) => memory.sources.some((source) => source.agentId === id))
    )
  }
  const closeAgentMemory = () => {
    setActiveAgentId(null)
    setMemoryCategory(null)
    setQuery('')
    setMemories(state.memories)
  }

  return (
    <div className={`app-shell ${sidebarMode ? 'has-sidebar' : ''}`}>
      <Header
        view={view}
        onView={setView}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        onNew={() => setComposerOpen(true)}
        onMinimize={() => void window.dachshund.minimizeToTray()}
        sidebarMode={sidebarMode}
        onToggleSidebar={() => setSidebarMode((current) => !current)}
        agents={state.counts.agents}
      />
      <div className="app-body">
        {sidebarMode && (
          <Sidebar view={view} onChange={setView} counts={state.counts} />
        )}
        <main className="main">
          {updater.visible && updater.state && (
            <UpdateNotice
              update={updater.state}
              onDownload={() => void updater.download()}
              onOpenDownloaded={() => void updater.openDownloaded()}
              onDismiss={updater.dismiss}
            />
          )}
          <div className="content-scroll">
            {view === 'memory' &&
              (activeAgent ? (
                <AgentMemoryView
                  key={activeAgent.id}
                  agent={activeAgent}
                  agents={state.agents}
                  memories={memories}
                  selectedId={selectedId}
                  onSelect={(id) => void select(id)}
                  onBack={closeAgentMemory}
                  onOpenAgent={openAgentMemory}
                  onScan={() => void scan()}
                  scanning={scanning || state.scanning}
                />
              ) : (
                <MemoryFeed
                  memories={memories}
                  agents={state.agents}
                  counts={state.counts}
                  activeAgentId={null}
                  activeCategory={memoryCategory}
                  onCategory={setMemoryCategory}
                  onOpenAgent={openAgentMemory}
                  onOpenAllAgents={closeAgentMemory}
                  selectedId={selectedId}
                  onSelect={(id) => void select(id)}
                  onNew={() => setComposerOpen(true)}
                  onScan={() => void scan()}
                  scanning={scanning || state.scanning}
                  query={query}
                  onClearQuery={() => setQuery('')}
                />
              ))}
            {view === 'pulse' && (
              <PulseView
                memories={state.memories}
                agents={state.agents}
                counts={state.counts}
                scanning={scanning || state.scanning}
                onScan={() => void scan()}
                onOpenCategory={(category) => {
                  setActiveAgentId(null)
                  setMemoryCategory(category)
                  setQuery('')
                  setMemories(state.memories)
                  setView('memory')
                }}
                onOpenAgent={(id) => {
                  setView('memory')
                  openAgentMemory(id)
                }}
                onOpenMemory={(id) => {
                  setActiveAgentId(null)
                  setMemoryCategory(null)
                  setQuery('')
                  setView('memory')
                  void select(id)
                }}
              />
            )}
            {view === 'agents' && (
              <AgentsView
                agents={state.agents}
                counts={state.counts}
                scanning={scanning}
                progress={progress}
                onScan={() => void scan()}
                onToggleShared={(id, shared) => void toggleShared(id, shared)}
                onInstallMcp={(id) => void installMcp(id)}
                onReveal={(path) => void window.dachshund.reveal(path)}
              />
            )}
            {view === 'connectors' && (
              <SettingsView
                state={state}
                bridgePath={bridgePath}
                onScan={() => void scan()}
                onReveal={(path) => void window.dachshund.reveal(path)}
                onInstallMcp={(id) => void installMcp(id)}
                onQuit={() => void window.dachshund.quit()}
              />
            )}
          </div>
        </main>
      </div>

      {detail && (
        <MemoryDetail
          memory={detail}
          expanded={detailExpanded}
          onToggleExpanded={() => setDetailExpanded((current) => !current)}
          onClose={closeDetail}
          onArchive={() => void archive()}
          onReveal={(path) => void window.dachshund.reveal(path)}
          onToast={notify}
        />
      )}

      {composerOpen && <Composer onClose={() => setComposerOpen(false)} onSave={save} />}
      {mcpSetupAgent && (
        <McpSetupDialog
          agent={mcpSetupAgent}
          onClose={() => setMcpSetupAgentId(null)}
          onConnected={refreshAfterMcpConnection}
          onToast={notify}
        />
      )}
      {showOnboarding && (
        <Onboarding
          agents={state.agents}
          counts={state.counts}
          scanning={scanning || state.scanning}
          onScan={() => void scan()}
          onEnter={() => void enter()}
        />
      )}
      {toast && <Toast message={toast.message} error={toast.error} />}
    </div>
  )
}
