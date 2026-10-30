import { _electron as electron } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const demoRoot = path.join(root, '.demo-home')
const shots = path.join(root, 'docs', 'screenshots')
fs.mkdirSync(shots, { recursive: true })

const app = await electron.launch({
  args: [path.join(root, 'out', 'main', 'index.js')],
  env: {
    ...process.env,
    DACHSHUND_HOME: path.join(demoRoot, 'data'),
    DACHSHUND_LIBRARY: path.join(demoRoot, 'Documents', 'dachshund'),
    DACHSHUND_DEMO: '1',
    DACHSHUND_DISABLE_IMPORT: '1'
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
  win.setSize(1380, 900)
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
}

await app.close()
console.log(`Screenshots written to ${shots}`)
