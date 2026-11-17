/*
 * Sidenib compact geometry reference (ADIEN-159).
 * SPDX-License-Identifier: Apache-2.0
 *
 * One pure function places the notch, the open card and the reminder toast
 * inside a monitor work area. All values are logical pixels. The shell
 * workspace ports this to src/shell/geometry.ts and keeps the same numbers.
 *
 * Loaded as a classic script by prototype.html (sets globalThis.SidenibGeometry)
 * and runnable as a self-check:  node docs/design/compact/geometry.js --check
 */

// Block scope keeps these names out of the page's global lexical scope.
{
const SN = {
  notch: { width: 12, hoverWidth: 14, openWidth: 6, height: 48 },
  hit: { width: 28, height: 72 },
  card: { width: 340, height: 480, minHeight: 320, radius: 24 },
  toast: { width: 296, height: 60, gap: 8 },
  clearance: 10,
  shadowMargin: 28,
  pull: { slop: 6, commit: 48, travel: 120, flick: 0.5 },
  snapCenter: 3,
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * @param {{x:number,y:number,width:number,height:number}} workArea
 *   Monitor work area: the screen minus menu bar, Dock and taskbar.
 * @param {{edge?: 'right'|'left', notchY?: number}} options
 *   notchY is the notch centre as a percentage of the work-area height.
 */
const computeGeometry = function (workArea, options = {}) {
  const edge = options.edge === 'left' ? 'left' : 'right'
  const notchY = clamp(options.notchY ?? 50, 0, 100)
  const right = workArea.x + workArea.width
  const bottom = workArea.y + workArea.height

  // The notch centre stays far enough from the corners for its hit target.
  const halfHit = SN.hit.height / 2
  const centerY = clamp(
    workArea.y + (workArea.height * notchY) / 100,
    workArea.y + halfHit,
    bottom - halfHit,
  )

  const notchX = edge === 'right' ? right - SN.notch.width : workArea.x
  const hitX = edge === 'right' ? right - SN.hit.width : workArea.x
  const notch = {
    x: notchX,
    y: centerY - SN.notch.height / 2,
    width: SN.notch.width,
    height: SN.notch.height,
  }
  const hit = {
    x: hitX,
    y: centerY - halfHit,
    width: SN.hit.width,
    height: SN.hit.height,
  }

  // The card never exceeds the work area minus one clearance on each side.
  const cardWidth = Math.min(SN.card.width, workArea.width - SN.clearance * 2)
  const cardHeight = Math.min(
    SN.card.height,
    workArea.height - SN.clearance * 2,
  )
  const cardX =
    edge === 'right'
      ? right - SN.clearance - cardWidth
      : workArea.x + SN.clearance
  // Centred on the notch, then pushed back inside the work area.
  const cardY = clamp(
    centerY - cardHeight / 2,
    workArea.y + SN.clearance,
    bottom - SN.clearance - cardHeight,
  )
  const card = { x: cardX, y: cardY, width: cardWidth, height: cardHeight }

  const toastWidth = Math.min(
    SN.toast.width,
    workArea.width - SN.notch.width - SN.toast.gap - SN.clearance,
  )
  const toast = {
    x:
      edge === 'right'
        ? right - SN.notch.width - SN.toast.gap - toastWidth
        : workArea.x + SN.notch.width + SN.toast.gap,
    y: clamp(
      centerY - SN.toast.height / 2,
      workArea.y + SN.clearance,
      bottom - SN.clearance - SN.toast.height,
    ),
    width: toastWidth,
    height: SN.toast.height,
  }

  // Native window rectangles. The window is only as large as what is drawn,
  // plus room for the shadow, so no full-height transparent strip is needed.
  const grow = (rect, margin) => ({
    x: Math.max(workArea.x, rect.x - margin),
    y: Math.max(workArea.y, rect.y - margin),
    width:
      Math.min(right, rect.x + rect.width + margin) -
      Math.max(workArea.x, rect.x - margin),
    height:
      Math.min(bottom, rect.y + rect.height + margin) -
      Math.max(workArea.y, rect.y - margin),
  })
  const union = (a, b) => {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
      x,
      y,
      width: Math.max(a.x + a.width, b.x + b.width) - x,
      height: Math.max(a.y + a.height, b.y + b.height) - y,
    }
  }

  return {
    edge,
    centerY,
    notch,
    hit,
    card,
    toast,
    compactCalendar: cardHeight < 420,
    windows: {
      collapsed: hit,
      toast: union(hit, grow(toast, SN.shadowMargin)),
      open: union(hit, grow(card, SN.shadowMargin)),
    },
  }
}

/**
 * Classifies a pointer gesture that started on the notch.
 * dx is travel toward the screen centre (positive = inward), dy is vertical
 * travel, velocity is inward px/ms at release.
 */
const classifyNotchGesture = function ({ dx, dy, velocity = 0, released = false }) {
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

const pullProgress = (dx) => clamp(dx / SN.pull.travel, 0, 1)

globalThis.SidenibGeometry = {
  SN,
  computeGeometry,
  classifyNotchGesture,
  pullProgress,
}

if (typeof process !== 'undefined' && process.argv?.includes('--check')) {
  const cases = [
    ['MacBook Air 13 (1440x900, menu bar 25, Dock 70)', 0, 25, 1440, 805, 50],
    ['MacBook Pro 14 (1512x982, menu bar 38)', 0, 38, 1512, 944, 50],
    ['Short display (1280x600, menu bar 25)', 0, 25, 1280, 575, 50],
    ['Windows laptop (1366x768, taskbar 40)', 0, 0, 1366, 728, 50],
    ['Very short (1024x420)', 0, 0, 1024, 420, 50],
    ['Notch dragged to top (1440x805)', 0, 25, 1440, 805, 0],
    ['Notch dragged to bottom (1440x805)', 0, 25, 1440, 805, 100],
    ['Second monitor, left edge (x=-1920)', -1920, 0, 1920, 1040, 30],
  ]
  let failures = 0
  const inside = (r, wa, pad) =>
    r.x >= wa.x + pad &&
    r.y >= wa.y + pad &&
    r.x + r.width <= wa.x + wa.width - pad &&
    r.y + r.height <= wa.y + wa.height - pad

  for (const [name, x, y, width, height, notchY] of cases) {
    const wa = { x, y, width, height }
    const edge = name.includes('left edge') ? 'left' : 'right'
    const g = computeGeometry(wa, { edge, notchY })
    const ok =
      inside(g.card, wa, SN.clearance) &&
      inside(g.toast, wa, 0) &&
      inside(g.hit, wa, 0) &&
      inside(g.windows.open, wa, 0) &&
      g.card.height <= SN.card.height &&
      g.card.width <= SN.card.width
    failures += ok ? 0 : 1
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${name}: card ${g.card.width}x${g.card.height} at ` +
        `(${g.card.x},${g.card.y}), window ${g.windows.open.width}x${g.windows.open.height}` +
        `${g.compactCalendar ? ', week-strip calendar' : ''}`,
    )
  }

  const gestures = [
    [{ dx: 2, dy: 1, released: true }, 'click'],
    [{ dx: 30, dy: 4, released: false }, 'pulling'],
    [{ dx: 30, dy: 4, released: true }, 'cancel'],
    [{ dx: 52, dy: 6, released: true }, 'open'],
    [{ dx: 20, dy: 2, velocity: 0.8, released: true }, 'open'],
    [{ dx: 3, dy: 40, released: false }, 'reposition'],
    [{ dx: -30, dy: 2, released: true }, 'cancel'],
  ]
  for (const [input, expected] of gestures) {
    const actual = classifyNotchGesture(input)
    const ok = actual === expected
    failures += ok ? 0 : 1
    console.log(`${ok ? 'ok  ' : 'FAIL'} gesture ${JSON.stringify(input)} -> ${actual}`)
  }

  if (failures) {
    console.error(`${failures} geometry check(s) failed`)
    process.exit(1)
  }
  console.log('geometry checks passed')
}
}
