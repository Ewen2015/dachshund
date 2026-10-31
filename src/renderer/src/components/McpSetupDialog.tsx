import { useEffect, useRef, useState } from 'react'
import type {
  AgentSummary,
  McpConnectionStatus,
  McpSetup
} from '../../../shared/types'
import { AgentLogo } from './AgentLogo'
import {
  ArrowUpRightIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  RefreshIcon
} from './Icons'

function setupText(setup: McpSetup): string {
  const environment = Object.entries(setup.env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  return [
    `Connector name: ${setup.name}`,
    `Transport: ${setup.transport.toUpperCase()}`,
    `Command: ${setup.command}`,
    'Arguments:',
    ...setup.args,
    'Environment:',
    environment
  ].join('\n')
}

export function McpSetupDialog({
  agent,
  onClose,
  onConnected,
  onToast
}: {
  agent: AgentSummary
  onClose: () => void
  onConnected: () => Promise<void>
  onToast: (message: string, error?: boolean) => void
}) {
  const [setup, setSetup] = useState<McpSetup | null>(null)
  const [status, setStatus] = useState<McpConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const connectedRef = useRef(false)
  const copiedTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.dachshund.getMcpSetup(agent.id),
      window.dachshund.checkMcp(agent.id)
    ])
      .then(([nextSetup, nextStatus]) => {
        if (cancelled) return
        setSetup(nextSetup)
        setStatus(nextStatus)
        connectedRef.current = nextStatus.connected
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onToast(error instanceof Error ? error.message : 'Could not load MCP setup', true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agent.id, onToast])

  useEffect(() => {
    let cancelled = false
    const timer = window.setInterval(() => {
      if (connectedRef.current) return
      void window.dachshund.checkMcp(agent.id).then((next) => {
        if (cancelled) return
        setStatus(next)
        if (next.connected && !connectedRef.current) {
          connectedRef.current = true
          void onConnected()
          onToast(`${agent.name} connected over MCP`)
        }
      })
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [agent.id, agent.name, onConnected, onToast])

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  const copy = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(null), 1800)
      onToast(`${label} copied`)
    } catch {
      onToast('Could not copy to the clipboard', true)
    }
  }

  const checkNow = async () => {
    if (checking) return
    setChecking(true)
    try {
      const next = await window.dachshund.checkMcp(agent.id)
      setStatus(next)
      if (next.connected) {
        if (!connectedRef.current) await onConnected()
        connectedRef.current = true
        onToast(`${agent.name} is connected over MCP`)
      } else {
        onToast(`No ${agent.name} MCP handshake yet`)
      }
    } finally {
      setChecking(false)
    }
  }

  const openDoubao = async () => {
    const opened = await window.dachshund.openAgentApp(agent.id)
    if (!opened) onToast(`Could not open ${agent.name}`, true)
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="mcp-setup"
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${agent.name} over MCP`}
      >
        <div className="mcp-setup-head">
          <div className="mcp-setup-title">
            <AgentLogo agentId={agent.id} agentName={agent.name} size={30} />
            <div>
              <p className="eyebrow">
                <span className="eyebrow-dot" />
                Local connector
              </p>
              <h2>Connect {agent.name}.</h2>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close setup">
            <CloseIcon size={16} />
          </button>
        </div>

        <p className="mcp-setup-lede">
          {agent.name} stores custom connectors inside its app, not in a local JSON file.
          Open <strong>Plugins / Skills</strong>{' '}
          <span className="mcp-setup-inline">(插件 · 技能)</span>, add a custom connector, and
          use these values.
        </p>

        <ol className="mcp-setup-steps">
          <li>
            <span>01</span>
            <p>
              Open {agent.name}, then <strong>Plugins / Skills</strong>{' '}
              <span className="mcp-setup-inline">(插件 · 技能)</span>.
            </p>
          </li>
          <li>
            <span>02</span>
            <p>
              Choose <strong>Add</strong> <span className="mcp-setup-inline">(添加)</span>, then{' '}
              <strong>Custom connector</strong>{' '}
              <span className="mcp-setup-inline">(新建自定义连接器)</span>.
            </p>
          </li>
          <li>
            <span>03</span>
            <p>Select <strong>STDIO</strong>, enter the fields below, and save.</p>
          </li>
        </ol>

        {loading ? (
          <div className="mcp-setup-loading">Loading local bridge details...</div>
        ) : setup ? (
          <div className="mcp-setup-fields">
            <div className="mcp-setup-field">
              <span>Connector name</span>
              <code>{setup.name}</code>
              <button
                type="button"
                onClick={() => void copy('name', setup.name, 'Connector name')}
                aria-label="Copy connector name"
              >
                {copied === 'name' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
            </div>
            <div className="mcp-setup-field">
              <span>Transport</span>
              <code>STDIO</code>
              <button
                type="button"
                onClick={() => void copy('transport', 'STDIO', 'Transport')}
                aria-label="Copy transport"
              >
                {copied === 'transport' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
            </div>
            <div className="mcp-setup-field">
              <span>Command</span>
              <code>{setup.command}</code>
              <button
                type="button"
                onClick={() => void copy('command', setup.command, 'Command')}
                aria-label="Copy command"
              >
                {copied === 'command' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
            </div>
            <div className="mcp-setup-field multiline">
              <span>Arguments</span>
              <code>
                {setup.args.map((argument) => (
                  <em key={argument}>{argument}</em>
                ))}
              </code>
              <button
                type="button"
                onClick={() => void copy('args', setup.args.join('\n'), 'Arguments')}
                aria-label="Copy arguments"
              >
                {copied === 'args' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
            </div>
            {Object.entries(setup.env).map(([key, value]) => (
              <div className="mcp-setup-field multiline" key={key}>
                <span>Environment: {key}</span>
                <code>{value}</code>
                <button
                  type="button"
                  onClick={() => void copy(`env-${key}`, value, key)}
                  aria-label={`Copy ${key}`}
                >
                  {copied === `env-${key}` ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mcp-setup-loading">This connector has no manual setup target.</div>
        )}

        <div className={`mcp-handshake ${status?.connected ? 'connected' : ''}`}>
          <span className="mcp-handshake-dot" />
          <div>
            <strong>
              {status?.connected
                ? `Connected${status.clientName ? ` as ${status.clientName}` : ''}${
                    status.clientVersion ? ` ${status.clientVersion}` : ''
                  }`
                : `Waiting for ${agent.name}`}
            </strong>
            <span>
              {status?.connected
                ? `Handshake received ${new Date(status.connectedAt ?? Date.now()).toLocaleString()}.`
                : 'The status turns green after the first real MCP handshake.'}
            </span>
          </div>
          <button type="button" className="ghost-button small" onClick={() => void checkNow()}>
            <RefreshIcon size={12} className={checking ? 'spinning' : ''} />
            {checking ? 'Checking' : 'Check now'}
          </button>
        </div>

        <div className="mcp-setup-foot">
          <button
            className="ghost-button small"
            type="button"
            disabled={!setup}
            onClick={() => setup && void copy('all', setupText(setup), 'Full setup')}
          >
            {copied === 'all' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied === 'all' ? 'Copied' : 'Copy full setup'}
          </button>
          <div>
            <button className="ghost-button small" type="button" onClick={onClose}>
              Close
            </button>
            <button className="primary-button small" type="button" onClick={() => void openDoubao()}>
              Open {agent.name}
              <ArrowUpRightIcon size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
