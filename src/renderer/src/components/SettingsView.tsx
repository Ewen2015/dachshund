import type { AppState } from '../../../shared/types'
import { AgentLogo } from './AgentLogo'
import { displayHomePath, relativeTime, sortAgentsByMemory } from '../lib/format'
import {
  ArrowUpRightIcon,
  CheckIcon,
  FileIcon,
  FolderIcon,
  LockIcon,
  RefreshIcon
} from './Icons'

export function SettingsView({
  state,
  bridgePath,
  onScan,
  onReveal,
  onInstallMcp,
  onToggleAutoSync,
  onQuit
}: {
  state: AppState
  bridgePath: string
  onScan: () => void
  onReveal: (path: string) => void
  onInstallMcp: (id: string) => void
  onToggleAutoSync: (enabled: boolean) => void
  onQuit: () => void
}) {
  const installed = sortAgentsByMemory(state.agents.filter((agent) => agent.installed))
  const connected = installed.filter((agent) => agent.mcpInstalled).length
  return (
    <div className="page settings-page">
      <section className="page-head">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Connectors
        </p>
        <h1>Connect every agent.</h1>
        <p className="page-copy">
          Give each local agent one path to the same memory library over MCP. Connections stay on
          this Mac, and dachshund never rewrites the memory files an agent already keeps.
        </p>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h2>Memory sync</h2>
          <span>{state.sync.autoSync ? 'On' : 'Off'}</span>
        </div>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-icon">
              <RefreshIcon size={18} />
            </div>
            <div className="settings-copy">
              <strong>Automatic sync</strong>
              <span>
                Scan agent memory when you turn this on, then every {state.sync.intervalMinutes}{' '}
                minutes while dachshund is running. Source files stay read-only.
              </span>
            </div>
            <button
              className={`switch ${state.sync.autoSync ? 'on' : ''}`}
              type="button"
              role="switch"
              aria-checked={state.sync.autoSync}
              aria-label="Automatic memory sync"
              disabled={state.sync.scanning && !state.sync.autoSync}
              onClick={() => onToggleAutoSync(!state.sync.autoSync)}
            >
              <span />
            </button>
          </div>
          <div className="settings-row compact">
            <div className="settings-copy sync-settings-status">
              <strong>
                {state.sync.scanning
                  ? 'Scanning memory files…'
                  : state.sync.lastResult?.ok === false
                    ? 'Last sync failed'
                    : 'Last successful sync'}
              </strong>
              <span>
                {state.sync.lastSuccessfulSyncAt
                  ? relativeTime(state.sync.lastSuccessfulSyncAt)
                  : 'Not completed yet'}
                {state.sync.lastResult && state.sync.lastResult.added + state.sync.lastResult.updated > 0
                  ? ` · ${state.sync.lastResult.added} added, ${state.sync.lastResult.updated} updated`
                  : ''}
              </span>
            </div>
            <button className="ghost-button small" type="button" onClick={onScan} disabled={state.scanning}>
              <RefreshIcon size={13} />
              Sync now
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h2>Agent connectors</h2>
          <span>
            {connected} of {installed.length} connected
          </span>
        </div>
        <div className="settings-card">
          <div className="settings-row mcp-intro">
            <div className="settings-icon">
              <ArrowUpRightIcon size={18} />
            </div>
            <div className="settings-copy">
              <strong>Shared memory over MCP</strong>
              <span>
                Most agents receive a small MCP entry automatically. App-managed connectors open a
                guided setup instead. No memory files are touched.
              </span>
              <code className="bridge-path">{bridgePath}</code>
            </div>
          </div>
          {installed.map((agent) => (
            <div className="settings-row compact" key={agent.id}>
              <AgentLogo
                agentId={agent.id}
                agentName={agent.name}
                size={18}
                shape="circle"
                className="settings-agent-dot"
              />
              <div className="settings-copy">
                <strong>{agent.name}</strong>
                <span>
                  {agent.mcpInstalled ? 'Connected over MCP' : 'Not connected yet'}
                  {agent.id === 'trae'
                    ? ` · ${agent.appVersion ? `v${agent.appVersion}` : 'version unknown'}`
                    : ''}
                </span>
                {agent.id === 'trae' && agent.mcpConfigPath ? (
                  <code className="settings-agent-path" title={agent.mcpConfigPath}>
                    {displayHomePath(agent.mcpConfigPath)}
                  </code>
                ) : null}
              </div>
              <button
                className={`mcp-button ${agent.mcpInstalled ? 'connected' : ''}`}
                type="button"
                onClick={() => onInstallMcp(agent.id)}
                disabled={!agent.mcpMode}
              >
                {agent.mcpInstalled ? (
                  <>
                    <CheckIcon size={13} />
                    Connected
                  </>
                ) : agent.mcpMode === 'manual' ? (
                  'Set up'
                ) : agent.mcpMode === 'config' ? (
                  'Connect'
                ) : (
                  'Import only'
                )}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h2>Library</h2>
          <span>Plain Markdown</span>
        </div>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-icon">
              <FolderIcon size={18} />
            </div>
            <div className="settings-copy">
              <strong>Memory library</strong>
              <code>{state.libraryPath}</code>
            </div>
            <button className="ghost-button small" type="button" onClick={() => onReveal(state.libraryPath)}>
              Reveal
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-icon">
              <FileIcon size={18} />
            </div>
            <div className="settings-copy">
              <strong>Every memory is a file</strong>
              <span>Readable, editable, diffable, and yours. SQLite is only the index.</span>
            </div>
            <button className="ghost-button small" type="button" onClick={onScan}>
              <RefreshIcon size={13} />
              Rebuild index
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h2>Privacy</h2>
          <span>By architecture</span>
        </div>
        <div className="privacy-grid">
          <div className="privacy-card">
            <LockIcon size={18} />
            <strong>On this Mac</strong>
            <p>The app, database, and MCP server all bind to your local machine.</p>
          </div>
          <div className="privacy-card">
            <FileIcon size={18} />
            <strong>No model required</strong>
            <p>Capture, search, and recall work without an API key or an LLM call.</p>
          </div>
          <div className="privacy-card">
            <RefreshIcon size={18} />
            <strong>Read-only imports</strong>
            <p>Agent memory files are read in place. dachshund never rewrites their sources.</p>
          </div>
        </div>
      </section>

      <section className="settings-section about-section">
        <div>
          <h2>dachshund</h2>
          <p>Long memory, short leash. Version {state.version}.</p>
        </div>
        <button className="ghost-button small" type="button" onClick={onQuit}>
          Quit dachshund
        </button>
      </section>
    </div>
  )
}
