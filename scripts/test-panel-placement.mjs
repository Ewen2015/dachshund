import assert from 'node:assert/strict'
import { panelPlacement } from '../src/main/panel-placement.ts'
import { ensurePanelVisibleInFullscreen } from '../src/main/panel-window.ts'

const panelSize = { width: 420, height: 620 }
const primary = { x: 0, y: 25, width: 1470, height: 931 }
const external = { x: 1470, y: 25, width: 1920, height: 1080 }
const left = { x: -1920, y: 25, width: 1920, height: 1080 }
const staleTray = { x: 600, y: 0, width: 24, height: 24 }

assert.deepEqual(
  panelPlacement({
    cursor: { x: 2400, y: 12 },
    cursorDisplayId: 2,
    trayBounds: staleTray,
    trayDisplayId: 1,
    panelSize,
    workArea: external
  }),
  { x: 2190, y: 31 },
  'a stale tray position should not pull the panel back to the primary display'
)

assert.deepEqual(
  panelPlacement({
    cursor: { x: -1800, y: 12 },
    cursorDisplayId: 3,
    trayBounds: staleTray,
    trayDisplayId: 1,
    panelSize,
    workArea: left
  }),
  { x: -1912, y: 31 },
  'the panel should clamp inside a display with a negative origin'
)

assert.deepEqual(
  panelPlacement({
    cursor: { x: 800, y: 12 },
    cursorDisplayId: 1,
    trayBounds: { x: 780, y: 0, width: 24, height: 24 },
    trayDisplayId: 1,
    panelSize,
    workArea: primary
  }),
  { x: 582, y: 31 },
  'the panel should centre under a tray icon on the current display'
)

let workspaceVisibilityCall = null
ensurePanelVisibleInFullscreen({
  setVisibleOnAllWorkspaces(visible, options) {
    workspaceVisibilityCall = { visible, options }
  }
})

assert.deepEqual(
  workspaceVisibilityCall,
  {
    visible: true,
    options: {
      visibleOnFullScreen: true,
      skipTransformProcessType: true
    }
  },
  'the compact panel should remain available above full-screen Spaces'
)

console.log('Panel placement and full-screen fixtures passed')
