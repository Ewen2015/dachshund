import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
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
import { agentMemoryDiagram } from '../lib/agent-memory-diagrams'

export function AgentMemoryView({
  agent,
  agents,
  memories,
  activeCategory,
  onCategory,
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
  activeCategory: MemoryCategoryId | null
  onCategory: (category: MemoryCategoryId | null) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onBack: () => void
  onOpenAgent: (id: string) => void
  onScan: () => void
  scanning: boolean
}) {
  const [diagramOpen, setDiagramOpen] = useState(false)
  const closeDiagramRef = useRef<HTMLButtonElement>(null)
  const model = agentMemoryModel(agent.id)
  const diagram = agentMemoryDiagram(agent.id)

  useEffect(() => {
    if (!diagramOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDiagramOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    closeDiagramRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [diagramOpen])

  const categoryCounts = Object.fromEntries(
    MEMORY_CATEGORIES.map((item) => [
      item.id,
      memories.filter((memory) => categoryForKind(memory.kind) === item.id).length
    ])
  ) as Record<MemoryCategoryId, number>
  const visible = [...memories]
    .filter(
      (memory) =>
        activeCategory === null || categoryForKind(memory.kind) === activeCategory
    )
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

      <section
        className={`native-model ${diagram ? 'has-diagram' : ''} ${
          model.mappings.length > 6 ? 'has-long-mappings' : ''
        }`}
      >
        <div className="native-model-overview">
          {diagram && (
            <figure className="native-model-diagram">
              <div className="native-model-diagram-head">
                <span className="native-model-diagram-label">Memory mechanism</span>
                <span className="native-model-diagram-flow">{diagram.flow}</span>
              </div>
              <button
                className="native-model-diagram-trigger"
                type="button"
                onClick={() => setDiagramOpen(true)}
                aria-label={`Enlarge ${agent.name} memory mechanism`}
              >
                <img src={diagram.src} alt="" draggable={false} />
                <span className="native-model-zoom-hint" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4M11 8v6M8 11h6" />
                  </svg>
                  View larger
                </span>
              </button>
            </figure>
          )}
          <div className="native-model-intro">
            <small>Native classification</small>
            <h2>{model.title}</h2>
            <p>{model.summary}</p>
            <div className="native-path">
              <FolderIcon size={13} />
              <span>{model.path}</span>
            </div>
          </div>
        </div>
        <div className="mapping-list">
          <div className="mapping-axis-head" aria-hidden="true">
            <span>{agent.name} classification</span>
            <span />
            <span>dachshund memory</span>
          </div>
          {MEMORY_CATEGORIES.map((category) => {
            const mappings = model.mappings.filter((mapping) => mapping.category === category.id)
            const target = categoryDefinition(category.id)
            return (
              <div
                className={`mapping-row ${mappings.length === 0 ? 'is-empty' : ''}`}
                key={category.id}
                aria-label={
                  mappings.length === 0
                    ? `${category.label}: no native equivalent`
                    : `${category.label}: ${mappings.map((mapping) => mapping.native).join(', ')}`
                }
              >
                <div className="mapping-source-list">
                  {mappings.map((mapping) => (
                    <div
                      className={`mapping-source ${mapping.imported ? '' : 'not-imported'}`}
                      key={`${mapping.native}-${mapping.kinds.join('-')}`}
                    >
                      <div className="native-kind-line">
                        <span
                          className="native-kind"
                          style={{ '--mapping-color': target.color } as CSSProperties}
                        >
                          {mapping.native}
                        </span>
                        {!mapping.imported && <span className="mapping-state">Not imported</span>}
                      </div>
                      <span className="mapping-description">{mapping.description}</span>
                    </div>
                  ))}
                </div>
                <div className="mapping-arrow" aria-hidden="true">
                  {mappings.length > 0 && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 12h14M14 7l5 5-5 5" />
                    </svg>
                  )}
                </div>
                <div className="mapped-kind" style={{ '--mapping-color': target.color } as CSSProperties}>
                  <strong>{target.label}</strong>
                  <span>{target.kinds.map(kindLabel).join(' / ')}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {diagram &&
        diagramOpen &&
        createPortal(
          <div
            className="diagram-lightbox"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDiagramOpen(false)
            }}
          >
            <div
              className="diagram-lightbox-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="diagram-lightbox-title"
            >
              <div className="diagram-lightbox-head">
                <div>
                  <span className="native-model-diagram-label">Memory mechanism</span>
                  <h2 id="diagram-lightbox-title">{agent.name}</h2>
                </div>
                <button
                  ref={closeDiagramRef}
                  className="diagram-lightbox-close"
                  type="button"
                  onClick={() => setDiagramOpen(false)}
                  aria-label="Close enlarged diagram"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <p className="diagram-lightbox-flow">{diagram.flow}</p>
              <img src={diagram.src} alt={diagram.alt} draggable={false} />
            </div>
          </div>,
          document.body
        )}

      <div className="memory-section-label">
        <span>Category legend</span>
      </div>
      <CategoryLegend
        counts={categoryCounts}
        selected={activeCategory}
        onSelect={onCategory}
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
        category={activeCategory}
        memories={visible}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}
