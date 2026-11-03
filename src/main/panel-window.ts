export interface FullscreenPanelWindow {
  setVisibleOnAllWorkspaces(
    visible: boolean,
    options?: {
      visibleOnFullScreen?: boolean
      skipTransformProcessType?: boolean
    }
  ): void
}

export const FULLSCREEN_PANEL_OPTIONS = Object.freeze({
  visibleOnFullScreen: true,
  skipTransformProcessType: true
})

export function ensurePanelVisibleInFullscreen(win: FullscreenPanelWindow): void {
  win.setVisibleOnAllWorkspaces(true, FULLSCREEN_PANEL_OPTIONS)
}
