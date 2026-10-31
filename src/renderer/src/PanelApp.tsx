import { useEffect, useState } from 'react'
import type { AppState, MemorySummary } from '../../shared/types'
import {
  MEMORY_CATEGORIES,
  categoryDefinition,
  categoryForKind,
  type MemoryCategoryId
} from '../../shared/memory-taxonomy'
import { AgentStack } from './components/AgentStack'
import { AgentLogo } from './components/AgentLogo'
import { PanelPulse } from './components/PanelPulse'
import {
  ArrowUpRightIcon,
  CheckIcon,
  CloseIcon,
  LockIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon
} from './components/Icons'
import { Mark } from './components/Mark'
import { UpdateNotice } from './components/UpdateNotice'
import { kindLabel, relativeTime, uniqueSources } from './lib/format'
import { useUpdater } from './lib/useUpdater'

type Tab = 'memory' | 'pulse' | 'agents'

export default function PanelApp() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('memory')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MemoryCategoryId | null>(null)
  const [memories, setMemories] = useState<MemorySummary[]>([])
  const [showAllAgents, setShowAllAgents] = useState(false)
  const [scanning, setScanning] = useState(false)
  const updater = useUpdater()

  useEffect(() => {
    document.documentElement.classList.add('panel-mode')
    document.body.classList.add('panel-mode')
    void (async () => {
      const initial = await window.dachshund.getState()
      setState(initial)
      setMemories(initial.memories.slice(0, 24))
    })()
    const offState = window.dachshund.onStateChanged((next) => {
      setState(next)
      setMemories(next.memories.slice(0, 24))
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void window.dachshund.hidePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('panel-mode')
      document.documentElement.classList.remove('panel-mode')
      offState()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const list = await window.dachshund.search({ query, limit: 24 })
        setMemories(list.slice(0, 24))
      })()
    }, 140)
    return () => window.clearTimeout(timer)
  }, [query])

  if (!state) return <div className="panel-shell loading-shell" />

  const installed = state.agents.filter((agent) => agent.installed)
  const categoryCounts = Object.fromEntries(
    MEMORY_CATEGORIES.map((item) => [
      item.id,
      memories.filter((memory) => categoryForKind(memory.kind) === item.id).length
    ])
  ) as Record<MemoryCategoryId, number>
  const visibleMemories = memories
    .filter((memory) => category === null || categoryForKind(memory.kind) === category)
    .slice(0, 8)
  const agentsWithMemory = installed.filter((agent) => agent.memoryCount > 0)
  const agentsWithoutMemory = installed.filter((agent) => agent.memoryCount === 0)
  const visibleAgents = showAllAgents
    ? installed
    : agentsWithMemory.length
      ? agentsWithMemory
      : agentsWithoutMemory
  const hiddenAgentCount = installed.length - visibleAgents.length

  const scan = async () => {
    setScanning(true)
    try {
      const next = await window.dachshund.scan()
      setState(next)
      setMemories(next.memories.slice(0, 24))
    } finally {
      setScanning(false)
    }
  }

  const toggleAgent = async (id: string, shared: boolean) => {
    const next = await window.dachshund.setAgentShared(id, shared)
    setState(next)
  }

  return (
    <div className="panel-shell">
      <header className="panel-head">
        <div className="panel-brand">
          <Mark size={18} />
          <span>dachshund</span>
        </div>
        <div className="panel-tools">
          <button
            className={`panel-icon-button ${scanning ? 'spinning' : ''}`}
            type="button"
            aria-label="Scan agents"
            title="Scan agents"
            onClick={() => void scan()}
            disabled={scanning}
          >
            <RefreshIcon size={13} />
          </button>
          <button
            className="panel-icon-button"
            type="button"
            aria-label="Open dachshund"
            title="Open full app"
            onClick={() => void window.dachshund.openMain()}
          >
            <ArrowUpRightIcon size={13} />
          </button>
          <button
            className="panel-icon-button"
            type="button"
            aria-label="Close panel"
            title="Close"
            onClick={() => void window.dachshund.hidePanel()}
          >
            <CloseIcon size={12} />
          </button>
        </div>
      </header>

      {updater.visible && updater.state && (
        <UpdateNotice
          update={updater.state}
          compact
          onDownload={() => void updater.download()}
          onOpenDownloaded={() => void updater.openDownloaded()}
          onDismiss={updater.dismiss}
        />
      )}

      <div className="panel-tabs">
        <button
          type="button"
          className={`panel-tab ${tab === 'memory' ? 'active' : ''}`}
          onClick={() => setTab('memory')}
        >
          Memory
        </button>
        <button
          type="button"
          className={`panel-tab ${tab === 'pulse' ? 'active' : ''}`}
          onClick={() => setTab('pulse')}
        >
          Pulse
        </button>
        <button
          type="button"
          className={`panel-tab ${tab === 'agents' ? 'active' : ''}`}
          onClick={() => setTab('agents')}
        >
          Agents
        </button>
        <span className="panel-tab-count">
          {tab === 'memory'
            ? `${state.counts.memories} memories`
            : tab === 'pulse'
              ? `${state.counts.echoes} echoes`
              : `${installed.length} found`}
        </span>
      </div>

      {tab === 'memory' && (
        <>
          <div className="panel-search-row">
            <label className="panel-search">
              <SearchIcon size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your memory"
                aria-label="Search memory in compact panel"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  <CloseIcon size={10} />
                </button>
              )}
            </label>
          </div>
          <div className="panel-categories" role="tablist" aria-label="Memory categories">
            <button
              type="button"
              className={`panel-category ${category === null ? 'active' : ''}`}
              onClick={() => setCategory(null)}
            >
              <i />
              <span>All</span>
            </button>
            {MEMORY_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`panel-category ${category === item.id ? 'active' : ''}`}
                onClick={() => setCategory(item.id)}
                title={`${item.label}: ${categoryCounts[item.id]}`}
              >
                <i style={{ background: item.color }} />
                <span>{item.shortLabel}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="panel-body">
        {tab === 'pulse' && (
          <PanelPulse
            memories={state.memories}
            agents={state.agents}
            onOpenCategory={(nextCategory) => {
              setCategory(nextCategory)
              setTab('memory')
            }}
          />
        )}

        {tab === 'memory' && (
          <>
            {visibleMemories.length === 0 ? (
              <div className="panel-empty">
                <Mark size={36} />
                <strong>{query || category ? 'Nothing in this view' : 'No memories yet'}</strong>
                <span>
                  {query || category
                    ? 'Try another search or category.'
                    : 'Scan an agent or write the first note.'}
                </span>
              </div>
            ) : (
              visibleMemories.map((memory) => {
                const sources = uniqueSources(memory.sources)
                const memoryCategory = categoryDefinition(categoryForKind(memory.kind))
                return (
                  <button
                    className="panel-memory"
                    type="button"
                    key={memory.id}
                    onClick={() => void window.dachshund.openMain({ memoryId: memory.id })}
                  >
                    <div className="pm-meta">
                      <AgentStack sources={sources} size={15} />
                      <span className="pm-category">
                        <i style={{ background: memoryCategory.color }} />
                        {memoryCategory.shortLabel}
                      </span>
                      <span>{kindLabel(memory.kind)}</span>
                      <span className="pm-time">{relativeTime(memory.updatedAt)}</span>
                      {memory.echoCount > 1 && <span className="pm-echo">{memory.echoCount} agents</span>}
                    </div>
                    <h3>{memory.title}</h3>
                    <p>{memory.excerpt}</p>
                  </button>
                )
              })
            )}
          </>
        )}

        {tab === 'agents' && (
          <div className="panel-agents">
            {visibleAgents.map((agent) => (
              <div className="panel-agent" key={agent.id}>
                <AgentLogo
                  agentId={agent.id}
                  agentName={agent.name}
                  size={22}
                  className="panel-agent-tile"
                />
                <div className="panel-agent-copy">
                  <strong>{agent.name}</strong>
                  <small>
                    {agent.memoryCount} memories · {agent.mcpInstalled ? 'MCP on' : 'read-only'}
                  </small>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={agent.shared}
                  aria-label={`Share ${agent.name} memory`}
                  className={`switch ${agent.shared ? 'on' : ''}`}
                  onClick={() => void toggleAgent(agent.id, !agent.shared)}
                >
                  <span />
                </button>
              </div>
            ))}
            {hiddenAgentCount > 0 && (
              <button
                type="button"
                className="panel-agent-more"
                onClick={() => setShowAllAgents(true)}
              >
                Show {hiddenAgentCount} other {hiddenAgentCount === 1 ? 'agent' : 'agents'}
              </button>
            )}
            {showAllAgents && agentsWithoutMemory.length > 0 && (
              <button
                type="button"
                className="panel-agent-more"
                onClick={() => setShowAllAgents(false)}
              >
                Hide agents without memory
              </button>
            )}
            <div className="panel-tip">
              <CheckIcon size={12} />
              <span>dachshund reads these files in place. Toggle one off to pause it.</span>
            </div>
          </div>
        )}
      </div>

      <footer className="panel-foot">
        <span className="panel-local">
          <LockIcon size={11} />
          Local only
        </span>
        <button
          className="panel-new"
          type="button"
          onClick={() => void window.dachshund.openMain({ action: 'new' })}
        >
          <PlusIcon size={12} />
          New memory
        </button>
      </footer>
    </div>
  )
}
