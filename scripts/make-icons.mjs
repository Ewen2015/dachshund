import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const resources = path.join(root, 'resources')
const iconset = path.join(resources, 'icon.iconset')
fs.mkdirSync(iconset, { recursive: true })

const source = path.join(resources, 'icon.svg')
const master = path.join(resources, 'icon.png')
await sharp(source).resize(1024, 1024).png().toFile(master)

for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
  const normal = path.join(iconset, `icon_${size}x${size}.png`)
  const retina = path.join(iconset, `icon_${size}x${size}@2x.png`)
  await sharp(source).resize(size, size).png().toFile(normal)
  if (size <= 512) await sharp(source).resize(size * 2, size * 2).png().toFile(retina)
}

try {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'icon.icns')])
  console.log('icon.icns created')
} catch (error) {
  console.warn('iconutil failed:', error.message)
}

async function renderTray(size, file) {
  await sharp(path.join(resources, 'trayTemplate.svg'), { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(file)
}

async function assertTemplateHasMargins(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let touchesEdge = false
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3]
      if (alpha > 0 && (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)) {
        touchesEdge = true
      }
    }
  }
  if (touchesEdge) throw new Error(`Tray template is clipped at its edge: ${file}`)
}

const trayPath = path.join(resources, 'trayTemplate.png')
const trayRetinaPath = path.join(resources, 'trayTemplate@2x.png')
await renderTray(22, trayPath)
await renderTray(44, trayRetinaPath)
await assertTemplateHasMargins(trayPath)
await assertTemplateHasMargins(trayRetinaPath)

async function renderWideTray(width, height, file) {
  const trimmed = await sharp(path.join(resources, 'trayTemplate.svg'), { density: 768 })
    .trim()
    .png()
    .toBuffer()

  await sharp(trimmed)
    .resize(width - 2, height - 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .extend({
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(file)
}

const wideTrayPath = path.join(resources, 'trayTemplateLarge.png')
const wideTrayRetinaPath = path.join(resources, 'trayTemplateLarge@2x.png')
await renderWideTray(25, 20, wideTrayPath)
await renderWideTray(50, 40, wideTrayRetinaPath)
await assertTemplateHasMargins(wideTrayPath)
await assertTemplateHasMargins(wideTrayRetinaPath)
