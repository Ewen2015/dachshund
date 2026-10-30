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
import { MemoryDetail } from './components/MemoryDetail'
import { MemoryFeed } from './components/MemoryFeed'
import { Onboarding } from './components/Onboarding'
import { PulseView } from './components/PulseView'
import { SettingsView } from './components/SettingsView'
import { Toast } from './components/Toast'
import { UpdateNotice } from './components/UpdateNotice'
import { useUpdater } from './lib/useUpdater'

type View = 'memory' | 'pulse' | 'agents' | 'settings'

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [view, setView] = useState<View>('memory')
  const [memories, setMemories] = useState<MemorySummary[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemoryDetailType | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<Record<string, ScanProgress>>({})
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)
  const [bridgePath, setBridgePath] = useState('')
  const updater = useUpdater()
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<number | null>(null)

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
    async (nextQuery = query, nextFilter = filter) => {
      const list = await window.dachshund.search({
        query: nextQuery,
        agentId: nextFilter ?? undefined,
        limit: 120
      })
      setMemories(list)
    },
    [filter, query]
  )

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
      void loadMemories(query, filter)
    }, 160)
    return () => window.clearTimeout(timer)
  }, [query, filter, loadMemories])

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
      if (event.key === 'Escape') {
        if (composerOpen) setComposerOpen(false)
        else if (detail) {
          setDetail(null)
          setSelectedId(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composerOpen, detail])

  const scan = async () => {
    if (scanning) return
    setScanning(true)
    setProgress({})
    try {
      const next = await window.dachshund.scan()
      setState(next)
      await loadMemories(query, filter)
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
    const memory = await window.dachshund.getMemory(id)
    setDetail(memory)
  }

  const save = async (input: CreateMemoryInput) => {
    try {
      const created = await window.dachshund.createMemory(input)
      setComposerOpen(false)
      const next = await refreshState()
      setState(next)
      await loadMemories('', filter)
      setQuery('')
      setSelectedId(created.id)
      setDetail(created)
      notify('Memory saved to your library')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save memory', true)
    }
  }

  const archive = async () => {
    if (!detail) return
    const ok = await window.dachshund.archiveMemory(detail.id)
    if (ok) {
      setDetail(null)
      setSelectedId(null)
      const next = await refreshState()
      setState(next)
      await loadMemories(query, filter)
      notify('Forgotten here — original agent files are untouched')
    }
  }

  const toggleShared = async (id: string, shared: boolean) => {
    const next = await window.dachshund.setAgentShared(id, shared)
    setState(next)
    notify(shared ? 'Sharing turned on' : 'Sharing paused')
  }

  const installMcp = async (id: string) => {
    const result = await window.dachshund.installMcp(id)
    notify(result.message, !result.ok)
    if (result.ok) {
      const next = await refreshState()
      setState(next)
    }
  }

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

  return (
    <div className="app-shell">
      <Header
        view={view}
        onView={setView}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        onNew={() => setComposerOpen(true)}
        onMinimize={() => void window.dachshund.minimizeToTray()}
        agents={state.counts.agents}
      />
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
          {view === 'memory' && (
            <MemoryFeed
              memories={memories}
              agents={state.agents}
              counts={state.counts}
              filter={filter}
              onFilter={setFilter}
              selectedId={selectedId}
              onSelect={(id) => void select(id)}
              onNew={() => setComposerOpen(true)}
              onScan={() => void scan()}
              scanning={scanning || state.scanning}
              query={query}
              onClearQuery={() => setQuery('')}
            />
          )}
          {view === 'pulse' && (
            <PulseView
              memories={state.memories}
              agents={state.agents}
              counts={state.counts}
              scanning={scanning || state.scanning}
              onScan={() => void scan()}
              onOpenMemory={(id) => {
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
          {view === 'settings' && (
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

      {detail && (
        <MemoryDetail
          memory={detail}
          onClose={() => {
            setDetail(null)
            setSelectedId(null)
          }}
          onArchive={() => void archive()}
          onReveal={(path) => void window.dachshund.reveal(path)}
          onToast={notify}
        />
      )}

      {composerOpen && <Composer onClose={() => setComposerOpen(false)} onSave={save} />}
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
