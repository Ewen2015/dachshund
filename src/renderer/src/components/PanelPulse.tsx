import { useMemo, useState } from 'react'
import type { AgentSummary, MemorySummary } from '../../../shared/types'
import {
  MEMORY_CATEGORIES,
  categoryForKind,
  type MemoryCategoryId
} from '../../../shared/memory-taxonomy'
import { accentFor, uniqueSources } from '../lib/format'
import { AgentLogo } from './AgentLogo'

type PanelRange = '7d' | '30d' | 'all'

const DAY = 86_400_000

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function niceMaximum(value: number): number {
  if (value <= 2) return 2
  if (value <= 4) return 4
  if (value <= 6) return 6
  return Math.ceil(value / 5) * 5
}

function medianAge(memories: MemorySummary[]): string {
  if (!memories.length) return '0d'
  const ages = memories
    .map((memory) => Math.max(0, Date.now() - memory.updatedAt))
    .sort((a, b) => a - b)
  const median = ages[Math.floor(ages.length / 2)]
  const days = Math.floor(median / DAY)
  return days < 30 ? `${days}d` : `${Math.max(1, Math.floor(days / 30))}mo`
}

export function PanelPulse({
  memories,
  agents,
  onOpenCategory
}: {
  memories: MemorySummary[]
  agents: AgentSummary[]
  onOpenCategory: (category: MemoryCategoryId) => void
}) {
  const [range, setRange] = useState<PanelRange>('30d')

  const visible = useMemo(() => {
    if (range === 'all') return memories
    const days = range === '7d' ? 7 : 30
    const start = startOfDay(Date.now()) - (days - 1) * DAY
    return memories.filter((memory) => memory.createdAt >= start)
  }, [memories, range])

  const buckets = useMemo(() => {
    if (range === '7d') {
      const start = startOfDay(Date.now()) - 6 * DAY
      return Array.from({ length: 7 }, (_, index) => {
        const bucketStart = start + index * DAY
        const items = visible.filter(
          (memory) => memory.createdAt >= bucketStart && memory.createdAt < bucketStart + DAY
        )
        return {
          label: new Intl.DateTimeFormat('en', { weekday: 'narrow' }).format(bucketStart),
          total: items.length,
          shared: items.filter((memory) => memory.echoCount > 1).length
        }
      })
    }

    const earliest = visible.length
      ? Math.min(...visible.map((memory) => memory.createdAt))
      : Date.now()
    const step =
      range === '30d'
        ? 3
        : Math.max(1, Math.ceil((Date.now() - earliest) / DAY / 8))
    const count = range === '30d' ? 10 : 8
    const start =
      range === '30d'
        ? startOfDay(Date.now()) - (count - 1) * step * DAY
        : startOfDay(earliest)
    return Array.from({ length: count }, (_, index) => {
      const bucketStart = start + index * step * DAY
      const bucketEnd = bucketStart + step * DAY
      const items = visible.filter(
        (memory) => memory.createdAt >= bucketStart && memory.createdAt < bucketEnd
      )
      return {
        label:
          index === 0 || index === count - 1
            ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(bucketStart)
            : '',
        total: items.length,
        shared: items.filter((memory) => memory.echoCount > 1).length
      }
    })
  }, [range, visible])

  const maximum = niceMaximum(Math.max(1, ...buckets.map((bucket) => bucket.total)))
  const echoes = visible.filter((memory) => memory.echoCount > 1).length
  const categoryCounts = MEMORY_CATEGORIES.map((category) => ({
    ...category,
    count: visible.filter((memory) => categoryForKind(memory.kind) === category.id).length
  }))
  const activeAgentIds = new Set(
    visible.flatMap((memory) => uniqueSources(memory.sources).map((source) => source.agentId))
  )
  const agentCounts = new Map<string, number>()
  for (const memory of visible) {
    for (const source of uniqueSources(memory.sources)) {
      agentCounts.set(source.agentId, (agentCounts.get(source.agentId) ?? 0) + 1)
    }
  }
  const topAgents = [...agentCounts.entries()]
    .map(([id, count]) => ({
      id,
      count,
      name: agents.find((agent) => agent.id === id)?.name ?? id
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  const topTotal = Math.max(1, ...topAgents.map((agent) => agent.count))

  return (
    <div className="panel-pulse">
      <div className="panel-pulse-range" role="group" aria-label="Pulse range">
        {(
          [
            ['7d', '7D'],
            ['30d', '30D'],
            ['all', 'All']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={range === key ? 'active' : ''}
            aria-pressed={range === key}
            onClick={() => setRange(key)}
          >
            {label}
          </button>
        ))}
        <span>Memory pulse</span>
      </div>

      <div className="panel-pulse-stats">
        <div>
          <span>Memories</span>
          <strong>{visible.length}</strong>
        </div>
        <div>
          <span>Echoes</span>
          <strong>{echoes}</strong>
        </div>
        <div>
          <span>Agents</span>
          <strong>{activeAgentIds.size}</strong>
        </div>
        <div>
          <span>Median age</span>
          <strong>{medianAge(visible)}</strong>
        </div>
      </div>

      <section className="panel-pulse-card panel-pulse-categories">
        <div className="panel-pulse-card-head">
          <strong>Category mix</strong>
          <span>Click to filter</span>
        </div>
        {visible.length ? (
          <>
            <div
              className="panel-pulse-category-bar"
              role="img"
              aria-label="Memory distribution across the five categories"
            >
              {categoryCounts
                .filter((category) => category.count > 0)
                .map((category) => (
                  <span
                    key={category.id}
                    title={`${category.label}: ${category.count}`}
                    style={{
                      width: `${(category.count / visible.length) * 100}%`,
                      background: category.color
                    }}
                  />
                ))}
            </div>
            <div className="panel-pulse-category-list">
              {categoryCounts.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => onOpenCategory(category.id)}
                >
                  <i style={{ background: category.color }} />
                  <span>{category.shortLabel}</span>
                  <strong>{category.count}</strong>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="panel-pulse-empty">No memories in this range.</p>
        )}
      </section>

      <section className="panel-pulse-card">
        <div className="panel-pulse-card-head">
          <strong>Memory added</strong>
          <span>shared / single</span>
        </div>
        <div className="panel-pulse-chart" role="img" aria-label={`${visible.length} memories in the selected range`}>
          {buckets.map((bucket, index) => (
            <div key={index} className="panel-pulse-column">
              <div className="panel-pulse-stack" title={`${bucket.total} memories`}>
                {bucket.total > 0 && (
                  <>
                    <span
                      className="single"
                      style={{ height: `${((bucket.total - bucket.shared) / maximum) * 100}%` }}
                    />
                    <span
                      className="shared"
                      style={{ height: `${(bucket.shared / maximum) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <small>{bucket.label}</small>
            </div>
          ))}
        </div>
        <div className="panel-pulse-legend">
          <span><i className="shared" /> Shared {echoes}</span>
          <span><i className="single" /> Single {Math.max(0, visible.length - echoes)}</span>
        </div>
      </section>

      <section className="panel-pulse-card panel-pulse-agents">
        <div className="panel-pulse-card-head">
          <strong>Agent contribution</strong>
          <span>{visible.length} memories</span>
        </div>
        {topAgents.length ? (
          topAgents.map((agent) => (
            <div className="panel-pulse-agent" key={agent.id}>
              <AgentLogo
                agentId={agent.id}
                agentName={agent.name}
                size={17}
                shape="circle"
              />
              <span>{agent.name}</span>
              <div>
                <i
                  style={{
                    width: `${(agent.count / topTotal) * 100}%`,
                    background: accentFor(agent.id)
                  }}
                />
              </div>
              <strong>{agent.count}</strong>
            </div>
          ))
        ) : (
          <p className="panel-pulse-empty">No memories in this range.</p>
        )}
      </section>

      <p className="panel-pulse-note">Provenance, overlap and freshness only. No recall telemetry.</p>
    </div>
  )
}
