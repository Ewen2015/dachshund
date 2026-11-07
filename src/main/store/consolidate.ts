import type { ConsolidationCandidate } from './db'

export interface ConsolidationGroup {
  canonical: string
  members: string[]
  reason: 'family' | 'title'
}

const MAX_GROUP_SIZE = 40
const MIN_SUBSTRING = 80
const SIMILARITY_THRESHOLD = 0.82

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'then',
  'than', 'have', 'has', 'was', 'were', 'are', 'but', 'not', 'you', 'your',
  'they', 'their', 'them', 'its', 'it', 'a', 'an', 'of', 'to', 'in', 'on',
  'at', 'by', 'as', 'or', 'is', 'be', 'if', 'we', 'our', 'us', 'can', 'will'
])

const AUTHORITY_RANK: Record<string, number> = {
  user_explicit: 4,
  project_declared: 3,
  agent_observed: 2,
  inferred: 1
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>`~[\]()]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedTitle(title: string): string {
  return normalize(title).replace(/\s+/g, ' ').trim()
}

function tokens(text: string): Set<string> {
  const plain = normalize(text)
  const out = new Set<string>()
  for (const word of plain.split(' ')) {
    if (word.length > 2 && !STOP_WORDS.has(word)) out.add(word)
  }
  const cjk = plain.match(/[一-鿿]/g) ?? []
  for (let index = 0; index < cjk.length - 1; index += 1) {
    out.add(`${cjk[index]}${cjk[index + 1]}`)
  }
  return out
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / (left.size + right.size - shared)
}

function shouldMerge(left: ConsolidationCandidate, right: ConsolidationCandidate): boolean {
  const a = normalize(left.content)
  const b = normalize(right.content)
  if (!a || !b) return false
  if (a === b) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (shorter.length >= MIN_SUBSTRING && longer.includes(shorter)) return true
  if (normalizedTitle(left.title) && normalizedTitle(left.title) === normalizedTitle(right.title)) {
    if (jaccard(tokens(left.content), tokens(right.content)) >= 0.55) return true
  }
  return jaccard(tokens(left.content), tokens(right.content)) >= SIMILARITY_THRESHOLD
}

function familyFor(candidate: ConsolidationCandidate): string | null {
  if (candidate.agentIds.length !== 1) return null
  const agentId = candidate.agentIds[0]
  const knowledge = candidate.refs.find((ref) => /:knowledge:\d+$/.test(ref))
  if (knowledge) return `${agentId}|${knowledge.replace(/:knowledge:\d+$/, '')}`
  if (candidate.refs.length === 1) return `${agentId}|${candidate.refs[0]}`
  return null
}

function compareCanonical(left: ConsolidationCandidate, right: ConsolidationCandidate): number {
  const authority =
    (AUTHORITY_RANK[right.authority] ?? 0) - (AUTHORITY_RANK[left.authority] ?? 0)
  if (authority) return authority
  if (left.agentIds.length !== right.agentIds.length) {
    return right.agentIds.length - left.agentIds.length
  }
  if (left.content.length !== right.content.length) {
    return right.content.length - left.content.length
  }
  return left.createdAt - right.createdAt || left.id.localeCompare(right.id)
}

function cluster(members: ConsolidationCandidate[]): ConsolidationCandidate[][] {
  const sorted = [...members].sort(compareCanonical)
  const clusters: ConsolidationCandidate[][] = []
  for (const candidate of sorted) {
    const match = clusters.find((group) =>
      group.some((existing) => shouldMerge(existing, candidate))
    )
    if (match) match.push(candidate)
    else clusters.push([candidate])
  }
  return clusters.filter((group) => group.length > 1)
}

/**
 * Pure planning step: no database writes, so the same rules can power a
 * dry-run report and the real consolidation pass.
 */
export function planConsolidation(
  candidates: ConsolidationCandidate[]
): ConsolidationGroup[] {
  const buckets = new Map<string, ConsolidationCandidate[]>()
  for (const candidate of candidates) {
    const family = familyFor(candidate)
    const key =
      family ??
      (candidate.agentIds.length === 1
        ? `${candidate.agentIds[0]}|title|${normalizedTitle(candidate.title)}`
        : null)
    if (!key) continue
    const bucket = buckets.get(key) ?? []
    bucket.push(candidate)
    buckets.set(key, bucket)
  }

  const groups: ConsolidationGroup[] = []
  for (const [key, bucket] of buckets) {
    if (bucket.length < 2 || bucket.length > MAX_GROUP_SIZE) continue
    for (const members of cluster(bucket)) {
      const sorted = [...members].sort(compareCanonical)
      groups.push({
        canonical: sorted[0].id,
        members: sorted.map((member) => member.id),
        reason: key.includes('|title|') ? 'title' : 'family'
      })
    }
  }
  return groups
}
