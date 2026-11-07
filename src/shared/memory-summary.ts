const MAX_SUMMARY = 180
const MIN_SUMMARY = 24

function cleanLine(line: string): string {
  return line
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // Only paired emphasis disappears. Single `*`, `_`, and `~` stay because
    // they are common in paths, env var names, and glob patterns.
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)__([^_]+)__(?=\s|$)/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= MAX_SUMMARY) return trimmed
  const window = trimmed.slice(0, MAX_SUMMARY)
  const boundaries = [
    window.lastIndexOf('. '),
    window.lastIndexOf('。'),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
    window.lastIndexOf('；'),
    window.lastIndexOf('; ')
  ]
  const boundary = Math.max(...boundaries)
  if (boundary >= MIN_SUMMARY) return window.slice(0, boundary + 1).trim()
  return `${window.trimEnd()}…`
}

/**
 * One line that makes a memory useful in an index. Claude's memory index uses
 * the same shape: a title plus a short hook, with the detail left on disk.
 */
export function deriveSummary(content: string, explicit?: string | null): string {
  const provided = cleanLine(explicit ?? '')
  if (provided) return clip(provided)

  let inFence = false
  const candidates: string[] = []
  for (const raw of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^#{1,6}\s/.test(line)) continue
    if (/^[-=]{3,}$/.test(line)) continue
    if (/^\|/.test(line)) continue
    if (/^!\[/.test(line)) continue
    if (/^<[^>]+>$/.test(line)) continue
    if (/^\*\*(why|how to apply|why it matters)\*\*:?\s*$/i.test(line)) continue
    if (/^(why|how to apply|why it matters):\s*$/i.test(line)) continue
    const cleaned = cleanLine(
      line
        .replace(/^(description|summary):\s*/i, '')
        .replace(/^\*\*(why|how to apply|why it matters)\*\*:?\s*/i, '')
    )
    if (!cleaned) continue
    candidates.push(cleaned)
  }

  const first = candidates.find((item) => item.length >= MIN_SUMMARY) ?? candidates[0] ?? ''
  return clip(first)
}

export function summaryOf(content: string, stored?: string | null): string {
  const explicit = stored?.trim()
  return explicit ? clip(explicit) : deriveSummary(content)
}
