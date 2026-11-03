import type { AgentSummary, Counts, ScanProgress } from '../../../shared/types'
import { AgentLogo } from './AgentLogo'
import { CheckIcon, RefreshIcon, ShieldIcon } from './Icons'
import { sortAgentsByMemory } from '../lib/format'

export function AgentsView({
  agents,
  counts,
  scanning,
  progress,
  onScan,
  onToggleShared,
  onInstallMcp,
  onReveal
}: {
  agents: AgentSummary[]
  counts: Counts
  scanning: boolean
  progress: Record<string, ScanProgress>
  onScan: () => void
  onToggleShared: (id: string, shared: boolean) => void
  onInstallMcp: (id: string) => void
  onReveal: (path: string) => void
}) {
  const installed = agents.filter((agent) => agent.installed)
  const sharing = installed.filter((agent) => agent.shared)
  const memories = counts.memories
  const sortedAgents = sortAgentsByMemory(agents)

  return (
    <div className="page agents-page">
      <section className="page-head">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Local discovery
        </p>
        <div className="page-title-row">
          <h1>The agents on this Mac.</h1>
          <button className="ghost-button" type="button" onClick={onScan} disabled={scanning}>
            <RefreshIcon size={14} />
            {scanning ? 'Scanning…' : 'Scan again'}
          </button>
        </div>
        <p className="page-copy">
          dachshund reads their memory files in place. Nothing is moved, rewritten, or uploaded.
        </p>
      </section>

      <div className="agent-summary">
        <div>
          <strong>{installed.length}</strong>
          <span>found</span>
        </div>
        <div>
          <strong>{sharing.length}</strong>
          <span>sharing</span>
        </div>
        <div>
          <strong>{memories}</strong>
          <span>memories</span>
        </div>
        <div className="summary-note">
          <ShieldIcon size={16} />
          <span>Read-only until you connect an agent over MCP.</span>
        </div>
      </div>

      <div className="agent-list">
        {sortedAgents.map((agent) => {
          const state = progress[agent.id]
          return (
            <div
              className={`agent-row ${agent.installed ? '' : 'missing'}`}
              key={agent.id}
            >
              <div className="agent-tile">
                <AgentLogo
                  agentId={agent.id}
                  agentName={agent.name}
                  size={22}
                  muted={!agent.installed}
                />
                <span className={`agent-status ${agent.installed ? 'on' : ''}`} />
              </div>
              <div className="agent-copy">
                <div className="agent-name-line">
                  <h3>{agent.name}</h3>
                  <span className="agent-kind">{agent.kind}</span>
                  {state?.status === 'scanning' && <span className="agent-reading">reading…</span>}
                  {state?.status === 'ready' && state.memories !== undefined && (
                    <span className="agent-reading ready">+{state.memories} found</span>
                  )}
                </div>
                <p>{agent.description ?? (agent.installed ? 'Memory source available' : 'Not found on this Mac')}</p>
                <button
                  type="button"
                  className="agent-path"
                  onClick={() => agent.home && onReveal(agent.home)}
                  disabled={!agent.home}
                  title={agent.home ?? ''}
                >
                  {agent.home ? agent.home.replace(/^\/Users\/[^/]+/, '~') : 'No local directory'}
                </button>
              </div>
              <div className="agent-numbers">
                <strong>{agent.memoryCount}</strong>
                <span>memories</span>
                <small>{agent.sourceCount} sources</small>
              </div>
              <div className="agent-controls">
                <button
                  type="button"
                  role="switch"
                  aria-checked={agent.shared}
                  aria-label={`Share ${agent.name} memory`}
                  className={`switch ${agent.shared ? 'on' : ''}`}
                  disabled={!agent.installed}
                  onClick={() => onToggleShared(agent.id, !agent.shared)}
                >
                  <span />
                </button>
                <button
                  type="button"
                  className={`mcp-button ${agent.mcpInstalled ? 'connected' : ''}`}
                  disabled={!agent.installed || !agent.mcpMode}
                  onClick={() => onInstallMcp(agent.id)}
                  title={
                    agent.mcpMode === 'manual'
                      ? 'Doubao stores MCP connectors in its app. Open the setup guide.'
                      : undefined
                  }
                >
                  {agent.mcpInstalled ? (
                    <>
                      <CheckIcon size={13} />
                      MCP on
                    </>
                  ) : agent.mcpMode === 'manual' ? (
                    'Set up MCP'
                  ) : agent.mcpMode === 'config' ? (
                    'Connect MCP'
                  ) : (
                    'Import only'
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <section className="how-it-works">
        <p className="section-label">
          <span>How sharing works</span>
        </p>
        <div className="how-grid">
          <div>
            <span className="how-number">01</span>
            <h3>Read in place</h3>
            <p>Existing memory files stay exactly where they are. dachshund builds a local index.</p>
          </div>
          <div>
            <span className="how-number">02</span>
            <h3>Deduplicate</h3>
            <p>When two agents know the same thing, one memory keeps both sources as echoes.</p>
          </div>
          <div>
            <span className="how-number">03</span>
            <h3>Share forward</h3>
            <p>Connect over MCP and every agent reads and writes the same local memory.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
