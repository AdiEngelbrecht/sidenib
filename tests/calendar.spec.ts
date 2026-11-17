/*
 * Calendar view (ADIEN-163): the date helpers, then the view in a browser at
 * the real card sizes, 340 x 480 with the month and 340 x 400 with one week.
 * The clock is fixed so every date in here is a known one.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  addDays,
  buildCalendarDays,
  buildMonthWeeks,
  buildWeek,
  compareAgendaEntries,
  formatDateKey,
  isoWeekNumber,
  parseDateKey,
  shiftMonthKeepingDay,
  startOfWeek,
  weekAnchor,
} from '../src/calendar/dates'
import type { Task } from '../src/tasks'

const day = (year: number, month: number, date: number) =>
  new Date(year, month - 1, date, 12)
const key = (date: Date) => formatDateKey(date)
const task = (
  id: number,
  title: string,
  reminderAt?: string,
  extra: Partial<Task> = {},
): Task => ({ id, title, meta: '', priority: 'normal', reminderAt, ...extra })

test.describe('date helpers', () => {
  test('date keys round-trip and reject days that do not exist', () => {
    expect(key(parseDateKey('2028-02-29')!)).toBe('2028-02-29')
    expect(parseDateKey('2027-02-29')).toBeNull()
    expect(parseDateKey('2026-13-01')).toBeNull()
    expect(parseDateKey('2026-11-31')).toBeNull()
    expect(parseDateKey('16 Nov')).toBeNull()
  })

  test('days step across month, leap-day and year boundaries', () => {
    expect(key(addDays(day(2028, 2, 28), 1))).toBe('2028-02-29')
    expect(key(addDays(day(2028, 2, 29), 1))).toBe('2028-03-01')
    expect(key(addDays(day(2027, 2, 28), 1))).toBe('2027-03-01')
    expect(key(addDays(day(2026, 12, 31), 1))).toBe('2027-01-01')
    expect(key(addDays(day(2027, 1, 1), -1))).toBe('2026-12-31')
    expect(key(addDays(day(2026, 12, 28), 7))).toBe('2027-01-04')
    // Across both European DST changes of 2026 a day is still a day.
    expect(key(addDays(day(2026, 3, 28), 2))).toBe('2026-03-30')
    expect(key(addDays(day(2026, 10, 24), 2))).toBe('2026-10-26')
  })

  test('a month step keeps the day and clamps it to a shorter month', () => {
    expect(key(shiftMonthKeepingDay(day(2028, 1, 31), 1))).toBe('2028-02-29')
    expect(key(shiftMonthKeepingDay(day(2027, 1, 31), 1))).toBe('2027-02-28')
    expect(key(shiftMonthKeepingDay(day(2028, 3, 31), -1))).toBe('2028-02-29')
    expect(key(shiftMonthKeepingDay(day(2028, 2, 29), 12))).toBe('2029-02-28')
    expect(key(shiftMonthKeepingDay(day(2028, 2, 29), -12))).toBe('2027-02-28')
    expect(key(shiftMonthKeepingDay(day(2026, 12, 15), 1))).toBe('2027-01-15')
    expect(key(shiftMonthKeepingDay(day(2027, 1, 15), -1))).toBe('2026-12-15')
  })

  test('a month is drawn in four, five or six Monday-first weeks', () => {
    const cases = [
      // 28 days from a Monday.
      { month: day(2027, 2, 1), weeks: 4, days: 28 },
      // Leap February from a Tuesday.
      { month: day(2028, 2, 1), weeks: 5, days: 29 },
      // 30 days from a Sunday.
      { month: day(2026, 11, 1), weeks: 6, days: 30 },
      // 31 days from a Saturday.
      { month: day(2026, 8, 1), weeks: 6, days: 31 },
      { month: day(2026, 12, 1), weeks: 5, days: 31 },
    ]

    for (const { month, weeks: expected, days } of cases) {
      const weeks = buildMonthWeeks(month, [], month.getTime())
      const inMonth = weeks.flat().filter((cell) => cell.isCurrentMonth)

      expect(weeks, key(month)).toHaveLength(expected)
      expect(inMonth.map((cell) => cell.date.getDate())).toEqual(
        Array.from({ length: days }, (_, index) => index + 1),
      )

      for (const week of weeks) {
        expect(week).toHaveLength(7)
        expect(week[0].date.getDay()).toBe(1)
        expect(week.some((cell) => cell.isCurrentMonth)).toBe(true)
      }
    }

    // The full six-week block is still there for callers that want it.
    expect(buildCalendarDays(day(2027, 2, 1), [])).toHaveLength(42)
  })

  test('a week is named by its Thursday, across the year boundary', () => {
    expect(key(startOfWeek(day(2026, 11, 22)))).toBe('2026-11-16')
    expect(key(startOfWeek(day(2026, 11, 16)))).toBe('2026-11-16')

    // 29 Dec 2025 to 4 Jan 2026 is week 1 of January 2026.
    const week = buildWeek(day(2025, 12, 31), [], day(2025, 12, 31).getTime())

    expect(week.map((cell) => cell.key)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ])
    expect(week.map((cell) => cell.isCurrentMonth)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ])
    expect(key(weekAnchor(day(2025, 12, 31)))).toBe('2026-01-01')
    expect(isoWeekNumber(day(2025, 12, 31))).toBe(1)

    // 2026 has 53 weeks; its last one runs into January 2027.
    expect(isoWeekNumber(day(2026, 12, 31))).toBe(53)
    expect(isoWeekNumber(day(2027, 1, 3))).toBe(53)
    expect(isoWeekNumber(day(2027, 1, 4))).toBe(1)
    expect(isoWeekNumber(day(2026, 11, 16))).toBe(47)
    expect(isoWeekNumber(day(2028, 2, 29))).toBe(9)
  })

  test('days count what is scheduled, done and overdue', () => {
    const now = new Date(2026, 10, 16, 10).getTime()
    const days = buildCalendarDays(
      day(2026, 11, 1),
      [
        { task: task(1, 'late', '2026-11-12T09:00') },
        { task: task(2, 'done late', '2026-11-12T09:00', { done: true }) },
        { task: task(3, 'earlier today', '2026-11-16T09:00') },
        { task: task(4, 'later today', '2026-11-16T14:00', { kind: 'event' }) },
        { task: task(5, 'no date') },
        { task: task(6, 'bad date', 'soon') },
      ],
      now,
    )
    const find = (dateKey: string) => days.find((cell) => cell.key === dateKey)!

    expect(find('2026-11-12')).toMatchObject({
      taskCount: 2,
      doneCount: 1,
      overdueCount: 1,
      isToday: false,
    })
    expect(find('2026-11-16')).toMatchObject({
      taskCount: 2,
      eventCount: 1,
      overdueCount: 1,
      isToday: true,
    })
    expect(find('2026-11-17').taskCount).toBe(0)
  })

  test('the agenda order is time, events first, then the sort preference', () => {
    const entries = [
      { task: task(5, 'e', '2026-11-16T09:00', { priority: 'later' }) },
      { task: task(4, 'd', '2026-11-16T09:00', { done: true }) },
      { task: task(3, 'c', '2026-11-16T09:00', { kind: 'event' }) },
      { task: task(2, 'b', '2026-11-16T08:00', { priority: 'later' }) },
      { task: task(6, 'f', '2026-11-16T09:00', { priority: 'focus' }) },
      { task: task(1, 'a', '2026-11-16T18:30') },
      { task: task(7, 'g', '2026-11-16T09:00') },
    ]
    const order = (mode: 'priority' | 'newest' | 'oldest', list = entries) =>
      [...list]
        .sort((a, b) => compareAgendaEntries(a, b, mode))
        .map((entry) => entry.task.title)
        .join('')

    expect(order('priority')).toBe('bcfdgea')
    expect(order('oldest')).toBe('bcdefga')
    expect(order('newest')).toBe('bcgfeda')
    // The same whatever order the entries arrive in.
    expect(order('priority', [...entries].reverse())).toBe('bcfdgea')
  })
})

// ---- In the browser ---------------------------------------------------------

const NOW = new Date(2026, 10, 16, 10, 0) // Monday 16 November 2026, 10:00
const CARD = { width: 1280, height: 800 } // 340 x 480 card, month grid
const SHORT_CARD = { width: 1024, height: 420 } // 340 x 400 card, one week

const SEED: Task[] = [
  task(101, 'Dentist', '2026-11-16T14:00', {
    kind: 'event',
    priority: 'focus',
  }),
  task(102, 'Write report', '2026-11-16T09:00'),
  task(103, 'Call plumber', '2026-11-12T09:00'),
  task(104, 'Paid invoice', '2026-11-10T09:00', { done: true }),
  task(105, 'Plan trip', '2026-11-20T09:00'),
  task(106, 'Unscheduled idea'),
]

async function openCalendar(
  page: Page,
  {
    viewport = CARD,
    now = NOW,
    tasks = SEED,
    theme = 'light',
  }: {
    viewport?: { width: number; height: number }
    now?: Date
    tasks?: Task[]
    theme?: 'light' | 'dark'
  } = {},
) {
  const errors: string[] = []

  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      errors.push(message.text())
    }
  })

  await page.setViewportSize(viewport)
  await page.clock.setFixedTime(now)
  await page.addInitScript((month) => {
    if (window.localStorage.getItem('calendar-spec-seeded')) {
      return
    }

    window.localStorage.setItem('calendar-spec-seeded', '1')
    window.localStorage.setItem('sidenib.today.v1', '[]')
    window.localStorage.setItem('sidenib.month.v1', JSON.stringify(month))
    // No reminder toast over the header while the tests click in it.
    window.localStorage.setItem(
      'sidenib.sidebar.settings.v27',
      JSON.stringify({ notificationsEnabled: false }),
    )
  }, tasks)
  await page.goto(`/?open=1&theme=${theme}`)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.locator('[data-view="calendar"]')).toBeVisible()

  return errors
}

const view = (page: Page) => page.locator('[data-view="calendar"]')
const grid = (page: Page) => page.getByRole('grid')
const cell = (page: Page, dateKey: string) =>
  page.locator(`.sn-day[data-date="${dateKey}"]`)
const title = (page: Page) => view(page).locator('.sn-title')
const subtitle = (page: Page) => view(page).locator('.sn-subtitle')
const agendaLabel = (page: Page) =>
  view(page).locator('.sn-section-label').first()
const agendaTitles = (page: Page) =>
  view(page).locator('.sn-section').first().locator('.sn-row-title')
const quickAdd = (page: Page) =>
  page.getByLabel('Add a task to selected calendar day')
const row = (page: Page, text: string) =>
  page.locator('.sn-task').filter({ hasText: text })

async function frame(locator: Locator) {
  const box = await locator.boundingBox()

  if (!box) {
    throw new Error('Element is not drawn')
  }

  return box
}

async function capture(
  page: Page,
  text: string,
  kind: 'task' | 'event' = 'task',
) {
  await quickAdd(page).fill(text)

  if (kind === 'event') {
    await page.getByRole('button', { name: /^Entry type: Task/ }).click()
    await expect(
      page.getByRole('button', { name: /^Entry type: Event/ }),
    ).toBeVisible()
  }

  await quickAdd(page).press('Enter')
  await expect(row(page, text)).toBeVisible()
}

test.describe('calendar in the card', () => {
  // The browser shares this machine's time zone, so NOW is the same wall
  // clock on both sides.
  test.use({ locale: 'en-GB' })

  test('the month fits a 340 x 480 card and every state has its own cue', async ({
    page,
  }) => {
    const errors = await openCalendar(page)
    const card = await frame(page.locator('.sn-card'))

    expect(card.width).toBeCloseTo(340, 0)
    expect(card.height).toBeCloseTo(480, 0)
    await expect(title(page)).toHaveText('November')
    await expect(subtitle(page)).toHaveText('2026')
    await expect(grid(page)).toHaveAccessibleName('November 2026')

    // November 2026 needs six weeks. The grid is a real grid: a header row
    // of weekdays and seven cells per week.
    await expect(grid(page).getByRole('row')).toHaveCount(7)
    await expect(grid(page).getByRole('columnheader')).toHaveCount(7)
    await expect(
      grid(page).getByRole('columnheader', { name: 'Monday' }),
    ).toHaveText('M')
    await expect(grid(page).getByRole('gridcell')).toHaveCount(42)
    await expect(
      grid(page).getByRole('row').nth(1).getByRole('gridcell').first(),
    ).toHaveAttribute('data-date', '2026-10-26')

    // Today: a filled disc, bold, and named as today.
    const today = cell(page, '2026-11-16')

    await expect(today).toHaveClass(/is-today/)
    await expect(today).toHaveAttribute('aria-current', 'date')
    await expect(today).toHaveAttribute('aria-selected', 'true')
    await expect(today).toHaveAccessibleName(
      /^Today, Monday,? 16 November 2026, 2 scheduled, 1 overdue$/,
    )
    await expect(grid(page).locator('[aria-current="date"]')).toHaveCount(1)
    await expect(grid(page).locator('[aria-selected="true"]')).toHaveCount(1)

    const styleOf = (dateKey: string) =>
      cell(page, dateKey)
        .locator('.sn-day-number')
        .evaluate((node) => {
          const style = getComputedStyle(node)

          return {
            background: style.backgroundColor,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            ring: style.boxShadow,
          }
        })
    const plain = await styleOf('2026-11-18')
    const todayStyle = await styleOf('2026-11-16')

    expect(todayStyle.fontWeight).toBe('700')
    expect(todayStyle.background).not.toBe(plain.background)
    expect(todayStyle.ring).not.toBe('none')
    expect(plain.ring).toBe('none')
    expect(plain.fontWeight).toBe('400')

    // Selected, when it is not today: a ring and a heavier number.
    await cell(page, '2026-11-18').click()
    await expect(cell(page, '2026-11-18')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(today).toHaveAttribute('aria-selected', 'false')
    await page.mouse.move(5, 5)

    // The ring and the hover tint fade over 120 ms; wait for them to settle.
    await expect
      .poll(async () => (await styleOf('2026-11-16')).ring)
      .toBe('none')
    await expect
      .poll(async () => (await styleOf('2026-11-18')).background)
      .toBe(plain.background)

    const selected = await styleOf('2026-11-18')

    expect(selected.ring).not.toBe('none')
    expect(selected.fontWeight).toBe('600')
    expect(selected.background).toBe(plain.background)
    expect((await styleOf('2026-11-16')).ring).toBe('none')

    // Outside the month: a smaller number, not only a paler one.
    const outside = cell(page, '2026-10-28')

    await expect(outside).toHaveClass(/is-outside/)
    expect((await styleOf('2026-10-28')).fontSize).toBe('12px')
    expect(plain.fontSize).toBe('14px')
    await expect(outside).toHaveAccessibleName(
      /28 October 2026, nothing scheduled$/,
    )

    // Scheduled days carry a mark whose shape says what is on them.
    const mark = (dateKey: string) =>
      cell(page, dateKey).locator('.sn-day-mark')
    const markBox = async (dateKey: string) => {
      const box = await frame(mark(dateKey))

      return { width: Math.round(box.width), height: Math.round(box.height) }
    }

    await expect(mark('2026-11-20')).toHaveClass(/is-open/)
    await expect(mark('2026-11-12')).toHaveClass(/is-overdue/)
    await expect(mark('2026-11-10')).toHaveClass(/is-done/)
    await expect(mark('2026-11-18')).toHaveCount(0)
    expect(await markBox('2026-11-20')).toEqual({ width: 4, height: 4 })
    expect(await markBox('2026-11-12')).toEqual({ width: 10, height: 3 })
    expect(
      await mark('2026-11-10').evaluate(
        (node) => getComputedStyle(node).backgroundColor,
      ),
    ).toBe('rgba(0, 0, 0, 0)')
    await expect(cell(page, '2026-11-12')).toHaveAccessibleName(
      /12 November 2026, 1 scheduled, 1 overdue$/,
    )
    await expect(cell(page, '2026-11-10')).toHaveAccessibleName(
      /10 November 2026, 1 scheduled, 1 done$/,
    )

    // Everything is inside the card and nothing overflows sideways.
    const gridBox = await frame(grid(page))
    const body = view(page).locator('.sn-view-body')
    const bodyBox = await frame(body)

    expect(gridBox.x).toBeGreaterThanOrEqual(card.x)
    expect(gridBox.x + gridBox.width).toBeLessThanOrEqual(card.x + card.width)
    expect(bodyBox.height).toBeGreaterThan(100)
    expect(bodyBox.y + bodyBox.height).toBeLessThanOrEqual(card.y + card.height)
    expect(
      await view(page).evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true)
    expect(errors).toEqual([])
  })

  test('month arrows cross the year and Today comes back', async ({ page }) => {
    await openCalendar(page)

    const next = page.getByRole('button', { name: 'Next month' })
    const previous = page.getByRole('button', { name: 'Previous month' })

    await next.click()
    await expect(title(page)).toHaveText('December')
    await expect(grid(page).getByRole('row')).toHaveCount(6)
    await next.click()
    await expect(title(page)).toHaveText('January')
    await expect(subtitle(page)).toHaveText('2027')
    await expect(grid(page)).toHaveAccessibleName('January 2027')
    await next.click()
    // February 2027: 28 days from a Monday, four weeks and no outside days.
    await expect(title(page)).toHaveText('February')
    await expect(grid(page).getByRole('row')).toHaveCount(5)
    await expect(grid(page).locator('.is-outside')).toHaveCount(0)
    await expect(cell(page, '2027-02-29')).toHaveCount(0)
    await expect(cell(page, '2027-02-28')).toBeVisible()

    // The selected day did not move, and the agenda still shows it.
    await expect(agendaLabel(page)).toContainText('Mon 16 Nov')

    for (let index = 0; index < 3; index += 1) {
      await previous.click()
    }

    await expect(title(page)).toHaveText('November')
    await expect(subtitle(page)).toHaveText('2026')
    await previous.click()
    await previous.click()
    await expect(title(page)).toHaveText('September')

    // A day of the next month, picked from the grid, turns the page.
    await cell(page, '2026-10-02').click()
    await expect(title(page)).toHaveText('October')
    await expect(cell(page, '2026-10-02')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(agendaLabel(page)).toHaveText('Fri 2 Oct')

    await page.getByRole('button', { name: 'Jump to today' }).click()
    await expect(title(page)).toHaveText('November')
    await expect(cell(page, '2026-11-16')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('the grid is one tab stop and the keys move through days', async ({
    browserName,
    page,
  }) => {
    // WebKit, like Safari, only tabs to buttons with Option held unless the
    // system's keyboard navigation setting is on.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'

    await openCalendar(page)

    // One day holds the tab stop: the selected one.
    await expect(grid(page).locator('[tabindex="0"]')).toHaveCount(1)
    await expect(cell(page, '2026-11-16')).toHaveAttribute('tabindex', '0')

    await page.getByRole('button', { name: 'Jump to today' }).focus()
    await page.keyboard.press(tab) // Settings
    await page.keyboard.press(tab)
    await expect(cell(page, '2026-11-16')).toBeFocused()

    // The focus ring is drawn around the disc.
    expect(
      await cell(page, '2026-11-16')
        .locator('.sn-day-number')
        .evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe('solid')

    await page.keyboard.press('ArrowRight')
    await expect(cell(page, '2026-11-17')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(cell(page, '2026-11-24')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(cell(page, '2026-11-22')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(cell(page, '2026-11-16')).toBeFocused()
    await page.keyboard.press('End')
    await expect(cell(page, '2026-11-22')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(cell(page, '2026-11-15')).toBeFocused()

    // Moving focus does not select. Enter does; so does Space.
    await expect(cell(page, '2026-11-16')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(grid(page).locator('[tabindex="0"]')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(cell(page, '2026-11-15')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(agendaLabel(page)).toHaveText('Sun 15 Nov')
    await expect(quickAdd(page)).toHaveAttribute('placeholder', 'Add to 15 Nov')
    await expect(cell(page, '2026-11-15')).toBeFocused()

    // Past the end of the month the page turns and focus goes with it.
    await page.keyboard.press('PageDown')
    await expect(title(page)).toHaveText('December')
    await expect(cell(page, '2026-12-15')).toBeFocused()
    await page.keyboard.press('PageDown')
    await expect(title(page)).toHaveText('January')
    await expect(subtitle(page)).toHaveText('2027')
    await expect(cell(page, '2027-01-15')).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(cell(page, '2026-12-28')).toBeFocused()
    await expect(title(page)).toHaveText('December')
    await page.keyboard.press('End')
    await expect(cell(page, '2027-01-03')).toBeFocused()
    await expect(title(page)).toHaveText('January')
    await page.keyboard.press('Space')
    await expect(cell(page, '2027-01-03')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(agendaLabel(page)).toHaveText(/^Sun,? 3 Jan 2027$/)

    // Leaving and coming back lands on the same day.
    await page.keyboard.press(`Shift+${tab}`)
    await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused()
    await page.keyboard.press(tab)
    await expect(cell(page, '2027-01-03')).toBeFocused()

    // Escape still closes the card from inside the grid.
    await page.keyboard.press('Escape')
    await expect(page.locator('.sn-card')).not.toHaveClass(/is-open/)
  })

  test('leap day: 29 February is there in 2028 and only then', async ({
    page,
  }) => {
    await openCalendar(page, { now: new Date(2028, 2, 31, 10), tasks: [] })
    await expect(title(page)).toHaveText('March')

    await cell(page, '2028-03-31').focus()
    await page.keyboard.press('PageUp')
    await expect(title(page)).toHaveText('February')
    await expect(subtitle(page)).toHaveText('2028')
    await expect(cell(page, '2028-02-29')).toBeFocused()
    await expect(cell(page, '2028-02-29')).not.toHaveClass(/is-outside/)
    await expect(grid(page).locator('.sn-day:not(.is-outside)')).toHaveCount(29)

    await page.keyboard.press('Enter')
    await capture(page, 'Leap day task')
    await expect(agendaLabel(page)).toHaveText('Tue 29 Feb · 1 open')
    // 29 February at 09:00 is a month before this test's clock: overdue.
    await expect(cell(page, '2028-02-29').locator('.sn-day-mark')).toHaveClass(
      /is-overdue/,
    )
    await expect(row(page, 'Leap day task')).toHaveClass(/is-overdue/)

    await cell(page, '2028-02-29').focus()
    await page.keyboard.press('ArrowRight')
    await expect(cell(page, '2028-03-01')).toBeFocused()
    await expect(title(page)).toHaveText('March')
    await page.keyboard.press('ArrowLeft')
    await expect(cell(page, '2028-02-29')).toBeFocused()

    // A year on there is no 29th: the 28th takes it.
    await page.keyboard.press('Shift+PageDown')
    await expect(subtitle(page)).toHaveText('2029')
    await expect(cell(page, '2029-02-28')).toBeFocused()
    await expect(cell(page, '2029-02-29')).toHaveCount(0)
    await expect(grid(page).locator('.sn-day:not(.is-outside)')).toHaveCount(28)
    await page.keyboard.press('ArrowRight')
    await expect(cell(page, '2029-03-01')).toBeFocused()
  })

  test('the short card shows one week and the arrows move by week', async ({
    page,
  }) => {
    const errors = await openCalendar(page, { viewport: SHORT_CARD })
    const card = await frame(page.locator('.sn-card'))

    expect(card.width).toBeCloseTo(340, 0)
    expect(card.height).toBeCloseTo(400, 0)
    await expect(grid(page).getByRole('row')).toHaveCount(2)
    await expect(grid(page).getByRole('gridcell')).toHaveCount(7)
    await expect(cell(page, '2026-11-16')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(title(page)).toHaveText('November')
    await expect(subtitle(page)).toHaveText('2026 · Week 47')
    await expect(grid(page)).toHaveAccessibleName('Week 47, November 2026')
    await expect(page.getByRole('button', { name: 'Next month' })).toHaveCount(
      0,
    )

    const next = page.getByRole('button', { name: 'Next week' })
    const previous = page.getByRole('button', { name: 'Previous week' })

    await next.click()
    await expect(subtitle(page)).toHaveText('2026 · Week 48')
    await expect(grid(page).getByRole('gridcell').first()).toHaveAttribute(
      'data-date',
      '2026-11-23',
    )
    await next.click()
    // 30 November to 6 December belongs to December.
    await expect(title(page)).toHaveText('December')
    await expect(subtitle(page)).toHaveText('2026 · Week 49')
    await expect(cell(page, '2026-11-30')).toHaveClass(/is-outside/)
    await expect(cell(page, '2026-12-01')).not.toHaveClass(/is-outside/)

    for (let index = 0; index < 4; index += 1) {
      await next.click()
    }

    // 28 December to 3 January is week 53 of December 2026.
    await expect(title(page)).toHaveText('December')
    await expect(subtitle(page)).toHaveText('2026 · Week 53')
    await expect(cell(page, '2027-01-03')).toHaveClass(/is-outside/)
    await next.click()
    await expect(title(page)).toHaveText('January')
    await expect(subtitle(page)).toHaveText('2027 · Week 1')
    await expect(grid(page).getByRole('gridcell').first()).toHaveAttribute(
      'data-date',
      '2027-01-04',
    )
    await previous.click()
    await previous.click()
    await expect(subtitle(page)).toHaveText('2026 · Week 52')

    // The keys work in a week too, and turn it at either end.
    await cell(page, '2026-12-27').focus()
    await page.keyboard.press('ArrowRight')
    await expect(cell(page, '2026-12-28')).toBeFocused()
    await expect(subtitle(page)).toHaveText('2026 · Week 53')
    await page.keyboard.press('ArrowDown')
    await expect(cell(page, '2027-01-04')).toBeFocused()
    await expect(subtitle(page)).toHaveText('2027 · Week 1')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('End')
    await expect(cell(page, '2027-01-03')).toBeFocused()

    // Pick a day in this week and add to it; the week stays.
    await page.keyboard.press('Enter')
    await expect(agendaLabel(page)).toHaveText(/^Sun,? 3 Jan 2027$/)
    await capture(page, 'New year walk')
    await expect(subtitle(page)).toHaveText('2026 · Week 53')
    await expect(cell(page, '2027-01-03').locator('.sn-day-mark')).toBeVisible()

    await page.getByRole('button', { name: 'Jump to today' }).click()
    await expect(subtitle(page)).toHaveText('2026 · Week 47')
    await expect(cell(page, '2026-11-16')).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // The agenda, quick add and tabs all fit under the week.
    const body = await frame(view(page).locator('.sn-view-body'))

    expect(body.height).toBeGreaterThan(150)
    await expect(quickAdd(page)).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('capture, edit and remove tasks and events on the selected day', async ({
    page,
  }) => {
    await openCalendar(page)

    // Today's agenda, in time order, and the backlog under it.
    await expect(agendaLabel(page)).toHaveText('Mon 16 Nov · 2 open · 1 event')
    await expect(agendaTitles(page)).toHaveText(['Write report', 'Dentist'])
    await expect(row(page, 'Dentist').locator('.task-kind-pill')).toHaveText(
      'Event',
    )
    await expect(page.getByText('Backlog · 1')).toBeVisible()
    await expect(row(page, 'Unscheduled idea')).toBeVisible()

    // Another day: empty, then a task and an event captured onto it.
    await cell(page, '2026-11-25').click()
    await expect(agendaLabel(page)).toHaveText('Wed 25 Nov')
    await expect(page.getByText('Nothing scheduled.')).toBeVisible()
    await expect(quickAdd(page)).toHaveAttribute('placeholder', 'Add to 25 Nov')
    await expect(cell(page, '2026-11-25').locator('.sn-day-mark')).toHaveCount(
      0,
    )

    await capture(page, 'Book venue')
    await capture(page, 'Team offsite', 'event')
    await expect(agendaLabel(page)).toHaveText('Wed 25 Nov · 2 open · 1 event')
    // Both are at 09:00; the event leads.
    await expect(agendaTitles(page)).toHaveText(['Team offsite', 'Book venue'])
    await expect(cell(page, '2026-11-25').locator('.sn-day-mark')).toHaveClass(
      /is-open/,
    )
    await expect(cell(page, '2026-11-25')).toHaveAccessibleName(
      /, 2 scheduled$/,
    )
    await expect(quickAdd(page)).toHaveValue('')

    // Complete: the row stays where it was, and the day's mark follows.
    await page.getByRole('button', { name: 'Complete Team offsite' }).click()
    await expect(row(page, 'Team offsite')).toHaveClass(/is-done/)
    await expect(agendaTitles(page)).toHaveText(['Team offsite', 'Book venue'])
    await expect(agendaLabel(page)).toHaveText('Wed 25 Nov · 1 open · 1 event')
    await page.getByRole('button', { name: 'Complete Book venue' }).click()
    await expect(agendaLabel(page)).toHaveText(
      'Wed 25 Nov · all done · 1 event',
    )
    await expect(cell(page, '2026-11-25').locator('.sn-day-mark')).toHaveClass(
      /is-done/,
    )
    await page.getByRole('button', { name: 'Mark Book venue open' }).click()
    await expect(cell(page, '2026-11-25').locator('.sn-day-mark')).toHaveClass(
      /is-open/,
    )

    // Rename through the row's menu.
    await row(page, 'Book venue').hover()
    await page
      .getByRole('button', { name: 'More actions for Book venue' })
      .click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await page.getByLabel('Edit Book venue').fill('Book the venue')
    await page.getByLabel('Edit Book venue').press('Enter')
    await expect(agendaTitles(page)).toHaveText([
      'Team offsite',
      'Book the venue',
    ])

    // Move the reminder to an exact time on another day: the entry leaves
    // this day and the other day gains its mark.
    await row(page, 'Book the venue').hover()
    await page
      .getByRole('button', {
        name: /^Reminder .* for Book the venue\. Change$/,
      })
      .click()
    await page
      .getByRole('dialog')
      .locator('input[type="datetime-local"]')
      .fill('2026-11-27T15:30')
    await page.keyboard.press('Enter')
    await expect(row(page, 'Book the venue')).toHaveCount(0)
    await expect(cell(page, '2026-11-27').locator('.sn-day-mark')).toHaveClass(
      /is-open/,
    )
    await cell(page, '2026-11-27').click()
    await expect(agendaTitles(page)).toHaveText(['Book the venue'])
    await expect(row(page, 'Book the venue')).toContainText('15:30')

    // Delete. Shift skips the confirmation, as everywhere else.
    await row(page, 'Book the venue').hover()
    await page
      .getByRole('button', { name: 'More actions for Book the venue' })
      .click()
    await page
      .getByRole('menuitem', { name: 'Delete' })
      .click({ modifiers: ['Shift'] })
    await expect(row(page, 'Book the venue')).toHaveCount(0)
    await expect(cell(page, '2026-11-27').locator('.sn-day-mark')).toHaveCount(
      0,
    )
    await expect(page.getByText('Nothing scheduled.')).toBeVisible()

    // The selected day and what was added outlive a visit to another tab.
    await page.getByRole('tab', { name: 'Today' }).click()
    await page.getByRole('tab', { name: 'Calendar' }).click()
    await expect(cell(page, '2026-11-27')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await cell(page, '2026-11-25').click()
    await expect(agendaTitles(page)).toHaveText(['Team offsite'])
    await expect(page.getByText('Backlog · 1')).toBeVisible()
  })

  const LONG_AGENDA: Task[] = [
    ...Array.from({ length: 12 }, (_, index) =>
      task(
        200 + index,
        `Entry ${String(index + 1).padStart(2, '0')}`,
        // Entries 1 to 6 at 09:00, the rest an hour apart from 10:00.
        `2026-11-16T${String(index < 6 ? 9 : 4 + index).padStart(2, '0')}:00`,
      ),
    ).reverse(),
    task(300, 'Standup', '2026-11-16T09:00', {
      kind: 'event',
      priority: 'focus',
    }),
    task(301, 'Early run', '2026-11-16T06:30'),
    task(302, 'Other day', '2026-11-17T09:00'),
    task(303, 'Loose end'),
  ]
  const LONG_ORDER = [
    'Early run',
    'Standup',
    ...Array.from(
      { length: 12 },
      (_, index) => `Entry ${String(index + 1).padStart(2, '0')}`,
    ),
  ]

  for (const [name, viewport, cardHeight] of [
    ['340 x 480', CARD, 480],
    ['340 x 400', SHORT_CARD, 400],
  ] as const) {
    test(`a long agenda scrolls inside the ${name} card in a steady order`, async ({
      page,
    }) => {
      await openCalendar(page, { viewport, tasks: LONG_AGENDA })

      const body = view(page).locator('.sn-view-body')
      const metrics = () =>
        body.evaluate((node) => ({
          client: node.clientHeight,
          scroll: node.scrollHeight,
          top: node.scrollTop,
        }))
      const card = await frame(page.locator('.sn-card'))
      const gridBefore = await frame(grid(page))

      expect(card.height).toBeCloseTo(cardHeight, 0)
      await expect(agendaLabel(page)).toHaveText(
        'Mon 16 Nov · 14 open · 1 event',
      )
      await expect(agendaTitles(page)).toHaveText(LONG_ORDER)

      // More content than room: it scrolls in the body and nowhere else.
      const before = await metrics()

      expect(before.scroll).toBeGreaterThan(before.client * 2)
      expect(before.top).toBe(0)
      await body.hover()
      await page.mouse.wheel(0, 5000)
      await expect.poll(async () => (await metrics()).top).toBeGreaterThan(300)
      await expect(row(page, 'Loose end')).toBeInViewport()
      expect(await frame(grid(page))).toEqual(gridBefore)
      expect((await frame(page.locator('.sn-card'))).height).toBeCloseTo(
        cardHeight,
        0,
      )
      await expect(quickAdd(page)).toBeInViewport()
      await expect(page.getByRole('tablist')).toBeInViewport()
      expect(await page.evaluate(() => window.scrollY)).toBe(0)

      // Ticking an entry leaves every row where it was.
      await row(page, 'Entry 03').scrollIntoViewIfNeeded()
      await page.getByRole('button', { name: 'Complete Entry 03' }).click()
      await expect(row(page, 'Entry 03')).toHaveClass(/is-done/)
      await expect(agendaTitles(page)).toHaveText(LONG_ORDER)

      // A new entry at 09:00 lands among the others and is brought into view.
      await body.evaluate((node) => node.scrollTo(0, node.scrollHeight))
      await capture(page, 'Fresh capture')
      await expect(agendaTitles(page)).toHaveText([
        ...LONG_ORDER.slice(0, 8),
        'Fresh capture',
        ...LONG_ORDER.slice(8),
      ])
      await expect(row(page, 'Fresh capture')).toBeInViewport({ ratio: 0.9 })

      // Another day starts at the top of its own agenda.
      await body.evaluate((node) => node.scrollTo(0, node.scrollHeight))
      await cell(page, '2026-11-17').click()
      await expect(agendaTitles(page)).toHaveText(['Other day'])
      expect((await metrics()).top).toBe(0)
    })
  }

  test('dark mode keeps every cue', async ({ page }) => {
    const errors = await openCalendar(page, { theme: 'dark' })

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await cell(page, '2026-11-18').click()
    await page.mouse.move(5, 5)

    const read = (dateKey: string) =>
      cell(page, dateKey)
        .locator('.sn-day-number')
        .evaluate((node) => {
          const style = getComputedStyle(node)
          const cellStyle = getComputedStyle(node.parentElement!)

          return {
            background: style.backgroundColor,
            color: cellStyle.color,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            ring: style.boxShadow,
          }
        })
    // The ring fades in over 120 ms.
    await expect
      .poll(async () => (await read('2026-11-18')).ring)
      .toContain('rgb(244, 239, 226)')

    const plain = await read('2026-11-19')
    const today = await read('2026-11-16')
    const selected = await read('2026-11-18')
    const outside = await read('2026-10-28')

    // Light ink on the dark card.
    expect(plain.color).toBe('rgb(244, 239, 226)')
    expect(today.background).toBe('rgb(246, 196, 69)')
    expect(today.fontWeight).toBe('700')
    expect(selected.ring).toContain('rgb(244, 239, 226)')
    expect(selected.fontWeight).toBe('600')
    expect(outside.fontSize).toBe('12px')
    expect(outside.color).not.toBe(plain.color)
    await expect(cell(page, '2026-11-12').locator('.sn-day-mark')).toHaveClass(
      /is-overdue/,
    )
    await expect(cell(page, '2026-11-10').locator('.sn-day-mark')).toHaveClass(
      /is-done/,
    )
    // On the gold disc the mark is ink, not gold on gold.
    expect(
      await cell(page, '2026-11-16')
        .locator('.sn-day-mark')
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe('rgb(40, 39, 34)')
    expect(errors).toEqual([])
  })
})
