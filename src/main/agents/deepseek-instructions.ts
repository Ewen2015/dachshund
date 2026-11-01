const BEGIN_MARKER = '<!-- >>> dachshund memory (managed by dachshund) -->'
const END_MARKER = '<!-- <<< dachshund memory -->'

export const DEEPSEEK_MANAGED_BLOCK = [
  BEGIN_MARKER,
  '## Shared memory',
  '',
  'When prior user preferences, decisions, project context, or lessons could affect the answer, call the dachshund `memory_context` tool first.',
  '',
  'Call `memory_remember` only for durable, self-contained information explicitly provided or confirmed by the user. Never store raw transcripts, tool output, secrets, temporary task details, or speculative conclusions.',
  '',
  'When the user corrects an earlier shared memory, save the correction and forget the obsolete record if its id is known.',
  END_MARKER
].join('\n')

function managedBlockPattern(): RegExp {
  return /<!-- >>> dachshund memory \(managed by dachshund\) -->[\s\S]*?<!-- <<< dachshund memory -->/g
}

export function mergeDeepSeekInstructions(existing: string): string {
  const trimmed = existing.trim()
  if (managedBlockPattern().test(trimmed)) {
    return trimmed.replace(managedBlockPattern(), DEEPSEEK_MANAGED_BLOCK) + '\n'
  }
  return `${trimmed}${trimmed ? '\n\n' : ''}${DEEPSEEK_MANAGED_BLOCK}\n`
}

export function stripDeepSeekInstructions(raw: string): string {
  return raw.replace(managedBlockPattern(), '').replace(/\n{3,}/g, '\n\n').trim()
}
