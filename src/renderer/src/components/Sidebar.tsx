import type { Counts } from '../../../shared/types'
import { AgentsIcon, MemoryIcon, PlusIcon, PulseIcon, SettingsIcon } from './Icons'
import { Mark } from './Mark'
import { LockIcon } from './Icons'

type View = 'memory' | 'pulse' | 'agents' | 'settings'

export function Sidebar({
  view,
  onChange,
  counts,
  onNew
}: {
  view: View
  onChange: (view: View) => void
  counts: Counts
  onNew: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Mark size={27} className="brand-mark" />
        <span className="brand-word">dachshund</span>
      </div>

      <button className="new-memory" onClick={onNew} type="button">
        <PlusIcon size={15} />
        <span>New memory</span>
        <kbd>⌘N</kbd>
      </button>

      <nav className="nav" aria-label="Primary">
        <button
          className={`nav-item ${view === 'memory' ? 'active' : ''}`}
          onClick={() => onChange('memory')}
          type="button"
          aria-label="Memory"
        >
          <MemoryIcon size={17} />
          <span>Memory</span>
          <span className="nav-count">{counts.memories}</span>
        </button>
        <button
          className={`nav-item ${view === 'pulse' ? 'active' : ''}`}
          onClick={() => onChange('pulse')}
          type="button"
          aria-label="Pulse"
        >
          <PulseIcon size={17} />
          <span>Pulse</span>
        </button>
        <button
          className={`nav-item ${view === 'agents' ? 'active' : ''}`}
          onClick={() => onChange('agents')}
          type="button"
          aria-label="Agents"
        >
          <AgentsIcon size={17} />
          <span>Agents</span>
          <span className="nav-count">{counts.agents}</span>
        </button>
        <button
          className={`nav-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onChange('settings')}
          type="button"
          aria-label="Settings"
        >
          <SettingsIcon size={17} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="local-note">
        <div className="local-pill">
          <LockIcon size={12} />
          <span>Local only</span>
        </div>
        <p>
          {counts.memories} memories from {counts.agents} agents.
          <br />
          Nothing leaves this Mac.
        </p>
      </div>
      <div className="sidebar-foot">
        <span>dachshund</span>
        <span>v0.1</span>
      </div>
    </aside>
  )
}
