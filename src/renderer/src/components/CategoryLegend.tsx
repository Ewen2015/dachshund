import type { CSSProperties } from 'react'
import {
  MEMORY_CATEGORIES,
  type MemoryCategoryId
} from '../../../shared/memory-taxonomy'

export function CategoryLegend({
  counts,
  selected,
  onSelect
}: {
  counts: Record<MemoryCategoryId, number>
  selected: MemoryCategoryId | null
  onSelect: (category: MemoryCategoryId | null) => void
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return (
    <div className="category-legend" role="tablist" aria-label="Memory categories">
      <span className="category-legend-label">Filter</span>
      <button
        type="button"
        className={`category-legend-item ${selected === null ? 'active' : ''}`}
        style={{ '--category-color': '#28282B' } as CSSProperties}
        onClick={() => onSelect(null)}
      >
        <i />
        <strong>All</strong>
        <small>{total}</small>
      </button>
      {MEMORY_CATEGORIES.filter(
        (category) => (counts[category.id] ?? 0) > 0 || selected === category.id
      ).map((category) => (
        <button
          key={category.id}
          type="button"
          className={`category-legend-item ${selected === category.id ? 'active' : ''}`}
          style={{ '--category-color': category.color } as CSSProperties}
          onClick={() => onSelect(category.id)}
        >
          <i />
          <strong>{category.label}</strong>
          <small>{counts[category.id] ?? 0}</small>
        </button>
      ))}
    </div>
  )
}
