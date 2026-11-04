import type { Counts } from '../../../shared/types'
import { AgentsIcon, ConnectorsIcon, GuideIcon, MemoryIcon, PulseIcon } from './Icons'

type View = 'memory' | 'pulse' | 'agents' | 'guide' | 'connectors'

export function Sidebar({
  view,
  onChange,
  counts
}: {
  view: View
  onChange: (view: View) => void
  counts: Counts
}) {
  return (
    <aside className="app-sidebar" aria-label="Sidebar navigation">
      <div className="app-sidebar-group">
        <p className="app-sidebar-label">Workspace</p>
        <button
          className={`app-sidebar-item ${view === 'memory' ? 'active' : ''}`}
          onClick={() => onChange('memory')}
          type="button"
          aria-current={view === 'memory' ? 'page' : undefined}
        >
          <MemoryIcon size={17} />
          <span>Memory</span>
          <small>{counts.memories}</small>
        </button>
        <button
          className={`app-sidebar-item ${view === 'agents' ? 'active' : ''}`}
          onClick={() => onChange('agents')}
          type="button"
          aria-current={view === 'agents' ? 'page' : undefined}
        >
          <AgentsIcon size={17} />
          <span>Agents</span>
          <small>{counts.agents}</small>
        </button>
      </div>

      <div className="app-sidebar-group">
        <p className="app-sidebar-label">Insights</p>
        <button
          className={`app-sidebar-item ${view === 'pulse' ? 'active' : ''}`}
          onClick={() => onChange('pulse')}
          type="button"
          aria-current={view === 'pulse' ? 'page' : undefined}
        >
          <PulseIcon size={17} />
          <span>Pulse</span>
        </button>
        <button
          className={`app-sidebar-item ${view === 'guide' ? 'active' : ''}`}
          onClick={() => onChange('guide')}
          type="button"
          aria-current={view === 'guide' ? 'page' : undefined}
        >
          <GuideIcon size={17} />
          <span>Guide</span>
        </button>
      </div>

      <div className="app-sidebar-group app-sidebar-system">
        <p className="app-sidebar-label">App</p>
        <button
          className={`app-sidebar-item ${view === 'connectors' ? 'active' : ''}`}
          onClick={() => onChange('connectors')}
          type="button"
          aria-current={view === 'connectors' ? 'page' : undefined}
        >
          <ConnectorsIcon size={17} />
          <span>Connectors</span>
        </button>
      </div>

      <div className="app-sidebar-foot">
        <span className="app-sidebar-status" />
        <span>Local only</span>
      </div>
    </aside>
  )
}
