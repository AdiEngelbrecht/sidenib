/*
 * Settings (ADIEN-164): the short default page, the Advanced page, System
 * theme resolution, stored and legacy preferences, reset, keyboard use,
 * short cards and contrast. Runs against the browser preview at the real
 * card size; nothing here proves native behaviour.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  defaultSidebarSettings,
  resolveThemePreset,
  sanitizeSettings,
  themePresetsByMode,
} from '../src/sidebarSettings'
import type { SidebarSettings } from '../src/sidebarSettings'

const SETTINGS_KEY = 'sidenib.sidebar.settings.v27'

// What a v0.1.14-era install has stored: explicit light, the `codex` preset,
// the old sizes, and choices the compact defaults would not have made.
const LEGACY_SETTINGS = {
  dockEdge: 'top',
  panelWidth: 400,
  tabVisibility: 'hover',
  tabWidth: 42,
  handleHeight: 84,
  handleY: 20,
  motionMs: 230,
  panelRadius: 18,
  surfaceAlpha: 96,
  taskRowHeight: 50,
  taskGap: 7,
  taskTextSize: 12.5,
  showCompleted: false,
  launchAtLogin: false,
  notificationsEnabled: false,
  taskSortMode: 'oldest',
  theme: 'light',
  visualStyle: 'codex',
  sectionOrder: ['lists', 'today', 'calendar'],
  backdropImage: '',
  backdropImageName: '',
  backdropOpacity: 60,
  backdropBlur: 4,
  backdropDim: 30,
}

const workspace = (page: Page) => page.locator('.workspace')
const card = (page: Page) => page.locator('.sn-card')
const body = (page: Page) => page.locator('.sn-view-body')
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, level: 1 })
const backLabel = (page: Page, label: string) =>
  page.locator('.sn-back').filter({ hasText: label })

/**
 * WebKit on macOS moves Tab between text fields only, unless the system
 * "Keyboard navigation" setting is on; Option+Tab always visits every control.
 */
const tabKey = (browserName: string) =>
  browserName === 'webkit' ? 'Alt+Tab' : 'Tab'

/** Seeds storage once, so a later reload reads what the app itself wrote. */
async function seedSettings(page: Page, value: object) {
  await page.addInitScript(
    ([key, json]) => {
      if (!window.sessionStorage.getItem('seeded')) {
        window.sessionStorage.setItem('seeded', '1')
        window.localStorage.setItem(key, json)
      }
    },
    [SETTINGS_KEY, JSON.stringify(value)] as const,
  )
}

const stored = (page: Page) =>
  page.evaluate(
    (key) =>
      JSON.parse(window.localStorage.getItem(key) ?? '{}') as SidebarSettings,
    SETTINGS_KEY,
  )

async function openSettings(page: Page, query = '') {
  await page.goto(`/?open=1&settings=1${query}`)
  await expect(card(page)).toHaveClass(/is-open/)
  await expect(heading(page, 'Settings')).toBeVisible()
}

/** The whole element lies inside the card. */
async function expectInsideCard(page: Page, selector: string) {
  const frame = await card(page).boundingBox()
  const box = await page.locator(selector).first().boundingBox()

  expect(frame).not.toBeNull()
  expect(box).not.toBeNull()

  if (frame && box) {
    expect(box.x).toBeGreaterThanOrEqual(frame.x - 0.5)
    expect(box.y).toBeGreaterThanOrEqual(frame.y - 0.5)
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 0.5)
    expect(box.y + box.height).toBeLessThanOrEqual(
      frame.y + frame.height + 0.5,
    )
  }
}

test.describe('settings model', () => {
  test('new defaults follow the system and use the Sidenib preset', () => {
    expect(defaultSidebarSettings).toMatchObject({
      dockEdge: 'right',
      handleY: 50,
      panelHeightMode: 'compact',
      panelWidth: 340,
      surfaceAlpha: 100,
      theme: 'system',
      visualStyle: 'sidenib',
    })
    expect(sanitizeSettings({})).toEqual(defaultSidebarSettings)
    expect(sanitizeSettings(defaultSidebarSettings)).toEqual(
      defaultSidebarSettings,
    )
  })

  test('stored legacy values are kept as they are', () => {
    const kept = sanitizeSettings(LEGACY_SETTINGS as Partial<SidebarSettings>)

    expect(kept).toEqual({ ...LEGACY_SETTINGS, panelHeightMode: 'compact' })
    // Sanitising again changes nothing, so a rewrite on save is a no-op.
    expect(sanitizeSettings(kept)).toEqual(kept)
  })

  test('theme and preset fall back only when the value is unknown', () => {
    expect(sanitizeSettings({ theme: 'dark' }).theme).toBe('dark')
    expect(sanitizeSettings({ theme: 'light' }).theme).toBe('light')
    expect(sanitizeSettings({ theme: 'system' }).theme).toBe('system')
    expect(
      sanitizeSettings({ theme: 'sepia' as SidebarSettings['theme'] }).theme,
    ).toBe('system')
    expect(
      sanitizeSettings({
        visualStyle: 'lumen' as SidebarSettings['visualStyle'],
      }).visualStyle,
    ).toBe('sidenib')
    // A dark-only preset survives an explicit light theme in storage.
    expect(
      sanitizeSettings({ theme: 'light', visualStyle: 'graphite' }).visualStyle,
    ).toBe('graphite')
  })

  test('the drawn preset is always one the mode has', () => {
    expect(resolveThemePreset('codex', 'light')).toBe('sidenib')
    expect(resolveThemePreset('codex', 'dark')).toBe('sidenib')
    expect(resolveThemePreset('sidenib', 'dark')).toBe('sidenib')
    expect(resolveThemePreset('graphite', 'dark')).toBe('graphite')
    expect(resolveThemePreset('graphite', 'light')).toBe('sidenib')
    expect(resolveThemePreset('paper', 'dark')).toBe('sidenib')
    expect(resolveThemePreset('clay', 'light')).toBe('clay')
    expect(resolveThemePreset('clay', 'dark')).toBe('clay')

    for (const mode of ['light', 'dark'] as const) {
      expect(themePresetsByMode[mode]).toHaveLength(6)
      expect(themePresetsByMode[mode][0]).toBe('sidenib')
    }
  })
})

test.describe('settings in the compact card', () => {
  test.use({ viewport: { width: 900, height: 700 } })

  test('the default page is ten rows with no sliders and no connector', async ({
    page,
  }) => {
    await openSettings(page)

    await expect(
      page.locator('.sn-settings .sn-section-label'),
    ).toHaveText(['Appearance', 'Tasks', 'Desktop', 'More'])
    await expect(page.locator('.sn-settings .sn-group > *')).toHaveCount(10)
    await expect(page.locator('.sn-settings input[type="range"]')).toHaveCount(0)
    await expect(page.getByText(/gmail|connector/i)).toHaveCount(0)

    // The card keeps its size; the page scrolls inside it.
    const frame = await card(page).boundingBox()

    expect(frame?.width).toBeCloseTo(340, 0)
    expect(frame?.height).toBeCloseTo(480, 0)
    await expectInsideCard(page, '.sn-header')
    await expectInsideCard(page, '.sn-tabs')
    expect(
      await body(page).evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBe(0)

    // The shortcut is the pair the native side registers.
    await expect(
      page.locator('.sn-setting-row').filter({ hasText: 'Open or close' }),
    ).toContainText(/⌥⇧S|Alt\+Shift\+S/)
    await expect(page.locator('.sn-settings-note').first()).toContainText(
      /⌃⌥⇧S|Ctrl\+Alt\+Shift\+S/,
    )
  })

  test('System follows the device while running; Light and Dark hold', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await openSettings(page)
    await expect(
      page.getByRole('button', { name: 'System', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(workspace(page)).toHaveClass(/theme-dark/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.sn-panel')).toHaveCSS(
      'color',
      'rgb(244, 239, 226)',
    )

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(workspace(page)).toHaveClass(/theme-light/)

    // An explicit choice ignores the device.
    await page.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(workspace(page)).toHaveClass(/theme-dark/)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.getByRole('button', { name: 'Light', exact: true }).click()
    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // Back on System it picks the device up again, with no reload.
    await page.getByRole('button', { name: 'System', exact: true }).click()
    await expect(workspace(page)).toHaveClass(/theme-dark/)

    // The unresolved preference never reaches the classes or the attribute.
    await expect(workspace(page)).not.toHaveClass(/theme-system/)
    await expect.poll(async () => (await stored(page)).theme).toBe('system')
  })

  test('legacy stored preferences reload unchanged', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await seedSettings(page, LEGACY_SETTINGS)
    await openSettings(page)

    // Explicit light stays light on a dark device; codex draws as Sidenib.
    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(workspace(page)).toHaveClass(/style-sidenib/)
    await expect(workspace(page)).toHaveClass(/dock-top/)
    await expect(workspace(page)).toHaveClass(/tab-hover/)
    await expect(
      page.getByRole('button', { name: 'Light', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: 'Oldest', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Show completed')).not.toBeChecked()
    await expect(page.getByLabel('Reminders')).not.toBeChecked()
    await expect(page.getByLabel('Launch at login')).not.toBeChecked()
    await expect(page.getByRole('button', { name: /Tab order/ })).toContainText(
      'Lists, Today, Calendar',
    )
    await expect(page.getByRole('tablist').getByRole('tab')).toHaveText([
      'Lists',
      'Today',
      'Calendar',
    ])

    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('400')
    await expect(page.getByLabel('Corner radius')).toHaveValue('18')
    await expect(page.getByLabel('Surface opacity')).toHaveValue('96')
    await expect(page.getByLabel('Thickness')).toHaveValue('42')
    await expect(page.getByLabel('Length')).toHaveValue('84')
    await expect(page.getByLabel('Position')).toHaveValue('20')
    await expect(page.getByLabel('Row height')).toHaveValue('50')
    await expect(page.getByLabel('Row spacing')).toHaveValue('7')
    await expect(page.getByLabel('Text size')).toHaveValue('12.5')
    await expect(page.getByLabel('Motion')).toHaveValue('230')
    await expect(
      page.getByRole('button', { name: 'On hover' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: /Theme preset/ }),
    ).toContainText('Sidenib')

    // One unrelated change is saved; everything else is written back as it was.
    await backLabel(page, 'Settings').click()
    await page.getByText('Launch at login', { exact: true }).click()
    await expect
      .poll(async () => (await stored(page)).launchAtLogin)
      .toBe(true)
    expect(await stored(page)).toEqual({
      ...LEGACY_SETTINGS,
      launchAtLogin: true,
      panelHeightMode: 'compact',
    })

    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(workspace(page)).toHaveClass(/dock-top/)
    await expect(page.getByLabel('Launch at login')).toBeChecked()
    expect((await stored(page)).visualStyle).toBe('codex')
  })

  test('a preset with no palette in the mode is parked, not replaced', async ({
    page,
  }) => {
    await seedSettings(page, {
      ...LEGACY_SETTINGS,
      dockEdge: 'right',
      tabVisibility: 'always',
      theme: 'dark',
      visualStyle: 'graphite',
    })
    await openSettings(page)
    await expect(workspace(page)).toHaveClass(/theme-dark/)
    await expect(workspace(page)).toHaveClass(/style-graphite/)

    await page.getByRole('button', { name: 'Light', exact: true }).click()
    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(workspace(page)).toHaveClass(/style-sidenib/)
    await expect.poll(async () => (await stored(page)).theme).toBe('light')
    expect((await stored(page)).visualStyle).toBe('graphite')

    await page.getByRole('button', { name: 'Advanced' }).click()
    await page.getByRole('button', { name: /Theme preset/ }).click()
    await expect(page.getByRole('radio')).toHaveCount(6)
    await expect(page.getByRole('radio', { name: /Sidenib/ })).toBeChecked()
    await expect(page.getByRole('status')).toContainText(
      'Graphite is a dark preset',
    )

    await backLabel(page, 'Advanced').click()
    await backLabel(page, 'Settings').click()
    await page.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(workspace(page)).toHaveClass(/style-graphite/)
  })

  test('reset confirms inside the card and restores the new defaults', async ({
    page,
    browserName,
  }) => {
    const tab = tabKey(browserName)

    await page.emulateMedia({ colorScheme: 'light' })
    await seedSettings(page, {
      ...LEGACY_SETTINGS,
      dockEdge: 'left',
      tabVisibility: 'always',
      theme: 'dark',
      visualStyle: 'midnight',
    })
    await openSettings(page)
    await expect(workspace(page)).toHaveClass(/style-midnight/)

    const reset = page.getByRole('button', { name: 'Reset settings' })
    const confirm = page.getByRole('alertdialog', {
      name: 'Reset settings confirmation',
    })

    await reset.scrollIntoViewIfNeeded()
    await reset.click()
    await expect(confirm).toBeVisible()
    await expectInsideCard(page, '[role="alertdialog"]')
    // The safe choice has focus, and Escape closes only the confirmation.
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(confirm).toHaveCount(0)
    await expect(heading(page, 'Settings')).toBeVisible()
    await expect(reset).toBeFocused()
    await expect(workspace(page)).toHaveClass(/style-midnight/)

    // By keyboard: open, move to Reset, confirm.
    await page.keyboard.press('Enter')
    await expect(confirm).toBeVisible()
    await page.keyboard.press(tab)
    await expect(
      page.getByRole('button', { name: 'Reset', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(confirm).toHaveCount(0)

    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(workspace(page)).toHaveClass(/style-sidenib/)
    await expect(workspace(page)).toHaveClass(/dock-right/)
    await expect(
      page.getByRole('button', { name: 'System', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('tablist').getByRole('tab')).toHaveText([
      'Today',
      'Calendar',
      'Lists',
    ])
    await expect.poll(() => stored(page)).toEqual(defaultSidebarSettings)

    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await expect(workspace(page)).toHaveClass(/style-sidenib/)
    expect(await stored(page)).toEqual(defaultSidebarSettings)
  })

  test('pages, focus and Escape work from the keyboard', async ({
    page,
    browserName,
  }) => {
    const tab = tabKey(browserName)

    await openSettings(page)

    // Every control on the default page is reachable with Tab, in order.
    await page.getByRole('button', { name: 'Done' }).focus()

    const reached: string[] = []

    for (let step = 0; step < 16; step += 1) {
      await page.keyboard.press(tab)
      reached.push(
        await page.evaluate(() => {
          const node = document.activeElement as HTMLElement

          return (
            node.getAttribute('aria-label') ??
            node.closest('label')?.textContent ??
            node.textContent ??
            ''
          ).trim()
        }),
      )
    }

    expect(reached).toEqual([
      'System',
      'Light',
      'Dark',
      'Dock left',
      'Dock top',
      'Dock right',
      'Priority',
      'Newest',
      'Oldest',
      'Show completed',
      expect.stringContaining('Tab order'),
      'Reminders',
      'Launch at login',
      'Advanced',
      'Reset settings',
      'Today',
    ])

    // The focused row shows a ring.
    const advanced = page.getByRole('button', { name: 'Advanced' })

    await page.keyboard.press(`Shift+${tab}`)
    await page.keyboard.press(`Shift+${tab}`)
    await expect(advanced).toBeFocused()
    await expect(advanced).toHaveCSS('outline-style', 'solid')
    await expect(advanced).toHaveCSS('outline-width', '2px')

    // Enter pushes the page and focus lands on the way back.
    await page.keyboard.press('Enter')
    await expect(heading(page, 'Advanced')).toBeVisible()
    await expect(backLabel(page, 'Settings')).toBeFocused()

    // A switch-like choice and a slider by keyboard.
    await page.getByRole('button', { name: 'Full', exact: true }).focus()
    await page.keyboard.press('Space')
    await expect(
      page.getByRole('button', { name: 'Full', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Compact', exact: true }).click()
    await page.getByLabel('Corner radius').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByLabel('Corner radius')).toHaveValue('23')

    // The preset list is a radio group: arrows move and choose.
    const presetRow = page.getByRole('button', { name: /Theme preset/ })

    await presetRow.focus()
    await page.keyboard.press('Enter')
    await expect(heading(page, 'Theme preset')).toBeVisible()
    await expect(backLabel(page, 'Advanced')).toBeFocused()
    await page.getByRole('radio', { name: /Sidenib/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('radio').nth(1)).toBeChecked()
    await expect(page.getByRole('radio').nth(1)).toBeFocused()
    await expect(workspace(page)).toHaveClass(/style-(porcelain|carbon)/)
    await page.keyboard.press('ArrowUp')
    await expect(workspace(page)).toHaveClass(/style-sidenib/)

    // Escape peels one page at a time, returning focus to the row it left.
    await page.keyboard.press('Escape')
    await expect(heading(page, 'Advanced')).toBeVisible()
    await expect(presetRow).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(heading(page, 'Settings')).toBeVisible()
    await expect(advanced).toBeFocused()

    // Then Settings itself, then the card.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Today' })).toBeVisible()
    await expect(card(page)).toHaveClass(/is-open/)
    await page.keyboard.press('Escape')
    await expect(card(page)).toBeHidden()
  })

  test('advanced controls apply and persist', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('button', { name: 'Advanced' }).click()

    // Width waits for Apply, so the card does not move under the slider.
    await page.getByLabel('Width').fill('420')
    await expect(page.getByText('The card resizes when you apply.')).toBeVisible()
    expect((await card(page).boundingBox())?.width).toBeCloseTo(340, 0)
    await page.getByRole('button', { name: 'Apply width' }).click()
    await expect
      .poll(async () => Math.round((await card(page).boundingBox())?.width ?? 0))
      .toBe(420)
    await expect(page.getByRole('button', { name: 'Apply width' })).toHaveCount(0)

    await page.getByLabel('Row spacing').fill('6')
    await expect(workspace(page)).toHaveClass(/sn-rows-spaced/)
    await page.getByLabel('Surface opacity').fill('80')
    await page.getByRole('button', { name: 'On hover' }).click()
    await expect(workspace(page)).toHaveClass(/tab-hover/)

    await expect
      .poll(() => stored(page))
      .toMatchObject({
        panelWidth: 420,
        surfaceAlpha: 80,
        tabVisibility: 'hover',
        taskGap: 6,
      })

    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('420')
    await expect(page.getByLabel('Row spacing')).toHaveValue('6')
    await expect(page.getByLabel('Surface opacity')).toHaveValue('80')
  })

  test('reduced motion is honoured and explained', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openSettings(page)
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByText(/Reduce Motion is on/)).toBeVisible()
    // Page changes are a fade at most; with reduced motion it is over at once.
    await expect(page.locator('.sn-view')).toHaveCSS('animation-duration', '0.001s')
    expect(
      await page
        .locator('.sn-switch, .sn-setting-row')
        .evaluateAll((nodes) =>
          nodes.every(
            (node) => parseFloat(getComputedStyle(node).transitionDuration) <= 0.001,
          ),
        ),
    ).toBe(true)

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(page.getByText(/Reduce Motion is on/)).toHaveCount(0)
  })
})

test.describe('settings on a short display', () => {
  // A 420-high work area gives the 400-high card.
  test.use({ viewport: { width: 900, height: 420 } })

  test('every page and the confirmation fit and scroll', async ({ page }) => {
    await openSettings(page)

    const frame = await card(page).boundingBox()

    expect(frame).not.toBeNull()
    expect(frame!.height).toBeLessThanOrEqual(400.5)
    expect(frame!.y).toBeGreaterThanOrEqual(0)
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(420)

    const checkPage = async () => {
      await expectInsideCard(page, '.sn-header')
      await expectInsideCard(page, '.sn-view-body')
      await expectInsideCard(page, '.sn-tabs')
      await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
      // Scrolled to the end, the last thing on the page is clear of the tabs.
      expect(
        await body(page).evaluate((node) => {
          node.scrollTo(0, node.scrollHeight)

          const last = node.querySelector('.sn-settings > :last-child')

          return last
            ? node.getBoundingClientRect().bottom -
                last.getBoundingClientRect().bottom
            : -1
        }),
      ).toBeGreaterThanOrEqual(0)
    }

    await checkPage()

    const reset = page.getByRole('button', { name: 'Reset settings' })

    await reset.scrollIntoViewIfNeeded()
    await reset.click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expectInsideCard(page, '[role="alertdialog"]')
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: /Tab order/ }).click()
    await checkPage()
    await backLabel(page, 'Settings').click()

    await page.getByRole('button', { name: 'Advanced' }).click()
    await checkPage()
    await page.getByRole('button', { name: /Theme preset/ }).click()
    await checkPage()
    await backLabel(page, 'Advanced').click()
    await page.getByRole('button', { name: /Backdrop image/ }).click()
    await checkPage()
  })
})

test.describe('settings contrast', () => {
  const pairs = [
    ['--sn-ink', '--sn-surface-raised', 'row label on a group', 4.5],
    ['--sn-ink-secondary', '--sn-surface-raised', 'value on a group', 4.5],
    ['--sn-ink-secondary', '--sn-surface', 'group label and footnote', 4.5],
    ['--sn-ink-secondary', '--sn-surface-sunken', 'unselected segment', 4.5],
    ['--sn-ink', '--sn-surface-sunken', 'shortcut key', 4.5],
    ['--sn-accent-text', '--sn-surface', 'Done and back labels', 4.5],
    ['--sn-accent-text', '--sn-surface-raised', 'preset check mark', 4.5],
    ['--sn-danger', '--sn-surface-raised', 'Reset settings', 4.5],
    // A control part, not text: WCAG 1.4.11 asks 3:1.
    ['--sn-accent-ink', '--sn-accent', 'switch knob on its track', 3],
  ] as const

  for (const mode of ['light', 'dark'] as const) {
    test(`text and controls meet contrast on every ${mode} preset`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode })
      await page.goto(`/?open=1&settings=1&theme=${mode}`)
      await expect(heading(page, 'Settings')).toBeVisible()
      await page.getByRole('button', { name: 'Advanced' }).click()
      await page.getByRole('button', { name: /Theme preset/ }).click()

      const failures: string[] = []

      for (const preset of themePresetsByMode[mode]) {
        await page.getByRole('radio').nth(themePresetsByMode[mode].indexOf(preset)).check({ force: true })
        await expect(workspace(page)).toHaveClass(new RegExp(`style-${preset}`))

        const ratios = await page.evaluate((tokenPairs) => {
          const root = document.querySelector('.workspace') as HTMLElement
          const probe = document.createElement('span')

          root.append(probe)

          const read = (token: string) => {
            probe.style.color = `var(${token})`

            const [r, g, b] = getComputedStyle(probe)
              .color.match(/[\d.]+/g)!
              .map(Number)
            const linear = (channel: number) => {
              const value = channel / 255

              return value <= 0.03928
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4
            }

            return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
          }
          const result = tokenPairs.map(([ink, surface]) => {
            const a = read(ink)
            const b = read(surface)

            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          })

          probe.remove()
          return result
        }, pairs)

        ratios.forEach((ratio, index) => {
          if (ratio < pairs[index][3]) {
            failures.push(
              `${mode} ${preset}: ${pairs[index][2]} is ${ratio.toFixed(2)}:1`,
            )
          }
        })
      }

      expect(failures).toEqual([])
    })
  }
})
