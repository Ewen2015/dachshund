import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function nodeRuntime(): string {
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'node'),
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    ...(process.env.PATH ?? '')
      .split(path.delimiter)
      .filter(Boolean)
      .map((directory) => path.join(directory, 'node'))
  ]

  for (const candidate of [...new Set(candidates)]) {
    try {
      if (fs.statSync(candidate).isFile()) {
        fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      }
    } catch {
      // Try the next known Node.js location.
    }
  }
  return 'node'
}
