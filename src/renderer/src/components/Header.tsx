import type { RefObject } from 'react'
import { MenuBarIcon, PlusIcon, SearchIcon, SidebarToggleIcon } from './Icons'
import { Mark } from './Mark'

type View = 'memory' | 'pulse' | 'agents' | 'guide' | 'connectors'

const tabs: Array<{ id: View; label: string }> = [
  { id: 'memory', label: 'Memory' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'agents', label: 'Agents' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'guide', label: 'Guide' }
]

export function Header({
  view,
  onView,
  onLanding,
  query,
  onQuery,
  searchRef,
  onNew,
  onMinimize,
  sidebarMode,
  onToggleSidebar,
  agents
}: {
  view: View
  onView: (view: View) => void
  onLanding: () => void
  query: string
  onQuery: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  onNew: () => void
  onMinimize: () => void
  sidebarMode: boolean
  onToggleSidebar: () => void
  agents: number
}) {
  return (
    <header className="topbar">
      <button
        className="sidebar-toggle"
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarMode ? 'Use top tab navigation' : 'Use sidebar navigation'}
        aria-pressed={sidebarMode}
        aria-keyshortcuts="Meta+\\"
        title={sidebarMode ? 'Use top tab navigation (⌘\\)' : 'Use sidebar navigation (⌘\\)'}
      >
        <SidebarToggleIcon size={17} />
      </button>
      <button
        className="topbar-brand"
        type="button"
        onClick={onLanding}
        aria-label="Open dachshund landing"
        title="Open dachshund landing"
      >
        <Mark size={20} />
        <span>dachshund</span>
      </button>
      {!sidebarMode && (
        <nav className="topbar-nav" aria-label="Primary">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={`topbar-tab ${view === item.id ? 'active' : ''}`}
              type="button"
              onClick={() => onView(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <div className="topbar-grow" />
      <div
        className={`search-box ${view !== 'memory' ? 'quiet' : ''}`}
        onClick={() => {
          if (view === 'memory') searchRef.current?.focus()
        }}
      >
        <SearchIcon size={14} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={`Search ${agents} agents`}
          aria-label="Search memory"
          disabled={view !== 'memory'}
        />
        {view === 'memory' &&
          (query ? (
            <button type="button" className="search-clear" onClick={() => onQuery('')}>
              Clear
            </button>
          ) : (
            <kbd>⌘K</kbd>
          ))}
      </div>
      <button
        className="menubar-button"
        type="button"
        onClick={onMinimize}
        aria-label="Minimize to menu bar"
        title="Minimize to menu bar (⌘⇧M)"
      >
        <MenuBarIcon size={16} />
      </button>
      <button className="primary-button" type="button" onClick={onNew} aria-label="New memory">
        <PlusIcon size={15} />
        <span className="primary-label">New memory</span>
      </button>
    </header>
  )
}
