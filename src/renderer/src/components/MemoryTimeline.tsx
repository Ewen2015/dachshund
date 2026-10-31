import type { MemorySummary } from '../../../shared/types'
import { categoryDefinition, type MemoryCategoryId } from '../../../shared/memory-taxonomy'
import { MemoryCard } from './MemoryCard'

export function MemoryTimeline({
  category,
  memories,
  selectedId,
  onSelect
}: {
  category: MemoryCategoryId | null
  memories: MemorySummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const label = category ? categoryDefinition(category).label : 'All memories'

  return (
    <section className="memory-timeline">
      <div className="timeline-toolbar">
        <strong>
          {label} · {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
        </strong>
        <span>Newest first</span>
      </div>
      {memories.length ? (
        <div className="group-items">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              selected={selectedId === memory.id}
              onSelect={() => onSelect(memory.id)}
            />
          ))}
        </div>
      ) : (
        <div className="timeline-empty">No memories in this category.</div>
      )}
    </section>
  )
}
