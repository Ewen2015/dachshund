import type { AgentSummary, Counts, MemorySummary } from '../../../shared/types'
import {
  MEMORY_CATEGORIES,
  categoryForKind,
  type MemoryCategoryId
} from '../../../shared/memory-taxonomy'
import { AgentFilterBar } from './AgentFilterBar'
import { CategoryLegend } from './CategoryLegend'
import { Mark } from './Mark'
import { MemoryTimeline } from './MemoryTimeline'
import { SparkIcon } from './Icons'

export function MemoryFeed({
  memories,
  agents,
  counts,
  activeAgentId,
  activeCategory,
  onCategory,
  onOpenAgent,
  onOpenAllAgents,
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
  activeAgentId: string | null
  activeCategory: MemoryCategoryId | null
  onCategory: (category: MemoryCategoryId | null) => void
  onOpenAgent: (id: string) => void
  onOpenAllAgents: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onScan: () => void
  scanning: boolean
  query: string
  onClearQuery: () => void
}) {
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
    <div className="feed">
      <section className="hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Local memory, by meaning
        </p>
        <h1>What your agents remember, in one local timeline.</h1>
        <p className="hero-copy">
          Every memory sits in one newest-first feed. Category and kind stay visible, and each item
          remains traceable to the agent and file that produced it.
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
            <span className="stat-number">{MEMORY_CATEGORIES.length}</span>
            <span className="stat-label">categories</span>
          </div>
          <div className="stat-note">
            <SparkIcon size={14} />
            <span>The agent is provenance. Category and kind are both filing decisions.</span>
          </div>
        </div>
      </section>

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
        activeAgentId={activeAgentId}
        onOpenAgent={onOpenAgent}
        onAll={onOpenAllAgents}
        onScan={onScan}
        scanning={scanning}
      />

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
        <MemoryTimeline
          category={activeCategory}
          memories={visible}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
