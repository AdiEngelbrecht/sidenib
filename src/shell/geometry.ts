/*
 * Sidenib compact shell geometry.
 *
 * Port of docs/design/compact/geometry.js with the same constants and bounds.
 * This module is the single source for where the notch, the open card and the
 * reminder toast sit: native window bounds, the drawn shape, the reveal
 * animation origin and the pointer hit regions are all derived from
 * `computeGeometry`. All values are logical pixels.
 */

export type ShellEdge = 'right' | 'left' | 'top'
export type ShellMode = 'collapsed' | 'toast' | 'open'
export type PanelHeightMode = 'compact' | 'full'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** A rectangle that intercepts the pointer, rounded by `radius`. */
export interface InteractiveRegion extends Rect {
  id: 'notch' | 'card' | 'toast'
  radius: number
}

export interface GeometryOptions {
  /** Dock edge. Default 'right'. */
  edge?: ShellEdge | 'bottom'
  /** Notch centre as a percentage along the edge (settings.handleY). */
  notchY?: number
  /** Card width (settings.panelWidth). */
  panelWidth?: number
  /** 'full' fills the work-area height minus clearance. */
  heightMode?: PanelHeightMode
  /** Visible notch thickness (settings.tabWidth). */
  notchWidth?: number
  /** Visible notch length (settings.handleHeight). */
  notchHeight?: number
  /** Card corner radius (settings.panelRadius). */
  cardRadius?: number
}

export const SN = {
  notch: { width: 12, hoverGrow: 2, openWidth: 10, height: 48 },
  hit: { width: 28, height: 72 },
  card: { width: 340, height: 480, minHeight: 320, radius: 16 },
  toast: { width: 296, height: 60, gap: 8, radius: 12 },
  clearance: 10,
  shadowMargin: 28,
  pull: { slop: 6, commit: 48, travel: 120, flick: 0.5 },
  snapCenter: 3,
  compactCalendarBelow: 420,
  // Upper bounds equal v0.1.14's, so no stored value is rejected; lower
  // bounds are widened to admit the compact defaults.
  bounds: {
    panelWidth: [320, 560],
    notchWidth: [10, 112],
    notchHeight: [44, 176],
    cardRadius: [12, 28],
  },
} as const

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const finite = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export interface ShellGeometry {
  edge: ShellEdge
  workArea: Rect
  /** Point on the docked edge at the notch centre. */
  anchor: Point
  /** Visible notch while the card is closed. */
  notch: Rect
  /** Visible notch while the card is open: thinner, inside the clearance. */
  notchOpen: Rect
  /** Pointer target of the closed notch. Never smaller than 28 x 72. */
  hit: Rect
  /** Pointer target of the open notch: the clearance strip beside the card. */
  hitOpen: Rect
  card: Rect
  cardRadius: number
  toast: Rect
  /** True when the card is shorter than 420: Calendar shows one week. */
  compactCalendar: boolean
  /** Regions that intercept pointer events in each mode. */
  interactive: Record<ShellMode, InteractiveRegion[]>
  /** Native window bounds for each mode: the drawn shape plus shadow room. */
  windows: Record<ShellMode, Rect>
}

export function computeGeometry(
  workArea: Rect,
  options: GeometryOptions = {},
): ShellGeometry {
  const edge: ShellEdge =
    options.edge === 'left'
      ? 'left'
      : options.edge === 'top' || options.edge === 'bottom'
        ? 'top'
        : 'right'
  const along = clamp(finite(options.notchY, 50), 0, 100)
  const right = workArea.x + workArea.width
  const bottom = workArea.y + workArea.height
  const thickness = clamp(
    finite(options.notchWidth, SN.notch.width),
    ...SN.bounds.notchWidth,
  )
  const length = clamp(
    finite(options.notchHeight, SN.notch.height),
    ...SN.bounds.notchHeight,
  )
  // The hit target never shrinks below 28 x 72, whatever is drawn.
  const hitThickness = Math.max(SN.hit.width, thickness)
  const hitLength = Math.max(SN.hit.height, length)

  // The card never exceeds the work area minus one clearance on each side.
  const cardWidth = Math.max(
    0,
    Math.min(
      clamp(finite(options.panelWidth, SN.card.width), ...SN.bounds.panelWidth),
      workArea.width - SN.clearance * 2,
    ),
  )
  const cardHeight = Math.max(
    0,
    options.heightMode === 'full'
      ? workArea.height - SN.clearance * 2
      : Math.min(SN.card.height, workArea.height - SN.clearance * 2),
  )
  const cardRadius = Math.min(
    clamp(finite(options.cardRadius, SN.card.radius), ...SN.bounds.cardRadius),
    cardWidth / 2,
    cardHeight / 2,
  )
  const toastWidth = Math.max(
    0,
    Math.min(
      SN.toast.width,
      workArea.width - thickness - SN.toast.gap - SN.clearance,
    ),
  )

  let anchor: Point
  let notch: Rect
  let notchOpen: Rect
  let hit: Rect
  let hitOpen: Rect
  let card: Rect
  let toast: Rect

  if (edge === 'top') {
    // The notch lies along the top edge; the card drops down from it.
    const centerX = clamp(
      workArea.x + (workArea.width * along) / 100,
      workArea.x + hitLength / 2,
      Math.max(workArea.x + hitLength / 2, right - hitLength / 2),
    )
    anchor = { x: centerX, y: workArea.y }
    notch = {
      x: centerX - length / 2,
      y: workArea.y,
      width: length,
      height: thickness,
    }
    notchOpen = { ...notch, height: SN.notch.openWidth }
    hit = {
      x: centerX - hitLength / 2,
      y: workArea.y,
      width: hitLength,
      height: hitThickness,
    }
    hitOpen = { ...hit, height: SN.clearance }
    card = {
      x: clamp(
        centerX - cardWidth / 2,
        workArea.x + SN.clearance,
        right - SN.clearance - cardWidth,
      ),
      y: workArea.y + SN.clearance,
      width: cardWidth,
      height: cardHeight,
    }
    toast = {
      x: clamp(
        centerX - toastWidth / 2,
        workArea.x + SN.clearance,
        right - SN.clearance - toastWidth,
      ),
      y: workArea.y + thickness + SN.toast.gap,
      width: toastWidth,
      height: SN.toast.height,
    }
  } else {
    // The notch centre stays far enough from the corners for its hit target.
    const centerY = clamp(
      workArea.y + (workArea.height * along) / 100,
      workArea.y + hitLength / 2,
      Math.max(workArea.y + hitLength / 2, bottom - hitLength / 2),
    )
    const isRight = edge === 'right'
    anchor = { x: isRight ? right : workArea.x, y: centerY }
    notch = {
      x: isRight ? right - thickness : workArea.x,
      y: centerY - length / 2,
      width: thickness,
      height: length,
    }
    notchOpen = {
      ...notch,
      x: isRight ? right - SN.notch.openWidth : workArea.x,
      width: SN.notch.openWidth,
    }
    hit = {
      x: isRight ? right - hitThickness : workArea.x,
      y: centerY - hitLength / 2,
      width: hitThickness,
      height: hitLength,
    }
    hitOpen = {
      ...hit,
      x: isRight ? right - SN.clearance : workArea.x,
      width: SN.clearance,
    }
    card = {
      x: isRight ? right - SN.clearance - cardWidth : workArea.x + SN.clearance,
      // Centred on the notch, then pushed back inside the work area.
      y: clamp(
        centerY - cardHeight / 2,
        workArea.y + SN.clearance,
        bottom - SN.clearance - cardHeight,
      ),
      width: cardWidth,
      height: cardHeight,
    }
    toast = {
      x: isRight
        ? right - thickness - SN.toast.gap - toastWidth
        : workArea.x + thickness + SN.toast.gap,
      y: clamp(
        centerY - SN.toast.height / 2,
        workArea.y + SN.clearance,
        bottom - SN.clearance - SN.toast.height,
      ),
      width: toastWidth,
      height: SN.toast.height,
    }
  }

  // Native window bounds: what is drawn plus room for the shadow. These are
  // bounds only. The shadow margin and the rounded corners inside them are
  // transparent and still pass pointer events through (see `interactive`).
  const grow = (rect: Rect, margin: number): Rect => {
    const x = Math.max(workArea.x, rect.x - margin)
    const y = Math.max(workArea.y, rect.y - margin)

    return {
      x,
      y,
      width: Math.min(right, rect.x + rect.width + margin) - x,
      height: Math.min(bottom, rect.y + rect.height + margin) - y,
    }
  }

  const notchRegion: InteractiveRegion = { ...hit, id: 'notch', radius: 0 }
  const notchOpenRegion: InteractiveRegion = {
    ...hitOpen,
    id: 'notch',
    radius: 0,
  }
  const cardRegion: InteractiveRegion = {
    ...card,
    id: 'card',
    radius: cardRadius,
  }
  const toastRegion: InteractiveRegion = {
    ...toast,
    id: 'toast',
    radius: Math.min(SN.toast.radius, toast.width / 2, toast.height / 2),
  }

  return {
    edge,
    workArea,
    anchor,
    notch,
    notchOpen,
    hit,
    hitOpen,
    card,
    cardRadius,
    toast,
    compactCalendar: cardHeight < SN.compactCalendarBelow,
    interactive: {
      collapsed: [notchRegion],
      toast: [toastRegion, notchRegion],
      // The open notch only claims the clearance strip, so it never covers
      // the card's own edge.
      open: [cardRegion, notchOpenRegion],
    },
    windows: {
      collapsed: hit,
      toast: unionRect(hit, grow(toast, SN.shadowMargin)),
      open: unionRect(hit, grow(card, SN.shadowMargin)),
    },
  }
}

export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/**
 * Rounds a window rectangle outward to whole device pixels so the native
 * window never lands on a half pixel and never clips what is drawn.
 */
export function snapToDevicePixels(rect: Rect, scaleFactor: number): Rect {
  const scale = scaleFactor > 0 ? scaleFactor : 1
  const left = Math.floor(rect.x * scale + 1e-6)
  const top = Math.floor(rect.y * scale + 1e-6)
  const right = Math.ceil((rect.x + rect.width) * scale - 1e-6)
  const bottom = Math.ceil((rect.y + rect.height) * scale - 1e-6)

  return {
    x: left / scale,
    y: top / scale,
    width: Math.max(1, right - left) / scale,
    height: Math.max(1, bottom - top) / scale,
  }
}

export function rectEquals(a: Rect, b: Rect) {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}

/** Moves a rectangle into the coordinate space whose origin is `origin`. */
export function relativeTo<T extends Rect>(rect: T, origin: Point): T {
  return { ...rect, x: rect.x - origin.x, y: rect.y - origin.y }
}

/** True when the point is inside the rectangle after rounding its corners. */
export function pointInRoundedRect(
  point: Point,
  rect: Rect & { radius?: number },
) {
  const { x, y } = point

  if (
    x < rect.x ||
    y < rect.y ||
    x >= rect.x + rect.width ||
    y >= rect.y + rect.height
  ) {
    return false
  }

  const radius = Math.max(
    0,
    Math.min(rect.radius ?? 0, rect.width / 2, rect.height / 2),
  )

  if (radius === 0) {
    return true
  }

  // Nearest corner-circle centre; only the corner squares need the test.
  const cx = clamp(x, rect.x + radius, rect.x + rect.width - radius)
  const cy = clamp(y, rect.y + radius, rect.y + rect.height - radius)

  return Math.hypot(x - cx, y - cy) <= radius
}

/** The region under a point for the given mode, or null for pass-through. */
export function hitTest(
  geometry: ShellGeometry,
  mode: ShellMode,
  point: Point,
): InteractiveRegion['id'] | null {
  for (const region of geometry.interactive[mode]) {
    if (pointInRoundedRect(point, region)) {
      return region.id
    }
  }

  return null
}

export type NotchGesture =
  | 'pending'
  | 'click'
  | 'pulling'
  | 'reposition'
  | 'open'
  | 'cancel'

/**
 * Classifies a pointer gesture that started on the notch.
 * dx is travel away from the docked edge (positive = inward), dy is travel
 * along the edge, velocity is inward px/ms at release.
 */
export function classifyNotchGesture({
  dx,
  dy,
  velocity = 0,
  released = false,
}: {
  dx: number
  dy: number
  velocity?: number
  released?: boolean
}): NotchGesture {
  const inward = Math.max(0, dx)
  const moved = Math.hypot(dx, dy) >= SN.pull.slop

  if (!moved) {
    return released ? 'click' : 'pending'
  }

  if (Math.abs(dy) > Math.abs(dx)) {
    return 'reposition'
  }

  if (!released) {
    return 'pulling'
  }

  return inward >= SN.pull.commit || velocity >= SN.pull.flick
    ? 'open'
    : 'cancel'
}

export const pullProgress = (dx: number) => clamp(dx / SN.pull.travel, 0, 1)

/**
 * Splits a screen-space pointer delta into travel away from the docked edge
 * (inward) and travel along it.
 */
export function gestureAxes(edge: ShellEdge, deltaX: number, deltaY: number) {
  if (edge === 'top') {
    return { inward: deltaY, along: deltaX }
  }

  return { inward: edge === 'right' ? -deltaX : deltaX, along: deltaY }
}

/** Snaps a notch position to the centre when it is within +/-3%. */
export function snapNotchPercent(percent: number) {
  const bounded = clamp(percent, 0, 100)

  return Math.abs(bounded - 50) <= SN.snapCenter ? 50 : bounded
}

/** The notch centre as a percentage along its edge, as it is drawn. */
export function notchPercent(geometry: ShellGeometry) {
  const { anchor, edge, workArea } = geometry
  const length = edge === 'top' ? workArea.width : workArea.height
  const offset =
    edge === 'top' ? anchor.x - workArea.x : anchor.y - workArea.y

  return length > 0 ? clamp((offset / length) * 100, 0, 100) : 50
}

/** The notch percentage after dragging `along` pixels from `startPercent`. */
export function repositionPercent(
  geometry: ShellGeometry,
  startPercent: number,
  along: number,
) {
  const length =
    geometry.edge === 'top'
      ? geometry.workArea.width
      : geometry.workArea.height

  if (length <= 0) {
    return startPercent
  }

  return snapNotchPercent(startPercent + (along / length) * 100)
}

/** Reveal travel and scale for a pull or reveal progress between 0 and 1. */
export function revealTransform(edge: ShellEdge, progress: number) {
  const p = clamp(progress, 0, 1)
  const offset = (1 - p) * 16
  const scale = 0.96 + 0.04 * p

  return {
    opacity: p,
    scale,
    translateX: edge === 'right' ? offset : edge === 'left' ? -offset : 0,
    translateY: edge === 'top' ? -offset : 0,
  }
}
