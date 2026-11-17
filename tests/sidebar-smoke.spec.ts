import { expect, test } from '@playwright/test'

const viewports = [
  { height: 900, name: 'desktop', width: 1280 },
  { height: 780, name: 'narrow', width: 420 },
  { height: 480, name: 'short', width: 900 },
] as const

test('sidebar opens and completed-task visibility is configurable', async ({
  page,
}) => {
  const consoleMessages: string[] = []

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
  await expect(page.getByText('Today').first()).toBeVisible()
  await expect(page.locator('.section-meter')).toHaveCount(0)

  await page.getByRole('button', { name: 'Sidebar settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Show completed')).toBeVisible()
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connectors' })).toHaveCount(0)
  await expect(page.getByText('Connect Gmail', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Sidebar settings' }).click()
  await expect(page.getByText('Connect Gmail', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Priority' })).toBeVisible()
  await page.getByRole('button', { name: 'Newest' }).click()
  await expect(page.getByRole('button', { name: 'Newest' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText('No custom backdrop', { exact: true })).toBeVisible()
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

  await page.getByRole('button', { name: 'Theme preset' }).click()
  await expect(page.getByRole('option')).toHaveCount(6)
  await expect(page.getByRole('option', { name: 'Choose Lumen' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Choose Graphite' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.getByRole('button', { name: 'Theme preset' }).click()
  await expect(page.getByRole('option')).toHaveCount(6)
  await expect(page.getByRole('option', { name: 'Choose Smoke' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Choose Graphite' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/theme-dark/)
  await expect(page.locator('.workspace')).toHaveClass(/style-graphite/)
  await expect(page.getByText('Edge position', { exact: true })).toBeVisible()
  await page.getByText('Hover-only tab', { exact: true }).click()
  await expect(page.locator('.workspace')).toHaveClass(/tab-hover/)
  await expect(page.getByText('Middle', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dock bottom' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Dock left' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/dock-left/)
  await page.getByRole('button', { name: 'Dock top' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/dock-top/)
  await page.getByRole('button', { name: 'Dock right' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/dock-right/)
  await page.getByRole('button', { name: 'Reset settings' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Reset settings confirmation' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Reset settings confirmation' }),
  ).toHaveCount(0)
  const todayLayoutRow = page.locator('.section-order-row').filter({
    hasText: 'Today',
  })
  const listsLayoutRow = page.locator('.section-order-row').filter({
    hasText: 'Lists',
  })
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
  }
  await page.getByRole('button', { name: 'Move Today up' }).click()

  await page.getByText('Show completed', { exact: true }).click()
  await expect(page.getByLabel('Show completed')).not.toBeChecked()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByText('Inbox suggestions', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Capture inbox', { exact: true })).toBeHidden()
  await expect(page.locator('section[aria-labelledby="today-heading"]')).toBeVisible()
  await expect(page.locator('section[aria-labelledby="calendar-heading"]')).toHaveCount(0)

  await page.getByLabel('Add a task to Today').fill('Reminder smoke')
  await page
    .locator('section[aria-labelledby="today-heading"] .quick-add .reminder-toggle')
    .click()
  await page
    .getByRole('textbox', { name: 'Reminder time' })
    .fill('2026-05-09T09:30')
  await page
    .locator('section[aria-labelledby="today-heading"] .quick-add .submit-task')
    .click()
  await expect(
    page
      .locator('section[aria-labelledby="today-heading"]')
      .getByText('Reminder smoke', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit Reminder smoke' }).click()
  await page.getByRole('textbox', { name: 'Edit Reminder smoke' }).fill(
    'Renamed smoke',
  )
  await page.getByRole('textbox', { name: 'Edit Reminder smoke' }).press('Enter')
  await expect(
    page
      .locator('section[aria-labelledby="today-heading"]')
      .getByText('Renamed smoke', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Add a task to Today').fill('Delete smoke')
  await page
    .locator('section[aria-labelledby="today-heading"] .quick-add .submit-task')
    .click()
  await page.getByRole('button', { name: 'Delete Delete smoke' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Confirm delete Delete smoke' }),
  ).toBeVisible()
  await page
    .getByRole('alertdialog', { name: 'Confirm delete Delete smoke' })
    .getByRole('button', { name: 'Cancel' })
    .click()
  await expect(page.getByText('Delete smoke', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Delete Delete smoke' })
    .click({ modifiers: ['Shift'] })
  await expect(page.getByText('Delete smoke', { exact: true })).toHaveCount(0)
  await expect(page.locator('#reminders-section')).toHaveCount(0)
  await expect(page.locator('.task-reminder').filter({ hasText: '09:30' })).toBeVisible()

  await page.evaluate(() => {
    window.localStorage.setItem('sidenib.notified-reminders.v1', '{}')
  })
  await page.getByLabel('Add a task to Today').fill('Toast smoke')
  await page
    .locator('section[aria-labelledby="today-heading"] .quick-add .reminder-toggle')
    .click()
  await page
    .getByRole('textbox', { name: 'Reminder time' })
    .fill('2020-01-01T09:30')
  await page
    .locator('section[aria-labelledby="today-heading"] .quick-add .submit-task')
    .click()
  const reminderToast = page.getByRole('status').filter({ hasText: 'Toast smoke' })
  await expect(reminderToast).toBeVisible({ timeout: 15_000 })
  await expect(
    reminderToast.getByRole('button', {
      name: 'Snooze Toast smoke 10 minutes',
    }),
  ).toBeVisible()
  await reminderToast.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('button', { name: 'Jump to Calendar' })).toHaveAttribute(
    'aria-current',
    'true',
  )

  await page.getByRole('button', { name: 'Jump to Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Jump to Calendar' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(page.locator('.view-stack')).toHaveAttribute(
    'data-motion',
    /forward|backward/,
  )
  await expect(page.locator('section[aria-labelledby="calendar-heading"]')).toBeVisible()
  await expect(
    page.locator('section[aria-labelledby="calendar-heading"]'),
  ).toHaveCSS('animation-name', 'view-section-in')
  await expect(page.locator('.calendar-board')).toHaveCSS(
    'animation-name',
    'view-stagger-in',
  )
  await expect(page.getByRole('grid')).toBeVisible()
  await expect(page.getByLabel('Add a task to selected calendar day')).toBeVisible()
  await page
    .getByLabel('Add a task to selected calendar day')
    .fill('Calendar smoke')
  await page.getByRole('button', { name: 'Event' }).click()
  await page
    .locator('section[aria-labelledby="calendar-heading"] .quick-add .submit-task')
    .click()
  await expect(
    page
      .locator('section[aria-labelledby="calendar-heading"]')
      .getByText('Calendar smoke', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .locator('section[aria-labelledby="calendar-heading"]')
      .locator('.task-kind-pill')
      .filter({ hasText: 'Event' }),
  ).toBeVisible()
  await page
    .locator('section[aria-labelledby="calendar-heading"]')
    .getByRole('button', { name: 'Jump to today', exact: true })
    .click()
  await expect(page.locator('.calendar-grid button.is-selected')).toContainText(
    String(new Date().getDate()),
  )
  await expect(page.locator('section[aria-labelledby="today-heading"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Jump to Lists' }).click()
  await expect(page.getByRole('button', { name: 'Jump to Lists' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(page.locator('.view-stack')).toHaveAttribute(
    'data-motion',
    /forward|backward/,
  )
  await expect(page.locator('section[aria-labelledby="lists-heading"]')).toBeVisible()
  await expect(page.locator('.list-create')).toHaveCSS(
    'animation-name',
    'view-stagger-in',
  )
  await expect(page.locator('section[aria-labelledby="calendar-heading"]')).toHaveCount(0)
  await page.getByLabel('Create a custom list').fill('Workstream')
  await page.getByRole('button', { name: 'Create list' }).click()
  await page.getByRole('button', { name: 'Rename Workstream' }).click()
  await page.getByRole('textbox', { name: 'Rename Workstream' }).fill('Planner')
  await page.getByRole('textbox', { name: 'Rename Workstream' }).press('Enter')
  const customList = page.locator('.custom-list').filter({ hasText: 'Planner' })
  await customList.getByLabel('Add a task to Planner').fill('Pinned task')
  await customList.locator('.submit-task').click()
  await customList.getByRole('button', { name: 'Show Planner on Today' }).click()
  await page.getByRole('button', { name: 'Jump to Today' }).click()
  await expect(page.locator('.view-stack')).toHaveAttribute(
    'data-motion',
    /forward|backward/,
  )
  await expect(page.getByText('Pinned lists', { exact: true })).toBeVisible()
  await expect(
    page.locator('.today-goal-list-title strong').filter({ hasText: 'Planner' }),
  ).toBeVisible()
  await expect(page.getByText('Pinned task', { exact: true })).toBeVisible()
  // Pinned task list deliberately renders without an outer card so it
  // doesn't nest a card-in-card inside the Today goal divider. The
  // separation between pinned goal lists is provided by the second-and-later
  // .today-goal-list border-top (first child has `border-top: 0`).
  await expect(page.locator('.pinned-task-list').first()).toHaveCSS(
    'border-top-style',
    'none',
  )

  await page.getByRole('button', { name: 'Sidebar settings' }).click()
  await page.getByText('Show completed', { exact: true }).click()
  await expect(page.getByLabel('Show completed')).toBeChecked()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Jump to Today' }).click()
  await expect(page.getByText('Capture inbox', { exact: true })).toBeVisible()

  expect(consoleMessages).toEqual([])
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
    await expect(page.getByRole('button', { name: 'Sidebar settings' })).toBeVisible()
    await expect.poll(async () =>
      page.locator('.sidebar-rail button').evaluateAll((buttons) =>
        buttons.every((button) => {
          const rect = button.getBoundingClientRect()

          return Math.round(rect.width) === Math.round(rect.height)
        }),
      ),
    ).toBe(true)

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

    await page.getByRole('button', { name: 'Sidebar settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Panel width', { exact: true })).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Jump to Calendar' })).toHaveAttribute(
    'aria-current',
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
  await page.getByRole('button', { name: 'Sidebar settings' }).click()

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
