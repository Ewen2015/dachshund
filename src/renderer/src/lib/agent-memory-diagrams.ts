import claudeCodeDiagram from '../assets/agent-memory/claude-code.svg'
import claudeDesktopDiagram from '../assets/agent-memory/claude-desktop.svg'
import codexDiagram from '../assets/agent-memory/codex.svg'
import hermesDiagram from '../assets/agent-memory/hermes.svg'
import opencodeDiagram from '../assets/agent-memory/opencode.svg'
import piDiagram from '../assets/agent-memory/pi.svg'
import traeDiagram from '../assets/agent-memory/trae.svg'
import workbuddyDiagram from '../assets/agent-memory/workbuddy.svg'

interface AgentMemoryDiagram {
  src: string
  flow: string
  alt: string
}

const AGENT_MEMORY_DIAGRAMS: Record<string, AgentMemoryDiagram> = {
  codex: {
    src: codexDiagram,
    flow: 'Chats → extract → local memory → next chat',
    alt: 'Codex memory mechanism: eligible chats are processed in the background, saved as local memory, and recalled in a later chat while AGENTS.md remains an instruction layer.'
  },
  workbuddy: {
    src: workbuddyDiagram,
    flow: 'Conversations → nightly summary → next chat · past sessions → search',
    alt: 'WorkBuddy Desktop memory mechanism: conversations produce a nightly summary for a later chat, while past sessions can also be searched directly.'
  },
  'claude-code': {
    src: claudeCodeDiagram,
    flow: 'CLAUDE.md → every session · MEMORY.md index → topics on demand',
    alt: 'Claude Code memory mechanism: CLAUDE.md loads as an instruction every session; a small MEMORY.md index points to topic files that load on demand.'
  },
  'claude-desktop': {
    src: claudeDesktopDiagram,
    flow: 'Local project → local memory · account topics → cloud · no sync',
    alt: 'Claude Desktop memory mechanism: local project memory stays on the device, account topics support cloud Chat, and the two sides do not sync.'
  },
  opencode: {
    src: opencodeDiagram,
    flow: 'Project and global rules + config → session context · no typed auto memory',
    alt: 'OpenCode memory mechanism: project and global instruction sources are combined into session context, with no documented typed automatic memory store.'
  },
  trae: {
    src: traeDiagram,
    flow: 'User profile + project memory → current task · rules remain separate',
    alt: 'Trae memory mechanism: a global user profile and project memory are selected for the current task, while rules remain a separate instruction system.'
  },
  pi: {
    src: piDiagram,
    flow: 'Session tree → active branch → model context · compaction summary → model context',
    alt: 'Pi memory mechanism: the model reads the active branch of a stored session tree; compaction adds a summary to the model context without deleting raw entries.'
  },
  hermes: {
    src: hermesDiagram,
    flow: 'MEMORY.md + USER.md → frozen snapshot → session · writes apply next session',
    alt: 'Hermes memory mechanism: MEMORY.md and USER.md are injected as a frozen snapshot at session start; live writes reach the prompt only in a later session.'
  }
}

export function agentMemoryDiagram(agentId: string): AgentMemoryDiagram | null {
  return AGENT_MEMORY_DIAGRAMS[agentId] ?? null
}
