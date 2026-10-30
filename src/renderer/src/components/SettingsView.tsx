import type { AppState } from '../../../shared/types'
import { AgentLogo } from './AgentLogo'
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
  onQuit
}: {
  state: AppState
  bridgePath: string
  onScan: () => void
  onReveal: (path: string) => void
  onInstallMcp: (id: string) => void
  onQuit: () => void
}) {
  const installed = state.agents.filter((agent) => agent.installed)
  return (
    <div className="page settings-page">
      <section className="page-head">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Preferences
        </p>
        <h1>Quiet by default.</h1>
        <p className="page-copy">
          dachshund has no account, no telemetry, and no opinion about where your memories should
          live. They live with you.
        </p>
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
          <h2>Sharing</h2>
          <span>MCP</span>
        </div>
        <div className="settings-card">
          <div className="settings-row mcp-intro">
            <div className="settings-icon">
              <ArrowUpRightIcon size={18} />
            </div>
            <div className="settings-copy">
              <strong>One memory, every agent</strong>
              <span>Connecting writes a small MCP entry to the agent’s config. No memory files are touched.</span>
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
                <span>{agent.mcpInstalled ? 'Connected over MCP' : 'Not connected yet'}</span>
              </div>
              <button
                className={`mcp-button ${agent.mcpInstalled ? 'connected' : ''}`}
                type="button"
                onClick={() => onInstallMcp(agent.id)}
                disabled={!agent.mcpConfigPath}
              >
                {!agent.mcpConfigPath ? (
                  'Import only'
                ) : agent.mcpInstalled ? (
                  <>
                    <CheckIcon size={13} />
                    Connected
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          ))}
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
