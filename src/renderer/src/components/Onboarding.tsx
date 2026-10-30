import type { AgentSummary, Counts } from '../../../shared/types'
import { AgentLogo } from './AgentLogo'
import { LockIcon, RefreshIcon } from './Icons'
import { Mark } from './Mark'

export function Onboarding({
  agents,
  counts,
  scanning,
  onScan,
  onEnter
}: {
  agents: AgentSummary[]
  counts: Counts
  scanning: boolean
  onScan: () => void
  onEnter: () => void
}) {
  const found = agents.filter((agent) => agent.installed)
  return (
    <div className="onboarding">
      <div className="onboarding-left">
        <div className="onboarding-brand">
          <Mark size={30} />
          <span>dachshund</span>
        </div>
        <div className="onboarding-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            One memory across all agents
          </p>
          <h1>Your agents forget each other.</h1>
          <p className="onboarding-lede">
            Claude Code knows one thing. Codex knows another. dachshund gives them one quiet,
            shared memory — stored as plain files on this Mac.
          </p>

          <div className="found-block">
            <div className="found-title">
              <span>{scanning ? 'Looking for agents…' : `Found ${found.length} agents on this Mac`}</span>
              {scanning && <span className="scan-spinner" />}
            </div>
            <div className="found-agents">
              {found.map((agent) => (
                <div className="found-agent" key={agent.id}>
                  <AgentLogo
                    agentId={agent.id}
                    agentName={agent.name}
                    size={20}
                    shape="circle"
                    className="found-avatar"
                  />
                  <span>{agent.name}</span>
                  <small>{agent.memoryCount}</small>
                </div>
              ))}
              {!found.length && !scanning && <span className="found-empty">No local agents found yet.</span>}
            </div>
          </div>

          <div className="onboarding-actions">
            <button className="primary-button" type="button" onClick={onEnter}>
              Enter dachshund
            </button>
            <button className="text-button" type="button" onClick={onScan} disabled={scanning}>
              <RefreshIcon size={14} />
              Scan again
            </button>
          </div>
          <p className="onboarding-count">
            {counts.memories} memories · {counts.sources} sources · {counts.echoes} echoes
          </p>
        </div>
        <div className="onboarding-foot">
          <LockIcon size={13} />
          No account. No cloud. No model required.
        </div>
      </div>

      <div className="onboarding-art">
        <div className="art-paper">
          <span className="art-index">fig. 01</span>
          <div className="art-mark" aria-hidden="true">
            <Mark size={88} className="art-mark-svg" />
          </div>

          <span className="orbit-chip chip-claude">
            <AgentLogo agentId="claude-code" agentName="Claude Code" size={18} shape="circle" />
            Claude
          </span>
          <span className="orbit-chip chip-codex">
            <AgentLogo agentId="codex" agentName="Codex" size={18} shape="circle" />
            Codex
          </span>
          <span className="orbit-chip chip-gemini">
            <AgentLogo agentId="gemini-cli" agentName="Gemini CLI" size={18} shape="circle" />
            Gemini
          </span>
          <span className="orbit-chip chip-cursor">
            <AgentLogo agentId="cursor" agentName="Cursor" size={18} shape="circle" />
            Cursor
          </span>

          <div className="art-caption">
            <span className="caption-line" />
            <p>A long memory, on a short leash.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
