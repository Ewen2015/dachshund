import { app, net, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { UpdateState } from '../shared/types'
import packageJson from '../../package.json'

const DEFAULT_CHECK_INTERVAL = 6 * 60 * 60 * 1000
const DEFAULT_CHECK_DELAY = 2500
const REQUEST_TIMEOUT = 20_000

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  name?: string
  body?: string
  html_url: string
  assets?: GitHubAsset[]
}

type UpdateListener = (state: UpdateState) => void

function parseVersion(value: string): [number, number, number] | null {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return 0
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1
  }
  return 0
}

function cleanReleaseNotes(value: string | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~[\]]/g, ' ')
    .replace(/^\s*[-+]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return cleaned.length > 260 ? `${cleaned.slice(0, 257)}...` : cleaned
}

function pickDmgAsset(release: GitHubRelease): GitHubAsset | null {
  const assets = release.assets ?? []
  return (
    assets.find((asset) => /arm64.*\.dmg$/i.test(asset.name)) ??
    assets.find((asset) => /\.dmg$/i.test(asset.name)) ??
    null
  )
}

function safeFilename(value: string): string {
  return value.replace(/[^0-9A-Za-z._-]/g, '-')
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function fallbackReleaseFromAtom(feed: string): GitHubRelease {
  const entry = feed.match(/<entry>([\s\S]*?)<\/entry>/)?.[1]
  if (!entry) throw new Error('No published release was found')
  const link = entry
    .match(/<link\s+rel="alternate"\s+type="text\/html"\s+href="([^"]+)"/)?.[1]
    ?.replace(/&amp;/g, '&')
  const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
  const content = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1]
  if (!link) throw new Error('Latest release could not be parsed')

  const tag = link.split('/').pop() ?? ''
  const version = tag.replace(/^v/i, '')
  const assetName = `dachshund-${version}-arm64.dmg`
  return {
    tag_name: tag,
    name: title ? decodeHtml(title).trim() : `dachshund ${version}`,
    body: content ? decodeHtml(content) : '',
    html_url: link,
    assets: [
      {
        name: assetName,
        browser_download_url: `https://github.com/Ewen2015/dachshund/releases/download/${tag}/${assetName}`
      }
    ]
  }
}

async function fetchWithTimeout(
  url: string,
  accept = 'application/vnd.github+json'
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    return await net.fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: accept,
        'User-Agent': `dachshund/${packageJson.version}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

export class UpdateService {
  private state: UpdateState
  private checkPromise: Promise<UpdateState> | null = null
  private downloadPromise: Promise<UpdateState> | null = null
  private initialTimer: ReturnType<typeof setTimeout> | null = null
  private intervalTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly currentVersion: string,
    private readonly onChange: UpdateListener
  ) {
    this.state = {
      phase: 'idle',
      currentVersion,
      latestVersion: null,
      releaseName: null,
      releaseNotes: null,
      releaseUrl: null,
      downloadUrl: null,
      assetName: null,
      downloadedPath: null,
      progress: null,
      checkedAt: null,
      error: null
    }
  }

  start(): void {
    if (process.env.DACHSHUND_UPDATE_DISABLED === '1') return
    const delay = Number(process.env.DACHSHUND_UPDATE_DELAY_MS ?? DEFAULT_CHECK_DELAY)
    const interval = Number(
      process.env.DACHSHUND_UPDATE_INTERVAL_MS ?? DEFAULT_CHECK_INTERVAL
    )
    this.initialTimer = setTimeout(() => {
      void this.checkForUpdates()
    }, Number.isFinite(delay) ? delay : DEFAULT_CHECK_DELAY)
    this.initialTimer.unref?.()
    this.intervalTimer = setInterval(() => {
      void this.checkForUpdates()
    }, Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_CHECK_INTERVAL)
    this.intervalTimer.unref?.()
  }

  stop(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer)
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.initialTimer = null
    this.intervalTimer = null
  }

  getState(): UpdateState {
    return this.state
  }

  private publish(patch: Partial<UpdateState>): UpdateState {
    this.state = { ...this.state, ...patch }
    this.onChange(this.state)
    return this.state
  }

  private async loadRelease(): Promise<GitHubRelease> {
    const override = process.env.DACHSHUND_UPDATE_MANIFEST
    const source =
      override ?? 'https://api.github.com/repos/Ewen2015/dachshund/releases/latest'

    if (!/^https?:\/\//.test(source)) {
      return JSON.parse(await fs.promises.readFile(source, 'utf8')) as GitHubRelease
    }

    try {
      const response = await fetchWithTimeout(source)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No published release was found')
        }
        if (response.status === 403) {
          throw new Error('GitHub update check was rate limited')
        }
        throw new Error(`Update check failed with HTTP ${response.status}`)
      }
      return (await response.json()) as GitHubRelease
    } catch (error) {
      if (override) throw error
      const response = await fetchWithTimeout(
        'https://github.com/Ewen2015/dachshund/releases.atom',
        'application/atom+xml'
      )
      if (!response.ok) {
        throw error
      }
      return fallbackReleaseFromAtom(await response.text())
    }
  }

  checkForUpdates(): Promise<UpdateState> {
    if (this.checkPromise) return this.checkPromise
    this.checkPromise = this.runCheck().finally(() => {
      this.checkPromise = null
    })
    return this.checkPromise
  }

  private async runCheck(): Promise<UpdateState> {
    this.publish({ phase: 'checking', error: null })
    try {
      const release = await this.loadRelease()
      const latestVersion = release.tag_name.replace(/^v/i, '')
      if (compareVersions(latestVersion, this.currentVersion) <= 0) {
        return this.publish({
          phase: 'up-to-date',
          latestVersion,
          releaseName: release.name ?? null,
          releaseNotes: cleanReleaseNotes(release.body),
          releaseUrl: release.html_url,
          downloadUrl: pickDmgAsset(release)?.browser_download_url ?? null,
          assetName: pickDmgAsset(release)?.name ?? null,
          progress: null,
          checkedAt: Date.now(),
          error: null
        })
      }

      const asset = pickDmgAsset(release)
      return this.publish({
        phase: 'available',
        latestVersion,
        releaseName: release.name ?? `dachshund ${latestVersion}`,
        releaseNotes: cleanReleaseNotes(release.body),
        releaseUrl: release.html_url,
        downloadUrl: asset?.browser_download_url ?? release.html_url,
        assetName: asset?.name ?? null,
        downloadedPath: null,
        progress: null,
        checkedAt: Date.now(),
        error: null
      })
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Update check timed out'
          : error instanceof Error
            ? error.message
            : 'Update check failed'
      return this.publish({
        phase: 'error',
        checkedAt: Date.now(),
        error: message
      })
    }
  }

  downloadUpdate(): Promise<UpdateState> {
    if (this.downloadPromise) return this.downloadPromise
    this.downloadPromise = this.runDownload().finally(() => {
      this.downloadPromise = null
    })
    return this.downloadPromise
  }

  private async runDownload(): Promise<UpdateState> {
    if (this.state.phase === 'downloaded' && this.state.downloadedPath) {
      return this.state
    }
    if (!this.state.downloadUrl) {
      return this.publish({ phase: 'error', error: 'No update download is available' })
    }
    if (!this.state.assetName) {
      await shell.openExternal(this.state.downloadUrl)
      return this.state
    }

    const filename = safeFilename(this.state.assetName)
    const downloadDir = process.env.DACHSHUND_DOWNLOAD_DIR ?? app.getPath('downloads')
    const destination = path.join(downloadDir, filename)
    const temporary = `${destination}.part`
    this.publish({ phase: 'downloading', progress: 0, error: null })

    try {
      const response = await net.fetch(this.state.downloadUrl, { redirect: 'follow' })
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with HTTP ${response.status}`)
      }

      const total = Number(response.headers.get('content-length') ?? 0)
      let received = 0
      let lastUpdate = 0
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length
          const now = Date.now()
          if (now - lastUpdate > 120) {
            lastUpdate = now
            const progress = total > 0 ? Math.min(received / total, 0.99) : null
            this.emit('progress', progress)
          }
          callback(null, chunk)
        }
      })
      meter.on('progress', (progress: number | null) => {
        this.publish({ phase: 'downloading', progress })
      })

      await fs.promises.mkdir(path.dirname(destination), { recursive: true })
      await pipeline(
        Readable.fromWeb(response.body as never),
        meter,
        fs.createWriteStream(temporary)
      )
      await fs.promises.rename(temporary, destination)
      return this.publish({
        phase: 'downloaded',
        downloadedPath: destination,
        progress: 1,
        error: null
      })
    } catch (error) {
      try {
        await fs.promises.unlink(temporary)
      } catch {
        // Ignore cleanup failures.
      }
      return this.publish({
        phase: 'error',
        progress: null,
        error: error instanceof Error ? error.message : 'Update download failed'
      })
    }
  }

  async openDownloadedUpdate(): Promise<boolean> {
    if (!this.state.downloadedPath) return false
    try {
      await fs.promises.access(this.state.downloadedPath)
      const result = await shell.openPath(this.state.downloadedPath)
      return result === ''
    } catch {
      return false
    }
  }
}
