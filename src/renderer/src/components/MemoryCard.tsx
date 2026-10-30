import type { MemorySummary } from '../../../shared/types'
import type { CSSProperties } from 'react'
import { accentFor, kindLabel, relativeTime, uniqueSources } from '../lib/format'
import { AgentLogo } from './AgentLogo'
import { AgentStack } from './AgentStack'

export function MemoryCard({
  memory,
  selected,
  onSelect
}: {
  memory: MemorySummary
  selected: boolean
  onSelect: () => void
}) {
  const sources = uniqueSources(memory.sources)
  const accent = accentFor(sources[0]?.agentId ?? 'dachshund')
  return (
    <article
      className={`memory-card ${selected ? 'selected' : ''}`}
      style={{ '--card-accent': accent } as CSSProperties}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="card-rail" aria-hidden="true">
        <span className="rail-dot" />
        <span className="rail-line" />
      </div>
      <div className="card-main">
        <div className="card-kicker">
          <AgentStack sources={sources} size={19} />
          <span className="kicker-sep" />
          <span>{kindLabel(memory.kind)}</span>
          <span className="kicker-sep" />
          <span>{relativeTime(memory.updatedAt)}</span>
        </div>
        <h3>{memory.title}</h3>
        <p>{memory.excerpt}</p>
        <div className="card-foot">
          <div className="card-tags">
            {memory.project && <span className="tag project-tag">{memory.project}</span>}
            {memory.tags.slice(0, 2).map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          {memory.echoCount > 1 ? (
            <span className="echo-pill">
              <span className="echo-dots">
                {sources.slice(0, 3).map((source) => (
                  <AgentLogo
                    key={source.agentId}
                    agentId={source.agentId}
                    agentName={source.agentName}
                    size={11}
                    shape="circle"
                    decorative
                  />
                ))}
              </span>
              {memory.echoCount} agents
            </span>
          ) : (
            <span className="single-agent">{sources[0]?.agentName ?? 'dachshund'}</span>
          )}
        </div>
      </div>
    </article>
  )
}
