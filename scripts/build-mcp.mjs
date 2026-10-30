import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const outfile = path.join(process.cwd(), 'out', 'mcp', 'index.cjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(process.cwd(), 'src', 'mcp', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile,
  logLevel: 'info',
  banner: { js: '#!/usr/bin/env node' },
  define: { 'process.env.NODE_ENV': '"production"' }
})

fs.chmodSync(outfile, 0o755)
console.log(`MCP bridge → ${outfile}`)
