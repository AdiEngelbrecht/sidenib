import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const viewports = [
  { height: 900, name: 'desktop', width: 1280 },
  { height: 780, name: 'narrow', width: 420 },
  { height: 480, name: 'short', width: 900 },
] as const

const SETTINGS_BUTTON = { name: 'Settings', exact: true } as const

const taskRow = (page: Page, title: string) =>
  page.locator('.sn-task').filter({ hasText: title })

/** Row actions appear on hover (or keyboard focus); then the named one is used. */
async function rowAction(page: Page, title: string, name: string | RegExp) {
  const row = taskRow(page, title)

  await row.hover()
  await row.getByRole('button', { name }).click()
}

async function addTask(page: Page, label: string, title: string) {
  await page.getByLabel(label).fill(title)
  await page.getByRole('button', { name: 'Add task' }).click()
}

test('tasks, lists, reminders and settings work in the compact card', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  const nextYear = new Date().getFullYear() + 1

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleMessages.push(`${message.type()}: ${message.text()}`)
    }
  })

  page.on('pageerror', (error) => {
    consoleMessages.push(`pageerror: ${error.message}`)
  })

  await page.goto('/')
  await expect(page).toHaveTitle(/sidenib/i)
  await expect(page.getByText('Sidenib').first()).toBeVisible()

  // Closed, only the notch is there; the card content is not shown.
  await expect(page.locator('.sn-card')).toBeHidden()
  await page.getByRole('button', { name: 'Open Sidenib' }).click()
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

  // Compact chrome: one segmented control, no side rail, no progress strip,
  // and no group inside a group.
  await expect(page.getByRole('tablist').getByRole('tab')).toHaveText([
    'Today',
    'Calendar',
    'Lists',
  ])
  await expect(
    page.locator('.sidebar-rail, .focus-strip, .section-meter'),
  ).toHaveCount(0)
  await expect(page.locator('.sn-group .sn-group')).toHaveCount(0)

  await page.getByRole('button', SETTINGS_BUTTON).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Show completed')).toBeVisible()
  await expect(page.getByText('Reminders', { exact: true })).toBeVisible()
  await expect(page.getByText('Connectors', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Connect Gmail', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog', { name: 'Today' })).toBeVisible()
  await page.getByRole('button', SETTINGS_BUTTON).click()
  await expect(page.getByText('Connect Gmail', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Priority', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Newest' }).click()
  await expect(page.getByRole('button', { name: 'Newest' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Tuning controls live one level down, on the Advanced page.
  const backTo = (label: string) =>
    page.locator('.sn-back').filter({ hasText: label }).click()

  await page.getByRole('button', { name: 'Advanced' }).click()
  await expect(page.getByRole('heading', { name: 'Advanced' })).toBeVisible()
  await page.getByRole('button', { name: /Backdrop image/ }).click()
  await expect(page.getByText('No backdrop image', { exact: true })).toBeVisible()
  await page.locator('.backdrop-actions input[type="file"]').setInputFiles({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lFPccwAAAABJRU5ErkJggg==',
      'base64',
    ),
    mimeType: 'image/png',
    name: 'backdrop.png',
  })
  await expect(page.locator('.workspace')).toHaveClass(/has-custom-backdrop/)
  await expect(page.locator('.sn-notch')).toBeVisible()
  await expect(page.getByText('Image strength', { exact: true })).toBeVisible()
  await backTo('Advanced')

  await page.getByRole('button', { name: /Theme preset/ }).click()
  await expect(page.getByRole('radio')).toHaveCount(6)
  await expect(page.getByRole('radio', { name: /Lumen/ })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /Graphite/ })).toHaveCount(0)
  await backTo('Advanced')
  await backTo('Settings')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('button', { name: /Theme preset/ }).click()
  await expect(page.getByRole('radio')).toHaveCount(6)
  await expect(page.getByRole('radio', { name: /Smoke/ })).toHaveCount(0)
  await page.getByText('Graphite', { exact: true }).click()
  await expect(page.locator('.workspace')).toHaveClass(/theme-dark/)
  await expect(page.locator('.workspace')).toHaveClass(/style-graphite/)
  // The preset reaches the card through the tokens.
  await expect(page.locator('.sn-panel')).toHaveCSS('color', 'rgb(246, 247, 248)')
  await backTo('Advanced')
  await expect(page.getByText('Position', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'On hover' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/tab-hover/)
  await backTo('Settings')
  await expect(page.getByText('Middle', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dock bottom' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Dock left' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/dock-left/)
  await page.getByRole('button', { name: 'Dock top' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/dock-top/)
  await page.getByRole('button', { name: 'Dock right' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/dock-right/)
  await page
    .getByRole('button', { name: 'Reset settings' })
    .scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Reset settings' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Reset settings confirmation' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Reset settings confirmation' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: /Tab order/ }).click()
  const todayLayoutRow = page.locator('.section-order-row').filter({
    hasText: 'Today',
  })
  const listsLayoutRow = page.locator('.section-order-row').filter({
    hasText: 'Lists',
  })

  await todayLayoutRow.scrollIntoViewIfNeeded()
  await listsLayoutRow.scrollIntoViewIfNeeded()

  const todayLayoutBox = await todayLayoutRow.boundingBox()
  const listsLayoutBox = await listsLayoutRow.boundingBox()

  expect(todayLayoutBox).not.toBeNull()
  expect(listsLayoutBox).not.toBeNull()

  if (todayLayoutBox && listsLayoutBox) {
    await page.mouse.move(todayLayoutBox.x + 12, todayLayoutBox.y + 17)
    await page.mouse.down()
    await page.mouse.move(listsLayoutBox.x + 12, listsLayoutBox.y + 17, {
      steps: 6,
    })
    await page.mouse.up()
    await expect(page.locator('.section-order-row').nth(2)).toContainText(
      'Today',
    )
    // The tabs follow the stored order.
    await expect(page.getByRole('tablist').getByRole('tab').last()).toHaveText(
      'Today',
    )
  }
  await page.getByRole('button', { name: 'Move Today up' }).click()
  await backTo('Settings')

  await page.getByText('Show completed', { exact: true }).click()
  await expect(page.getByLabel('Show completed')).not.toBeChecked()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('tab', { name: 'Today' }).click()
  await expect(page.getByText('Inbox suggestions', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Capture inbox', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/^Completed/)).toHaveCount(0)
  await expect(page.locator('[data-view="today"]')).toBeVisible()
  await expect(page.locator('[data-view="calendar"]')).toHaveCount(0)

  // Create with a reminder, then rename inline.
  await page.getByLabel('Add a task to Today').fill('Reminder smoke')
  await page.getByRole('button', { name: 'Add reminder time' }).click()
  await page.getByRole('textbox', { name: 'Reminder time' }).fill(`${nextYear}-05-09T09:30`)
  await page.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByLabel('Add a task to Today')).toHaveValue('')
  await expect(page.getByLabel('Add a task to Today')).toBeFocused()
  await expect(taskRow(page, 'Reminder smoke')).toBeVisible()
  await expect(
    taskRow(page, 'Reminder smoke').locator('.task-reminder'),
  ).toContainText('09:30')
  await rowAction(page, 'Reminder smoke', 'More actions for Reminder smoke')
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByRole('textbox', { name: 'Edit Reminder smoke' }).fill(
    'Renamed smoke',
  )
  await page.getByRole('textbox', { name: 'Edit Reminder smoke' }).press('Enter')
  await expect(taskRow(page, 'Renamed smoke')).toBeVisible()

  // Priority: the gold dot marks Focus.
  await expect(taskRow(page, 'Renamed smoke').locator('.sn-flag')).toHaveCount(0)
  await rowAction(page, 'Renamed smoke', 'More actions for Renamed smoke')
  await page.getByRole('menuitem', { name: 'Priority: Normal. Change' }).click()
  await expect(
    page.getByRole('menuitem', { name: 'Priority: Focus. Change' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)
  await expect(taskRow(page, 'Renamed smoke').locator('.sn-flag')).toHaveCount(1)

  // Reminder selection on an existing row: clear, then set again by preset.
  await rowAction(page, 'Renamed smoke', /^Reminder .* for Renamed smoke/)
  await page.getByRole('button', { name: 'Clear reminder' }).click()
  await expect(
    taskRow(page, 'Renamed smoke').locator('.task-reminder'),
  ).toHaveCount(0)
  await rowAction(page, 'Renamed smoke', 'Add reminder for Renamed smoke')
  await page.getByRole('button', { name: 'Next week at the same time' }).click()
  await expect(
    taskRow(page, 'Renamed smoke').locator('.task-reminder'),
  ).toHaveCount(1)

  // Delete asks first; Shift skips the question.
  await addTask(page, 'Add a task to Today', 'Delete smoke')
  await rowAction(page, 'Delete smoke', 'More actions for Delete smoke')
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Confirm delete Delete smoke' }),
  ).toBeVisible()
  await page
    .getByRole('alertdialog', { name: 'Confirm delete Delete smoke' })
    .getByRole('button', { name: 'Cancel' })
    .click()
  await expect(page.getByText('Delete smoke', { exact: true })).toBeVisible()
  await rowAction(page, 'Delete smoke', 'More actions for Delete smoke')
  await page
    .getByRole('menuitem', { name: 'Delete' })
    .click({ modifiers: ['Shift'] })
  await expect(page.getByText('Delete smoke', { exact: true })).toHaveCount(0)

  // A due reminder raises the toast; opening it lands on the Calendar.
  await page.evaluate(() => {
    window.localStorage.setItem('sidenib.notified-reminders.v1', '{}')
  })
  await page.getByLabel('Add a task to Today').fill('Toast smoke')
  await page.getByRole('button', { name: 'Add reminder time' }).click()
  await page.getByRole('textbox', { name: 'Reminder time' }).fill('2020-01-01T09:30')
  await page.getByRole('button', { name: 'Add task' }).click()
  // In the past, so it is listed as overdue.
  await expect(page.getByText('Overdue · 1')).toBeVisible()
  await expect(taskRow(page, 'Toast smoke')).toHaveClass(/is-overdue/)
  const reminderToast = page.getByRole('status').filter({ hasText: 'Toast smoke' })
  await expect(reminderToast).toBeVisible({ timeout: 15_000 })
  await expect(
    reminderToast.getByRole('button', {
      name: 'Snooze Toast smoke 10 minutes',
    }),
  ).toBeVisible()
  await reminderToast.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('heading', { name: 'January' })).toBeVisible()
  await expect(taskRow(page, 'Toast smoke')).toBeVisible()

  // Calendar: back to today, then an event on a day next month.
  const calendar = page.locator('[data-view="calendar"]')

  await expect(calendar).toBeVisible()
  await expect(page.getByRole('grid')).toBeVisible()
  await calendar
    .getByRole('button', { name: 'Jump to today', exact: true })
    .click()
  await expect(page.locator('.calendar-grid .is-selected')).toHaveText(
    String(new Date().getDate()),
  )
  await expect(page.locator('.calendar-grid .is-selected')).toHaveClass(
    /is-today/,
  )
  await page.getByRole('button', { name: 'Next month' }).click()
  await page.locator('.calendar-grid .sn-day:not(.is-outside)').nth(14).click()
  await expect(page.locator('.calendar-grid .is-selected')).toHaveText('15')
  await expect(page.getByLabel('Add a task to selected calendar day')).toBeVisible()
  await page
    .getByLabel('Add a task to selected calendar day')
    .fill('Calendar smoke')
  await page.getByRole('button', { name: /^Entry type: Task/ }).click()
  await expect(
    page.getByRole('button', { name: /^Entry type: Event/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add task' }).click()
  await expect(taskRow(page, 'Calendar smoke')).toBeVisible()
  await expect(
    taskRow(page, 'Calendar smoke')
      .locator('.task-kind-pill')
      .filter({ hasText: 'Event' }),
  ).toBeVisible()
  await expect(page.locator('.calendar-grid .is-selected')).toHaveClass(
    /has-items/,
  )
  await expect(page.locator('[data-view="today"]')).toHaveCount(0)

  // Lists: create, rename, add a task, pin to Today.
  await page.getByRole('tab', { name: 'Lists' }).click()
  await expect(page.getByRole('tab', { name: 'Lists' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('[data-view="lists"]')).toBeVisible()
  await expect(calendar).toHaveCount(0)
  await page.getByRole('button', { name: 'New list' }).click()
  await page.getByLabel('Create a custom list').fill('Workstream')
  await page.getByRole('button', { name: 'Create list' }).click()
  await expect(page.getByRole('heading', { name: 'Workstream' })).toBeVisible()
  await page.getByRole('button', { name: 'Actions for Workstream' }).click()
  await page.getByRole('menuitem', { name: 'Rename list' }).click()
  await page.getByRole('textbox', { name: 'Rename Workstream' }).fill('Planner')
  await page.getByRole('textbox', { name: 'Rename Workstream' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible()
  await page.getByLabel('Add a task to Planner').fill('Pinned task')
  await page.getByLabel('Add a task to Planner').press('Enter')
  await expect(taskRow(page, 'Pinned task')).toBeVisible()
  await page.getByRole('button', { name: 'Actions for Planner' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Show on Today' }).click()
  await expect(page.getByText('1 open · shown on Today')).toBeVisible()
  await page.getByRole('button', { name: 'Lists', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open Planner, 1 open' }),
  ).toBeVisible()

  // The pinned list is one labelled group on Today, not a card in a card.
  await page.getByRole('tab', { name: 'Today' }).click()
  await expect(
    page.locator('.sn-section-label').filter({ hasText: 'Planner' }),
  ).toBeVisible()
  await expect(taskRow(page, 'Pinned task')).toBeVisible()
  await expect(page.locator('.sn-group .sn-group')).toHaveCount(0)

  // Completed tasks come back with the setting, behind a disclosure.
  await page.getByRole('button', SETTINGS_BUTTON).click()
  await page.getByText('Show completed', { exact: true }).click()
  await expect(page.getByLabel('Show completed')).toBeChecked()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('tab', { name: 'Today' }).click()
  await page.getByRole('button', { name: 'Completed · 1' }).click()
  await expect(page.getByText('Capture inbox', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Complete Renamed smoke' }).click()
  await expect(page.getByRole('button', { name: 'Completed · 2' })).toBeVisible()
  await expect(taskRow(page, 'Renamed smoke')).toHaveClass(/is-done/)
  await page.getByRole('button', { name: 'Mark Renamed smoke open' }).click()
  await expect(page.getByRole('button', { name: 'Completed · 1' })).toBeVisible()
  await expect(taskRow(page, 'Renamed smoke')).not.toHaveClass(/is-done/)

  // Everything above is stored locally and survives a reload.
  await expect
    .poll(() =>
      page.evaluate(() => ({
        lists: window.localStorage.getItem('sidenib.custom-lists.v1') ?? '',
        today: window.localStorage.getItem('sidenib.today.v1') ?? '',
      })),
    )
    .toMatchObject({
      lists: expect.stringContaining('Pinned task'),
      today: expect.stringContaining('Renamed smoke'),
    })
  await page.goto('/?open=1')
  await expect(taskRow(page, 'Renamed smoke')).toBeVisible()
  await expect(taskRow(page, 'Renamed smoke').locator('.sn-flag')).toHaveCount(1)
  await expect(taskRow(page, 'Pinned task')).toBeVisible()

  expect(consoleMessages).toEqual([])
})

test('row actions are reachable by keyboard and Escape peels one layer', async ({
  page,
}) => {
  await page.goto('/?open=1')
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)

  const row = taskRow(page, 'Design sidebar shell')

  // Hidden until hover or focus, but always in the tab order.
  await expect(row.locator('.sn-row-actions')).toHaveCSS('opacity', '0')
  await row.getByRole('button', { name: 'Complete Design sidebar shell' }).focus()
  await page.keyboard.press('Tab')
  await expect(
    row.getByRole('button', { name: 'Add reminder for Design sidebar shell' }),
  ).toBeFocused()
  await expect(row.locator('.sn-row-actions')).toHaveCSS('opacity', '1')
  await page.keyboard.press('Tab')

  const more = row.getByRole('button', {
    name: 'More actions for Design sidebar shell',
  })

  await expect(more).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: /^Priority/ })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('alertdialog', {
      name: 'Confirm delete Design sidebar shell',
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()

  // Escape closes the confirmation only, and focus returns to the row.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)
  await expect(more).toBeFocused()
  await expect(row).toBeVisible()

  // Rename by keyboard; Escape leaves the rename without closing the card.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  const edit = page.getByRole('textbox', { name: 'Edit Design sidebar shell' })

  await expect(edit).toBeFocused()
  await edit.fill('Should not be saved')
  await page.keyboard.press('Escape')
  await expect(edit).toHaveCount(0)
  await expect(row).toBeVisible()
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)

  // A quick-add draft is cleared before Escape may close the card.
  const quickAdd = page.getByLabel('Add a task to Today')

  await quickAdd.fill('Half-typed')
  await page.keyboard.press('Escape')
  await expect(quickAdd).toHaveValue('')
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.sn-card')).toBeHidden()

  // Arrow keys move between the tabs.
  await page.goto('/?open=1')
  await page.getByRole('tab', { name: 'Today' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Calendar' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Lists' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('long titles clamp to two lines and stay readable and editable', async ({
  page,
}) => {
  const longTitle =
    'Write the long-form retrospective for the offsite including travel costs, catering feedback and the follow-up actions nobody has picked up yet'
  const unbroken = `https://example.org/${'a-very-long-unbroken-path/'.repeat(6)}`

  await page.addInitScript(
    ([first, second]) => {
      window.localStorage.setItem(
        'sidenib.today.v1',
        JSON.stringify([
          { id: 7002, meta: 'Today', priority: 'normal', title: first },
          { id: 7001, meta: 'Today', priority: 'normal', title: second },
        ]),
      )
    },
    [longTitle, unbroken],
  )
  await page.goto('/?open=1')

  const row = taskRow(page, 'retrospective')
  const title = row.locator('.sn-row-title')

  // Two lines of 19 px, the full text as the tooltip, nothing overflowing.
  await expect(title).toHaveAttribute('title', longTitle)
  expect((await title.boundingBox())?.height).toBeLessThanOrEqual(39)
  expect(
    await page
      .locator('.sn-view-body')
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true)
  expect(
    (await taskRow(page, 'example.org').locator('.sn-row-title').boundingBox())
      ?.width,
  ).toBeLessThanOrEqual(300)

  // Renaming shows the whole title, however long.
  await title.dblclick()

  const edit = page.getByRole('textbox', { name: `Edit ${longTitle}` })

  await expect(edit).toHaveValue(longTitle)
  expect(
    await edit.evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
  ).toBe(true)
  expect((await edit.boundingBox())?.height).toBeGreaterThan(60)
  await edit.fill('Short again')
  await edit.press('Enter')
  await expect(taskRow(page, 'Short again')).toBeVisible()
})

for (const viewport of viewports) {
  test(`sidebar layout stays inside the viewport on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    })
    await page.goto('/?open=1')

    const sidebar = page.locator('.sn-card')
    const handle = page.locator('.sn-notch')

    await expect(sidebar).toBeVisible()
    await expect(handle).toBeVisible()
    await expect(page.getByRole('separator', { name: 'Resize panel' })).toHaveCount(
      0,
    )
    await expect(page.getByRole('button', SETTINGS_BUTTON)).toBeVisible()
    // Header, quick add and tabs all sit inside the card; only the body
    // between them scrolls.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const frame = document
            .querySelector('.sn-card')
            ?.getBoundingClientRect()

          return ['.sn-header', '.sn-view-body', '.sn-quick', '.sn-tabs'].every(
            (selector) => {
              const rect = document
                .querySelector(selector)
                ?.getBoundingClientRect()

              return Boolean(
                frame &&
                  rect &&
                  rect.top >= frame.top - 0.5 &&
                  rect.bottom <= frame.bottom + 0.5 &&
                  rect.left >= frame.left - 0.5 &&
                  rect.right <= frame.right + 0.5,
              )
            },
          )
        }),
      )
      .toBe(true)

    await expect(sidebar).toHaveCSS('transform', 'none')

    const sidebarBox = await sidebar.boundingBox()
    const handleBox = await handle.boundingBox()
    const documentWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    )

    expect(sidebarBox).not.toBeNull()
    expect(handleBox).not.toBeNull()
    expect(documentWidth).toBeLessThanOrEqual(viewport.width + 2)

    if (sidebarBox && handleBox) {
      // The card is bounded: never wider or taller than the compact frame,
      // whatever the viewport, and always clear of the viewport edges.
      expect(sidebarBox.width).toBeLessThanOrEqual(340.5)
      expect(sidebarBox.height).toBeLessThanOrEqual(480.5)
      expect(sidebarBox.y).toBeGreaterThanOrEqual(9.5)
      expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(
        viewport.height - 9.5,
      )
      expect(sidebarBox.x).toBeGreaterThanOrEqual(-1)
      expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(
        viewport.width + 1,
      )
      expect(handleBox.x).toBeGreaterThanOrEqual(-1)
      expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(
        viewport.width + 1,
      )
      expect(handleBox.y).toBeGreaterThanOrEqual(-1)
      expect(handleBox.y + handleBox.height).toBeLessThanOrEqual(
        viewport.height + 1,
      )
    }

    await page.getByRole('button', SETTINGS_BUTTON).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Screen edge', { exact: true })).toBeVisible()
  })
}

test('due reminders badge the closed notch without opening the card', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sidenib.notified-reminders.v1', '{}')
    window.localStorage.setItem(
      'sidenib.today.v1',
      JSON.stringify([
        {
          id: 99001,
          meta: 'Today',
          priority: 'normal',
          reminderAt: '2020-01-01T09:00',
          title: 'Closed reminder',
        },
      ]),
    )
  })
  await page.goto('/')

  const reminderToast = page.getByRole('status').filter({
    hasText: 'Closed reminder',
  })

  // The reminder shows beside the closed notch. It never opens the card and
  // never takes focus.
  await expect(page.locator('.workspace')).toHaveClass(/is-sidebar-closed/)
  await expect(page.locator('.sn-card')).not.toHaveClass(/is-open/)
  await expect(page.locator('.sn-notch-badge')).toHaveText('1')
  await expect(page.locator('.sn-toast')).toHaveClass(/is-beside/)
  await expect(reminderToast).toBeVisible()
  expect(
    await page.evaluate(() => document.activeElement === document.body),
  ).toBe(true)

  const toastBox = await page.locator('.sn-toast').boundingBox()

  expect(toastBox?.width).toBeLessThanOrEqual(296.5)
  expect(toastBox?.height).toBeCloseTo(60, 0)
  await expect(
    reminderToast.getByRole('button', {
      name: 'Snooze Closed reminder 10 minutes',
    }),
  ).toBeVisible()
  await reminderToast
    .getByRole('button', { name: 'Open reminder Closed reminder' })
    .click()
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('reminder toast snooze moves the reminder forward', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sidenib.notified-reminders.v1', '{}')
    window.localStorage.setItem(
      'sidenib.today.v1',
      JSON.stringify([
        {
          id: 99002,
          meta: 'Today',
          priority: 'normal',
          reminderAt: '2020-01-01T09:00',
          title: 'Snooze reminder',
        },
      ]),
    )
  })
  await page.goto('/?open=1')

  const reminderToast = page.getByRole('status').filter({
    hasText: 'Snooze reminder',
  })

  await expect(reminderToast).toBeVisible()
  await reminderToast
    .getByRole('button', { name: 'Snooze Snooze reminder 10 minutes' })
    .click()
  await expect(reminderToast).toHaveCount(0)
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const tasks = JSON.parse(
          window.localStorage.getItem('sidenib.today.v1') ?? '[]',
        ) as Array<{ reminderAt?: string }>
        const reminderAt = tasks[0]?.reminderAt

        return Boolean(
          reminderAt && new Date(reminderAt).getTime() > Date.now(),
        )
      }),
    )
    .toBe(true)
})

test('Gmail connector UI stays hidden while the feature is held back', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'sidenib.gmail.mock.v1',
      JSON.stringify({
        accountEmail: 'alex@example.com',
        state: 'needs_reconnect',
      }),
    )
  })
  await page.goto('/?open=1')
  await page.getByRole('button', SETTINGS_BUTTON).click()

  await expect(page.getByText('Reconnect required', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reconnect Gmail' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Connectors' })).toHaveCount(0)
  await expect(page.getByText('No email data is read yet.')).toHaveCount(0)
  await expect
    .poll(async () =>
      page.evaluate(() =>
        Object.keys(window.localStorage).some((key) =>
          key.toLowerCase().includes('token'),
        ),
      ),
    )
    .toBe(false)
})
