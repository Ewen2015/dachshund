import type { AgentSummary, MemorySource } from '../../../shared/types'
import { kindLabel as taxonomyKindLabel } from '../../../shared/memory-taxonomy'

export const AGENT_ACCENTS: Record<string, string> = {
  'claude-code': '#C0663B',
  'claude-desktop': '#B86A3F',
  codex: '#2E2B27',
  'gemini-cli': '#4C6F91',
  cursor: '#66765A',
  copilot: '#5C6570',
  opencode: '#8A6A4F',
  windsurf: '#3F7A6E',
  workbuddy: '#01C886',
  doubao: '#1E37FC',
  trae: '#32F08C',
  hermes: '#D45B90',
  pi: '#1C1C1C',
  zcode: '#2D2D2D',
  'deepseek-harness': '#4D6BFE',
  dachshund: '#B5542F'
}

export function accentFor(agentId: string): string {
  return AGENT_ACCENTS[agentId] ?? '#7A7064'
}

export function initials(name: string, id = ''): string {
  if (id === 'codex') return 'CX'
  if (id === 'claude-code') return 'CL'
  if (id === 'gemini-cli') return 'GM'
  if (id === 'cursor') return 'CU'
  if (id === 'copilot') return 'GH'
  if (id === 'opencode') return 'OC'
  if (id === 'windsurf') return 'WS'
  if (id === 'workbuddy') return 'WB'
  if (id === 'doubao') return 'DB'
  if (id === 'trae') return 'TR'
  if (id === 'hermes') return 'HE'
  if (id === 'pi') return 'PI'
  if (id === 'zcode') return 'ZC'
  if (id === 'deepseek-harness') return 'DS'
  const words = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/)
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export function uniqueSources(sources: MemorySource[]): MemorySource[] {
  const map = new Map<string, MemorySource>()
  for (const source of sources) {
    if (!map.has(source.agentId)) map.set(source.agentId, source)
  }
  return [...map.values()]
}

export function sortAgentsByMemory(agents: AgentSummary[]): AgentSummary[] {
  return [...agents].sort(
    (a, b) =>
      Number(b.installed) - Number(a.installed) ||
      b.memoryCount - a.memoryCount ||
      b.sourceCount - a.sourceCount ||
      a.name.localeCompare(b.name)
  )
}

export function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (delta < minute) return 'Just now'
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`
  if (delta < day) return `${Math.floor(delta / hour)}h ago`
  if (delta < day * 2) return 'Yesterday'
  if (delta < day * 7) return `${Math.floor(delta / day)}d ago`
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp)
}

export function groupLabel(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86_400_000
  if (timestamp >= startOfToday) return 'Today'
  if (timestamp >= startOfYesterday) return 'Yesterday'
  if (timestamp >= startOfToday - 86_400_000 * 6) return 'This week'
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
    return 'Earlier this month'
  }
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(timestamp)
}

export function kindLabel(kind: string): string {
  return taxonomyKindLabel(kind)
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(timestamp)
}

export function groupByLabel<T extends { updatedAt: number }>(
  items: T[]
): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = []
  for (const item of items) {
    const label = groupLabel(item.updatedAt)
    const current = groups[groups.length - 1]
    if (current?.label === label) current.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}
