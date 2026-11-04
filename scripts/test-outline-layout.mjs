import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { _electron as electron } from 'playwright'

const root = process.cwd()
const demoRoot = path.join(root, '.demo-home')
const outputDir = path.join(root, 'release')
fs.mkdirSync(outputDir, { recursive: true })

const seeded = spawnSync(process.execPath, ['scripts/seed-demo.mjs'], {
  cwd: root,
  encoding: 'utf8'
})
if (seeded.status !== 0) {
  process.stderr.write(seeded.stderr)
  process.exit(seeded.status ?? 1)
}

const app = await electron.launch({
  args: [path.join(root, 'out', 'main', 'index.js')],
  env: {
    ...process.env,
    DACHSHUND_HOME: path.join(demoRoot, 'data'),
    DACHSHUND_LIBRARY: path.join(demoRoot, 'Documents', 'dachshund'),
    DACHSHUND_USER_DATA: path.join(demoRoot, 'electron'),
    DACHSHUND_DEMO: '1',
    DACHSHUND_DISABLE_IMPORT: '1',
    DACHSHUND_UPDATE_DISABLED: '1'
  }
})

async function waitForPage(predicate, timeout = 20_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const match = app.windows().find(predicate)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for the dachshund window')
}

try {
  const page = await waitForPage(
    (item) => item.url() && !item.url().includes('panel=1')
  )
  await page.waitForSelector('.app-shell', { timeout: 20_000 })
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(
      (item) => !item.webContents.getURL().includes('panel=1')
    )
    win?.setSize(920, 700)
    win?.center()
  })
  await page.waitForTimeout(700)

  if (await page.locator('.onboarding').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Enter dachshund' }).click()
    await page.waitForTimeout(500)
  }

  await page.getByText('Contents stress fixture', { exact: true }).first().click()
  await page.locator('.memory-outline').waitFor({ state: 'visible' })
  await page.waitForTimeout(350)

  const sidebar = await page.evaluate(() => {
    const outline = document.querySelector('.memory-outline')
    const list = document.querySelector('.memory-outline-list')
    const items = Array.from(document.querySelectorAll('.memory-outline-item'))
    const h4Items = items.filter((item) => item.dataset.outlineLevel === '4')
    const h2Items = items.filter((item) => item.dataset.outlineLevel === '2')
    const style = (item) => item && getComputedStyle(item)
    const contentWidth = (item) => {
      if (!item) return 0
      const computed = getComputedStyle(item)
      return (
        item.clientWidth -
        Number.parseFloat(computed.paddingLeft) -
        Number.parseFloat(computed.paddingRight)
      )
    }
    return {
      outlineWidth: outline?.getBoundingClientRect().width ?? 0,
      itemCount: items.length,
      h4Count: h4Items.length,
      h4ContentWidth: Math.min(...h4Items.map(contentWidth)),
      h4Padding: Math.max(
        ...h4Items.map((item) => Number.parseFloat(style(item).paddingLeft))
      ),
      h2Padding: Math.min(
        ...h2Items.map((item) => Number.parseFloat(style(item).paddingLeft))
      ),
      whiteSpace: style(items[0]).whiteSpace,
      completeLabels: items.every(
        (item) =>
          item.title === item.textContent?.trim() &&
          item.getAttribute('aria-label') === item.textContent?.trim()
      ),
      minimumItemHeight: Math.min(
        ...items.map((item) => item.getBoundingClientRect().height)
      ),
      verticallyClippedItems: items.filter(
        (item) => item.scrollHeight > item.clientHeight + 1
      ).length,
      overflowY: style(list).overflowY,
      scrollable: Boolean(list && list.scrollHeight > list.clientHeight)
    }
  })

  assert.equal(sidebar.itemCount, 28, 'fixture should render all 28 headings')
  assert.equal(sidebar.h4Count, 16, 'fixture should render all 16 h4 headings')
  assert.ok(
    sidebar.outlineWidth >= 164 && sidebar.outlineWidth <= 190,
    `compact outline width should stay readable, received ${sidebar.outlineWidth}px`
  )
  assert.ok(
    sidebar.h4ContentWidth >= 120,
    `h4 labels need usable width, received ${sidebar.h4ContentWidth}px`
  )
  assert.ok(
    sidebar.h4Padding <= 24 && sidebar.h4Padding > sidebar.h2Padding,
    'deep indentation should be capped while preserving visible hierarchy'
  )
  assert.equal(sidebar.whiteSpace, 'nowrap', 'outline labels should use stable one-line rows')
  assert.ok(sidebar.completeLabels, 'every clipped label needs title and aria-label text')
  assert.ok(
    sidebar.minimumItemHeight >= 27,
    `outline rows should not shrink vertically, received ${sidebar.minimumItemHeight}px`
  )
  assert.equal(
    sidebar.verticallyClippedItems,
    0,
    'outline row text must not be clipped by vertical flex shrinking'
  )
  assert.equal(sidebar.overflowY, 'auto', 'the Contents rail should remain vertically scrollable')
  assert.ok(sidebar.scrollable, 'a 28-heading outline should scroll vertically')

  await page.screenshot({ path: path.join(outputDir, 'outline-sidebar.png') })

  await page.getByRole('button', { name: 'Collapse contents' }).click()
  await page.waitForTimeout(250)
  const collapsedWidth = await page
    .locator('.memory-outline')
    .evaluate((element) => element.getBoundingClientRect().width)
  assert.ok(collapsedWidth <= 40, `collapsed outline should stay compact, received ${collapsedWidth}px`)
  await page.getByRole('button', { name: 'Expand contents' }).click()
  await page.waitForTimeout(250)

  await page.locator('.detail-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(400)
  const activeVisible = await page.locator('.memory-outline-item.is-active').evaluate((item) => {
    const itemBounds = item.getBoundingClientRect()
    const listBounds = item.closest('.memory-outline-list').getBoundingClientRect()
    return itemBounds.top >= listBounds.top - 1 && itemBounds.bottom <= listBounds.bottom + 1
  })
  assert.ok(activeVisible, 'the active outline item should remain visible while reading')

  await page.locator('.memory-outline-item[data-outline-level="4"]').first().click()
  await page.waitForTimeout(500)
  const activeText = await page.locator('.memory-outline-item.is-active').getAttribute('aria-label')
  assert.ok(activeText, 'clicking an outline item should update the active item')

  await page.getByRole('button', { name: 'Expand memory' }).click()
  await page.waitForTimeout(350)
  const expanded = await page.evaluate(() => {
    const outline = document.querySelector('.memory-outline')
    const items = Array.from(document.querySelectorAll('.memory-outline-item'))
    return {
      detailExpanded: document.querySelector('.detail')?.classList.contains('is-expanded'),
      outlineWidth: outline?.getBoundingClientRect().width ?? 0,
      itemCount: items.length,
      nowrap: getComputedStyle(items[0]).whiteSpace
    }
  })
  assert.ok(expanded.detailExpanded, 'expanded reading state should be active')
  assert.ok(expanded.outlineWidth >= 200, 'expanded outline should retain its wider rail')
  assert.equal(expanded.itemCount, 28, 'expanded mode should retain every heading')
  assert.equal(expanded.nowrap, 'nowrap', 'expanded labels should retain one-line rhythm')

  await page.screenshot({ path: path.join(outputDir, 'outline-expanded.png') })
  console.log(JSON.stringify({ sidebar, collapsedWidth, expanded }, null, 2))
} finally {
  await app.close()
}
