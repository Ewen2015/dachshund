import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const home = os.homedir()
const defaultDataDir = path.join(home, 'Library', 'Application Support', 'dachshund')
const defaultLibraryDir = path.join(home, 'Documents', 'dachshund')
const legacyDataDir = path.join(home, 'Library', 'Application Support', 'Dachshund')
const legacyLibraryDir = path.join(home, 'Documents', 'Dachshund')

export const IS_DEMO = process.env.DACHSHUND_DEMO === '1'
export const DISABLE_IMPORT = process.env.DACHSHUND_DISABLE_IMPORT === '1'

export const DATA_DIR = process.env.DACHSHUND_HOME ?? defaultDataDir

export const LIBRARY_DIR = process.env.DACHSHUND_LIBRARY ?? defaultLibraryDir

export const MEMORY_DIR = path.join(LIBRARY_DIR, 'memory')
export const DB_PATH = path.join(DATA_DIR, 'dachshund.db')
export const RUNTIME_PATH = path.join(DATA_DIR, 'runtime.json')
export const LOG_PATH = path.join(DATA_DIR, 'dachshund.log')

function migrateLegacyDirectory(legacy: string, target: string): void {
  if (!fs.existsSync(legacy) || fs.existsSync(target)) return
  try {
    fs.renameSync(legacy, target)
  } catch {
    try {
      fs.cpSync(legacy, target, { recursive: true })
    } catch {
      // Keep starting with a fresh lowercase directory if migration is unavailable.
    }
  }
}

export function ensureDirs(): void {
  if (!process.env.DACHSHUND_HOME) migrateLegacyDirectory(legacyDataDir, defaultDataDir)
  if (!process.env.DACHSHUND_LIBRARY) {
    migrateLegacyDirectory(legacyLibraryDir, defaultLibraryDir)
  }
  for (const dir of [DATA_DIR, LIBRARY_DIR, MEMORY_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function expandHome(input: string): string {
  if (input === '~') return home
  if (input.startsWith('~/')) return path.join(home, input.slice(2))
  return input
}
