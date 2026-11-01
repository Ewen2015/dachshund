import { _electron as electron } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const demoRoot = path.join(root, '.demo-home')
const shots = path.join(root, 'docs', 'screenshots')
fs.mkdirSync(shots, { recursive: true })
fs.mkdirSync(demoRoot, { recursive: true })

const updateManifest = path.join(demoRoot, 'update.json')
fs.writeFileSync(
  updateManifest,
  JSON.stringify(
    {
      tag_name: 'v0.1.11',
      name: 'dachshund v0.1.11',
      body: 'The menu bar panel now stays on the current screen.',
      html_url: 'https://github.com/Ewen2015/dachshund/releases/tag/v0.1.11',
      assets: [
        {
          name: 'dachshund-0.1.11-arm64.dmg',
          browser_download_url:
            'https://github.com/Ewen2015/dachshund/releases/download/v0.1.11/dachshund-0.1.11-arm64.dmg'
        }
      ]
    },
    null,
    2
  )
)

const app = await electron.launch({
  args: [path.join(root, 'out', 'main', 'index.js')],
  env: {
    ...process.env,
    DACHSHUND_HOME: path.join(demoRoot, 'data'),
    DACHSHUND_LIBRARY: path.join(demoRoot, 'Documents', 'dachshund'),
    DACHSHUND_USER_DATA: path.join(demoRoot, 'electron'),
    DACHSHUND_DEMO: '1',
    DACHSHUND_DISABLE_IMPORT: '1',
    DACHSHUND_UPDATE_MANIFEST: updateManifest,
    DACHSHUND_UPDATE_DELAY_MS: '150'
  }
})

async function waitForPage(predicate, timeout = 20_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const match = app.windows().find(predicate)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for an Electron window')
}

const page = await waitForPage((item) => item.url() && !item.url().includes('panel=1'))
await page.waitForSelector('.app-shell', { timeout: 20_000 })
await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows().find(
    (item) => !item.webContents.getURL().includes('panel=1')
  )
  if (!win) return
  win.setSize(920, 700)
  win.center()
})
await page.waitForTimeout(1200)

if (await page.locator('.onboarding').isVisible().catch(() => false)) {
  await page.screenshot({ path: path.join(shots, '00-onboarding.png') })
  await page.getByRole('button', { name: 'Enter dachshund' }).click()
  await page.waitForTimeout(700)
}

await page.screenshot({ path: path.join(shots, '01-memory.png') })

await page.getByRole('button', { name: 'Agents', exact: true }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(shots, '02-agents.png') })

await page.getByRole('button', { name: 'Memory', exact: true }).click()
await page.waitForTimeout(400)
await page.getByText('Paper before pixels', { exact: true }).first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(shots, '03-detail.png') })

await page.getByRole('button', { name: 'Close detail' }).click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'Open Claude Code memory' }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(shots, '09-agent-memory.png') })

await page.locator('.category-legend-item').filter({ hasText: 'Ways of working' }).click()
await page.waitForTimeout(350)
await page.screenshot({ path: path.join(shots, '10-agent-category.png') })

await page.locator('.back-link').click()
await page.waitForTimeout(350)
await page.getByRole('button', { name: 'New memory', exact: true }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(shots, '04-composer.png') })
await page.keyboard.press('Escape')
await page.waitForTimeout(250)
await page.keyboard.press('Escape')
await page.waitForTimeout(250)

await page.getByRole('button', { name: 'Settings', exact: true }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(shots, '05-settings.png') })

await page.getByRole('button', { name: 'Pulse', exact: true }).click()
await page.waitForTimeout(650)
await page.screenshot({ path: path.join(shots, '07-pulse.png') })
await page.locator('.pulse-categories').scrollIntoViewIfNeeded()
await page.waitForTimeout(350)
await page.screenshot({ path: path.join(shots, '11-pulse-category-mix.png') })

const panelPage = await waitForPage((item) => item.url().includes('panel=1'))
await app.evaluate(async ({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows().find((item) =>
    item.webContents.getURL().includes('panel=1')
  )
  if (!win) return
  win.setResizable(true)
  win.setSize(420, 620, false)
  win.setContentSize(420, 620, false)
  win.setPosition(120, 120)
  win.show()
  win.focus()
  await new Promise((resolve) => setTimeout(resolve, 700))
})
if (panelPage) {
  await panelPage.waitForTimeout(500)
  await panelPage.screenshot({
    path: path.join(shots, '06-menubar-panel.png'),
    scale: 'device'
  })
  await panelPage.getByRole('button', { name: 'Pulse', exact: true }).click()
  await panelPage.waitForTimeout(350)
  await panelPage.screenshot({
    path: path.join(shots, '08-menubar-pulse.png'),
    scale: 'device'
  })
}

await app.close()
console.log(`Screenshots written to ${shots}`)
