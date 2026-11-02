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
import { findDefinition } from './agents/discovery'
import { buildMcpSetup, getMcpConnectionStatus } from './agents/mcp-connection'
import { panelPlacement } from './panel-placement'
import {
  currentAppBundlePath,
  installerLogPath,
  launchUpdateInstaller
} from './installer'
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
let installScheduled = false
let hidingMainWindow = false

function bridgePath(): string {
  if (process.env.DACHSHUND_MCP_BRIDGE) return process.env.DACHSHUND_MCP_BRIDGE
  if (app.isPackaged) return path.join(process.resourcesPath, 'mcp', 'index.cjs')
  return path.join(process.cwd(), 'out', 'mcp', 'index.cjs')
}

function iconPath(name: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'assets', name)
  return path.join(app.getAppPath(), 'resources', name)
}

function hideMainWindow(afterHide?: () => void): void {
  const win = mainWindow
  if (!win || hidingMainWindow) return

  if (!win.isFullScreen() && !win.isSimpleFullScreen()) {
    win.hide()
    afterHide?.()
    return
  }

  hidingMainWindow = true
  let finished = false
  let safetyTimer: ReturnType<typeof setTimeout> | null = null
  const finish = (): void => {
    if (finished) return
    finished = true
    hidingMainWindow = false
    if (safetyTimer) clearTimeout(safetyTimer)
    win.removeListener('leave-full-screen', finish)
    win.hide()
    afterHide?.()
  }

  if (win.isSimpleFullScreen()) {
    win.setSimpleFullScreen(false)
    setTimeout(finish, 80)
    return
  }

  win.once('leave-full-screen', finish)
  win.setFullScreen(false)
  safetyTimer = setTimeout(() => {
    if (win.isFullScreen()) {
      win.setFullScreen(false)
      safetyTimer = setTimeout(finish, 400)
      return
    }
    finish()
  }, 700)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    center: true,
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
      hideMainWindow()
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
    type: 'panel',
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
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const trayBounds = tray.getBounds()
  const trayCenter = {
    x: trayBounds.x + trayBounds.width / 2,
    y: trayBounds.y + trayBounds.height / 2
  }
  const trayDisplay = screen.getDisplayNearestPoint(trayCenter)
  const position = panelPlacement({
    cursor,
    cursorDisplayId: display.id,
    trayBounds,
    trayDisplayId: trayDisplay.id,
    panelSize: panelWindow.getBounds(),
    workArea: display.workArea
  })
  panelWindow.setPosition(position.x, position.y, false)
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
    update && ['available', 'downloading', 'downloaded', 'installing'].includes(update.phase)
      ? [
          {
            label:
              update.phase === 'installing' || update.phase === 'downloaded'
                ? `Installing dachshund ${update.latestVersion}...`
                : update.phase === 'downloading'
                  ? `Downloading dachshund ${update.latestVersion}...`
                  : `Download dachshund ${update.latestVersion}`,
            enabled: update.phase === 'available',
            click: () => {
              showPanel()
              if (update.phase === 'available') {
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
              hideMainWindow(showPanel)
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

async function installDownloadedUpdate(): Promise<void> {
  const state = updateService?.getState()
  if (!state?.downloadedPath || !state.latestVersion) {
    installScheduled = false
    return
  }
  if (!app.isPackaged) {
    installScheduled = false
    updateService?.markInstallError(
      'Automatic installation is available only in the packaged macOS app'
    )
    return
  }

  updateService?.markInstalling()
  const result = await launchUpdateInstaller({
    dmgPath: state.downloadedPath,
    version: state.latestVersion,
    digest: state.downloadDigest,
    targetAppPath: currentAppBundlePath()
  })
  if (!result.ok) {
    installScheduled = false
    updateService?.markInstallError(result.message)
    await dialog.showMessageBox({
      type: 'warning',
      message: 'Could not install the update automatically',
      detail: `${result.message}\n\nThe downloaded DMG will open so you can finish manually. Update log: ${installerLogPath()}`
    })
    await updateService?.openDownloadedUpdate()
    return
  }

  setTimeout(() => {
    quitting = true
    app.quit()
  }, 900)
}

function scheduleAutomaticInstall(state: UpdateState): void {
  if (installScheduled || state.phase !== 'downloaded' || !state.downloadedPath) return
  installScheduled = true
  setTimeout(() => {
    void installDownloadedUpdate()
  }, 700)
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
  ipcMain.handle(
    'app:open-main',
    (_event, payload?: { memoryId?: string; action?: 'new' | 'landing' }) => {
      showWindow()
      if (payload?.action === 'new') mainWindow?.webContents.send('ui:new-memory')
      if (payload?.action === 'landing') mainWindow?.webContents.send('ui:landing')
      if (payload?.memoryId) mainWindow?.webContents.send('ui:open-memory', payload.memoryId)
      return true
    }
  )
  ipcMain.handle('app:minimize-to-tray', () => {
    hideMainWindow(showPanel)
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
  ipcMain.handle('agent:mcp-setup', (_event, id: string) => buildMcpSetup(id, bridgePath()))
  ipcMain.handle('agent:mcp-status', (_event, id: string) => {
    const status = getMcpConnectionStatus(id)
    if (status.connected) {
      mainWindow?.webContents.send('state:changed', store.state())
    }
    return status
  })
  ipcMain.handle('agent:open-app', async (_event, id: string) => {
    const definition = findDefinition(id)
    const candidates = [
      ...(definition?.appPath ? [definition.appPath] : []),
      ...(definition?.appPaths ?? [])
    ]
    const appPath = candidates.find((candidate) => fs.existsSync(candidate))
    if (!appPath) return false
    const error = await shell.openPath(appPath)
    return !error
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
    if (process.platform === 'darwin') app.dock?.hide()

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
      scheduleAutomaticInstall(state)
    })
    updateService.start()
    globalShortcut.register('CommandOrControl+Shift+D', togglePanel)
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      hideMainWindow(showPanel)
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
