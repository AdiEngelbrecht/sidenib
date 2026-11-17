import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  SN,
  classifyNotchGesture,
  computeGeometry,
  hitTest,
  relativeTo,
  repositionPercent,
  snapNotchPercent,
  snapToDevicePixels,
} from '../src/shell/geometry'
import type { GeometryOptions, Rect, ShellMode } from '../src/shell/geometry'
import { beginGesture, endGesture, moveGesture } from '../src/shell/gesture'
import { resolveModes } from '../src/shell/types'
import { defaultSidebarSettings, sanitizeSettings } from '../src/sidebarSettings'

const SETTINGS_KEY = 'sidenib.sidebar.settings.v27'
const mac: Rect = { x: 0, y: 25, width: 1440, height: 805 }

// The seventeen placement cases of docs/design/compact/geometry.js.
const placements: Array<[string, Rect, GeometryOptions]> = [
  ['MacBook Air 13 (menu bar 25, Dock 70)', mac, {}],
  ['MacBook Pro 14 (menu bar 38)', { x: 0, y: 38, width: 1512, height: 944 }, {}],
  ['Short display (1280x600)', { x: 0, y: 25, width: 1280, height: 575 }, {}],
  ['Windows laptop (taskbar 40)', { x: 0, y: 0, width: 1366, height: 728 }, {}],
  ['Very short (1024x420)', { x: 0, y: 0, width: 1024, height: 420 }, {}],
  ['Notch dragged to top', mac, { notchY: 0 }],
  ['Notch dragged to bottom', mac, { notchY: 100 }],
  [
    'Second monitor, left edge (x=-1920)',
    { x: -1920, y: 0, width: 1920, height: 1040 },
    { edge: 'left', notchY: 30 },
  ],
  ['Top edge, centred', mac, { edge: 'top' }],
  ['Top edge, notch at far right', mac, { edge: 'top', notchY: 100 }],
  ['Top edge on very short display', { x: 0, y: 0, width: 1024, height: 420 }, { edge: 'top' }],
  ['Advanced: panel width 560', mac, { panelWidth: 560 }],
  [
    'Advanced: stored width 560 on a 500-wide work area',
    { x: 0, y: 0, width: 500, height: 700 },
    { panelWidth: 560 },
  ],
  ['Advanced: out-of-range width 9999', mac, { panelWidth: 9999 }],
  ['Advanced: full height', mac, { heightMode: 'full' }],
  ['Advanced: v0.1.14 handle 42x84', mac, { notchWidth: 42, notchHeight: 84 }],
  [
    'Advanced: largest notch 112x176 at bottom',
    mac,
    { notchWidth: 112, notchHeight: 176, notchY: 100 },
  ],
]

const inside = (rect: Rect, area: Rect, pad: number) =>
  rect.x >= area.x + pad &&
  rect.y >= area.y + pad &&
  rect.x + rect.width <= area.x + area.width - pad &&
  rect.y + rect.height <= area.y + area.height - pad

test.describe('shell geometry', () => {
  for (const [name, workArea, options] of placements) {
    test(`placement: ${name}`, () => {
      const g = computeGeometry(workArea, options)

      expect(inside(g.card, workArea, SN.clearance)).toBe(true)
      expect(inside(g.toast, workArea, 0)).toBe(true)
      expect(inside(g.hit, workArea, 0)).toBe(true)
      expect(inside(g.notch, g.hit, 0)).toBe(true)
      expect(inside(g.notchOpen, g.hitOpen, 0)).toBe(true)
      expect(g.card.width).toBeLessThanOrEqual(SN.bounds.panelWidth[1])
      expect(g.hit.width).toBeGreaterThanOrEqual(SN.hit.width)
      expect(g.hit.height).toBeGreaterThanOrEqual(SN.hit.width)

      if (options.heightMode !== 'full') {
        // Compact height never follows the monitor.
        expect(g.card.height).toBeLessThanOrEqual(SN.card.height)
      }

      for (const mode of ['collapsed', 'toast', 'open'] as ShellMode[]) {
        const bounds = g.windows[mode]

        // The native window stays inside the work area and holds every
        // region that intercepts the pointer in that mode.
        expect(inside(bounds, workArea, 0)).toBe(true)

        for (const region of g.interactive[mode]) {
          expect(inside(region, bounds, 0)).toBe(true)
        }
      }

      // The open notch never covers the card.
      const overlap =
        g.hitOpen.x < g.card.x + g.card.width &&
        g.hitOpen.x + g.hitOpen.width > g.card.x &&
        g.hitOpen.y < g.card.y + g.card.height &&
        g.hitOpen.y + g.hitOpen.height > g.card.y

      expect(overlap).toBe(false)
    })
  }

  test('default is a 12 x 48 notch centred on the right edge', () => {
    const g = computeGeometry(mac)

    expect(g.edge).toBe('right')
    expect(g.notch).toEqual({ x: 1428, y: 403.5, width: 12, height: 48 })
    expect(g.hit).toEqual({ x: 1412, y: 391.5, width: 28, height: 72 })
    expect(g.windows.collapsed).toEqual(g.hit)
    expect(g.card).toEqual({ x: 1090, y: 187.5, width: 340, height: 480 })
    expect(g.cardRadius).toBe(24)
    expect(g.windows.open).toEqual({ x: 1062, y: 159.5, width: 378, height: 536 })
    // Nothing is as tall as the work area.
    expect(g.windows.open.height).toBeLessThan(mac.height)
  })

  test('a stored bottom dock still becomes top', () => {
    expect(computeGeometry(mac, { edge: 'bottom' }).edge).toBe('top')
  })

  test('margins, rounded corners and the edge gap pass through', () => {
    for (const edge of ['right', 'left', 'top'] as const) {
      const g = computeGeometry(mac, { edge })
      const { card } = g
      const bounds = g.windows.open

      // Card interior and the open notch strip intercept.
      expect(
        hitTest(g, 'open', {
          x: card.x + card.width / 2,
          y: card.y + card.height / 2,
        }),
      ).toBe('card')
      expect(
        hitTest(g, 'open', {
          x: g.hitOpen.x + g.hitOpen.width / 2,
          y: g.hitOpen.y + g.hitOpen.height / 2,
        }),
      ).toBe('notch')

      // All four rounded corners of the card's bounding box pass through.
      for (const [cx, cy] of [
        [card.x + 1, card.y + 1],
        [card.x + card.width - 1, card.y + 1],
        [card.x + 1, card.y + card.height - 1],
        [card.x + card.width - 1, card.y + card.height - 1],
      ]) {
        expect(hitTest(g, 'open', { x: cx, y: cy })).toBeNull()
      }

      // The shadow margin inside the window bounds passes through.
      const marginPoint =
        edge === 'top'
          ? { x: bounds.x + 4, y: card.y + card.height + 14 }
          : edge === 'right'
            ? { x: bounds.x + 4, y: bounds.y + 4 }
            : { x: bounds.x + bounds.width - 4, y: bounds.y + 4 }

      expect(inside({ ...marginPoint, width: 0, height: 0 }, bounds, 0)).toBe(true)
      expect(hitTest(g, 'open', marginPoint)).toBeNull()

      // Once the card is closed only the notch intercepts.
      expect(
        hitTest(g, 'collapsed', {
          x: card.x + card.width / 2,
          y: card.y + card.height / 2,
        }),
      ).toBeNull()
      expect(
        hitTest(g, 'collapsed', {
          x: g.hit.x + g.hit.width / 2,
          y: g.hit.y + g.hit.height / 2,
        }),
      ).toBe('notch')
    }
  })

  test('the toast intercepts only inside its rounded shape', () => {
    const g = computeGeometry(mac)
    const { toast } = g

    expect(
      hitTest(g, 'toast', {
        x: toast.x + toast.width / 2,
        y: toast.y + toast.height / 2,
      }),
    ).toBe('toast')
    expect(hitTest(g, 'toast', { x: toast.x + 1, y: toast.y + 1 })).toBeNull()
    expect(hitTest(g, 'toast', { x: toast.x - 10, y: toast.y - 10 })).toBeNull()
    expect(hitTest(g, 'collapsed', { x: toast.x + 40, y: toast.y + 30 })).toBeNull()
  })

  test('native bounds land on whole device pixels at 1x, 1.25x and 2x', () => {
    const g = computeGeometry({ x: 0, y: 25.6, width: 1536, height: 801.6 })

    for (const scale of [1, 1.25, 1.5, 2]) {
      for (const mode of ['collapsed', 'toast', 'open'] as ShellMode[]) {
        const snapped = snapToDevicePixels(g.windows[mode], scale)

        for (const value of [
          snapped.x,
          snapped.y,
          snapped.width,
          snapped.height,
        ]) {
          expect(Math.abs(value * scale - Math.round(value * scale))).toBeLessThan(1e-6)
        }

        // Snapping only grows the window, so no region is clipped.
        for (const region of g.interactive[mode]) {
          const local = relativeTo(region, snapped)

          expect(local.x).toBeGreaterThanOrEqual(-1e-6)
          expect(local.y).toBeGreaterThanOrEqual(-1e-6)
          expect(local.x + local.width).toBeLessThanOrEqual(snapped.width + 1e-6)
          expect(local.y + local.height).toBeLessThanOrEqual(snapped.height + 1e-6)
        }
      }
    }
  })

  test('the notch snaps to the centre and repositions along its edge', () => {
    const g = computeGeometry(mac)

    expect(snapNotchPercent(52.9)).toBe(50)
    expect(snapNotchPercent(47.1)).toBe(50)
    expect(snapNotchPercent(54)).toBe(54)
    expect(snapNotchPercent(140)).toBe(100)
    expect(repositionPercent(g, 50, mac.height / 4)).toBe(75)
    expect(repositionPercent(g, 50, 10)).toBe(50)
    expect(
      repositionPercent(computeGeometry(mac, { edge: 'top' }), 50, -mac.width / 4),
    ).toBe(25)
  })
})

test.describe('shell gestures and state', () => {
  const cases: Array<[Parameters<typeof classifyNotchGesture>[0], string]> = [
    [{ dx: 2, dy: 1, released: true }, 'click'],
    [{ dx: 30, dy: 4, released: false }, 'pulling'],
    [{ dx: 30, dy: 4, released: true }, 'cancel'],
    [{ dx: 52, dy: 6, released: true }, 'open'],
    [{ dx: 20, dy: 2, velocity: 0.8, released: true }, 'open'],
    [{ dx: 3, dy: 40, released: false }, 'reposition'],
    [{ dx: -30, dy: 2, released: true }, 'cancel'],
  ]

  for (const [input, expected] of cases) {
    test(`classify ${JSON.stringify(input)} -> ${expected}`, () => {
      expect(classifyNotchGesture(input)).toBe(expected)
    })
  }

  const at = (screenX: number, screenY: number, time: number) => ({
    screenX,
    screenY,
    time,
  })

  test('a press released within 6 px is a click', () => {
    const state = moveGesture(
      beginGesture('right', at(1000, 400, 0), false),
      at(997, 402, 30),
    )

    expect(state.kind).toBe('pending')
    expect(endGesture(state, at(997, 402, 60))).toBe('click')
  })

  test('an inward pull latches and commits at 48 px', () => {
    let state = beginGesture('right', at(1000, 400, 0), false)

    state = moveGesture(state, at(980, 401, 200))
    expect(state.kind).toBe('pulling')
    // Wandering along the edge afterwards does not turn it into a drag.
    state = moveGesture(state, at(975, 440, 600))
    expect(state.kind).toBe('pulling')
    expect(endGesture(state, at(975, 440, 900))).toBe('cancel')

    state = moveGesture(state, at(940, 440, 1400))
    expect(endGesture(state, at(940, 440, 1700))).toBe('open')
  })

  test('a short fast inward flick opens', () => {
    let state = beginGesture('left', at(0, 400, 0), false)

    state = moveGesture(state, at(10, 400, 8))
    state = moveGesture(state, at(26, 401, 16))
    expect(state.inward).toBeLessThan(SN.pull.commit)
    expect(endGesture(state, at(26, 401, 20))).toBe('open')
  })

  test('the top edge pulls downward and drags sideways', () => {
    let pull = beginGesture('top', at(700, 0, 0), false)

    pull = moveGesture(pull, at(702, 60, 400))
    expect(pull.kind).toBe('pulling')
    expect(endGesture(pull, at(702, 60, 800))).toBe('open')

    let drag = beginGesture('top', at(700, 0, 0), false)

    drag = moveGesture(drag, at(760, 2, 400))
    expect(drag.kind).toBe('reposition')
    expect(endGesture(drag, at(760, 2, 800))).toBe('reposition')
  })

  test('dragging is ignored while the card is open', () => {
    let state = beginGesture('right', at(1000, 400, 0), true)

    state = moveGesture(state, at(1000, 470, 300))
    expect(state.kind).toBe('ignored')
    expect(endGesture(state, at(1000, 470, 500))).toBe('none')
  })

  test('window bounds and pointer regions follow the phase', () => {
    const phase = {
      isOpen: false,
      cardPresent: false,
      pulling: false,
      hasToast: false,
    }

    expect(resolveModes(phase)).toEqual({
      windowMode: 'collapsed',
      interactiveMode: 'collapsed',
    })
    // A reminder widens the window for the toast; it never opens the card.
    expect(resolveModes({ ...phase, hasToast: true })).toEqual({
      windowMode: 'toast',
      interactiveMode: 'toast',
    })
    expect(
      resolveModes({ ...phase, isOpen: true, cardPresent: true, hasToast: true }),
    ).toEqual({ windowMode: 'open', interactiveMode: 'open' })
    // Pulling and the dismiss animation keep the window at the open bounds,
    // but the card no longer intercepts the pointer.
    expect(resolveModes({ ...phase, pulling: true })).toEqual({
      windowMode: 'open',
      interactiveMode: 'collapsed',
    })
    expect(resolveModes({ ...phase, cardPresent: true })).toEqual({
      windowMode: 'open',
      interactiveMode: 'collapsed',
    })
  })

  test('settings default to the compact right-middle notch', () => {
    expect(defaultSidebarSettings).toMatchObject({
      dockEdge: 'right',
      handleHeight: 48,
      handleY: 50,
      panelHeightMode: 'compact',
      panelRadius: 24,
      panelWidth: 340,
      tabVisibility: 'always',
      tabWidth: 12,
    })
    expect(sanitizeSettings({})).toMatchObject({
      panelHeightMode: 'compact',
      panelWidth: 340,
      tabWidth: 12,
    })
  })

  test('stored customisation is clamped, never converted', () => {
    const stored = sanitizeSettings({
      dockEdge: 'top',
      handleHeight: 84,
      handleY: 20,
      panelRadius: 18,
      panelWidth: 400,
      tabVisibility: 'hover',
      tabWidth: 42,
      visualStyle: 'paper',
    })

    expect(stored).toMatchObject({
      dockEdge: 'top',
      handleHeight: 84,
      handleY: 20,
      panelHeightMode: 'compact',
      panelRadius: 18,
      panelWidth: 400,
      tabVisibility: 'hover',
      tabWidth: 42,
      visualStyle: 'paper',
    })
    expect(sanitizeSettings({ dockEdge: 'left' }).dockEdge).toBe('left')
    expect(sanitizeSettings({ dockEdge: 'bottom' }).dockEdge).toBe('top')
    expect(sanitizeSettings({ tabWidth: 2, handleHeight: 10 })).toMatchObject({
      handleHeight: 44,
      tabWidth: 10,
    })
    expect(sanitizeSettings({ panelHeightMode: 'full' }).panelHeightMode).toBe(
      'full',
    )
  })
})

const card = (page: Page) => page.locator('.sn-card')
const notch = (page: Page) => page.locator('.sn-notch')
const pill = (page: Page) => page.locator('.sn-notch-pill')

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).boundingBox()

  expect(rect).not.toBeNull()
  return rect as NonNullable<typeof rect>
}

/** The card's box once its reveal animation has finished. */
async function openFrame(page: Page) {
  await expect(card(page)).toHaveClass(/is-open/)
  await expect(card(page)).toHaveCSS('transform', 'none')
  return box(page, '.sn-card')
}

async function dragFromNotch(page: Page, dx: number, dy: number, hold = true) {
  const hit = await box(page, '.sn-notch')
  const startX = hit.x + hit.width / 2
  const startY = hit.y + hit.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 4 })
  await page.mouse.move(startX + dx, startY + dy, { steps: 4 })

  if (hold) {
    // A pause before release, so the pull is judged on distance, not speed.
    await page.waitForTimeout(180)
  }

  await page.mouse.up()
}

test.describe('shell in the browser', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('closed is only a 12 x 48 notch halfway down the right edge', async ({
    page,
  }) => {
    await page.goto('/')

    const drawn = await box(page, '.sn-notch-pill')
    const hit = await box(page, '.sn-notch')

    expect(drawn.width).toBeCloseTo(12, 0)
    expect(drawn.height).toBeCloseTo(48, 0)
    expect(drawn.x + drawn.width).toBeCloseTo(1280, 0)
    expect(drawn.y + drawn.height / 2).toBeCloseTo(400, 0)
    expect(hit.width).toBeCloseTo(28, 0)
    expect(hit.height).toBeCloseTo(72, 0)
    await expect(card(page)).toBeHidden()
    await expect(card(page)).toHaveAttribute('inert', '')
    await expect(notch(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.native-dock-surface, .edge-handle')).toHaveCount(0)
  })

  test('hover does not open; click reveals the bounded rounded card', async ({
    page,
  }) => {
    await page.goto('/')
    await notch(page).hover()
    await page.waitForTimeout(250)
    await expect(card(page)).toBeHidden()
    expect((await box(page, '.sn-notch-pill')).width).toBeCloseTo(14, 0)

    await notch(page).click()
    await expect(card(page)).toHaveClass(/is-open/)
    await expect(card(page)).toHaveCSS('opacity', '1')

    const frame = await openFrame(page)

    expect(frame.width).toBeCloseTo(340, 0)
    expect(frame.height).toBeCloseTo(480, 0)
    expect(1280 - (frame.x + frame.width)).toBeCloseTo(10, 0)
    expect(frame.y).toBeCloseTo(160, 0)

    for (const corner of [
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
    ]) {
      await expect(card(page)).toHaveCSS(corner, '24px')
    }

    // Opened by pointer: focus goes to the card, not into a text field.
    await expect(card(page)).toBeFocused()
    await expect(notch(page)).toHaveAttribute('aria-expanded', 'true')
    expect((await box(page, '.sn-notch-pill')).width).toBeCloseTo(6, 0)
    // The open notch keeps to the clearance strip and never covers the card.
    expect((await box(page, '.sn-notch')).x).toBeGreaterThanOrEqual(
      frame.x + frame.width - 0.5,
    )

    await notch(page).click()
    await expect(card(page)).toBeHidden()
  })

  test('Escape closes and focus returns to the notch', async ({ page }) => {
    await page.goto('/')
    await notch(page).click()
    await expect(card(page)).toBeFocused()
    await page.getByPlaceholder('New task').click()
    await page.keyboard.press('Escape')
    await expect(card(page)).toBeHidden()
    await expect(notch(page)).toBeFocused()
  })

  test('Escape peels Settings before it closes the card', async ({ page }) => {
    await page.goto('/?open=1')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0)
    await expect(card(page)).toHaveClass(/is-open/)
    await page.keyboard.press('Escape')
    await expect(card(page)).toBeHidden()
  })

  test('the shortcut opens the card and focuses quick add', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Alt+Shift+KeyS')
    await expect(card(page)).toHaveClass(/is-open/)
    await expect(page.getByPlaceholder('New task')).toBeFocused()
    await page.keyboard.press('Alt+Shift+KeyS')
    await expect(card(page)).toBeHidden()
  })

  test('Enter on the notch opens the card', async ({ page }) => {
    await page.goto('/')
    await notch(page).focus()
    await page.keyboard.press('Enter')
    await expect(card(page)).toHaveClass(/is-open/)
  })

  test('a pointer click reported without a click count toggles once', async ({
    page,
  }) => {
    await page.goto('/')

    // Some input sources send the click that follows a pointer press with
    // detail 0, which is otherwise how Enter and Space arrive.
    const clickWithoutCount = () =>
      notch(page).evaluate((element) => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
      })

    await notch(page).click()
    await clickWithoutCount()
    await expect(card(page)).toHaveClass(/is-open/)
    await page.waitForTimeout(500)
    await expect(card(page)).toHaveClass(/is-open/)

    // On its own it is still a keyboard activation.
    await clickWithoutCount()
    await expect(card(page)).not.toHaveClass(/is-open/)
  })

  test('a 24 px pull springs back and a 60 px pull opens', async ({ page }) => {
    await page.goto('/')
    await dragFromNotch(page, -24, 2)
    await expect(card(page)).not.toHaveClass(/is-open/)
    await expect(card(page)).toBeHidden()

    await dragFromNotch(page, -60, 3)
    await expect(card(page)).toHaveClass(/is-open/)
  })

  test('the card follows the pointer during a pull', async ({ page }) => {
    await page.goto('/')

    const hit = await box(page, '.sn-notch')

    await page.mouse.move(hit.x + 14, hit.y + 36)
    await page.mouse.down()
    await page.mouse.move(hit.x + 14 - 60, hit.y + 38, { steps: 6 })
    await expect(card(page)).toHaveClass(/is-pulling/)
    await expect(card(page)).toHaveCSS('opacity', '0.5')
    await expect(card(page)).not.toHaveClass(/is-open/)
    await page.mouse.move(hit.x + 14 - 10, hit.y + 38, { steps: 6 })
    await page.waitForTimeout(180)
    await page.mouse.up()
    await expect(card(page)).toBeHidden()
  })

  test('dragging along the edge moves the notch without opening', async ({
    page,
  }) => {
    await page.goto('/')
    await dragFromNotch(page, 2, 200)
    await expect(card(page)).toBeHidden()

    const moved = await box(page, '.sn-notch-pill')

    expect(moved.y + moved.height / 2).toBeCloseTo(600, 0)
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(window.localStorage.getItem(key) ?? '{}').handleY,
          SETTINGS_KEY,
        ),
      )
      .toBe(75)

    // The card opens centred on the notch, pushed back inside the viewport.
    await notch(page).click()

    const frame = await openFrame(page)

    expect(frame.height).toBeCloseTo(480, 0)
    expect(frame.y + frame.height).toBeCloseTo(790, 0)
  })

  test('long content scrolls inside the card instead of growing it', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'sidenib.today.v1',
        JSON.stringify(
          Array.from({ length: 40 }, (_, index) => ({
            id: 5000 + index,
            meta: 'Today',
            priority: 'normal',
            title: `Long list task ${index + 1}`,
          })),
        ),
      )
    })
    await page.goto('/?open=1')

    const frame = await openFrame(page)
    const scroll = await page.locator('.sn-view-body').evaluate((node) => ({
      client: node.clientHeight,
      scroll: node.scrollHeight,
    }))

    expect(frame.height).toBeCloseTo(480, 0)
    expect(scroll.client).toBeLessThanOrEqual(480)
    expect(scroll.scroll).toBeGreaterThan(scroll.client * 2)
    await page.locator('.sn-view-body').evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
    await expect(page.getByText('Long list task 40')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(801)
  })

  test('a short viewport clamps the card and keeps it scrollable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 420 })
    await page.goto('/?open=1')

    const frame = await openFrame(page)

    expect(frame.height).toBeCloseTo(400, 0)
    expect(frame.y).toBeCloseTo(10, 0)
    await expect(page.locator('.workspace')).toHaveClass(/sn-compact/)
  })

  test('a stored top dock is kept and drops the same card down', async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ dockEdge: 'top', handleY: 25 }),
      )
    }, SETTINGS_KEY)
    await page.goto('/')
    await expect(page.locator('.workspace')).toHaveClass(/dock-top/)
    await expect(page.locator('.workspace')).toHaveClass(/sn-edge-top/)

    const drawn = await box(page, '.sn-notch-pill')

    expect(drawn.width).toBeCloseTo(48, 0)
    expect(drawn.height).toBeCloseTo(12, 0)
    expect(drawn.y).toBeCloseTo(0, 0)
    expect(drawn.x + drawn.width / 2).toBeCloseTo(320, 0)

    await dragFromNotch(page, 3, 60)
    const frame = await openFrame(page)

    expect(frame.width).toBeCloseTo(340, 0)
    expect(frame.height).toBeCloseTo(480, 0)
    expect(frame.y).toBeCloseTo(10, 0)
    expect(frame.x + frame.width / 2).toBeCloseTo(320, 0)
    await page.reload()
    await expect(page.locator('.workspace')).toHaveClass(/dock-top/)
  })

  test('the left dock mirrors the right', async ({ page }) => {
    await page.goto('/?dock=left&open=1')

    const frame = await openFrame(page)
    const drawn = await box(page, '.sn-notch-pill')

    expect(frame.x).toBeCloseTo(10, 0)
    expect(frame.width).toBeCloseTo(340, 0)
    expect(drawn.x).toBeCloseTo(0, 0)
  })

  test('stored v0.1.14 sizes and the hover-only notch still apply', async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          handleHeight: 84,
          panelWidth: 400,
          tabVisibility: 'hover',
          tabWidth: 42,
        }),
      )
    }, SETTINGS_KEY)
    await page.goto('/')
    await expect(page.locator('.workspace')).toHaveClass(/tab-hover/)
    // Hidden until the pointer reaches the hit target; hover never opens.
    await expect(pill(page)).toHaveCSS('opacity', '0')
    await notch(page).hover()
    await expect(pill(page)).toHaveCSS('opacity', '1')
    await expect(card(page)).toBeHidden()

    const drawn = await box(page, '.sn-notch-pill')

    expect(drawn.width).toBeCloseTo(44, 0)
    expect(drawn.height).toBeCloseTo(84, 0)
    await notch(page).click()
    expect((await openFrame(page)).width).toBeCloseTo(400, 0)
  })

  test('full-height mode is opt-in and keeps the rounded frame', async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify({ panelHeightMode: 'full' }))
    }, SETTINGS_KEY)
    await page.goto('/?open=1')

    const frame = await openFrame(page)

    expect(frame.height).toBeCloseTo(780, 0)
    expect(frame.y).toBeCloseTo(10, 0)
    await expect(card(page)).toHaveCSS('border-bottom-right-radius', '24px')
  })

  test('reduced motion removes travel and scale', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(card(page)).toHaveCSS('transform', 'none')
    await notch(page).click()
    await expect(card(page)).toHaveClass(/is-open/)
    await expect(card(page)).toHaveCSS('transform', 'none')
    await expect(card(page)).toHaveCSS('opacity', '1')
  })

  test('the native surface is transparent with nothing full height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 378, height: 536 })
    await page.goto('/?runtime=tauri&open=1')
    await expect(page.locator('.workspace')).toHaveClass(/is-native/)
    await expect(page.locator('.workspace')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    )
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    )
    await expect(page.locator('.desktop-preview')).toBeHidden()
    await expect(page.locator('.native-dock-surface')).toHaveCount(0)
    await expect(card(page)).toHaveCSS('border-top-right-radius', '24px')
  })
})
