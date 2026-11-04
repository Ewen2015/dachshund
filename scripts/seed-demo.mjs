import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const root = process.cwd()
const demoRoot = path.join(root, '.demo-home')
const dataDir = path.join(demoRoot, 'data')
const library = path.join(demoRoot, 'Documents', 'dachshund')
const memoryDir = path.join(library, 'memory')

fs.rmSync(dataDir, { recursive: true, force: true })
fs.rmSync(memoryDir, { recursive: true, force: true })
fs.mkdirSync(memoryDir, { recursive: true })

const now = Date.now()
const day = 86_400_000
const iso = (daysAgo) => new Date(now - daysAgo * day).toISOString()

const memories = [
  {
    id: 'mem_demo_paper',
    title: 'Paper before pixels',
    kind: 'preference',
    project: 'Field Notes',
    tags: ['design', 'product', 'tone'],
    days: 0,
    agents: ['claude-code', 'codex', 'cursor', 'workbuddy', 'hermes', 'pi'],
    content:
      'Field Notes should feel like a paper field journal, not a productivity dashboard. Cream paper, ink, hairline rules, and one warm accent. When a screen starts to feel like software, remove a panel before adding a color.'
  },
  {
    id: 'mem_demo_reader',
    title: 'Ship the reader before the editor',
    kind: 'decision',
    project: 'Field Notes',
    tags: ['roadmap', 'scope'],
    days: 0,
    agents: ['codex', 'claude-code', 'doubao', 'zcode', 'deepseek-harness'],
    content:
      'The first release ships the reading experience only. Editing, collaboration, and publishing stay behind the next milestone. The reader has to feel finished on its own before we add authoring.'
  },
  {
    id: 'mem_demo_research',
    title: 'Memory research lives beside docs',
    kind: 'reference',
    project: 'dachshund',
    tags: ['research', 'docs'],
    days: 5,
    agents: ['codex'],
    content:
      'Dynamic product research belongs beside the docs directory, while stable architecture and import contracts stay inside docs. Link new findings from the implementation notes instead of copying them into several places.'
  },
  {
    id: 'mem_demo_feedback',
    title: 'Do not mock the storage boundary',
    kind: 'rule',
    project: 'dachshund',
    tags: ['testing', 'sqlite'],
    days: 7,
    agents: ['codex', 'cursor'],
    content:
      'Validation should exercise the real local storage boundary. A passing mock is not evidence that persistence, source attachment, or restart recovery works.'
  },
  {
    id: 'mem_demo_episode',
    title: 'Traced the missing menu bar update',
    kind: 'session_summary',
    project: 'dachshund',
    tags: ['session', 'updater'],
    days: 9,
    agents: ['pi', 'trae'],
    content:
      'The update state existed in the main process but never reached the compact panel. The session traced the event bridge, renderer subscription, and panel lifecycle before the fix was applied.'
  },
  {
    id: 'mem_demo_type',
    title: 'Never smaller than 15px',
    kind: 'rule',
    project: 'Field Notes',
    tags: ['typography', 'accessibility'],
    days: 1,
    agents: ['cursor', 'hermes'],
    content:
      'Body copy never goes below 15px. The default scale is 15 / 17 / 22 / 34. Larger type is allowed for editorial moments, but shrinking type to fit more content is not.'
  },
  {
    id: 'mem_demo_onboarding',
    title: 'No onboarding modals',
    kind: 'preference',
    project: null,
    tags: ['ux', 'onboarding'],
    days: 1,
    agents: ['claude-code', 'workbuddy'],
    content:
      'Mira closes onboarding modals on principle. Teach the product in place with a real first document, a quiet hint, and one obvious action. Never block the canvas with a carousel.'
  },
  {
    id: 'mem_demo_auth',
    title: 'Auth stays behind a feature flag',
    kind: 'constraint',
    project: 'Field Notes',
    tags: ['engineering', 'auth'],
    days: 2,
    agents: ['codex', 'doubao'],
    content:
      'Supabase auth is implemented but remains behind the `auth_enabled` flag until the local-first path is stable. Do not make an account mandatory for reading or capturing notes.'
  },
  {
    id: 'mem_demo_review',
    title: 'Friday review at 16:00',
    kind: 'profile',
    project: null,
    tags: ['ritual', 'planning'],
    days: 3,
    agents: ['gemini-cli'],
    content:
      'Every Friday at 16:00 Mira reviews the week, clears the inbox, and picks one thing to improve next week. Protect this block; do not schedule meetings over it.'
  },
  {
    id: 'mem_demo_comma',
    title: 'Oxford comma in editorial copy',
    kind: 'rule',
    project: null,
    tags: ['writing', 'editorial'],
    days: 4,
    agents: ['cursor', 'claude-code'],
    content:
      'Use the Oxford comma in editorial and marketing copy. Product UI labels stay terse and omit it when the sentence is only two items. Consistency matters more than the rule itself.'
  },
  {
    id: 'mem_demo_kyoto',
    title: 'The Kyoto notebook origin',
    kind: 'fact',
    project: 'Field Notes',
    tags: ['brand', 'story'],
    days: 6,
    agents: ['claude-code'],
    content:
      'The field-journal metaphor came from a small linen notebook Mira bought in Kyoto in 2019. The brand story can mention it, but the product should never become nostalgic or precious about stationery.'
  },
  {
    id: 'mem_demo_pdf',
    title: 'PDF export must keep footnotes',
    kind: 'constraint',
    project: 'Field Notes',
    tags: ['export', 'quality'],
    days: 8,
    agents: ['codex'],
    content:
      'PDF export is not done until footnotes, margin notes, and page numbers survive. Test with a document that has at least 40 footnotes and a two-column appendix before calling the export finished.'
  },
  {
    id: 'mem_demo_social',
    title: 'Never auto-post to social',
    kind: 'preference',
    project: null,
    tags: ['publishing', 'trust'],
    days: 12,
    agents: ['claude-code', 'gemini-cli'],
    content:
      'Drafting is allowed. Publishing without an explicit human confirmation is not. This applies to every channel, including the ones with an API that makes it easy.'
  },
  {
    id: 'mem_demo_quiet',
    title: 'Quiet interface, loud typography',
    kind: 'insight',
    project: 'Field Notes',
    tags: ['design', 'taste'],
    days: 16,
    agents: ['claude-code', 'codex', 'cursor', 'trae'],
    content:
      'The interface should be quiet so the writing can be loud. Spend boldness on type, pacing, and one signature detail, not on gradients, shadows, or decoration. If everything is emphasized, nothing is.'
  },
  {
    id: 'mem_demo_bench',
    title: 'Benchmark before rewriting',
    kind: 'insight',
    project: 'Field Notes',
    tags: ['engineering', 'performance'],
    days: 21,
    agents: ['codex'],
    content:
      'Do not rewrite the search index because it feels slow. Measure first with a real 500-document library. The last rewrite made startup 40ms faster and the code three times harder to read.'
  },
  {
    id: 'mem_demo_outline',
    title: 'Contents stress fixture',
    kind: 'reference',
    project: 'dachshund',
    tags: ['markdown', 'outline', 'layout'],
    days: 0,
    agents: ['codex'],
    content: fs.readFileSync(
      path.join(root, 'scripts', 'fixtures', 'outline-stress.md'),
      'utf8'
    )
  }
]

const agentNames = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'gemini-cli': 'Gemini CLI',
  cursor: 'Cursor',
  workbuddy: 'WorkBuddy',
  doubao: 'Doubao',
  trae: 'TRAE',
  hermes: 'Hermes',
  pi: 'Pi',
  zcode: 'ZCode',
  'deepseek-harness': 'DeepSeek Harness'
}

const sourcePaths = {
  'claude-code': '~/.claude/projects/-Users-mira-Documents-field-notes/memory/',
  codex: '~/.codex/memories/MEMORY.md',
  'gemini-cli': '~/.gemini/GEMINI.md',
  cursor: '~/.cursor/rules/',
  workbuddy: '~/.workbuddy/memory/',
  doubao: '~/Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace/.sessions/',
  trae: '~/.trae-cn/memory/projects/',
  hermes: '~/.hermes/memories/MEMORY.md',
  pi: '~/.pi/agent/sessions/',
  zcode: '~/.zcode/cli/db/db.sqlite',
  'deepseek-harness': '~/.dsh/sessions/'
}

for (const memory of memories) {
  const created = iso(memory.days + 2)
  const updated = iso(memory.days)
  const frontmatter = {
    id: memory.id,
    title: memory.title,
    kind: memory.kind,
    scope: memory.project ? 'project' : 'user',
    authority: 'agent_observed',
    tags: memory.tags,
    created,
    updated,
    status: 'active',
    pinned: false,
    sources: memory.agents.map((agent) => ({
      agent,
      path: sourcePaths[agent].endsWith('.md')
        ? sourcePaths[agent]
        : `${sourcePaths[agent]}${memory.id.replace('mem_demo_', '')}.md`,
      ref: `demo-${agent}-${memory.id.slice(-5)}`
    }))
  }
  if (memory.project) frontmatter.project = memory.project
  const slug = memory.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const file = path.join(memoryDir, `${updated.slice(0, 10)}-${slug}-${memory.id.slice(-6)}.md`)
  fs.writeFileSync(file, matter.stringify(`${memory.content}\n`, frontmatter), 'utf8')
}

console.log(`Seeded ${memories.length} demo memories in ${memoryDir}`)
