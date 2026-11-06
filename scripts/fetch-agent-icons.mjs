import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ICON_DIR = join(ROOT, 'src', 'renderer', 'src', 'assets', 'agent-icons')
const MANIFEST_PATH = join(ICON_DIR, 'manifest.json')

// Keep the source pinned. These SVGs are vendored at build time so the app
// never needs a network request to render an agent identity.
const PACKAGE_NAME = '@lobehub/icons-static-svg'
const PACKAGE_VERSION = '1.101.0'
const REPO_COMMIT = 'aea0ecb0fe1439467219197c52ffaeb579dfe33f'
const SOURCE_BASE = `https://unpkg.com/${PACKAGE_NAME}@${PACKAGE_VERSION}/icons`

const LOBE_ICONS = [
  { agentId: 'claude', file: 'claude-color.svg', source: 'claude-color.svg' },
  { agentId: 'codex', file: 'codex-color.svg', source: 'codex-color.svg' },
  { agentId: 'gemini-cli', file: 'geminicli-color.svg', source: 'geminicli-color.svg' },
  { agentId: 'cursor', file: 'cursor.svg', source: 'cursor.svg' },
  { agentId: 'copilot', file: 'githubcopilot.svg', source: 'githubcopilot.svg' },
  { agentId: 'opencode', file: 'opencode.svg', source: 'opencode.svg' },
  { agentId: 'workbuddy', file: 'workbuddy-color.svg', source: 'workbuddy-color.svg' },
  { agentId: 'doubao', file: 'doubao-color.svg', source: 'doubao-color.svg' },
  { agentId: 'hermes', file: 'hermesagent.svg', source: 'hermesagent.svg' },
  { agentId: 'pi', file: 'pi.svg', source: 'pi.svg' },
  { agentId: 'deepseek-harness', file: 'deepseek-color.svg', source: 'deepseek-color.svg' }
]

const EXTERNAL_ICONS = [
  {
    agentId: 'zcode',
    file: 'zai.svg',
    source: 'https://z-cdn.chatglm.cn/z-ai/static/logo.svg',
    collection: 'Z.ai official brand asset'
  }
]

const LOCAL_ICONS = [
  {
    agentId: 'trae',
    file: 'trae-color.svg',
    source: 'Trae CN.app application icon (vector redraw)',
    collection: 'TRAE official product asset',
    cachedOnly: true
  }
]

const ICONS = [
  ...LOBE_ICONS.map((icon) => ({
    ...icon,
    source: `${SOURCE_BASE}/${icon.source}`,
    collection: 'lobe-icons'
  })),
  ...EXTERNAL_ICONS,
  ...LOCAL_ICONS
]

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readCached(icon) {
  try {
    const value = await readFile(join(ICON_DIR, icon.file), 'utf8')
    if (!value.includes('<svg') || !value.includes('</svg>')) return null
    return value
  } catch {
    return null
  }
}

async function download(icon) {
  const url = icon.source
  const response = await fetch(url, {
    headers: { 'user-agent': 'dachshund-agent-icon-fetcher/1.0' }
  })
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`)
  }
  const value = await response.text()
  if (!value.includes('<svg') || !value.includes('</svg>')) {
    throw new Error(`Downloaded icon is not an SVG: ${url}`)
  }
  return value
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true })
  const force = process.argv.includes('--force')
  const entries = []
  let downloaded = 0

  for (const icon of ICONS) {
    let value = icon.cachedOnly ? await readCached(icon) : force ? null : await readCached(icon)
    if (!value && icon.cachedOnly) {
      throw new Error(`Local icon is missing or invalid: ${icon.file}`)
    }
    if (!value) {
      value = await download(icon)
      await writeFile(join(ICON_DIR, icon.file), value, 'utf8')
      downloaded += 1
    }
    entries.push({
      agentId: icon.agentId,
      file: icon.file,
      source: icon.source,
      collection: icon.collection,
      sha256: digest(value)
    })
  }

  const manifest = {
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    gitCommit: REPO_COMMIT,
    license: 'MIT',
    copyright: 'Copyright (c) 2023 LobeHub',
    homepage: 'https://github.com/lobehub/lobe-icons',
    runtimeNetwork: false,
    icons: entries
  }
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(
    downloaded
      ? `Cached ${downloaded} agent icons from LobeHub and external brand assets`
      : 'Agent icons are up to date'
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
