import { useState } from 'react'
import type { AgentSummary } from '../../../shared/types'
import { AgentLogo } from './AgentLogo'
import { RefreshIcon } from './Icons'
import { sortAgentsByMemory } from '../lib/format'

export function AgentFilterBar({
  agents,
  activeAgentId,
  onOpenAgent,
  onAll,
  onScan,
  scanning
}: {
  agents: AgentSummary[]
  activeAgentId: string | null
  onOpenAgent: (id: string) => void
  onAll: () => void
  onScan: () => void
  scanning: boolean
}) {
  const [showEmpty, setShowEmpty] = useState(false)
  const installed = sortAgentsByMemory(agents.filter((agent) => agent.installed))
  const withMemory = installed.filter((agent) => agent.memoryCount > 0)
  const withoutMemory = installed.filter((agent) => agent.memoryCount === 0)
  const activeEmptyAgent = withoutMemory.find((agent) => agent.id === activeAgentId)
  const visibleEmpty = showEmpty
    ? withoutMemory
    : activeEmptyAgent
      ? [activeEmptyAgent]
      : []
  const hiddenCount = withoutMemory.length - visibleEmpty.length

  const renderAgent = (agent: AgentSummary) => (
    <button
      key={agent.id}
      type="button"
      className={`chip ${activeAgentId === agent.id ? 'active' : ''}`}
      onClick={() => onOpenAgent(agent.id)}
      aria-label={`Open ${agent.name} memory`}
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
      <small className="chip-count">{agent.memoryCount}</small>
    </button>
  )

  return (
    <div className="filter-row">
      <div className="chips" role="group" aria-label="Agents">
        <button
          type="button"
          className={`chip ${activeAgentId === null ? 'active' : ''}`}
          onClick={onAll}
        >
          All
        </button>
        {withMemory.map(renderAgent)}
        {visibleEmpty.map(renderAgent)}
        {withoutMemory.length > 0 && (hiddenCount > 0 || showEmpty) && (
          <button
            type="button"
            className="chip chip-more"
            onClick={() => setShowEmpty((value) => !value)}
            aria-expanded={showEmpty}
          >
            {showEmpty
              ? 'Show fewer'
              : `Show ${hiddenCount} other ${hiddenCount === 1 ? 'agent' : 'agents'}`}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>
        )}
      </div>
      <button className="text-button" type="button" onClick={onScan} disabled={scanning}>
        <RefreshIcon size={14} />
        {scanning ? 'Reading…' : 'Scan again'}
      </button>
    </div>
  )
}
