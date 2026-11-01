export interface PanelPoint {
  x: number
  y: number
}

export interface PanelBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PanelPlacementInput {
  cursor: PanelPoint
  cursorDisplayId: number
  trayBounds: PanelBounds
  trayDisplayId: number
  panelSize: Pick<PanelBounds, 'width' | 'height'>
  workArea: PanelBounds
}

const PANEL_GAP = 6
const EDGE_PADDING = 8

export function panelPlacement(input: PanelPlacementInput): PanelPoint {
  const { workArea, panelSize } = input
  const trayHasBounds = input.trayBounds.width > 0 && input.trayBounds.height > 0
  const trayOnCurrentDisplay =
    trayHasBounds && input.trayDisplayId === input.cursorDisplayId

  const anchorX = trayOnCurrentDisplay
    ? input.trayBounds.x + input.trayBounds.width / 2
    : input.cursor.x
  const anchorY = trayOnCurrentDisplay
    ? input.trayBounds.y + input.trayBounds.height
    : workArea.y

  const minX = workArea.x + EDGE_PADDING
  const maxX = Math.max(
    minX,
    workArea.x + workArea.width - panelSize.width - EDGE_PADDING
  )
  const minY = workArea.y + PANEL_GAP
  const maxY = Math.max(
    minY,
    workArea.y + workArea.height - panelSize.height - EDGE_PADDING
  )

  return {
    x: Math.round(Math.min(Math.max(anchorX - panelSize.width / 2, minX), maxX)),
    y: Math.round(Math.min(Math.max(anchorY + PANEL_GAP, minY), maxY))
  }
}
