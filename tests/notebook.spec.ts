import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/*
 * The notebook page (ADIEN-172, docs/design/notebook/README.md). These pin
 * the structure that makes the layout what it is, so a later change cannot
 * quietly bring back the footer tab bar, the boxed quick-add or raised row
 * tiles, and they exercise the states where the structure could break:
 * empty, long, wrapped, editing, a due reminder, a short screen.
 */

const pad = (value: number) => `${value}`.padStart(2, '0')
const dayKey = (offset = 0) => {
  const date = new Date(Date.now() + offset * 864e5)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface Seed {
  today?: unknown[]
  month?: unknown[]
  lists?: unknown[]
  settings?: Record<string, unknown>
}

async function open(page: Page, seed: Seed = {}, query = '') {
  await page.addInitScript((data) => {
    if (window.localStorage.getItem('notebook-seeded')) {
      return
    }

    window.localStorage.setItem('notebook-seeded', '1')
    window.localStorage.setItem('sidenib.today.v1', JSON.stringify(data.today ?? []))
    window.localStorage.setItem('sidenib.month.v1', JSON.stringify(data.month ?? []))
    window.localStorage.setItem(
      'sidenib.custom-lists.v1',
      JSON.stringify(data.lists ?? []),
    )

    if (data.settings) {
      window.localStorage.setItem(
        'sidenib.sidebar.settings.v27',
        JSON.stringify(data.settings),
      )
    }
  }, seed)
  await page.goto(`/?open=1${query}`)
  await expect(page.locator('.sn-card')).toHaveClass(/is-open/)
}

const task = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  meta: '',
  priority: 'normal',
  ...extra,
})

const rect = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox()

  expect(box, selector).not.toBeNull()
  return box!
}

/** Whether `inner` lies wholly inside `outer`, to half a pixel. */
const within = (
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5

test.describe('notebook page structure', () => {
  test('the index is in the header, the entry line follows the open tasks, and nothing is boxed', async ({
    page,
  }) => {
    await open(page, {
      today: [
        task(1, 'Draft release notes', { priority: 'focus' }),
        task(2, 'Reply about the venue', { reminderAt: `${dayKey(1)}T17:00` }),
        task(3, 'Water the plants', { done: true }),
      ],
      lists: [
        {
          id: 'groceries',
          title: 'Groceries',
          showOnToday: true,
          collapsed: false,
          tasks: [task(21, 'Lemons')],
        },
      ],
    })

    const card = await rect(page, '.sn-card')
    const header = await rect(page, '.sn-header')
    const index = await rect(page, '.sn-header [role="tablist"]')
    const body = await rect(page, '.sn-view-body')

    // No footer bar and no icons in the index: three words in the header.
    await expect(page.locator('.sn-tabs')).toHaveCount(0)
    await expect(page.locator('[role="tab"] svg')).toHaveCount(0)
    expect(within(index, header)).toBe(true)
    expect(header.y).toBeCloseTo(card.y, 0)
    // The header is the only fixed chrome, and the body runs to the foot.
    expect(header.height).toBeLessThanOrEqual(74)
    expect(body.y + body.height).toBeCloseTo(card.y + card.height, 0)

    // The date block: the day number, the weekday, the month, the count.
    const now = new Date()

    await expect(page.locator('.sn-lead')).toHaveText(String(now.getDate()))
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      /^Today, /,
    )
    await expect(page.locator('.sn-aside')).toHaveText('2 open')

    // One paper: rows and the entry line have no fill of their own beyond
    // the page colour, and no radius.
    const paint = await page.evaluate(() => {
      const css = (selector: string) => {
        const node = document.querySelector(selector)

        return node ? getComputedStyle(node) : null
      }

      return {
        group: css('.sn-group')?.backgroundColor,
        row: css('.sn-task')?.backgroundColor,
        rowRadius: css('.sn-task')?.borderRadius,
        field: css('.sn-field')?.backgroundColor,
        fieldRadius: css('.sn-field')?.borderRadius,
        check: css('.sn-check > span')?.borderRadius,
      }
    })

    expect(paint.group).toBe('rgba(0, 0, 0, 0)')
    expect(paint.row).toBe('rgba(0, 0, 0, 0)')
    expect(paint.field).toBe('rgba(0, 0, 0, 0)')
    expect(paint.rowRadius).toBe('0px')
    expect(paint.fieldRadius).toBe('0px')
    // A square box, not a circle.
    expect(paint.check).toBe('4px')

    // Order down the page: open tasks, the entry line, the pinned list, the
    // completed fold.
    const tops = await page.evaluate(() =>
      ['.sn-task', '.sn-quick', 'button.sn-section-label'].map(
        (selector) => document.querySelector(selector)!.getBoundingClientRect().top,
      ),
    )
    const lastOpen = await page
      .locator('.sn-task')
      .filter({ hasText: 'Reply about the venue' })
      .boundingBox()
    const entry = await rect(page, '.sn-quick')

    expect(tops[0]).toBeLessThan(tops[1])
    expect(tops[1]).toBeLessThan(tops[2])
    expect(entry.y).toBeCloseTo(lastOpen!.y + lastOpen!.height, 0)

    // One line per task: the reminder is at the trailing end of the same
    // line, and every line is the same height.
    const row = await page
      .locator('.sn-task')
      .filter({ hasText: 'Reply about the venue' })
      .boundingBox()
    const meta = await page
      .locator('.sn-task')
      .filter({ hasText: 'Reply about the venue' })
      .locator('.sn-row-meta')
      .boundingBox()
    const plain = await page
      .locator('.sn-task')
      .filter({ hasText: 'Draft release notes' })
      .boundingBox()

    expect(row!.height).toBeCloseTo(plain!.height, 0)
    // 36 plus its rule, which is half a pixel or one by device scale.
    expect(row!.height).toBeGreaterThanOrEqual(36)
    expect(row!.height).toBeLessThanOrEqual(37.2)
    expect(meta!.y).toBeGreaterThanOrEqual(row!.y - 0.5)
    expect(meta!.y + meta!.height).toBeLessThanOrEqual(row!.y + row!.height + 0.5)
    expect(meta!.x + meta!.width).toBeGreaterThan(card.x + card.width - 24)

    // Focus priority is a highlighter stroke and is named for assistive
    // technology; the trailing dot is gone.
    const focusTitle = page
      .locator('.sn-task.is-focus')
      .locator('.sn-row-title-text')

    await expect(focusTitle).toHaveText('Draft release notes')
    await expect(focusTitle).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.locator('.sn-task.is-focus .sn-row-title')).toContainText(
      'focus priority',
    )

    // Checks sit left of the margin rule; titles start right of it.
    const check = await rect(page, '.sn-check')
    const title = await rect(page, '.sn-row-title')

    expect(check.x + check.width).toBeLessThanOrEqual(card.x + 36.5)
    expect(title.x).toBeGreaterThanOrEqual(card.x + 36)
  })

  test('an empty page is the entry line and one quiet line, with rules to the foot', async ({
    page,
  }) => {
    await open(page)

    const body = await rect(page, '.sn-view-body')
    const entry = await rect(page, '.sn-quick')
    const rules = await rect(page, '.sn-rules')

    // The first line of the page is where you write.
    expect(entry.y).toBeCloseTo(body.y, 0)
    await expect(page.locator('.sn-note')).toContainText('Nothing for today')
    await expect(page.locator('.sn-empty')).toHaveCount(0)
    // No blank slab: the rest of the page is ruled.
    expect(rules.height).toBeGreaterThan(250)
    expect(rules.y + rules.height).toBeCloseTo(body.y + body.height, 0)
    await expect(page.locator('.sn-rules')).toHaveCSS(
      'background-image',
      /repeating-linear-gradient/,
    )

    // Adding from the empty page works and keeps focus on the line.
    const field = page.getByLabel('Add a task to Today')

    await field.fill('First line')
    await field.press('Enter')
    await expect(page.locator('.sn-task')).toHaveText(/First line/)
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await expect(page.locator('.sn-note')).toHaveCount(0)
  })

  test('the entry line stays in view above and below a long page', async ({
    page,
  }) => {
    await open(page, {
      today: Array.from({ length: 24 }, (_, index) =>
        task(100 + index, `Open task ${index + 1}`),
      ),
      lists: [
        {
          id: 'long',
          title: 'Long list',
          showOnToday: true,
          collapsed: false,
          tasks: Array.from({ length: 24 }, (_, index) =>
            task(200 + index, `Listed ${index + 1}`),
          ),
        },
      ],
    })

    const body = page.locator('.sn-view-body')
    const card = await rect(page, '.sn-card')
    const bodyBox = await rect(page, '.sn-view-body')
    const entry = () => rect(page, '.sn-quick')

    // The card does not grow; the body scrolls.
    expect(card.height).toBeLessThanOrEqual(480.5)
    expect(
      await body.evaluate((node) => node.scrollHeight > node.clientHeight * 3),
    ).toBe(true)

    // At the top the line's own place is far below: it holds at the foot.
    let box = await entry()

    expect(box.y + box.height).toBeCloseTo(bodyBox.y + bodyBox.height, 0)

    // Scrolled to the end it is far above: it holds at the top.
    await body.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
    box = await entry()
    expect(box.y).toBeCloseTo(bodyBox.y, 0)

    // It is opaque there, so rows do not show through it, and it works.
    await expect(page.locator('.sn-quick')).not.toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    )
    await page.getByLabel('Add a task to Today').fill('Added from the end')
    await page.getByLabel('Add a task to Today').press('Enter')
    await expect(
      page.locator('.sn-task').filter({ hasText: 'Added from the end' }),
    ).toHaveCount(1)

    // Opened by shortcut, focus goes to the entry line wherever it is.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.sn-card')).toBeHidden()
    await page.keyboard.press('Alt+Shift+S')
    await expect(page.getByLabel('Add a task to Today')).toBeFocused()
  })

  test('a long title wraps to two lines, edits whole, and never pushes the row out of the page', async ({
    page,
  }) => {
    const long =
      'Write the quarterly summary for the three teams and send it to everyone who asked for a copy before the end of the week'
    const unbroken = 'A'.repeat(90)

    await open(page, {
      today: [
        task(1, long, { reminderAt: `${dayKey(1)}T17:00`, priority: 'focus' }),
        task(2, unbroken),
        task(3, 'Short'),
      ],
    })

    const card = await rect(page, '.sn-card')
    const longRow = page.locator('.sn-task').filter({ hasText: 'quarterly summary' })
    const rowBox = (await longRow.boundingBox())!
    const short = (await page
      .locator('.sn-task')
      .filter({ hasText: 'Short' })
      .boundingBox())!

    // Two lines, then an ellipsis: taller than one line, shorter than three.
    expect(rowBox.height).toBeGreaterThan(short.height + 10)
    expect(rowBox.height).toBeLessThan(short.height * 2)
    expect(within(rowBox, card)).toBe(true)
    // The trailing time keeps its place on the first line and is not pushed
    // out or wrapped by the long title.
    const meta = (await longRow.locator('.sn-row-meta').boundingBox())!

    expect(meta.x + meta.width).toBeLessThanOrEqual(card.x + card.width)
    expect(meta.height).toBeLessThanOrEqual(short.height)
    // Nothing overflows sideways.
    expect(
      await page
        .locator('.sn-view-body')
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true)

    // Editing shows the whole title, inside the card, and Escape leaves the
    // edit without closing the card.
    await longRow.locator('.sn-row-title').dblclick()

    const editor = page.getByRole('textbox', { name: `Edit ${long}` })

    await expect(editor).toBeFocused()

    const editorBox = (await editor.boundingBox())!

    expect(editorBox.height).toBeGreaterThan(50)
    expect(editorBox.x + editorBox.width).toBeLessThanOrEqual(card.x + card.width)
    expect(
      await editor.evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    await expect(page.locator('.sn-card')).toHaveClass(/is-open/)

    // A real edit is saved with Enter.
    await page.locator('.sn-task').filter({ hasText: 'Short' }).locator('.sn-row-title').dblclick()
    await page.getByRole('textbox', { name: 'Edit Short' }).fill('Short, edited')
    await page.keyboard.press('Enter')
    await expect(
      page.locator('.sn-task').filter({ hasText: 'Short, edited' }),
    ).toHaveCount(1)
  })

  test('complete, reopen, fold a pinned list and reach every view from the keyboard', async ({
    page,
  }) => {
    await open(page, {
      today: [task(1, 'One'), task(2, 'Two')],
      lists: [
        {
          id: 'groceries',
          title: 'Groceries',
          showOnToday: true,
          collapsed: false,
          tasks: [task(21, 'Lemons'), task(22, 'Oat milk')],
        },
      ],
    })

    await page.getByRole('button', { name: 'Complete One' }).click()
    await expect(page.locator('.sn-aside')).toHaveText('1 open')
    await page.getByRole('button', { name: 'Completed · 1' }).click()
    await page.getByRole('button', { name: 'Mark One open' }).click()
    await expect(page.locator('.sn-aside')).toHaveText('2 open')

    // Folding keeps the label as a ruled line and says what is hidden.
    await page.getByRole('button', { name: 'Groceries', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Groceries · 2' })).toBeVisible()
    await expect(page.locator('.sn-task').filter({ hasText: 'Lemons' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Groceries · 2' }).click()
    await expect(page.locator('.sn-task').filter({ hasText: 'Lemons' })).toHaveCount(1)

    // The index is one tab stop. Arrows move through the views and focus
    // stays on the index although each view draws its own.
    await page.getByRole('tab', { name: 'Today' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeFocused()
    await expect(page.locator('[data-view="calendar"]')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Lists' })).toBeFocused()
    await expect(page.locator('[data-view="lists"]')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Today' })).toBeFocused()
    expect(
      await page.locator('[role="tab"][tabindex="0"]').count(),
    ).toBe(1)

    // A click keeps focus on the chosen tab too, so Escape still reaches
    // the card.
    await page.getByRole('tab', { name: 'Lists' }).click()
    await expect(page.getByRole('tab', { name: 'Lists' })).toBeFocused()

    // Lists: the open count sits in the margin; a list opens and comes back.
    await expect(page.locator('.sn-row-nav .sn-margin-cell')).toHaveText('2')
    await page.getByRole('button', { name: 'Open Groceries, 2 open' }).click()
    await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible()
    await page.getByLabel('Add a task to Groceries').fill('Bread')
    await page.keyboard.press('Enter')
    await expect(page.locator('.sn-aside')).toHaveText('3 open')
    await page.getByRole('button', { name: 'All lists', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'All lists' })).toBeVisible()

    // Settings is reached from the index line and Escape peels it first.
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await expect(page.locator('.sn-header [role="tablist"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Lists' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sn-card')).toBeHidden()
  })

  test('a due reminder is a slip under the head rule and moves nothing out of the page', async ({
    page,
  }) => {
    await open(page, {
      today: [
        task(1, 'Call the bank', { reminderAt: `${dayKey(-1)}T09:00` }),
        task(2, 'Other'),
      ],
    })

    const banner = page.locator('.sn-banner')

    await expect(banner).toBeVisible()
    // Let the slip finish sliding in before it is measured.
    await expect
      .poll(async () =>
        banner.evaluate((node) =>
          node.getAnimations().every((item) => item.playState === 'finished'),
        ),
      )
      .toBe(true)

    const card = await rect(page, '.sn-card')
    const header = await rect(page, '.sn-header')
    const bannerBox = (await banner.boundingBox())!
    const body = await rect(page, '.sn-view-body')

    expect(bannerBox.y).toBeCloseTo(header.y + header.height, 0)
    expect(body.y).toBeCloseTo(bannerBox.y + bannerBox.height, 0)
    expect(within(bannerBox, card)).toBe(true)
    expect(bannerBox.width).toBeCloseTo(card.width, 0)
    // The overdue row says so in words and colour, on its one line.
    await expect(page.locator('.sn-task.is-overdue .task-reminder')).toContainText(
      'Overdue',
    )
    // Snooze clears the slip and the body takes the space back.
    await page.getByRole('button', { name: 'Snooze Call the bank 10 minutes' }).click()
    await expect(banner).toHaveCount(0)
    expect((await rect(page, '.sn-view-body')).y).toBeCloseTo(
      header.y + header.height,
      0,
    )
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`text on the page meets contrast in ${theme}`, async ({ page }) => {
      await open(
        page,
        {
          today: [
            task(1, 'Focus one', { priority: 'focus' }),
            task(2, 'With time', { reminderAt: `${dayKey(1)}T17:00` }),
            task(3, 'Late', { reminderAt: `${dayKey(-1)}T09:00` }),
            task(4, 'Done one', { done: true }),
          ],
          lists: [
            {
              id: 'g',
              title: 'Groceries',
              showOnToday: true,
              collapsed: false,
              tasks: [],
            },
          ],
        },
        `&theme=${theme}`,
      )
      await page.getByRole('button', { name: /^Dismiss reminder/ }).click()
      await page.getByRole('button', { name: 'Completed · 1' }).click()

      const ratios = await page.evaluate(() => {
        const parse = (value: string) => {
          const canvas = document.createElement('canvas')

          canvas.width = canvas.height = 1

          const context = canvas.getContext('2d', { willReadFrequently: true })!

          context.clearRect(0, 0, 1, 1)
          context.fillStyle = value
          context.fillRect(0, 0, 1, 1)

          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data

          return { r, g, b, a: a / 255 }
        }
        const over = (
          top: { r: number; g: number; b: number; a: number },
          bottom: { r: number; g: number; b: number },
        ) => ({
          r: top.r * top.a + bottom.r * (1 - top.a),
          g: top.g * top.a + bottom.g * (1 - top.a),
          b: top.b * top.a + bottom.b * (1 - top.a),
        })
        const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
          const channel = (value: number) => {
            const unit = value / 255

            return unit <= 0.03928
              ? unit / 12.92
              : ((unit + 0.055) / 1.055) ** 2.4
          }

          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        }
        const ratio = (
          a: { r: number; g: number; b: number },
          b: { r: number; g: number; b: number },
        ) => {
          const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)

          return (hi + 0.05) / (lo + 0.05)
        }
        const root = getComputedStyle(document.querySelector('.workspace')!)
        const paper = parse(root.getPropertyValue('--sn-surface'))
        const text = (selector: string, ground = paper) => {
          const node = document.querySelector(selector)

          if (!node) {
            throw new Error(`missing ${selector}`)
          }

          const style = getComputedStyle(node)
          const own = parse(style.backgroundColor)
          const base = own.a > 0 ? over(own, ground) : ground

          return ratio(over(parse(style.color), base), base)
        }

        return {
          title: text('.sn-task:not(.is-done):not(.is-focus) .sn-row-title'),
          focus: text('.sn-task.is-focus .sn-row-title-text'),
          done: text('.sn-task.is-done .sn-row-title'),
          time: text('.sn-task:not(.is-overdue) .task-reminder'),
          overdue: text('.sn-task.is-overdue .task-reminder'),
          label: text('button.sn-section-label'),
          placeholder: ratio(
            parse(
              getComputedStyle(
                document.querySelector('.sn-field input')!,
                '::placeholder',
              ).color,
            ),
            paper,
          ),
          tab: text('.sn-tab[aria-selected="false"]'),
          aside: text('.sn-aside'),
          subtitle: text('.sn-subtitle'),
          // Non-text: the unchecked box edge against the paper.
          box: ratio(
            parse(
              getComputedStyle(document.querySelector('.sn-check > span')!)
                .borderTopColor,
            ),
            paper,
          ),
        }
      })

      for (const [name, value] of Object.entries(ratios)) {
        expect(value, `${name} in ${theme}`).toBeGreaterThanOrEqual(
          name === 'box' ? 3 : 4.5,
        )
      }
    })
  }

  test('reduced motion and a short screen keep the page whole', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 900, height: 420 })
    await open(page, {
      today: Array.from({ length: 12 }, (_, index) => task(index + 1, `Task ${index + 1}`)),
    })

    const card = await rect(page, '.sn-card')

    expect(card.height).toBeLessThanOrEqual(400.5)
    expect(card.y).toBeGreaterThanOrEqual(9.5)
    expect(card.y + card.height).toBeLessThanOrEqual(410.5)
    for (const selector of ['.sn-header', '.sn-view-body', '.sn-quick']) {
      expect(within(await rect(page, selector), card), selector).toBe(true)
    }

    // Each view keeps its header and a usable body on the short card.
    for (const name of ['Calendar', 'Lists', 'Today']) {
      await page.getByRole('tab', { name }).click()
      expect(within(await rect(page, '.sn-header'), card)).toBe(true)
      expect((await rect(page, '.sn-view-body')).height).toBeGreaterThan(200)
    }

    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    expect((await rect(page, '.sn-view-body')).height).toBeGreaterThan(250)
    await expect(page.locator('.sn-card')).toHaveCSS('transform', 'none')
  })
})
