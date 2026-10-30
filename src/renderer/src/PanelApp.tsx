import { useEffect, useState } from 'react'
import type { AppState, MemorySummary } from '../../shared/types'
import { AgentStack } from './components/AgentStack'
import { AgentLogo } from './components/AgentLogo'
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
import { kindLabel, relativeTime, uniqueSources } from './lib/format'

type Tab = 'memory' | 'agents'

export default function PanelApp() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('memory')
  const [query, setQuery] = useState('')
  const [memories, setMemories] = useState<MemorySummary[]>([])
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('panel-mode')
    document.body.classList.add('panel-mode')
    void (async () => {
      const initial = await window.dachshund.getState()
      setState(initial)
      setMemories(initial.memories.slice(0, 8))
    })()
    const offState = window.dachshund.onStateChanged((next) => {
      setState(next)
      setMemories(next.memories.slice(0, 8))
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
        setMemories(list.slice(0, 8))
      })()
    }, 140)
    return () => window.clearTimeout(timer)
  }, [query])

  if (!state) return <div className="panel-shell loading-shell" />

  const installed = state.agents.filter((agent) => agent.installed)

  const scan = async () => {
    setScanning(true)
    try {
      const next = await window.dachshund.scan()
      setState(next)
      setMemories(next.memories.slice(0, 8))
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
          className={`panel-tab ${tab === 'agents' ? 'active' : ''}`}
          onClick={() => setTab('agents')}
        >
          Agents
        </button>
        <span className="panel-tab-count">
          {tab === 'memory' ? `${state.counts.memories} memories` : `${installed.length} found`}
        </span>
      </div>

      {tab === 'memory' && (
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
      )}

      <div className="panel-body">
        {tab === 'memory' && (
          <>
            {memories.length === 0 ? (
              <div className="panel-empty">
                <Mark size={36} />
                <strong>{query ? 'Nothing found' : 'No memories yet'}</strong>
                <span>{query ? 'Try another phrase.' : 'Scan an agent or write the first note.'}</span>
              </div>
            ) : (
              memories.map((memory) => {
                const sources = uniqueSources(memory.sources)
                return (
                  <button
                    className="panel-memory"
                    type="button"
                    key={memory.id}
                    onClick={() => void window.dachshund.openMain({ memoryId: memory.id })}
                  >
                    <div className="pm-meta">
                      <AgentStack sources={sources} size={15} />
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
            {installed.map((agent) => (
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
