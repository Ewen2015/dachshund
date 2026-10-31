import { useMemo, useState } from 'react'
import type { AgentSummary, Counts, MemorySummary } from '../../../shared/types'
import {
  MEMORY_CATEGORIES,
  categoryForKind,
  type MemoryCategoryId
} from '../../../shared/memory-taxonomy'
import { accentFor, relativeTime, uniqueSources } from '../lib/format'
import { AgentLogo } from './AgentLogo'
import { AgentStack } from './AgentStack'
import { RefreshIcon } from './Icons'

type RangeKey = '7d' | '30d' | '90d' | 'all'
type Breakdown = 'agent' | 'category' | 'overlap'

interface RangeOption {
  key: RangeKey
  label: string
  days: number | null
}

interface Series {
  id: string
  label: string
  color: string
  agentId?: string
  categoryId?: MemoryCategoryId
  count: number
}

interface Bucket {
  label: string
  total: number
  counts: Record<string, number>
}

const RANGES: RangeOption[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'All', days: null }
]

const DAY = 86_400_000

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

function rangeStart(range: RangeKey, memories: MemorySummary[]): number {
  if (range === 'all') {
    return memories.length
      ? Math.min(...memories.map((memory) => memory.createdAt))
      : startOfMonth(Date.now())
  }
  const option = RANGES.find((item) => item.key === range) ?? RANGES[1]
  return startOfDay(Date.now()) - (option.days! - 1) * DAY
}

function niceMaximum(value: number): number {
  if (value <= 4) return 4
  const power = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / power
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * power
}

function shortDate(timestamp: number, withYear = false): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: '2-digit' as const } : {})
  }).format(timestamp)
}

function monthLabel(timestamp: number): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    ...(new Date(timestamp).getFullYear() !== new Date().getFullYear()
      ? { year: '2-digit' as const }
      : {})
  }).format(timestamp)
}

function medianAge(memories: MemorySummary[]): number {
  if (!memories.length) return 0
  const ages = memories.map((memory) => Date.now() - memory.updatedAt).sort((a, b) => a - b)
  return ages[Math.floor(ages.length / 2)]
}

function ageLabel(timestamp: number): string {
  const days = Math.max(0, Math.floor(timestamp / DAY))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month' : `${months} months`
}

function buildBuckets(
  range: RangeKey,
  memories: MemorySummary[],
  series: Series[],
  breakdown: Breakdown
): { buckets: Bucket[]; maximum: number } {
  const now = Date.now()
  const earliest = rangeStart(range, memories)
  const intervals: Array<{ start: number; end: number; label: string }> = []

  if (range === 'all') {
    const firstMonth = startOfMonth(earliest)
    const currentMonth = startOfMonth(now)
    const months: number[] = []
    for (let cursor = firstMonth; cursor <= currentMonth; cursor += DAY) {
      const date = new Date(cursor)
      if (date.getDate() === 1) {
        months.push(cursor)
        cursor = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() - DAY
      }
    }
    const groupSize = Math.max(1, Math.ceil(months.length / 12))
    for (let index = 0; index < months.length; index += groupSize) {
      const start = months[index]
      const nextIndex = index + groupSize
      const end =
        nextIndex < months.length
          ? months[nextIndex]
          : new Date(new Date(currentMonth).getFullYear(), new Date(currentMonth).getMonth() + 1, 1)
              .getTime()
      intervals.push({ start, end, label: monthLabel(start) })
    }
  } else {
    const config =
      range === '7d'
        ? { count: 7, step: 1 }
        : range === '30d'
          ? { count: 10, step: 3 }
          : { count: 13, step: 7 }
    const start = startOfDay(now) - (config.count - 1) * config.step * DAY
    for (let index = 0; index < config.count; index += 1) {
      const bucketStart = start + index * config.step * DAY
      intervals.push({
        start: bucketStart,
        end: bucketStart + config.step * DAY,
        label:
          config.step === 1
            ? new Intl.DateTimeFormat('en', { weekday: 'short' }).format(bucketStart)
            : shortDate(bucketStart)
      })
    }
  }

  const buckets = intervals.map((interval) => ({
    label: interval.label,
    total: 0,
    counts: Object.fromEntries(series.map((item) => [item.id, 0])) as Record<string, number>
  }))

  for (const memory of memories) {
    if (memory.createdAt < earliest) continue
    const index = intervals.findIndex(
      (interval) => memory.createdAt >= interval.start && memory.createdAt < interval.end
    )
    if (index < 0) continue
    const bucket = buckets[index]
    bucket.total += 1
    if (breakdown === 'overlap') {
      bucket.counts[memory.echoCount > 1 ? 'overlap' : 'single'] += 1
    } else if (breakdown === 'category') {
      bucket.counts[categoryForKind(memory.kind)] += 1
    } else {
      for (const source of uniqueSources(memory.sources)) {
        if (source.agentId in bucket.counts) bucket.counts[source.agentId] += 1
      }
    }
  }

  const maximum = niceMaximum(Math.max(1, ...buckets.map((bucket) => bucket.total)))
  return { buckets, maximum }
}

export function PulseView({
  memories,
  agents,
  counts,
  scanning,
  onScan,
  onOpenCategory,
  onOpenAgent,
  onOpenMemory
}: {
  memories: MemorySummary[]
  agents: AgentSummary[]
  counts: Counts
  scanning: boolean
  onScan: () => void
  onOpenCategory: (category: MemoryCategoryId) => void
  onOpenAgent: (id: string) => void
  onOpenMemory: (id: string) => void
}) {
  const [range, setRange] = useState<RangeKey>('30d')
  const [agentFilter, setAgentFilter] = useState('all')
  const [breakdown, setBreakdown] = useState<Breakdown>('agent')

  const installed = agents.filter((agent) => agent.installed)
  const visible = useMemo(() => {
    const start = rangeStart(range, memories)
    return memories.filter(
      (memory) =>
        memory.createdAt >= start &&
        (agentFilter === 'all' ||
          memory.sources.some((source) => source.agentId === agentFilter))
    )
  }, [agentFilter, memories, range])

  const echoes = visible
    .filter((memory) => memory.echoCount > 1)
    .sort((a, b) => b.echoCount - a.echoCount || b.updatedAt - a.updatedAt)
  const uniqueAgents = new Set(
    visible.flatMap((memory) => uniqueSources(memory.sources).map((source) => source.agentId))
  )
  const connected = installed.filter((agent) => agent.mcpInstalled).length
  const echoShare = visible.length ? Math.round((echoes.length / visible.length) * 100) : 0
  const median = medianAge(visible)
  const fresh = visible.filter((memory) => Date.now() - memory.updatedAt < 7 * DAY).length

  const series = useMemo<Series[]>(() => {
    if (breakdown === 'overlap') {
      const overlap = visible.filter((memory) => memory.echoCount > 1).length
      return [
        { id: 'overlap', label: 'Shared by agents', color: '#2c2c2f', count: overlap },
        {
          id: 'single',
          label: 'Single source',
          color: '#b8afa5',
          count: visible.length - overlap
        }
      ]
    }

    if (breakdown === 'category') {
      return MEMORY_CATEGORIES.map((category) => ({
        id: category.id,
        label: category.label,
        color: category.color,
        categoryId: category.id,
        count: visible.filter((memory) => categoryForKind(memory.kind) === category.id).length
      }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    }

    const countsByAgent = new Map<string, number>()
    for (const memory of visible) {
      for (const source of uniqueSources(memory.sources)) {
        countsByAgent.set(source.agentId, (countsByAgent.get(source.agentId) ?? 0) + 1)
      }
    }
    return [...countsByAgent.entries()]
      .map(([agentId, count]) => {
        const agent = agents.find((item) => item.id === agentId)
        return {
          id: agentId,
          label: agent?.name ?? agentId,
          color: accentFor(agentId),
          agentId,
          count
        }
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [agents, breakdown, visible])

  const { buckets, maximum } = useMemo(
    () => buildBuckets(range, visible, series, breakdown),
    [breakdown, range, series, visible]
  )

  const categoryCounts = useMemo(() => {
    return MEMORY_CATEGORIES.map((category) => ({
      ...category,
      count: visible.filter((memory) => categoryForKind(memory.kind) === category.id).length
    }))
      .filter((category) => category.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [visible])

  const selectedAgent = agentFilter === 'all' ? null : agents.find((agent) => agent.id === agentFilter)
  const libraryTotal = selectedAgent?.memoryCount ?? counts.memories
  const seriesTotal = series.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="page pulse-page">
      <section className="page-head pulse-head">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Local memory landscape
        </p>
        <div className="page-title-row">
          <h1>The shape of what your agents know.</h1>
          <button className="ghost-button" type="button" onClick={onScan} disabled={scanning}>
            <RefreshIcon size={14} />
            {scanning ? 'Scanning...' : 'Scan again'}
          </button>
        </div>
        <p className="page-copy">
          A local read on provenance, overlap, and freshness. It shows what has been
          remembered, not how often it was recalled.
        </p>
      </section>

      <div className="pulse-toolbar">
        <div className="pulse-range" role="group" aria-label="Time range">
          {RANGES.map((option) => (
            <button
              className={range === option.key ? 'active' : ''}
              key={option.key}
              type="button"
              aria-pressed={range === option.key}
              onClick={() => setRange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="pulse-agent-filter">
          <span className="sr-only">Filter by agent</span>
          <select
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            aria-label="Filter pulse by agent"
          >
            <option value="all">All agents</option>
            {installed.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="pulse-summary" aria-label="Memory summary">
        <div className="pulse-stat">
          <span>Memories</span>
          <strong>{visible.length}</strong>
          <small>
            {libraryTotal} in {selectedAgent ? selectedAgent.name : 'your library'}
          </small>
        </div>
        <div className="pulse-stat">
          <span>Cross-agent echoes</span>
          <strong>{echoes.length}</strong>
          <small>{echoShare}% of selected memories</small>
        </div>
        <div className="pulse-stat">
          <span>Active agents</span>
          <strong>{uniqueAgents.size}</strong>
          <small>{connected} connected by MCP</small>
        </div>
        <div className="pulse-stat">
          <span>Median age</span>
          <strong>{ageLabel(median)}</strong>
          <small>{fresh} updated in the last 7 days</small>
        </div>
      </section>

      <section className="pulse-panel pulse-growth">
        <div className="pulse-panel-head">
          <div>
            <p className="section-label">Memory added</p>
            <h2>
              {breakdown === 'agent'
                ? 'Who is growing the library'
                : breakdown === 'category'
                  ? 'Which categories are growing'
                  : 'What crosses agent boundaries'}
            </h2>
          </div>
          <div className="pulse-breakdown" role="group" aria-label="Chart breakdown">
            <button
              type="button"
              className={breakdown === 'agent' ? 'active' : ''}
              aria-pressed={breakdown === 'agent'}
              onClick={() => setBreakdown('agent')}
            >
              By agent
            </button>
            <button
              type="button"
              className={breakdown === 'category' ? 'active' : ''}
              aria-pressed={breakdown === 'category'}
              onClick={() => setBreakdown('category')}
            >
              Categories
            </button>
            <button
              type="button"
              className={breakdown === 'overlap' ? 'active' : ''}
              aria-pressed={breakdown === 'overlap'}
              onClick={() => setBreakdown('overlap')}
            >
              Overlap
            </button>
          </div>
        </div>

        <div className="pulse-chart-head">
          <p>
            {breakdown === 'agent'
              ? 'A memory can count once for each source agent.'
              : breakdown === 'category'
                ? 'A memory belongs to one of the five dachshund categories.'
                : 'Single-source memories versus memories echoed by two or more agents.'}
          </p>
          <span>{visible.length} memories</span>
        </div>

        <div
          className="pulse-chart"
          role="img"
          aria-label={`Memory added by ${breakdown}; ${visible.length} memories in the selected range`}
        >
          <div className="pulse-y-axis" aria-hidden="true">
            <span>{maximum}</span>
            <span>{maximum / 2}</span>
            <span>0</span>
          </div>
          <div className="pulse-plot">
            <div className="pulse-gridline top" aria-hidden="true" />
            <div className="pulse-gridline middle" aria-hidden="true" />
            <div className="pulse-gridline bottom" aria-hidden="true" />
            <div className="pulse-bars">
              {buckets.map((bucket, index) => (
                <div className="pulse-bar-column" key={`${bucket.label}-${index}`}>
                  <div
                    className="pulse-bar-stack"
                    title={`${bucket.label}: ${bucket.total} ${bucket.total === 1 ? 'memory' : 'memories'}`}
                  >
                    {series.map((item) => {
                      const count = bucket.counts[item.id] ?? 0
                      if (!count) return null
                      return (
                        <span
                          key={item.id}
                          style={{
                            height: `${(count / maximum) * 100}%`,
                            background: item.color
                          }}
                        />
                      )
                    })}
                  </div>
                  <span className={`pulse-x-label ${buckets.length > 9 && index % 2 ? 'quiet' : ''}`}>
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
            {visible.length === 0 && (
              <div className="pulse-chart-empty">
                <strong>No memories in this range</strong>
                <button type="button" onClick={() => setRange('all')}>
                  Show all time
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`pulse-series ${series.length > 2 ? 'two-columns' : ''}`}>
          {series.map((item) => {
            const content = (
              <>
              <div className="pulse-series-line">
                {item.agentId ? (
                  <AgentLogo
                    agentId={item.agentId}
                    agentName={item.label}
                    size={18}
                    shape="circle"
                  />
                ) : (
                  <span
                    className="pulse-series-dot"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                )}
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="pulse-series-track" aria-hidden="true">
                <span
                  style={{
                    width: `${seriesTotal ? (item.count / seriesTotal) * 100 : 0}%`,
                    background: item.color
                  }}
                />
              </div>
              </>
            )
            const target = item.agentId ?? item.categoryId
            return target ? (
              <button
                type="button"
                className="pulse-series-item"
                key={item.id}
                onClick={() => {
                  if (item.agentId) onOpenAgent(item.agentId)
                  else if (item.categoryId) onOpenCategory(item.categoryId)
                }}
                aria-label={
                  item.agentId
                    ? `Open ${item.label} memory`
                    : `Open ${item.label} memories`
                }
              >
                {content}
              </button>
            ) : (
              <div className="pulse-series-item" key={item.id}>
                {content}
              </div>
            )
          })}
        </div>
      </section>

      <div className="pulse-secondary">
        <section className="pulse-panel pulse-categories">
          <div className="pulse-panel-head compact">
            <div>
              <p className="section-label">Category mix</p>
              <h2>What the library is made of</h2>
            </div>
          </div>
          {categoryCounts.length ? (
            <>
              <div className="pulse-category-bar" aria-hidden="true">
                {categoryCounts.map((item) => (
                  <span
                    key={item.id}
                    style={{
                      width: `${(item.count / visible.length) * 100}%`,
                      background: item.color
                    }}
                  />
                ))}
              </div>
              <div className="pulse-category-list">
                {categoryCounts.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onOpenCategory(item.id)}
                    aria-label={`Open ${item.label} memories`}
                    title={item.description}
                  >
                    <span className="pulse-series-dot" style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                    <small>{Math.round((item.count / visible.length) * 100)}%</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="pulse-card-empty">No memory categories to compare yet.</p>
          )}
        </section>

        <section className="pulse-panel pulse-echoes">
          <div className="pulse-panel-head compact">
            <div>
              <p className="section-label">Cross-agent echoes</p>
              <h2>What more than one agent knows</h2>
            </div>
            <span>{echoes.length}</span>
          </div>
          {echoes.length ? (
            <div className="pulse-echo-list">
              {echoes.slice(0, 4).map((memory) => (
                <button
                  type="button"
                  key={memory.id}
                  onClick={() => onOpenMemory(memory.id)}
                >
                  <AgentStack sources={memory.sources} size={17} />
                  <span>
                    <strong>{memory.title}</strong>
                    <small>
                      {memory.echoCount} agents · {relativeTime(memory.updatedAt)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="pulse-card-empty">
              No overlap in this range. That can mean clean ownership, or context that
              never travels between agents.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
