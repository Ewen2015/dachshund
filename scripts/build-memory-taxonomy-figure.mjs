import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'renderer', 'src', 'assets', 'memory-taxonomy.svg')
const WIDTH = 900
const HEIGHT = 500

const CATEGORIES = [
  {
    id: 'identity',
    label: 'IDENTITY',
    question: 'who you are',
    description: ['Stable context about you', 'and your role.'],
    kinds: ['profile'],
    color: '#B5542F'
  },
  {
    id: 'guidance',
    label: 'GUIDANCE',
    question: 'how to work',
    description: ['Defaults, rules, and', 'repeatable ways to work.'],
    kinds: ['preference', 'rule', 'procedure'],
    color: '#55745F'
  },
  {
    id: 'knowledge',
    label: 'KNOWLEDGE',
    question: 'what is true',
    description: ['Durable facts, references,', 'and lessons.'],
    kinds: ['fact', 'reference', 'insight'],
    color: '#9B7A4D'
  },
  {
    id: 'current',
    label: 'CURRENT WORK',
    question: 'what is active',
    description: ['Active goals, constraints,', 'and decisions.'],
    kinds: ['goal', 'constraint', 'decision'],
    color: '#5F7089'
  }
]

const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function text(x, y, value, { size = 12, weight = 500, fill = '#171718', anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(value)}</text>`
}

function mono(x, y, value, { size = 10, fill = '#77716A', anchor = 'start' } = {}) {
  return `<text class="plan-mono" x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${escapeXml(value)}</text>`
}

function stageLabel(x, y, number, label) {
  return `
    <g>
      ${mono(x, y, number, { size: 9.5, fill: '#96938D' })}
      ${text(x + 22, y, label, { size: 10.5, weight: 650, fill: '#5F5D59' })}
    </g>`
}

function nativeCard(x, y, file, contents) {
  return `
    <g>
      <rect x="${x + 3}" y="${y + 4}" width="176" height="46" rx="6" fill="#E9E9E4"/>
      <rect x="${x}" y="${y}" width="176" height="46" rx="6" fill="#FFFFFF" stroke="#D8D7D1"/>
      <path d="M${x + 12} ${y + 11}h12" stroke="#B8B6AF" stroke-width="1.2"/>
      ${mono(x + 12, y + 26, file, { size: 10.2, fill: '#242425' })}
      ${text(x + 12, y + 40, contents, { size: 9.2, fill: '#77736C' })}
    </g>`
}

function kindChip(x, y, label, color) {
  const width = Math.max(44, label.length * 5.7 + 12)
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="22" rx="5" fill="${color}0D" stroke="${color}36"/>
      ${text(x + 6.5, y + 14.5, label, { size: 9.3, weight: 560, fill: color })}
    </g>`
}

function categoryCard(category, x, y, index) {
  const chipY = y + 91
  let chipX = x + 14
  const chips = category.kinds
    .map((kind) => {
      const item = kindChip(chipX, chipY, kind, category.color)
      chipX += Math.max(44, kind.length * 5.7 + 12) + 5
      return item
    })
    .join('')

  return `
    <g data-bin="${category.id}">
      <g filter="url(#card-shadow)">
        <rect x="${x}" y="${y}" width="218" height="128" rx="10" fill="#FFFFFF" stroke="#D7D5CF"/>
        <path d="M${x + 10} ${y} H${x + 208}" stroke="${category.color}" stroke-width="3" stroke-linecap="round"/>
      </g>
      ${mono(x + 14, y + 22, `0${index + 1}`, { size: 9.5, fill: category.color })}
      ${text(x + 14, y + 43, category.label, { size: 14, weight: 680, fill: '#171718' })}
      ${text(x + 204, y + 22, category.question, { size: 9.5, fill: '#8B8881', anchor: 'end' })}
      ${text(x + 14, y + 65, category.description[0], { size: 10.3, fill: '#6F6C66' })}
      ${text(x + 14, y + 78, category.description[1], { size: 10.3, fill: '#6F6C66' })}
      ${chips}
    </g>`
}

const categoryCards = CATEGORIES.map((category, index) => {
  const column = index % 2
  const row = Math.floor(index / 2)
  return categoryCard(category, 418 + column * 230, 58 + row * 142, index)
}).join('')

const sourceRoutes = `
  <g class="plan-routes">
    <path class="plan-route is-source" d="M214 104 H247 Q257 104 257 151 V198 H274"/>
    <path class="plan-route is-source" d="M214 163 H257 V198 H274"/>
    <path class="plan-route is-source" d="M214 222 H247 Q257 222 257 213 V198 H274"/>
  </g>`

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="memory-plan-title memory-plan-desc" class="memory-plan-svg">
  <title id="memory-plan-title">How dachshund files memory</title>
  <desc id="memory-plan-desc">A top-down filing plan. Agent-native files enter a normalizer that resolves ten durable kinds and assigns each memory to one of four fixed categories. Evidence and Unclassified sit in a separate review tray.</desc>
  <defs>
    <pattern id="plan-grid" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.65" fill="#D8D7D1"/>
    </pattern>
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="135%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#171718" flood-opacity="0.055"/>
    </filter>
  </defs>
  <style>
    text {
      font-family: "Instrument Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif;
      font-variation-settings: "wdth" 100;
    }
    .plan-mono {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .plan-route {
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-dasharray: 3 4;
      opacity: 0.52;
    }
    .plan-route.is-source {
      stroke: #A6A39C;
    }
    .plan-route.is-aux {
      stroke: #9B9690;
    }
  </style>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#F8F8F5"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#plan-grid)" opacity="0.63"/>

  ${stageLabel(24, 29, '01', 'NATIVE FILES')}
  ${stageLabel(274, 29, '02', 'NORMALIZE')}
  ${stageLabel(418, 29, '03', 'FIXED CATEGORY')}

  <rect x="20" y="44" width="220" height="368" rx="12" fill="#FCFCFA" stroke="#DEDDD7"/>
  <rect x="274" y="44" width="122" height="368" rx="12" fill="#FCFCFA" stroke="#DEDDD7" stroke-dasharray="4 5"/>

  ${nativeCard(36, 81, 'USER.md', 'profile')}
  ${nativeCard(36, 140, 'FEEDBACK.md', 'preference · rule')}
  ${nativeCard(36, 199, 'PROJECT.md', 'goal · constraint')}

  <path d="M36 270 H216" stroke="#E1E0DA"/>
  ${mono(36, 291, 'OTHER AGENT FORMATS', { size: 9.5, fill: '#8C8982' })}
  <g>
    <rect x="36" y="302" width="176" height="26" rx="5" fill="#F1F1ED" stroke="#E1E0DA"/>
    ${text(48, 319, 'Claude · Codex · WorkBuddy', { size: 9.8, fill: '#76736D' })}
  </g>
  <g>
    <rect x="36" y="334" width="176" height="26" rx="5" fill="#F1F1ED" stroke="#E1E0DA"/>
    ${text(48, 351, 'Trae · Pi · DeepSeek Harness', { size: 9.8, fill: '#76736D' })}
  </g>
  <g>
    <rect x="36" y="366" width="176" height="26" rx="5" fill="#F1F1ED" stroke="#E1E0DA"/>
    ${text(48, 383, 'Hermes · Doubao · MCP writes', { size: 9.8, fill: '#76736D' })}
  </g>

  <g>
    <circle cx="335" cy="111" r="29" fill="#F0F0EB" stroke="#C9C7C0"/>
    <circle cx="335" cy="111" r="22" fill="#FFFFFF" stroke="#D7D5CF"/>
    ${text(335, 108, '10', { size: 18, weight: 690, anchor: 'middle' })}
    ${mono(335, 122, 'KINDS', { size: 8.5, fill: '#7C7972', anchor: 'middle' })}
  </g>

  <path d="M286 154 H374" stroke="#E1E0DA"/>
  ${mono(289, 177, '01  KEEP SOURCE', { size: 9.2 })}
  ${text(289, 193, 'Source retained.', { size: 9.2, fill: '#74716B' })}
  <path d="M286 208 H374" stroke="#E1E0DA"/>
  ${mono(289, 231, '02  RESOLVE KIND', { size: 9.2 })}
  ${text(289, 247, 'Content decides.', { size: 9.2, fill: '#74716B' })}
  <path d="M286 262 H374" stroke="#E1E0DA"/>
  ${mono(289, 285, '03  ASSIGN SHELF', { size: 9.2 })}
  ${text(289, 301, 'One fixed category.', { size: 9.2, fill: '#74716B' })}

  <rect x="284" y="332" width="98" height="56" rx="7" fill="#EEF1EB" stroke="#D5DAD1"/>
  ${text(333, 352, '10 kinds', { size: 11, weight: 660, anchor: 'middle' })}
  ${text(333, 367, '4 categories', { size: 9.5, fill: '#686C62', anchor: 'middle' })}
  ${mono(333, 380, '+ 2 trays', { size: 8.4, fill: '#7C8076', anchor: 'middle' })}

  ${sourceRoutes}
  <path class="plan-route is-main" d="M396 198 H408"/>
  <path d="M408 194 L416 198 L408 202Z" fill="#8B8881"/>
  ${categoryCards}

  <g>
    <path class="plan-route is-aux" d="M333 388 V416 H414"/>
    <rect x="418" y="352" width="214" height="88" rx="9" fill="#FCFCFA" stroke="#D9D6D4"/>
    <path d="M428 357 H622" stroke="#8B6D76" stroke-width="3" stroke-linecap="round"/>
    ${mono(432, 376, 'EVIDENCE', { size: 9.5, fill: '#8B6D76' })}
    ${text(432, 395, 'Keep source evidence intact.', { size: 10.2, weight: 560, fill: '#313032' })}
    ${text(432, 412, 'session summary · rollout · compaction', { size: 8.8, fill: '#75716F' })}
    ${text(432, 426, 'workspace log · feedback event', { size: 8.8, fill: '#75716F' })}

    <rect x="648" y="352" width="214" height="88" rx="9" fill="#FCFCFA" stroke="#D9D6D4"/>
    <path d="M658 357 H852" stroke="#77716A" stroke-width="3" stroke-linecap="round"/>
    ${mono(662, 376, 'UNCLASSIFIED', { size: 9.5, fill: '#77716A' })}
    ${text(662, 395, 'Review before durable filing.', { size: 10.2, weight: 560, fill: '#313032' })}
    ${text(662, 412, 'unknown · ambiguous · unsupported', { size: 8.8, fill: '#75716F' })}
    ${mono(662, 427, 'NO FORCED GUESS', { size: 8.6, fill: '#8A867F' })}
  </g>

  <g>
    <circle cx="24" cy="438" r="2.5" fill="#55745F"/>
    ${text(34, 442, 'Kind is the concrete type. Category is the stable shelf.', { size: 10.5, weight: 560, fill: '#5D5A55' })}
  </g>
</svg>`

mkdirSync(dirname(OUT), { recursive: true })
const output = svg
  .trim()
  .split('\n')
  .map((line) => line.trimEnd())
  .join('\n')
writeFileSync(OUT, `${output}\n`)
console.log(`wrote ${OUT}`)
