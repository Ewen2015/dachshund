import type { MemorySource } from '../../../shared/types'
import { uniqueSources } from '../lib/format'
import { AgentLogo } from './AgentLogo'

export function AgentStack({
  sources,
  limit = 4,
  size = 20
}: {
  sources: MemorySource[]
  limit?: number
  size?: number
}) {
  const unique = uniqueSources(sources).slice(0, limit)
  return (
    <span className="agent-stack" style={{ height: size }}>
      {unique.map((source) => (
        <AgentLogo
          key={source.agentId}
          agentId={source.agentId}
          agentName={source.agentName}
          size={size}
          shape="circle"
          className="agent-stack-logo"
        />
      ))}
    </span>
  )
}
