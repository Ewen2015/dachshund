interface SecretPattern {
  id: string
  source: string
  flags: string
}

/**
 * Deliberately narrow: these are token shapes that should never be shared
 * between agents. Prose that merely mentions a token is left alone.
 */
const SECRET_PATTERNS: SecretPattern[] = [
  { id: 'openai-key', source: String.raw`\bsk-[A-Za-z0-9_-]{20,}\b`, flags: 'g' },
  { id: 'github-token', source: String.raw`\bgh[pousr]_[A-Za-z0-9]{20,}\b`, flags: 'g' },
  { id: 'github-pat', source: String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}\b`, flags: 'g' },
  { id: 'volcengine-key', source: String.raw`\bark-[0-9a-f]{8}-[0-9a-f-]{16,}\b`, flags: 'gi' },
  { id: 'aws-key', source: String.raw`\bAKIA[0-9A-Z]{16}\b`, flags: 'g' },
  { id: 'bearer-token', source: String.raw`\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*`, flags: 'g' },
  {
    id: 'private-key',
    source: String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----`,
    flags: 'g'
  }
]

function patternFor(pattern: SecretPattern): RegExp {
  return new RegExp(pattern.source, pattern.flags)
}

export function findSecretKinds(text: string): string[] {
  const kinds: string[] = []
  for (const pattern of SECRET_PATTERNS) {
    if (patternFor(pattern).test(text)) kinds.push(pattern.id)
  }
  return kinds
}

export function redactSecrets(text: string): { text: string; kinds: string[] } {
  let next = text
  const kinds: string[] = []
  for (const pattern of SECRET_PATTERNS) {
    const matcher = patternFor(pattern)
    if (!matcher.test(next)) continue
    kinds.push(pattern.id)
    next = next.replace(patternFor(pattern), `[redacted:${pattern.id}]`)
  }
  return { text: next, kinds }
}

export class SecretContentError extends Error {
  readonly kinds: string[]

  constructor(kinds: string[]) {
    super(`Content looks like it contains a credential (${kinds.join(', ')}).`)
    this.name = 'SecretContentError'
    this.kinds = kinds
  }
}
