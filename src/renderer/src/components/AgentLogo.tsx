import claudeCodeIcon from '../assets/agent-icons/claudecode-color.svg'
import claudeDesktopIcon from '../assets/agent-icons/claude-color.svg'
import codexIcon from '../assets/agent-icons/codex-color.svg'
import geminiCliIcon from '../assets/agent-icons/geminicli-color.svg'
import cursorIcon from '../assets/agent-icons/cursor.svg'
import copilotIcon from '../assets/agent-icons/githubcopilot.svg'
import opencodeIcon from '../assets/agent-icons/opencode.svg'
import windsurfIcon from '../assets/agent-icons/windsurf.svg'
import workBuddyIcon from '../assets/agent-icons/workbuddy-color.svg'
import doubaoIcon from '../assets/agent-icons/doubao-color.svg'
import traeIcon from '../assets/agent-icons/trae-color.svg'
import hermesIcon from '../assets/agent-icons/hermesagent.svg'
import piIcon from '../assets/agent-icons/pi.svg'
import zcodeIcon from '../assets/agent-icons/zai.svg'
import deepSeekHarnessIcon from '../assets/agent-icons/deepseek-color.svg'
import { accentFor, initials } from '../lib/format'
import { Mark } from './Mark'

const AGENT_ICONS: Record<string, string> = {
  'claude-code': claudeCodeIcon,
  'claude-desktop': claudeDesktopIcon,
  codex: codexIcon,
  'gemini-cli': geminiCliIcon,
  cursor: cursorIcon,
  copilot: copilotIcon,
  opencode: opencodeIcon,
  windsurf: windsurfIcon,
  workbuddy: workBuddyIcon,
  doubao: doubaoIcon,
  trae: traeIcon,
  hermes: hermesIcon,
  pi: piIcon,
  zcode: zcodeIcon,
  'deepseek-harness': deepSeekHarnessIcon
}

export function AgentLogo({
  agentId,
  agentName,
  size = 20,
  shape = 'square',
  className = '',
  muted = false,
  decorative = false
}: {
  agentId: string
  agentName?: string
  size?: number
  shape?: 'square' | 'circle'
  className?: string
  muted?: boolean
  decorative?: boolean
}) {
  const source = AGENT_ICONS[agentId]
  const label = agentName ?? agentId
  const classes = [
    'agent-logo',
    `agent-logo-${shape}`,
    source ? 'agent-logo-brand' : 'agent-logo-fallback',
    muted ? 'muted' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')
  const accessibility = decorative
    ? {}
    : { role: 'img', 'aria-label': label, title: label }

  if (agentId === 'dachshund') {
    return (
      <span
        className={classes}
        style={{ width: size, height: size }}
        {...accessibility}
      >
        <Mark size={Math.max(10, Math.round(size * 0.72))} />
      </span>
    )
  }

  if (source) {
    return (
      <span
        className={classes}
        style={{ width: size, height: size }}
        {...accessibility}
      >
        <img src={source} alt="" draggable={false} />
      </span>
    )
  }

  return (
    <span
      className={classes}
      style={{
        width: size,
        height: size,
        background: accentFor(agentId),
        fontSize: Math.max(7, Math.round(size * 0.34))
      }}
      {...accessibility}
    >
      {initials(agentName ?? agentId, agentId)}
    </span>
  )
}
