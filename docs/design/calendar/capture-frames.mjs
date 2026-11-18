/*
 * Captures the calendar reference frames (ADIEN-163) from a running dev
 * server at the real card sizes.
 *
 *   npm run dev -- --host 127.0.0.1 --port 5183 --strictPort
 *   SIDENIB_TEST_URL=http://127.0.0.1:5183 node docs/design/calendar/capture-frames.mjs
 *
 * SIDENIB_BROWSER=webkit captures in WebKit; SIDENIB_FRAMES_DIR changes where
 * the frames go (default: this folder).
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as playwright from '@playwright/test'

const base = process.env.SIDENIB_TEST_URL ?? 'http://127.0.0.1:5173'
const engine = process.env.SIDENIB_BROWSER ?? 'chromium'
const out =
  process.env.SIDENIB_FRAMES_DIR ?? path.dirname(fileURLToPath(import.meta.url))
const NOW = new Date(2026, 10, 16, 10, 0)
const CARD = { width: 1280, height: 800 } // 340 x 480
const SHORT_CARD = { width: 1024, height: 420 } // 340 x 400

const entry = (id, title, reminderAt, extra = {}) => ({
  id,
  title,
  meta: '',
  priority: 'normal',
  reminderAt,
  ...extra,
})
const TASKS = [
  entry(101, 'Dentist', '2026-11-16T14:00', {
    kind: 'event',
    priority: 'focus',
  }),
  entry(102, 'Write the quarterly report', '2026-11-16T11:30'),
  entry(107, 'Water the plants', '2026-11-16T09:00', { done: true }),
  entry(103, 'Call the plumber', '2026-11-12T09:00'),
  entry(104, 'Pay the invoice', '2026-11-10T09:00', { done: true }),
  entry(105, 'Plan the trip', '2026-11-20T09:00'),
  entry(108, 'Birthday dinner', '2026-11-28T19:00', { kind: 'event' }),
  entry(109, 'Renew passport', '2026-12-03T09:00'),
  entry(106, 'Sort the bookshelf'),
]
const LONG = [
  ...TASKS,
  ...Array.from({ length: 10 }, (_, index) =>
    entry(
      200 + index,
      `Agenda entry ${index + 1}`,
      `2026-11-16T${String(12 + index).padStart(2, '0')}:00`,
    ),
  ),
]

const browser = await playwright[engine].launch()

async function frame(
  name,
  { viewport = CARD, theme = 'light', tasks = TASKS },
  act,
) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    locale: 'en-GB',
  })
  const page = await context.newPage()

  await page.clock.setFixedTime(NOW)
  await page.addInitScript((month) => {
    window.localStorage.setItem('sidenib.today.v1', '[]')
    window.localStorage.setItem('sidenib.month.v1', JSON.stringify(month))
    window.localStorage.setItem(
      'sidenib.sidebar.settings.v27',
      JSON.stringify({ notificationsEnabled: false }),
    )
  }, tasks)
  await page.goto(`${base}/?open=1&theme=${theme}`)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await page.locator('[data-view="calendar"]').waitFor()
  await act?.(page)
  await page.mouse.move(5, 5)
  await page.waitForTimeout(400)

  const card = await page.locator('.sn-card').boundingBox()

  await page.screenshot({
    path: path.join(out, `${name}.png`),
    clip: {
      x: card.x - 14,
      y: card.y - 14,
      width: card.width + 28,
      height: card.height + 28,
    },
  })
  console.log(
    `${name}: card ${Math.round(card.width)} x ${Math.round(card.height)}`,
  )
  await context.close()
}

const day = (page, key) => page.locator(`.sn-day[data-date="${key}"]`)

await frame('month-light', {})
await frame('month-dark', { theme: 'dark' })
await frame('month-selected-light', {}, (page) =>
  day(page, '2026-11-20').click(),
)
await frame('month-selected-dark', { theme: 'dark' }, (page) =>
  day(page, '2026-11-12').click(),
)
await frame('month-focus-light', {}, async (page) => {
  await day(page, '2026-11-16').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
})
await frame('month-five-weeks-light', {}, (page) =>
  page.getByRole('button', { name: 'Next month' }).click(),
)
await frame('month-long-agenda-light', { tasks: LONG }, async (page) => {
  await page.locator('.sn-view-body').hover()
  await page.mouse.wheel(0, 260)
})
await frame('week-light', { viewport: SHORT_CARD })
await frame('week-dark', { viewport: SHORT_CARD, theme: 'dark' })
await frame(
  'week-long-agenda-dark',
  { viewport: SHORT_CARD, theme: 'dark', tasks: LONG },
  async (page) => {
    await page.locator('.sn-view-body').hover()
    await page.mouse.wheel(0, 200)
  },
)
await frame(
  'week-year-boundary-light',
  { viewport: SHORT_CARD },
  async (page) => {
    for (let index = 0; index < 6; index += 1) {
      await page.getByRole('button', { name: 'Next week' }).click()
    }
  },
)

await browser.close()
