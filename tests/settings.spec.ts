/*
 * Settings (ADIEN-164): the short default page, the Advanced page, System
 * theme resolution, stored and legacy preferences, reset, keyboard use,
 * short cards and contrast, on the notebook page (ADIEN-172). Runs against
 * the browser preview at the real card size; nothing here proves native
 * behaviour.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  EARLIER_PRESENTATION_DEFAULTS,
  PRE_COMPACT_DEFAULTS,
  SETTINGS_BACKUP_KEY,
  SETTINGS_REVISION,
  defaultSidebarSettings,
  migrateStoredSettings,
  resolveThemePreset,
  sanitizeSettings,
  themePresetsByMode,
} from '../src/sidebarSettings'
import type { SidebarSettings } from '../src/sidebarSettings'

const SETTINGS_KEY = 'sidenib.sidebar.settings.v27'

// What an untouched v0.1.14-era install has stored: explicit light, the
// `codex` preset, and every size still at the full-height sidebar's default.
// It has no `settingsRevision`, so on load the old notch and paper (ADIEN-171)
// and the old card sizes and densities (ADIEN-172) are carried forward to the
// current defaults. The behaviour choices in it are not presentation and are
// kept.
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
  taskRowHeight: 44,
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

// The six presentation fields at the notebook defaults.
const NOTEBOOK_PRESENTATION = {
  motionMs: 220,
  panelRadius: 16,
  panelWidth: 340,
  taskGap: 0,
  taskRowHeight: 36,
  taskTextSize: 14,
}

// The same profile after the one-time carry-forward.
const MIGRATED_LEGACY_SETTINGS = {
  ...LEGACY_SETTINGS,
  ...NOTEBOOK_PRESENTATION,
  tabWidth: 12,
  handleHeight: 48,
  surfaceAlpha: 100,
  panelHeightMode: 'compact',
  settingsRevision: 3,
}

// Sizes nobody shipped as a default: each one is a deliberate choice.
const CHOSEN_PRESENTATION = {
  motionMs: 300,
  panelRadius: 20,
  panelWidth: 480,
  taskGap: 4,
  taskRowHeight: 50,
  taskTextSize: 13,
}

// The compact card's defaults (revision 2), as that app wrote them.
const COMPACT_PRESENTATION = {
  motionMs: 220,
  panelRadius: 24,
  panelWidth: 340,
  taskGap: 0,
  taskRowHeight: 44,
  taskTextSize: 14,
}

// A profile saved by the compact app without touching Advanced.
const REVISION_2_SETTINGS = {
  ...LEGACY_SETTINGS,
  ...COMPACT_PRESENTATION,
  tabWidth: 12,
  handleHeight: 48,
  surfaceAlpha: 100,
  panelHeightMode: 'compact',
  settingsRevision: 2,
}

// Fields the carry-forward has no business with.
const UNTOUCHED_FIELDS = [
  'backdropBlur',
  'backdropDim',
  'backdropImage',
  'backdropImageName',
  'backdropOpacity',
  'dockEdge',
  'handleY',
  'launchAtLogin',
  'notificationsEnabled',
  'sectionOrder',
  'showCompleted',
  'tabVisibility',
  'taskSortMode',
  'theme',
  'visualStyle',
] as const

const pick = <T extends object>(value: T, keys: readonly string[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => keys.includes(key)),
  )

const workspace = (page: Page) => page.locator('.workspace')
const card = (page: Page) => page.locator('.sn-card')
const body = (page: Page) => page.locator('.sn-view-body')
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, level: 1 })
// The way back is an icon-only button named after the page it returns to.
const backLabel = (page: Page, label: string) =>
  page.locator(`.sn-back[aria-label="${label}"]`)
const tablist = (page: Page) => page.getByRole('tablist', { name: 'Views' })

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

/** The copy of the pre-conversion settings, exactly as stored, or null. */
const backup = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_BACKUP_KEY)

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
      surfaceAlpha: 100,
      theme: 'system',
      visualStyle: 'sidenib',
      // The notebook page: a 16 px corner and a 36 px ruled line.
      ...NOTEBOOK_PRESENTATION,
    })
    expect(SETTINGS_REVISION).toBe(3)
    expect(defaultSidebarSettings.settingsRevision).toBe(3)
    expect(sanitizeSettings({})).toEqual(defaultSidebarSettings)
    expect(sanitizeSettings(defaultSidebarSettings)).toEqual(
      defaultSidebarSettings,
    )
  })

  test('the sanitiser keeps legacy values as they are', () => {
    const kept = sanitizeSettings(LEGACY_SETTINGS as Partial<SidebarSettings>)

    expect(kept).toEqual({
      ...LEGACY_SETTINGS,
      panelHeightMode: 'compact',
      settingsRevision: SETTINGS_REVISION,
    })
    // Sanitising again changes nothing, so a rewrite on save is a no-op.
    expect(sanitizeSettings(kept)).toEqual(kept)
  })

  test('row height runs from 32 to 62', () => {
    expect(sanitizeSettings({ taskRowHeight: 36 }).taskRowHeight).toBe(36)
    expect(sanitizeSettings({ taskRowHeight: 32 }).taskRowHeight).toBe(32)
    expect(sanitizeSettings({ taskRowHeight: 20 }).taskRowHeight).toBe(32)
    expect(sanitizeSettings({ taskRowHeight: 62 }).taskRowHeight).toBe(62)
    expect(sanitizeSettings({ taskRowHeight: 80 }).taskRowHeight).toBe(62)
  })

  test('an untouched pre-compact profile moves to the notebook defaults', () => {
    const legacy = LEGACY_SETTINGS as Partial<SidebarSettings>
    const snapshot = JSON.stringify(legacy)

    expect(PRE_COMPACT_DEFAULTS).toEqual({
      handleHeight: 84,
      surfaceAlpha: 96,
      tabWidth: 42,
    })
    expect(EARLIER_PRESENTATION_DEFAULTS).toEqual({
      motionMs: [230, 220],
      panelRadius: [18, 24],
      panelWidth: [400, 340],
      taskGap: [7, 0],
      taskRowHeight: [44],
      taskTextSize: [12.5, 14],
    })

    const migrated = migrateStoredSettings(legacy)

    // Notch and paper (revision 2) and the six sizes (revision 3) all move.
    expect(migrated).toMatchObject({
      ...NOTEBOOK_PRESENTATION,
      handleHeight: 48,
      settingsRevision: 3,
      surfaceAlpha: 100,
      tabWidth: 12,
    })
    // Theme, preset, edge, login and the rest are exactly what was stored.
    expect(pick(migrated, UNTOUCHED_FIELDS)).toEqual(
      pick(LEGACY_SETTINGS, UNTOUCHED_FIELDS),
    )
    expect(sanitizeSettings(migrated)).toEqual(MIGRATED_LEGACY_SETTINGS)
    // The stored object itself is not touched.
    expect(migrated).not.toBe(legacy)
    expect(JSON.stringify(legacy)).toBe(snapshot)
  })

  test('a revision-2 profile on the compact defaults moves too', () => {
    const compact = REVISION_2_SETTINGS as Partial<SidebarSettings>
    const migrated = migrateStoredSettings(compact)

    expect(migrated).not.toBe(compact)
    expect(sanitizeSettings(migrated)).toEqual({
      ...REVISION_2_SETTINGS,
      ...NOTEBOOK_PRESENTATION,
      settingsRevision: 3,
    })
    expect(pick(migrated, UNTOUCHED_FIELDS)).toEqual(
      pick(REVISION_2_SETTINGS, UNTOUCHED_FIELDS),
    )

    // The notch and paper step belongs to revision 2 and has already run:
    // an old notch or 96% paper saved under revision 2 was chosen there.
    expect(
      migrateStoredSettings({
        ...compact,
        handleHeight: 84,
        surfaceAlpha: 96,
        tabWidth: 42,
      }),
    ).toMatchObject({
      ...NOTEBOOK_PRESENTATION,
      handleHeight: 84,
      settingsRevision: 3,
      surfaceAlpha: 96,
      tabWidth: 42,
    })
  })

  test('every earlier default of a field moves, on its own', () => {
    const fields = Object.keys(EARLIER_PRESENTATION_DEFAULTS) as Array<
      keyof typeof EARLIER_PRESENTATION_DEFAULTS
    >

    for (const revision of [undefined, 1, 2]) {
      for (const field of fields) {
        for (const earlier of EARLIER_PRESENTATION_DEFAULTS[field]) {
          // Only this field is an old default; the others are choices.
          const profile = {
            ...CHOSEN_PRESENTATION,
            [field]: earlier,
            ...(revision === undefined ? {} : { settingsRevision: revision }),
          }

          expect(
            migrateStoredSettings(profile),
            `${field} ${earlier} at revision ${revision}`,
          ).toMatchObject({
            ...CHOSEN_PRESENTATION,
            [field]: defaultSidebarSettings[field],
            settingsRevision: 3,
          })
        }
      }
    }
  })

  test('the carry-forward leaves choices alone', () => {
    // A notch that differs from the old default in either size is a choice.
    expect(
      migrateStoredSettings({ handleHeight: 84, tabWidth: 60 }),
    ).toMatchObject({ handleHeight: 84, tabWidth: 60 })
    expect(
      migrateStoredSettings({ handleHeight: 120, tabWidth: 42 }),
    ).toMatchObject({ handleHeight: 120, tabWidth: 42 })
    // So is any other opacity, and the old one under a backdrop image.
    expect(migrateStoredSettings({ surfaceAlpha: 80 }).surfaceAlpha).toBe(80)
    expect(
      migrateStoredSettings({
        backdropImage: 'data:image/png;base64,AAAA',
        surfaceAlpha: 96,
      }).surfaceAlpha,
    ).toBe(96)

    // Sizes that were never a default are kept, from a pre-compact profile
    // and from a revision-2 one, while the old notch and paper beside them
    // still move in the first case.
    const chosenLegacy = { ...LEGACY_SETTINGS, ...CHOSEN_PRESENTATION }

    expect(
      sanitizeSettings(
        migrateStoredSettings(chosenLegacy as Partial<SidebarSettings>),
      ),
    ).toEqual({
      ...MIGRATED_LEGACY_SETTINGS,
      ...CHOSEN_PRESENTATION,
    })

    const chosenCompact = { ...REVISION_2_SETTINGS, ...CHOSEN_PRESENTATION }

    expect(
      sanitizeSettings(
        migrateStoredSettings(chosenCompact as Partial<SidebarSettings>),
      ),
    ).toEqual({ ...chosenCompact, settingsRevision: 3 })

    // One step off an old default is a choice as well.
    expect(
      migrateStoredSettings({
        motionMs: 240,
        panelRadius: 23,
        panelWidth: 390,
        taskGap: 1,
        taskRowHeight: 45,
        taskTextSize: 13.5,
      }),
    ).toMatchObject({
      motionMs: 240,
      panelRadius: 23,
      panelWidth: 390,
      taskGap: 1,
      taskRowHeight: 45,
      taskTextSize: 13.5,
    })
    // A field that was never stored is not invented by the carry-forward.
    expect(migrateStoredSettings({ theme: 'dark' })).toEqual({
      settingsRevision: 3,
      theme: 'dark',
    })
  })

  test('values saved under the current revision are never converted', () => {
    // Every old default at once, chosen again under revision 3.
    const chosen = {
      handleHeight: 84,
      motionMs: 230,
      panelRadius: 18,
      panelWidth: 400,
      settingsRevision: SETTINGS_REVISION,
      surfaceAlpha: 96,
      tabWidth: 42,
      taskGap: 7,
      taskRowHeight: 44,
      taskTextSize: 12.5,
    }

    expect(migrateStoredSettings(chosen)).toBe(chosen)
    expect(sanitizeSettings(migrateStoredSettings(chosen))).toMatchObject(chosen)
    // The compact defaults hold the same way.
    const compact = { ...COMPACT_PRESENTATION, settingsRevision: 3 }

    expect(migrateStoredSettings(compact)).toBe(compact)
    // A later revision is left alone too.
    const later = { panelWidth: 400, settingsRevision: 4 }

    expect(migrateStoredSettings(later)).toBe(later)
    // Running the carry-forward twice is the same as running it once.
    for (const profile of [LEGACY_SETTINGS, REVISION_2_SETTINGS]) {
      const once = migrateStoredSettings(profile as Partial<SidebarSettings>)

      expect(migrateStoredSettings(once)).toBe(once)
    }
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
    await expectInsideCard(page, '.sn-index')
    expect(
      await body(page).evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBe(0)

    // The three views are the index line at the head of the page, in
    // Settings as everywhere else, and nothing follows the body: no footer.
    await expect(
      page.locator('.sn-header > .sn-index-line').getByRole('tablist'),
    ).toHaveClass(/sn-index/)
    await expect(tablist(page).getByRole('tab')).toHaveText([
      'Today',
      'Calendar',
      'Lists',
    ])
    await expect(page.locator('.sn-tabs')).toHaveCount(0)
    expect(
      await page
        .locator('.sn-view')
        .evaluate((view) => view.lastElementChild?.className ?? ''),
    ).toContain('sn-view-body')

    const headerBox = await page.locator('.sn-header').boundingBox()
    const bodyBox = await body(page).boundingBox()

    expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(
      bodyBox!.y + 0.5,
    )
    expect(bodyBox!.y + bodyBox!.height).toBeLessThanOrEqual(
      frame!.y + frame!.height + 0.5,
    )
    expect(bodyBox!.y + bodyBox!.height).toBeGreaterThan(
      frame!.y + frame!.height - 20,
    )

    // Rows lie on the paper on a 36 px ruled line: no raised group, a rule
    // under every row, and no gap between a group and the next label.
    const sheet = await page.locator('.sn-settings').evaluate((node) => {
      const transparent = (element: Element) =>
        getComputedStyle(element).backgroundColor === 'rgba(0, 0, 0, 0)'
      const rows = [...node.querySelectorAll('.sn-group > *')]
      const labels = [...node.querySelectorAll('.sn-section-label')]

      return {
        display: getComputedStyle(node).display,
        flatGroups: [...node.querySelectorAll('.sn-group')].every(transparent),
        labelStyle: labels.map((label) => getComputedStyle(label).fontStyle),
        rowHeights: rows.map((row) => ({
          height: row.getBoundingClientRect().height,
          segmented: row.querySelector('.sn-segmented') !== null,
        })),
        ruled: rows.every(
          (row) => parseFloat(getComputedStyle(row).borderBottomWidth) > 0,
        ),
        // Distance from the end of each group to the label that follows.
        seams: labels.slice(1).map((label) => {
          const before = label.closest('.sn-section')?.previousElementSibling

          return before
            ? label.getBoundingClientRect().top -
                before.getBoundingClientRect().bottom
            : 0
        }),
      }
    })

    expect(sheet.display).toBe('block')
    expect(sheet.flatGroups).toBe(true)
    expect(sheet.ruled).toBe(true)
    expect(sheet.labelStyle).toEqual(['italic', 'italic', 'italic', 'italic'])
    // A plain row is one 36 px line; a row holding a segmented control is
    // as tall as the control needs, a few pixels more.
    for (const { height, segmented } of sheet.rowHeights) {
      expect(height).toBeGreaterThanOrEqual(36)
      expect(height).toBeLessThanOrEqual(segmented ? 40 : 36.5)
    }
    for (const seam of sheet.seams) {
      expect(Math.abs(seam)).toBeLessThanOrEqual(0.5)
    }

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
      'rgb(243, 236, 216)',
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

  test('an untouched legacy profile opens as the notebook page, choices kept', async ({ page }) => {
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
    await expect(tablist(page).getByRole('tab')).toHaveText([
      'Lists',
      'Today',
      'Calendar',
    ])

    // What was stored is kept, byte for byte, before anything is rewritten.
    expect(await backup(page)).toBe(JSON.stringify(LEGACY_SETTINGS))

    // The card itself is drawn at the notebook size, not the stored one.
    expect((await card(page).boundingBox())?.width).toBeCloseTo(340, 0)
    await expect(card(page)).toHaveCSS('border-top-left-radius', '16px')

    await page.getByRole('button', { name: 'Advanced' }).click()
    // The old sizes were carried forward to the notebook ones.
    await expect(page.getByLabel('Width')).toHaveValue('340')
    await expect(page.getByLabel('Corner radius')).toHaveValue('16')
    await expect(page.getByLabel('Row height')).toHaveValue('36')
    await expect(page.getByLabel('Row spacing')).toHaveValue('0')
    await expect(page.getByLabel('Text size')).toHaveValue('14')
    await expect(page.getByLabel('Motion')).toHaveValue('220')
    // So were the old notch and paper.
    await expect(page.getByLabel('Surface opacity')).toHaveValue('100')
    await expect(page.getByLabel('Thickness')).toHaveValue('12')
    await expect(page.getByLabel('Length')).toHaveValue('48')
    // Where the notch sits and when it shows were choices.
    await expect(page.getByLabel('Position')).toHaveValue('20')
    await expect(
      page.getByRole('button', { name: 'On hover' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: /Theme preset/ }),
    ).toContainText('Sidenib')

    // One unrelated change is saved; everything else is written back as
    // converted, and the copy of the original is not replaced by it.
    await backLabel(page, 'Settings').click()
    await page.getByText('Launch at login', { exact: true }).click()
    await expect
      .poll(async () => (await stored(page)).launchAtLogin)
      .toBe(true)
    expect(await stored(page)).toEqual({
      ...MIGRATED_LEGACY_SETTINGS,
      launchAtLogin: true,
    })

    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await expect(workspace(page)).toHaveClass(/theme-light/)
    await expect(workspace(page)).toHaveClass(/dock-top/)
    await expect(page.getByLabel('Launch at login')).toBeChecked()
    expect((await stored(page)).visualStyle).toBe('codex')
    expect(await backup(page)).toBe(JSON.stringify(LEGACY_SETTINGS))
  })

  test('sizes chosen in a legacy profile are kept', async ({ page }) => {
    const chosen = { ...LEGACY_SETTINGS, ...CHOSEN_PRESENTATION }

    await seedSettings(page, chosen)
    await openSettings(page)
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('480')
    await expect(page.getByLabel('Corner radius')).toHaveValue('20')
    await expect(page.getByLabel('Row height')).toHaveValue('50')
    await expect(page.getByLabel('Row spacing')).toHaveValue('4')
    await expect(page.getByLabel('Text size')).toHaveValue('13')
    await expect(page.getByLabel('Motion')).toHaveValue('300')
    // The old notch and paper beside them still move.
    await expect(page.getByLabel('Surface opacity')).toHaveValue('100')
    await expect(page.getByLabel('Thickness')).toHaveValue('12')
    await expect(page.getByLabel('Length')).toHaveValue('48')

    // The chosen sizes are what is drawn: a 54 px line (50 + 4).
    await expect(card(page)).toHaveCSS('border-top-left-radius', '20px')
    await expect(page.locator('.sn-setting-row').first()).toHaveCSS(
      'min-height',
      '54px',
    )

    await expect
      .poll(() => stored(page))
      .toEqual({ ...MIGRATED_LEGACY_SETTINGS, ...CHOSEN_PRESENTATION })
    // The profile was still converted (revision, notch, paper), so it has a
    // copy of the original.
    expect(await backup(page)).toBe(JSON.stringify(chosen))
  })

  test('a revision-2 profile converts once and its copy is never replaced', async ({
    page,
  }) => {
    await seedSettings(page, REVISION_2_SETTINGS)
    await openSettings(page)
    expect(await backup(page)).toBe(JSON.stringify(REVISION_2_SETTINGS))

    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('340')
    await expect(page.getByLabel('Corner radius')).toHaveValue('16')
    await expect(page.getByLabel('Row height')).toHaveValue('36')
    await expect(page.getByLabel('Row spacing')).toHaveValue('0')
    await expect(page.getByLabel('Text size')).toHaveValue('14')
    await expect(page.getByLabel('Motion')).toHaveValue('220')
    await expect
      .poll(() => stored(page))
      .toEqual({
        ...REVISION_2_SETTINGS,
        ...NOTEBOOK_PRESENTATION,
        settingsRevision: 3,
      })

    // A plain reload converts nothing and leaves the copy alone.
    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    expect(await backup(page)).toBe(JSON.stringify(REVISION_2_SETTINGS))

    // Chosen sizes in a revision-2 profile are kept. Putting one in storage
    // makes the next load a second conversion; the first copy still stands.
    const second = { ...REVISION_2_SETTINGS, ...CHOSEN_PRESENTATION }

    await page.evaluate(
      ([key, json]) => window.localStorage.setItem(key, json),
      [SETTINGS_KEY, JSON.stringify(second)] as const,
    )
    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('480')
    await expect(page.getByLabel('Corner radius')).toHaveValue('20')
    await expect(page.getByLabel('Row height')).toHaveValue('50')
    await expect(page.getByLabel('Row spacing')).toHaveValue('4')
    await expect(page.getByLabel('Text size')).toHaveValue('13')
    await expect(page.getByLabel('Motion')).toHaveValue('300')
    await expect
      .poll(() => stored(page))
      .toEqual({ ...second, settingsRevision: 3 })
    expect(await backup(page)).toBe(JSON.stringify(REVISION_2_SETTINGS))
  })

  test('a fresh profile and a current one leave no copy behind', async ({
    page,
  }) => {
    await openSettings(page)
    expect(await backup(page)).toBeNull()

    // Saving a change and loading it again is not a conversion.
    await expect(page.getByLabel('Show completed')).toBeChecked()
    await page.getByText('Show completed', { exact: true }).click()
    await expect
      .poll(async () => (await stored(page)).showCompleted)
      .toBe(false)
    expect(await stored(page)).toEqual({
      ...defaultSidebarSettings,
      showCompleted: false,
    })
    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await expect(page.getByLabel('Show completed')).not.toBeChecked()
    expect(await backup(page)).toBeNull()

    // Nor is a revision-3 profile that holds every old default by choice.
    const current = { ...LEGACY_SETTINGS, settingsRevision: 3 }

    await page.evaluate(
      ([key, json]) => window.localStorage.setItem(key, json),
      [SETTINGS_KEY, JSON.stringify(current)] as const,
    )
    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('400')
    await expect(page.getByLabel('Corner radius')).toHaveValue('18')
    await expect(page.getByLabel('Row height')).toHaveValue('44')
    await expect(page.getByLabel('Row spacing')).toHaveValue('7')
    await expect(page.getByLabel('Text size')).toHaveValue('12.5')
    await expect(page.getByLabel('Motion')).toHaveValue('230')
    await expect(page.getByLabel('Surface opacity')).toHaveValue('96')
    await expect(page.getByLabel('Thickness')).toHaveValue('42')
    await expect(page.getByLabel('Length')).toHaveValue('84')
    expect(await backup(page)).toBeNull()
  })

  test('the old defaults come back when chosen again', async ({ page }) => {
    await seedSettings(page, LEGACY_SETTINGS)
    await openSettings(page)
    await page.getByRole('button', { name: 'Advanced' }).click()
    await page.getByLabel('Surface opacity').fill('96')
    await page.getByLabel('Thickness').fill('42')
    await page.getByLabel('Length').fill('84')
    await page.getByLabel('Corner radius').fill('18')
    await page.getByLabel('Row height').fill('44')
    await page.getByLabel('Row spacing').fill('7')
    await page.getByLabel('Text size').fill('12.5')
    await page.getByLabel('Motion').fill('230')
    await page.getByLabel('Width').fill('400')
    await page.getByRole('button', { name: 'Apply width' }).click()

    const chosenAgain = {
      handleHeight: 84,
      motionMs: 230,
      panelRadius: 18,
      panelWidth: 400,
      settingsRevision: 3,
      surfaceAlpha: 96,
      tabWidth: 42,
      taskGap: 7,
      taskRowHeight: 44,
      taskTextSize: 12.5,
    }

    await expect
      .poll(async () => pick(await stored(page), Object.keys(chosenAgain)))
      .toEqual(chosenAgain)

    // Saved under the current revision, so the reload keeps them.
    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Surface opacity')).toHaveValue('96')
    await expect(page.getByLabel('Thickness')).toHaveValue('42')
    await expect(page.getByLabel('Length')).toHaveValue('84')
    await expect(page.getByLabel('Width')).toHaveValue('400')
    await expect(page.getByLabel('Corner radius')).toHaveValue('18')
    await expect(page.getByLabel('Row height')).toHaveValue('44')
    await expect(page.getByLabel('Row spacing')).toHaveValue('7')
    await expect(page.getByLabel('Text size')).toHaveValue('12.5')
    await expect(page.getByLabel('Motion')).toHaveValue('230')
    expect(pick(await stored(page), Object.keys(chosenAgain))).toEqual(
      chosenAgain,
    )
    // The copy is still the profile as it stood before the first load.
    expect(await backup(page)).toBe(JSON.stringify(LEGACY_SETTINGS))
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
    await expect(tablist(page).getByRole('tab')).toHaveText([
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

    // The index line comes first and is one stop: with Settings open no view
    // is current, so the first tab holds it. Then every control on the
    // default page is reachable with Tab, in order.
    await expect(tablist(page).getByRole('tab', { selected: true })).toHaveCount(0)
    await expect(tablist(page).locator('[tabindex="0"]')).toHaveText(['Today'])
    await tablist(page).getByRole('tab', { name: 'Today' }).focus()

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
      'Done',
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
    ])
    // Reset is the last stop in the card: there is no footer after the page.
    expect(
      await card(page).evaluate((node) => {
        const stops = [
          ...node.querySelectorAll<HTMLElement>(
            'button, input, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((stop) => stop.tabIndex >= 0)

        return stops[stops.length - 1] === document.activeElement
      }),
    ).toBe(true)

    // The focused row shows a ring.
    const advanced = page.getByRole('button', { name: 'Advanced' })

    await page.keyboard.press(`Shift+${tab}`)
    await expect(advanced).toBeFocused()
    await expect(advanced).toHaveCSS('outline-style', 'solid')
    await expect(advanced).toHaveCSS('outline-width', '2px')

    // Enter pushes the page and focus lands on the way back.
    await page.keyboard.press('Enter')
    await expect(heading(page, 'Advanced')).toBeVisible()
    await expect(backLabel(page, 'Settings')).toBeFocused()
    // The way back has no text of its own; its name is where it goes.
    await expect(
      page.locator('.sn-title-line').getByRole('button', {
        name: 'Settings',
        exact: true,
      }),
    ).toBeFocused()
    await expect(backLabel(page, 'Settings')).toHaveText('')
    await expectInsideCard(page, '.sn-back')

    // A switch-like choice and a slider by keyboard.
    await page.getByRole('button', { name: 'Full', exact: true }).focus()
    await page.keyboard.press('Space')
    await expect(
      page.getByRole('button', { name: 'Full', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Compact', exact: true }).click()
    await page.getByLabel('Corner radius').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByLabel('Corner radius')).toHaveValue('15')

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

    // Row height reaches down to 32; spacing is added to every ruled line.
    await expect(page.getByLabel('Row height')).toHaveAttribute('min', '32')
    await expect(page.getByLabel('Row height')).toHaveValue('36')

    const row = page.locator('.sn-setting-row').first()

    await expect(row).toHaveCSS('min-height', '36px')
    await page.getByLabel('Row spacing').fill('6')
    await expect(row).toHaveCSS('min-height', '42px')
    await page.getByLabel('Row height').fill('32')
    await expect(row).toHaveCSS('min-height', '38px')
    await page.getByLabel('Corner radius').fill('12')
    await expect(card(page)).toHaveCSS('border-top-left-radius', '12px')
    await page.getByLabel('Surface opacity').fill('80')
    await page.getByRole('button', { name: 'On hover' }).click()
    await expect(workspace(page)).toHaveClass(/tab-hover/)

    await expect
      .poll(() => stored(page))
      .toMatchObject({
        panelRadius: 12,
        panelWidth: 420,
        surfaceAlpha: 80,
        tabVisibility: 'hover',
        taskGap: 6,
        taskRowHeight: 32,
      })

    await page.reload()
    await expect(heading(page, 'Settings')).toBeVisible()
    await page.getByRole('button', { name: 'Advanced' }).click()
    await expect(page.getByLabel('Width')).toHaveValue('420')
    await expect(page.getByLabel('Row spacing')).toHaveValue('6')
    await expect(page.getByLabel('Row height')).toHaveValue('32')
    await expect(page.getByLabel('Corner radius')).toHaveValue('12')
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
      await expectInsideCard(page, '.sn-index')
      await expect(tablist(page).getByRole('tab')).toHaveCount(3)
      await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
      // Scrolled to the end, the last thing on the page is above its foot.
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
  // Rows, labels and controls are written straight on the page now, so the
  // page is the ground for all of them; only slips (menus, the toast) are
  // raised.
  const pairs = [
    ['--sn-ink', '--sn-surface', 'row label and shortcut key on the page', 4.5],
    ['--sn-ink-secondary', '--sn-surface', 'value, section label, footnote and unselected segment', 4.5],
    // The chosen segment is ink with the paper colour as its text.
    ['--sn-surface', '--sn-ink', 'selected segment', 4.5],
    ['--sn-accent-text', '--sn-surface', 'Done, back and preset check mark', 4.5],
    ['--sn-danger', '--sn-surface', 'Reset settings', 4.5],
    ['--sn-ink', '--sn-surface-raised', 'text on a slip', 4.5],
    ['--sn-ink-secondary', '--sn-surface-raised', 'secondary text on a slip', 4.5],
    // Control parts, not text: WCAG 1.4.11 asks 3:1.
    ['--sn-accent-ink', '--sn-accent', 'switch knob on its track, on', 3],
    ['--sn-ink', '--sn-surface', 'selected segment against the page', 3],
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

  // The token pairs above say what should be compared; this reads what is
  // actually painted, so a control that stops using those tokens is caught.
  for (const mode of ['light', 'dark'] as const) {
    test(`the drawn ${mode} Settings pages meet contrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode })
      await page.goto(`/?open=1&settings=1&theme=${mode}`)
      await expect(heading(page, 'Settings')).toBeVisible()

      const measure = (targets: ReadonlyArray<readonly [string, string, number]>) =>
        page.evaluate((list) => {
          const canvas = document.createElement('canvas')

          canvas.width = 1
          canvas.height = 1

          const context = canvas.getContext('2d', { willReadFrequently: true })!
          // Any CSS colour, as straight RGBA.
          const rgba = (colour: string) => {
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = colour
            context.fillRect(0, 0, 1, 1)

            const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data

            if (a === 0) {
              return [0, 0, 0, 0]
            }

            return [r, g, b, a / 255]
          }
          const over = (top: number[], under: number[]) => {
            const alpha = top[3] + under[3] * (1 - top[3])

            return alpha === 0
              ? [0, 0, 0, 0]
              : [
                  ...[0, 1, 2].map(
                    (i) =>
                      (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) /
                      alpha,
                  ),
                  alpha,
                ]
          }
          // What is painted behind the element's content, own fill included.
          // The paper itself is the panel's ::after, under everything in it.
          const ground = (element: Element) => {
            let colour = [0, 0, 0, 0]

            for (
              let node: Element | null = element;
              node && colour[3] < 0.999;
              node = node.parentElement
            ) {
              colour = over(colour, rgba(getComputedStyle(node).backgroundColor))

              if (node.matches('.sn-panel')) {
                colour = over(
                  colour,
                  rgba(getComputedStyle(node, '::after').backgroundColor),
                )
              }
            }

            return colour
          }
          const luminance = ([r, g, b]: number[]) => {
            const linear = (channel: number) => {
              const value = channel / 255

              return value <= 0.03928
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4
            }

            return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
          }

          return list.map(([name, selector, minimum]) => {
            const element = document.querySelector(selector)

            if (!element) {
              return `${name}: nothing matches ${selector}`
            }

            const back = ground(element)

            if (back[3] < 0.999) {
              return `${name}: no opaque ground found`
            }

            const ink = over(rgba(getComputedStyle(element).color), back)
            const a = luminance(ink)
            const b = luminance(back)
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

            return ratio < minimum ? `${name} is ${ratio.toFixed(2)}:1` : ''
          })
        }, targets)

      const failures = await measure([
        ['section label', '.sn-settings .sn-section-label', 4.5],
        ['row label', '.sn-settings .sn-setting-row', 4.5],
        ['switch row label', '.sn-settings .sn-control-row', 4.5],
        ['selected segment', '.sn-segmented button[aria-pressed="true"]', 4.5],
        ['unselected segment', '.sn-segmented button[aria-pressed="false"]', 4.5],
        ['nav row value', '.sn-setting-row.is-nav > em', 4.5],
        ['shortcut key', '.sn-setting-row kbd', 4.5],
        ['footnote', '.sn-settings-note', 4.5],
        ['Reset settings', '.sn-setting-row.is-danger', 4.5],
        ['Done', '.sn-header .sn-text-button', 4.5],
        ['index tab', '.sn-index [role="tab"]', 4.5],
        ['title', '.sn-title', 4.5],
      ])

      // The selected segment really is ink with paper-coloured text.
      const segment = page.locator('.sn-segmented button[aria-pressed="true"]').first()
      const tokens = await workspace(page).evaluate((root) => {
        const probe = document.createElement('span')

        root.append(probe)
        probe.style.color = 'var(--sn-surface)'

        const surface = getComputedStyle(probe).color

        probe.style.color = 'var(--sn-ink)'

        const ink = getComputedStyle(probe).color

        probe.remove()
        return { ink, surface }
      })

      await expect(segment).toHaveCSS('color', tokens.surface)
      await expect(segment).toHaveCSS('background-color', tokens.ink)
      await expect(
        page.locator('.sn-segmented button[aria-pressed="false"]').first(),
      ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // The track is an outline, not a sunken fill.
      await expect(page.locator('.sn-segmented').first()).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      )

      await page.getByRole('button', { name: 'Advanced' }).click()
      await expect(heading(page, 'Advanced')).toBeVisible()
      failures.push(
        ...(await measure([
          ['back button', '.sn-back', 3],
          ['slider row label', '.sn-settings .sn-group > *', 4.5],
          ['Advanced section label', '.sn-settings .sn-section-label', 4.5],
        ])),
      )

      expect(failures.filter(Boolean)).toEqual([])
    })
  }
})
