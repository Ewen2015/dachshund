import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { MemoryFile, MemorySource } from '../../shared/types'
import { MEMORY_DIR } from '../paths'
import { Db, makeId } from './db'

function listMarkdown(dir: string, maxFiles = 4000): string[] {
  const out: string[] = []
  const walk = (current: string): void => {
    if (out.length >= maxFiles) return
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full)
      if (out.length >= maxFiles) return
    }
  }
  walk(dir)
  return out
}

function firstHeading(content: string): string | null {
  const match = content.match(/^#{1,3}\s+(.+)$/m)
  return match ? match[1].trim() : null
}

function toTime(value: unknown, fallback: number): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((v) => v.trim().replace(/^#/, ''))
      .filter(Boolean)
  }
  return []
}

function asSources(value: unknown, file: string): MemoryFile['sources'] {
  if (!Array.isArray(value)) return [{ agentId: 'dachshund', path: file }]
  const sources = value
    .map((item) => {
      if (typeof item === 'string') return { agentId: item, path: file }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const agentId = typeof record.agent === 'string' ? record.agent : 'dachshund'
        const sourcePath = typeof record.path === 'string' ? record.path : file
        const ref = typeof record.ref === 'string' ? record.ref : undefined
        return { agentId, path: sourcePath, ref }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  return sources.length ? sources : [{ agentId: 'dachshund', path: file }]
}

export class Library {
  ensure(): void {
    fs.mkdirSync(MEMORY_DIR, { recursive: true })
  }

  readAll(): Array<MemoryFile & { filePath: string }> {
    this.ensure()
    return listMarkdown(MEMORY_DIR)
      .map((file) => this.readFile(file))
      .filter((item): item is MemoryFile & { filePath: string } => Boolean(item))
  }

  readFile(file: string): (MemoryFile & { filePath: string }) | null {
    try {
      const stats = fs.statSync(file)
      if (stats.size > 1_500_000) return null
      const raw = fs.readFileSync(file, 'utf8')
      const parsed = matter(raw)
      const body = parsed.content.trim()
      if (!body) return null
      const data = parsed.data as Record<string, unknown>
      const fallbackTime = stats.mtimeMs
      const title =
        (typeof data.title === 'string' && data.title.trim()) ||
        (typeof data.name === 'string' && data.name.trim()) ||
        firstHeading(body) ||
        path.basename(file, '.md')
      const id = typeof data.id === 'string' && data.id ? data.id : makeId()
      return {
        id,
        title,
        content: body,
        kind: typeof data.kind === 'string' ? data.kind : 'fact',
        project: typeof data.project === 'string' && data.project ? data.project : null,
        tags: asTags(data.tags),
        createdAt: toTime(data.created, stats.birthtimeMs || fallbackTime),
        updatedAt: toTime(data.updated, fallbackTime),
        archived: data.status === 'archived' || data.archived === true,
        pinned: data.pinned === true,
        sources: asSources(data.sources, file),
        filePath: file
      }
    } catch {
      return null
    }
  }

  syncToDb(db: Db): number {
    const files = this.readAll()
    for (const file of files) {
      db.upsertMemory({
        id: file.id,
        title: file.title,
        content: file.content,
        kind: file.kind,
        project: file.project,
        tags: file.tags,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        archived: file.archived,
        pinned: file.pinned,
        filePath: file.filePath
      })
      for (const source of file.sources) {
        db.attachSource(file.id, {
          agentId: source.agentId,
          agentName: agentNameFor(source.agentId),
          path: source.path,
          ref: source.ref,
          importedAt: Date.now()
        })
      }
    }
    return files.length
  }

  write(file: MemoryFile, existingPath?: string | null): string {
    this.ensure()
    const target = existingPath ?? this.pathFor(file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const frontmatter: Record<string, unknown> = {
      id: file.id,
      title: file.title,
      kind: file.kind,
      tags: file.tags,
      created: new Date(file.createdAt).toISOString(),
      updated: new Date(file.updatedAt).toISOString(),
      status: file.archived ? 'archived' : 'active',
      pinned: file.pinned,
      sources: file.sources.map((source) =>
        source.ref
          ? { agent: source.agentId, path: source.path, ref: source.ref }
          : { agent: source.agentId, path: source.path }
      )
    }
    if (file.project) frontmatter.project = file.project
    const output = matter.stringify(`${file.content.trim()}\n`, frontmatter)
    fs.writeFileSync(target, output, 'utf8')
    return target
  }

  pathFor(file: MemoryFile): string {
    const date = new Date(file.createdAt)
    const stamp = Number.isNaN(date.getTime())
      ? new Date().toISOString().slice(0, 10)
      : date.toISOString().slice(0, 10)
    const slug = slugify(file.title)
    return path.join(MEMORY_DIR, `${stamp}-${slug}-${file.id.slice(-6)}.md`)
  }

  isInsideLibrary(file: string): boolean {
    const relative = path.relative(MEMORY_DIR, file)
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
  }
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
  return slug || 'memory'
}

export function agentNameFor(id: string): string {
  const names: Record<string, string> = {
    'claude-code': 'Claude Code',
    'claude-desktop': 'Claude Desktop',
    codex: 'Codex',
    'gemini-cli': 'Gemini CLI',
    cursor: 'Cursor',
    copilot: 'GitHub Copilot',
    opencode: 'OpenCode',
    windsurf: 'Windsurf',
    workbuddy: 'WorkBuddy',
    doubao: 'Doubao',
    dachshund: 'dachshund'
  }
  return names[id] ?? id
}

export function sourceFromPath(agentId: string, sourcePath: string): MemorySource {
  return {
    agentId,
    agentName: agentNameFor(agentId),
    path: sourcePath,
    importedAt: Date.now()
  }
}
