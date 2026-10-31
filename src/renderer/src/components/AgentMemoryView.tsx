import { useState, type CSSProperties } from 'react'
import type { AgentSummary, MemorySummary } from '../../../shared/types'
import {
  MEMORY_CATEGORIES,
  agentMemoryModel,
  categoryDefinition,
  categoryForKind,
  kindLabel,
  type MemoryCategoryId
} from '../../../shared/memory-taxonomy'
import { AgentFilterBar } from './AgentFilterBar'
import { AgentLogo } from './AgentLogo'
import { CategoryLegend } from './CategoryLegend'
import { FolderIcon } from './Icons'
import { MemoryTimeline } from './MemoryTimeline'

export function AgentMemoryView({
  agent,
  agents,
  memories,
  selectedId,
  onSelect,
  onBack,
  onOpenAgent,
  onScan,
  scanning
}: {
  agent: AgentSummary
  agents: AgentSummary[]
  memories: MemorySummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onBack: () => void
  onOpenAgent: (id: string) => void
  onScan: () => void
  scanning: boolean
}) {
  const [category, setCategory] = useState<MemoryCategoryId | null>(null)
  const model = agentMemoryModel(agent.id)

  const categoryCounts = Object.fromEntries(
    MEMORY_CATEGORIES.map((item) => [
      item.id,
      memories.filter((memory) => categoryForKind(memory.kind) === item.id).length
    ])
  ) as Record<MemoryCategoryId, number>
  const visible = [...memories]
    .filter((memory) => category === null || categoryForKind(memory.kind) === category)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="agent-memory-view">
      <button className="back-link" type="button" onClick={onBack}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="m15 18-6-6 6-6" />
        </svg>
        All memory
      </button>

      <p className="eyebrow">
        <span className="eyebrow-dot" />
        Agent memory model
      </p>
      <div className="agent-memory-hero">
        <div className="agent-hero-logo">
          <AgentLogo agentId={agent.id} agentName={agent.name} size={42} />
        </div>
        <div>
          <h1>{agent.name} memory</h1>
          <p>{agent.description || model.summary}</p>
        </div>
      </div>

      <section className="native-model">
        <div className="native-model-intro">
          <small>Native classification</small>
          <h2>{model.title}</h2>
          <p>{model.summary}</p>
          <div className="native-path">
            <FolderIcon size={13} />
            <span>{model.path}</span>
          </div>
        </div>
        <div className="mapping-list">
          {model.mappings.map((mapping) => {
            const target = categoryDefinition(mapping.category)
            return (
              <div
                className={`mapping-row ${mapping.imported ? '' : 'not-imported'}`}
                key={`${mapping.native}-${mapping.category}-${mapping.kinds.join('-')}`}
              >
                <div>
                  <span
                    className="native-kind"
                    style={{ '--mapping-color': target.color } as CSSProperties}
                  >
                    {mapping.native}
                  </span>
                  <span className="mapping-description">{mapping.description}</span>
                </div>
                <div className="mapping-arrow" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 12h14M14 7l5 5-5 5" />
                  </svg>
                </div>
                <div className="mapped-kind" style={{ '--mapping-color': target.color } as CSSProperties}>
                  {!mapping.imported && <span className="mapping-state">Not imported</span>}
                  <strong>{target.label}</strong>
                  <span>{mapping.kinds.map(kindLabel).join(' / ')}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="memory-section-label">
        <span>Category legend</span>
      </div>
      <CategoryLegend
        counts={categoryCounts}
        selected={category}
        onSelect={setCategory}
      />

      <AgentFilterBar
        agents={agents}
        activeAgentId={agent.id}
        onOpenAgent={onOpenAgent}
        onAll={onBack}
        onScan={onScan}
        scanning={scanning}
      />

      {scanning && (
        <div className="scan-strip">
          <span className="scan-pulse" />
          Reading memory files in place. Nothing is moved.
        </div>
      )}

      <MemoryTimeline
        category={category}
        memories={visible}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}
