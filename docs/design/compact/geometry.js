/*
 * Sidenib compact geometry reference (ADIEN-159).
 * SPDX-License-Identifier: Apache-2.0
 *
 * One pure function places the notch, the open card and the reminder toast
 * inside a monitor work area. All values are logical pixels. The shell
 * workspace ports this to src/shell/geometry.ts and keeps the same numbers.
 *
 * Defaults are the compact right-middle Sidenib layout. The Advanced settings
 * that v0.1.14 already supports (dock edge, panel width, notch size, full
 * height) are accepted as options and clamped to safe bounds here, so a stored
 * preference can never push the card outside the work area.
 *
 * Loaded as a classic script by prototype.html (sets globalThis.SidenibGeometry)
 * and runnable as a self-check:  node docs/design/compact/geometry.js --check
 */

// Block scope keeps these names out of the page's global lexical scope.
{
const SN = {
  notch: { width: 12, hoverGrow: 2, openWidth: 10, height: 48 },
  hit: { width: 28, height: 72 },
  card: { width: 340, height: 480, minHeight: 320, radius: 16 },
  toast: { width: 296, height: 60, gap: 8 },
  clearance: 10,
  shadowMargin: 28,
  pull: { slop: 6, commit: 48, travel: 120, flick: 0.5 },
  snapCenter: 3,
  // Safe bounds for Advanced settings. Upper bounds equal v0.1.14's, so no
  // stored value is rejected; lower bounds are widened to admit the compact
  // defaults.
  bounds: {
    panelWidth: [320, 560],
    notchWidth: [10, 112],
    notchHeight: [44, 176],
  },
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * @param {{x:number,y:number,width:number,height:number}} workArea
 *   Monitor work area: the screen minus menu bar, Dock and taskbar.
 * @param {object} [options]
 * @param {'right'|'left'|'top'} [options.edge] Dock edge. Default 'right'.
 * @param {number} [options.notchY] Notch centre as a percentage along the
 *   edge (settings.handleY). Default 50.
 * @param {number} [options.panelWidth] Card width. Default 340.
 * @param {'compact'|'full'} [options.heightMode] 'full' fills the work-area
 *   height minus clearance. Default 'compact' (480).
 * @param {number} [options.notchWidth] Visible notch thickness. Default 12.
 * @param {number} [options.notchHeight] Visible notch length. Default 48.
 */
const computeGeometry = function (workArea, options = {}) {
  const edge =
    options.edge === 'left' || options.edge === 'top' ? options.edge : 'right'
  const along = clamp(options.notchY ?? 50, 0, 100)
  const right = workArea.x + workArea.width
  const bottom = workArea.y + workArea.height
  const thickness = clamp(
    options.notchWidth ?? SN.notch.width,
    ...SN.bounds.notchWidth,
  )
  const length = clamp(
    options.notchHeight ?? SN.notch.height,
    ...SN.bounds.notchHeight,
  )
  // The hit target never shrinks below 28 x 72, whatever is drawn.
  const hitThickness = Math.max(SN.hit.width, thickness)
  const hitLength = Math.max(SN.hit.height, length)

  // The card never exceeds the work area minus one clearance on each side.
  const cardWidth = Math.min(
    clamp(options.panelWidth ?? SN.card.width, ...SN.bounds.panelWidth),
    workArea.width - SN.clearance * 2,
  )
  const cardHeight =
    options.heightMode === 'full'
      ? workArea.height - SN.clearance * 2
      : Math.min(SN.card.height, workArea.height - SN.clearance * 2)
  const toastWidth = Math.min(
    SN.toast.width,
    workArea.width - thickness - SN.toast.gap - SN.clearance,
  )

  let anchor
  let notch
  let hit
  let card
  let toast

  if (edge === 'top') {
    // The notch lies along the top edge; the card drops down from it.
    const centerX = clamp(
      workArea.x + (workArea.width * along) / 100,
      workArea.x + hitLength / 2,
      right - hitLength / 2,
    )
    anchor = { x: centerX, y: workArea.y }
    notch = {
      x: centerX - length / 2,
      y: workArea.y,
      width: length,
      height: thickness,
    }
    hit = {
      x: centerX - hitLength / 2,
      y: workArea.y,
      width: hitLength,
      height: hitThickness,
    }
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
      bottom - hitLength / 2,
    )
    const isRight = edge === 'right'
    anchor = { x: isRight ? right : workArea.x, y: centerY }
    notch = {
      x: isRight ? right - thickness : workArea.x,
      y: centerY - length / 2,
      width: thickness,
      height: length,
    }
    hit = {
      x: isRight ? right - hitThickness : workArea.x,
      y: centerY - hitLength / 2,
      width: hitThickness,
      height: hitLength,
    }
    card = {
      x: isRight
        ? right - SN.clearance - cardWidth
        : workArea.x + SN.clearance,
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

  // Suggested native window bounds: what is drawn plus room for the shadow.
  // These are bounds only. The shadow margin and the rounded corners inside
  // them are transparent and must still pass pointer events through; how that
  // is achieved natively is the shell workspace's decision (see README).
  const grow = (rect, margin) => {
    const x = Math.max(workArea.x, rect.x - margin)
    const y = Math.max(workArea.y, rect.y - margin)
    return {
      x,
      y,
      width: Math.min(right, rect.x + rect.width + margin) - x,
      height: Math.min(bottom, rect.y + rect.height + margin) - y,
    }
  }
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
    anchor,
    notch,
    hit,
    card,
    toast,
    compactCalendar: cardHeight < 420,
    // Regions that intercept pointer events in each mode. Everything else
    // inside the window bounds passes through.
    interactive: {
      collapsed: [hit],
      toast: [hit, toast],
      open: [hit, card],
    },
    windows: {
      collapsed: hit,
      toast: union(hit, grow(toast, SN.shadowMargin)),
      open: union(hit, grow(card, SN.shadowMargin)),
    },
  }
}

/**
 * Classifies a pointer gesture that started on the notch.
 * dx is travel away from the docked edge (positive = inward), dy is travel
 * along the edge, velocity is inward px/ms at release.
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
  const mac = { x: 0, y: 25, width: 1440, height: 805 }
  const cases = [
    ['MacBook Air 13 (1440x900, menu bar 25, Dock 70)', mac, {}],
    ['MacBook Pro 14 (1512x982, menu bar 38)', { x: 0, y: 38, width: 1512, height: 944 }, {}],
    ['Short display (1280x600, menu bar 25)', { x: 0, y: 25, width: 1280, height: 575 }, {}],
    ['Windows laptop (1366x768, taskbar 40)', { x: 0, y: 0, width: 1366, height: 728 }, {}],
    ['Very short (1024x420)', { x: 0, y: 0, width: 1024, height: 420 }, {}],
    ['Notch dragged to top', mac, { notchY: 0 }],
    ['Notch dragged to bottom', mac, { notchY: 100 }],
    ['Second monitor, left edge (x=-1920)', { x: -1920, y: 0, width: 1920, height: 1040 }, { edge: 'left', notchY: 30 }],
    ['Top edge, centred', mac, { edge: 'top' }],
    ['Top edge, notch at far right', mac, { edge: 'top', notchY: 100 }],
    ['Top edge on very short display', { x: 0, y: 0, width: 1024, height: 420 }, { edge: 'top' }],
    ['Advanced: panel width 560', mac, { panelWidth: 560 }],
    ['Advanced: stored width 560 on a 500-wide work area', { x: 0, y: 0, width: 500, height: 700 }, { panelWidth: 560 }],
    ['Advanced: out-of-range width 9999', mac, { panelWidth: 9999 }],
    ['Advanced: full height', mac, { heightMode: 'full' }],
    ['Advanced: v0.1.14 handle 42x84', mac, { notchWidth: 42, notchHeight: 84 }],
    ['Advanced: largest notch 112x176 at bottom', mac, { notchWidth: 112, notchHeight: 176, notchY: 100 }],
  ]
  let failures = 0
  const inside = (r, wa, pad) =>
    r.x >= wa.x + pad &&
    r.y >= wa.y + pad &&
    r.x + r.width <= wa.x + wa.width - pad &&
    r.y + r.height <= wa.y + wa.height - pad

  for (const [name, wa, options] of cases) {
    const g = computeGeometry(wa, options)
    const ok =
      inside(g.card, wa, SN.clearance) &&
      inside(g.toast, wa, 0) &&
      inside(g.hit, wa, 0) &&
      inside(g.notch, g.hit, 0) &&
      inside(g.windows.open, wa, 0) &&
      inside(g.windows.toast, wa, 0) &&
      g.card.width <= SN.bounds.panelWidth[1] &&
      (options.heightMode === 'full' || g.card.height <= SN.card.height) &&
      g.hit.width >= SN.hit.width &&
      g.hit.height >= SN.hit.width
    failures += ok ? 0 : 1
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${name}: card ${g.card.width}x${g.card.height} at ` +
        `(${g.card.x},${g.card.y}), notch ${g.notch.width}x${g.notch.height}, ` +
        `window ${g.windows.open.width}x${g.windows.open.height}` +
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
