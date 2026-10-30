import type { RefObject } from 'react'
import { MenuBarIcon, PlusIcon, SearchIcon } from './Icons'
import { Mark } from './Mark'

type View = 'memory' | 'agents' | 'settings'

export function Header({
  view,
  onView,
  query,
  onQuery,
  searchRef,
  onNew,
  onMinimize,
  agents
}: {
  view: View
  onView: (view: View) => void
  query: string
  onQuery: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  onNew: () => void
  onMinimize: () => void
  agents: number
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Mark size={20} />
        <span>dachshund</span>
      </div>
      <nav className="topbar-nav" aria-label="Primary">
        {(['memory', 'agents', 'settings'] as const).map((item) => (
          <button
            key={item}
            className={`topbar-tab ${view === item ? 'active' : ''}`}
            type="button"
            onClick={() => onView(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      <div className="topbar-grow" />
      <div className={`search-box ${view !== 'memory' ? 'quiet' : ''}`}>
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
        New memory
      </button>
    </header>
  )
}
