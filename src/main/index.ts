import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  shell,
  screen,
  globalShortcut,
  dialog
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { Store } from './store'
import { startHttpServer } from './server'
import type {
  CreateMemoryInput,
  SearchQuery,
  UpdateState,
  UpdateMemoryInput
} from '../shared/types'
import { LIBRARY_DIR, expandHome } from './paths'
import { UpdateService } from './updater'
import packageJson from '../../package.json'

app.setName('dachshund')
if (process.env.DACHSHUND_USER_DATA) {
  fs.mkdirSync(process.env.DACHSHUND_USER_DATA, { recursive: true })
  app.setPath('userData', process.env.DACHSHUND_USER_DATA)
}
const APP_VERSION = packageJson.version

let mainWindow: BrowserWindow | null = null
let panelWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayMenu: Menu | null = null
let panelVisibleBeforeClick = false
let store: Store
let updateService: UpdateService | null = null
let latestUpdateState: UpdateState | null = null
let closeServer: (() => void) | null = null
let quitting = false

function bridgePath(): string {
  if (process.env.DACHSHUND_MCP_BRIDGE) return process.env.DACHSHUND_MCP_BRIDGE
  if (app.isPackaged) return path.join(process.resourcesPath, 'mcp', 'index.cjs')
  return path.join(process.cwd(), 'out', 'mcp', 'index.cjs')
}

function iconPath(name: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'assets', name)
  return path.join(app.getAppPath(), 'resources', name)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: '#fafafa',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 24 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function createPanelWindow(): void {
  panelWindow = new BrowserWindow({
    width: 420,
    height: 620,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  panelWindow.on('blur', () => {
    if (!panelWindow?.isVisible()) return
    setTimeout(() => {
      if (panelWindow?.isVisible() && !panelWindow.isFocused()) panelWindow.hide()
    }, 160)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void panelWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?panel=1`)
  } else {
    void panelWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { panel: '1' }
    })
  }
}

function showWindow(): void {
  if (!mainWindow) createWindow()
  panelWindow?.hide()
  mainWindow?.show()
  mainWindow?.focus()
}

function positionPanel(): void {
  if (!panelWindow || !tray) return
  const trayBounds = tray.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const bounds = panelWindow.getBounds()
  const x = Math.min(
    Math.max(Math.round(trayBounds.x + trayBounds.width / 2 - bounds.width / 2), display.workArea.x + 8),
    display.workArea.x + display.workArea.width - bounds.width - 8
  )
  const y = Math.min(trayBounds.y + trayBounds.height + 6, display.workArea.y + display.workArea.height - bounds.height - 8)
  panelWindow.setPosition(x, Math.max(y, display.workArea.y + 6), false)
}

function showPanel(): void {
  if (!panelWindow) createPanelWindow()
  positionPanel()
  panelWindow?.show()
  panelWindow?.focus()
}

function hidePanel(): void {
  panelWindow?.hide()
}

function togglePanel(): void {
  if (panelWindow?.isVisible()) hidePanel()
  else showPanel()
}

function rebuildTrayMenu(): void {
  if (!tray) return
  const update = latestUpdateState
  const updateItem =
    update && ['available', 'downloading', 'downloaded'].includes(update.phase)
      ? [
          {
            label:
              update.phase === 'downloaded'
                ? `Open dachshund ${update.latestVersion} installer`
                : update.phase === 'downloading'
                  ? `Downloading dachshund ${update.latestVersion}...`
                  : `Download dachshund ${update.latestVersion}`,
            enabled: update.phase !== 'downloading',
            click: () => {
              showPanel()
              if (update.phase === 'downloaded') {
                void updateService?.openDownloadedUpdate()
              } else if (update.phase === 'available') {
                void updateService?.downloadUpdate()
              }
            }
          },
          { type: 'separator' as const }
        ]
      : []

  trayMenu = Menu.buildFromTemplate([
    { label: 'Open compact panel', click: showPanel },
    { label: 'Open dachshund', click: showWindow },
    {
      label: 'New memory',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('ui:new-memory')
      }
    },
    {
      label: 'Scan agents',
      click: () => {
        void scanAgents()
      }
    },
    {
      label: 'Check for updates',
      click: () => {
        void checkForUpdates(true)
      }
    },
    { type: 'separator' },
    ...updateItem,
    {
      label: 'Quit dachshund',
      click: () => {
        quitting = true
        app.quit()
      }
    }
  ])
  tray.setToolTip(
    update?.phase === 'available'
      ? `dachshund · update ${update.latestVersion} available`
      : 'dachshund'
  )
}

function createTray(): void {
  const trayPath = iconPath('trayTemplate.png')
  const image = fs.existsSync(trayPath)
    ? nativeImage.createFromPath(trayPath)
    : nativeImage.createEmpty()
  image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip('dachshund')
  rebuildTrayMenu()
  tray.on('mouse-down', () => {
    panelVisibleBeforeClick = panelWindow?.isVisible() ?? false
  })
  tray.on('click', () => {
    if (panelVisibleBeforeClick) hidePanel()
    else showPanel()
  })
  tray.on('right-click', () => {
    if (trayMenu) tray?.popUpContextMenu(trayMenu)
  })
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'dachshund',
        submenu: [
          { role: 'about' },
          {
            label: 'Check for Updates...',
            click: () => {
              void checkForUpdates(true)
            }
          },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { type: 'separator' },
          {
            label: 'Quit dachshund',
            accelerator: 'Cmd+Q',
            click: () => {
              quitting = true
              app.quit()
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          {
            label: 'Minimize to Menu Bar',
            accelerator: 'CmdOrCtrl+Shift+M',
            click: () => {
              mainWindow?.hide()
              showPanel()
            }
          },
          { type: 'separator' },
          {
            label: 'Compact Panel',
            accelerator: 'CmdOrCtrl+Shift+D',
            click: togglePanel
          }
        ]
      }
    ])
  )
}

async function scanAgents(): Promise<void> {
  const state = await store.scan((progress) => {
    for (const win of [mainWindow, panelWindow]) {
      win?.webContents.send('scan:progress', progress)
    }
  })
  broadcastState(state)
}

function broadcastState(state: ReturnType<Store['state']>): void {
  for (const win of [mainWindow, panelWindow]) {
    win?.webContents.send('state:changed', state)
  }
}

function broadcastUpdate(state: UpdateState): void {
  for (const win of [mainWindow, panelWindow]) {
    win?.webContents.send('update:changed', state)
  }
}

async function checkForUpdates(manual = false): Promise<UpdateState | null> {
  if (!updateService) return null
  const state = await updateService.checkForUpdates()
  if (!manual) return state

  if (state.phase === 'available') {
    showPanel()
  } else if (state.phase === 'up-to-date') {
    await dialog.showMessageBox({
      type: 'info',
      message: 'dachshund is up to date',
      detail: `You are running the latest version, ${state.currentVersion}.`
    })
  } else if (state.phase === 'error') {
    await dialog.showMessageBox({
      type: 'warning',
      message: 'Could not check for updates',
      detail: state.error ?? 'Try again later.'
    })
  }
  return state
}

function registerIpc(): void {
  ipcMain.handle('app:state', () => store.state())
  ipcMain.handle('app:scan', async () => {
    await scanAgents()
    return store.state()
  })
  ipcMain.handle('app:onboarded', () => store.markOnboarded())
  ipcMain.handle('app:bridge-path', () => bridgePath())
  ipcMain.handle('app:library-path', () => LIBRARY_DIR)
  ipcMain.handle('app:open-main', (_event, payload?: { memoryId?: string; action?: 'new' }) => {
    showWindow()
    if (payload?.action === 'new') mainWindow?.webContents.send('ui:new-memory')
    if (payload?.memoryId) mainWindow?.webContents.send('ui:open-memory', payload.memoryId)
    return true
  })
  ipcMain.handle('app:minimize-to-tray', () => {
    mainWindow?.hide()
    showPanel()
    return true
  })
  ipcMain.handle('app:hide-panel', () => {
    hidePanel()
    return true
  })
  ipcMain.handle('app:quit', () => {
    quitting = true
    app.quit()
  })
  ipcMain.handle('update:state', () => updateService?.getState() ?? null)
  ipcMain.handle('update:check', () => checkForUpdates(false))
  ipcMain.handle('update:download', () => updateService?.downloadUpdate() ?? null)
  ipcMain.handle('update:open-downloaded', () => updateService?.openDownloadedUpdate() ?? false)
  ipcMain.handle('memory:search', (_event, query: SearchQuery) => store.search(query))
  ipcMain.handle('memory:get', (_event, id: string) => store.getMemory(id))
  ipcMain.handle('memory:create', (_event, input: CreateMemoryInput) => store.create(input))
  ipcMain.handle('memory:update', (_event, id: string, patch: UpdateMemoryInput) =>
    store.update(id, patch)
  )
  ipcMain.handle('memory:archive', (_event, id: string) => store.archive(id))
  ipcMain.handle('agent:shared', (_event, id: string, shared: boolean) =>
    store.setShared(id, shared)
  )
  ipcMain.handle('agent:install-mcp', async (_event, id: string, dryRun = false) => {
    const result = await store.installAgentMcp(id, bridgePath(), dryRun)
    mainWindow?.webContents.send('state:changed', store.state())
    return result
  })
  ipcMain.handle('shell:reveal', (_event, target: string) => {
    if (!target) return false
    const expanded = expandHome(target)
    try {
      const stat = fs.statSync(expanded)
      if (stat.isDirectory()) {
        void shell.openPath(expanded)
      } else {
        shell.showItemInFolder(expanded)
      }
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return false
    void shell.openExternal(url)
    return true
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(async () => {
    if (process.platform === 'darwin' && !app.isPackaged) {
      const dockIcon = iconPath('icon.png')
      if (fs.existsSync(dockIcon)) app.dock?.setIcon(dockIcon)
    }

    store = new Store(APP_VERSION)
    store.init()
    registerIpc()
    buildMenu()
    createWindow()
    createTray()
    createPanelWindow()
    updateService = new UpdateService(APP_VERSION, (state) => {
      latestUpdateState = state
      broadcastUpdate(state)
      rebuildTrayMenu()
    })
    updateService.start()
    globalShortcut.register('CommandOrControl+Shift+D', togglePanel)
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      mainWindow?.hide()
      showPanel()
    })

    try {
      const server = await startHttpServer(store, APP_VERSION)
      closeServer = server.close
    } catch (error) {
      console.error('Failed to start local memory server', error)
    }

    setTimeout(() => {
      void scanAgents()
    }, 900)

    app.on('activate', showWindow)
  })

  app.on('before-quit', () => {
    quitting = true
    globalShortcut.unregisterAll()
    updateService?.stop()
    closeServer?.()
    try {
      store?.db.close()
    } catch {
      // ignore
    }
  })
}
