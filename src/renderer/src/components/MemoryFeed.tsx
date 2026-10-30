import type { AgentSummary, Counts, MemorySummary } from '../../../shared/types'
import { groupByLabel } from '../lib/format'
import { AgentLogo } from './AgentLogo'
import { MemoryCard } from './MemoryCard'
import { Mark } from './Mark'
import { RefreshIcon, SparkIcon } from './Icons'

export function MemoryFeed({
  memories,
  agents,
  counts,
  filter,
  onFilter,
  selectedId,
  onSelect,
  onNew,
  onScan,
  scanning,
  query,
  onClearQuery
}: {
  memories: MemorySummary[]
  agents: AgentSummary[]
  counts: Counts
  filter: string | null
  onFilter: (id: string | null) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onScan: () => void
  scanning: boolean
  query: string
  onClearQuery: () => void
}) {
  const groups = groupByLabel(memories)
  const installed = agents.filter((agent) => agent.installed)

  return (
    <div className="feed">
      <section className="hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          On this Mac
        </p>
        <h1>Everything your agents know.</h1>
        <p className="hero-copy">
          One quiet place for the decisions, preferences, and lessons your agents picked up.
          Read by all of them. Stored only here.
        </p>
        <div className="stats">
          <div className="stat">
            <span className="stat-number">{counts.memories}</span>
            <span className="stat-label">memories</span>
          </div>
          <div className="stat">
            <span className="stat-number">{counts.agents}</span>
            <span className="stat-label">agents</span>
          </div>
          <div className="stat">
            <span className="stat-number">{counts.echoes}</span>
            <span className="stat-label">cross-agent echoes</span>
          </div>
          <div className="stat-note">
            <SparkIcon size={14} />
            <span>When two agents remember the same thing, dachshund keeps one copy.</span>
          </div>
        </div>
      </section>

      <div className="filter-row">
        <div className="chips" role="tablist" aria-label="Filter by agent">
          <button
            type="button"
            className={`chip ${filter === null ? 'active' : ''}`}
            onClick={() => onFilter(null)}
          >
            All
          </button>
          {installed.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`chip ${filter === agent.id ? 'active' : ''}`}
              onClick={() => onFilter(agent.id)}
            >
              <AgentLogo
                agentId={agent.id}
                agentName={agent.name}
                size={14}
                shape="circle"
                className="chip-dot"
                decorative
              />
              {agent.name}
            </button>
          ))}
        </div>
        <button className="text-button" type="button" onClick={onScan} disabled={scanning}>
          <RefreshIcon size={14} />
          {scanning ? 'Reading…' : 'Scan again'}
        </button>
      </div>

      {scanning && (
        <div className="scan-strip">
          <span className="scan-pulse" />
          Reading memory files in place. Nothing is moved.
        </div>
      )}

      {memories.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">
            <Mark size={78} />
          </div>
          {query ? (
            <>
              <h2>No memories match “{query}”.</h2>
              <p>Try a project name, a preference, or a phrase you remember.</p>
              <button className="ghost-button" type="button" onClick={onClearQuery}>
                Clear search
              </button>
            </>
          ) : (
            <>
              <h2>Your memory starts here.</h2>
              <p>dachshund can read what your agents already remember — or you can write the first note.</p>
              <div className="empty-actions">
                <button className="primary-button" type="button" onClick={onScan}>
                  Scan my agents
                </button>
                <button className="ghost-button" type="button" onClick={onNew}>
                  Write a memory
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="timeline">
          {groups.map((group) => (
            <section className="timeline-group" key={group.label}>
              <div className="group-heading">
                <span>{group.label}</span>
                <span className="group-count">{group.items.length}</span>
              </div>
              <div className="group-items">
                {group.items.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    selected={selectedId === memory.id}
                    onSelect={() => onSelect(memory.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
