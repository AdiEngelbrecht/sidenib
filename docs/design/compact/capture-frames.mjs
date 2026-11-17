/*
 * Captures the reference frames in frames/ from prototype.html and checks the
 * contract's fit, scroll and interaction rules in a real browser.
 * SPDX-License-Identifier: Apache-2.0
 *
 *   node docs/design/compact/capture-frames.mjs
 *
 * Uses the repository's Playwright. If its bundled browser is not installed,
 * point SIDENIB_CHROMIUM at any Chromium or Chrome executable.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'frames')
const page0 = pathToFileURL(join(here, 'prototype.html')).href
const STAGES = {
  laptop: [1440, 900],
  short: [1280, 600],
  tiny: [1024, 445],
}
// Right-hand slice of the laptop stage around the card.
const CROP = { x: 800, y: 180, width: 640, height: 565 }
const CROP_LEFT = { x: 0, y: 180, width: 640, height: 565 }
const CROP_TOP = { x: 240, y: 0, width: 960, height: 565 }
// Largest card the Advanced bounds allow; the default frames must stay 340 x 480.
const ADVANCED = { width: 560, height: Infinity }

const frames = [
  ['01-collapsed', 'annotate=1', CROP],
  ['02-today-populated', 'open=1&annotate=1', CROP],
  ['03-today-empty', 'open=1&data=empty', CROP],
  ['04-today-long', 'open=1&data=long&annotate=1', CROP],
  ['05-today-long-scrolled', 'open=1&data=long&scroll=420', CROP],
  ['06-today-overdue', 'open=1&data=overdue', CROP],
  ['07-today-completed', 'open=1&data=completed', CROP],
  ['08-calendar', 'open=1&view=calendar&annotate=1', CROP],
  ['09-lists', 'open=1&view=lists', CROP],
  ['10-list-detail', 'open=1&view=lists&list=groceries', CROP],
  ['11-settings', 'open=1&view=settings', CROP],
  ['12-reminder-toast', 'toast=1&annotate=1', CROP],
  ['13-reminder-banner', 'open=1&toast=1', CROP],
  ['14-dark-today', 'open=1&theme=dark&data=overdue', CROP],
  ['15-dark-calendar', 'open=1&theme=dark&view=calendar', CROP],
  ['16-dark-settings', 'open=1&theme=dark&view=settings', CROP],
  ['17-dark-toast', 'toast=1&theme=dark', CROP],
  ['18-left-edge', 'open=1&edge=left&annotate=1', CROP_LEFT],
  ['19-fit-laptop', 'open=1&data=long&annotate=1', null],
  ['20-fit-short', 'open=1&stage=short&view=calendar&annotate=1', null],
  ['21-fit-tiny', 'open=1&stage=tiny&view=calendar&annotate=1', null],
  ['22-fit-tiny-long', 'open=1&stage=tiny&data=long&annotate=1', null],
  ['23-top-edge', 'open=1&edge=top&annotate=1', CROP_TOP],
  ['24-top-edge-toast', 'edge=top&toast=1&annotate=1', CROP_TOP],
  ['25-settings-advanced', 'open=1&view=settings&page=advanced', CROP],
  ['26-advanced-wide-full', 'open=1&width=560&height=full&data=long&annotate=1', null, ADVANCED],
  ['27-advanced-wide-short', 'open=1&stage=short&width=560&height=full&view=calendar', null, ADVANCED],
]

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

mkdirSync(out, { recursive: true })
const browser = await chromium.launch(
  process.env.SIDENIB_CHROMIUM
    ? { executablePath: process.env.SIDENIB_CHROMIUM }
    : {},
)
const metrics = {}

for (const [name, query, clip, limit = { width: 340, height: 480 }] of frames) {
  const stage = new URLSearchParams(query).get('stage') ?? 'laptop'
  const [width, height] = STAGES[stage]
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: clip ? 2 : 1,
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${page0}?capture=1&${query}`)
  await page.waitForTimeout(350)
  await page.screenshot({ path: join(out, `${name}.png`), ...(clip ? { clip } : {}) })

  const m = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const card = document.getElementById('sn-card')
    const body = document.getElementById('sn-body')
    const menu = document.querySelector('.proto-menubar')
    return {
      open: card.classList.contains('is-open'),
      card: rect(card),
      notch: rect(document.querySelector('.sn-notch')),
      hit: rect(document.getElementById('sn-notch')),
      toastVisible: document.querySelector('.sn-toast').classList.contains('is-visible'),
      body: { client: body.clientHeight, scroll: body.scrollHeight, top: body.scrollTop },
      overflowX: card.scrollWidth > card.clientWidth || body.scrollWidth > body.clientWidth,
      workTop: menu.getBoundingClientRect().bottom,
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
  metrics[name] = m
  check(`${name}: no console errors`, errors.length === 0, errors.join('; '))
  if (m.open) {
    const fits =
      m.card.y >= m.workTop + 10 &&
      m.card.y + m.card.height <= m.viewport.height - 10 &&
      m.card.x >= 10 &&
      m.card.x + m.card.width <= m.viewport.width - 10
    check(
      `${name}: card ${m.card.width}x${m.card.height} inside work area with 10 clearance`,
      fits && m.card.height <= limit.height && m.card.width <= limit.width,
    )
    check(
      `${name}: content scrolls inside the card, no sideways overflow`,
      !m.overflowX && m.body.client < m.card.height,
      `body ${m.body.client}, content ${m.body.scroll}`,
    )
  } else {
    check(`${name}: card closed`, !m.open)
  }
  await context.close()
}

// Interaction rules.
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const isOpen = () =>
  page.evaluate(() => document.getElementById('sn-card').classList.contains('is-open'))
const focusId = () => page.evaluate(() => document.activeElement?.id ?? '')
const notchBox = async () => (await page.locator('#sn-notch').boundingBox())
const settle = () => page.waitForTimeout(320)

await page.goto(`${page0}?capture=0`)
await settle()
let box = await notchBox()
const drawn = await page.evaluate(() => {
  const hit = document.getElementById('sn-notch')
  const bar = hit.querySelector('.sn-notch')
  return [hit.offsetWidth, hit.offsetHeight, bar.offsetWidth, bar.offsetHeight].join('x')
})
check('notch hit target is 28x72 while 12x48 is drawn', drawn === '28x72x12x48', drawn)

await page.mouse.move(box.x + 14, box.y + 36)
await settle()
check('hover does not open the card', !(await isOpen()))

await page.mouse.click(box.x + 14, box.y + 36)
await settle()
check('click opens the card', await isOpen())
check('pointer open does not steal focus into the text field', (await focusId()) === 'sn-card')

await page.keyboard.press('Escape')
await settle()
check('Escape closes the card', !(await isOpen()))
check('focus returns to the notch after close', (await focusId()) === 'sn-notch')

await page.keyboard.press('Alt+KeyT')
await settle()
check('global shortcut opens the card', await isOpen())
check('keyboard open focuses quick add', (await focusId()) === 'sn-quick-input')
await page.keyboard.type('Draft')
await page.keyboard.press('Escape')
await settle()
check('first Escape clears a draft and keeps the card', await isOpen())
await page.keyboard.press('Escape')
await settle()
check('second Escape closes the card', !(await isOpen()))

box = await notchBox()
const drag = async (dx, dy, steps = 8) => {
  await page.mouse.move(box.x + 20, box.y + 36)
  await page.mouse.down()
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(box.x + 20 + (dx * i) / steps, box.y + 36 + (dy * i) / steps)
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await settle()
}
await drag(-24, 2)
check('24 px slow inward pull springs back', !(await isOpen()))
await drag(-60, 3)
check('60 px inward pull opens the card', await isOpen())
await page.keyboard.press('Escape')
await settle()

box = await notchBox()
const before = box.y
await drag(-2, 120)
box = await notchBox()
check('vertical drag repositions the notch and does not open', !(await isOpen()) && box.y > before + 100, `moved ${Math.round(box.y - before)} px`)

// Top edge: the same rules with the axes swapped.
await page.goto(`${page0}?capture=0&edge=top`)
await settle()
box = await notchBox()
const pullDown = async (distance) => {
  const x = box.x + box.width / 2
  await page.mouse.move(x, box.y + 4)
  await page.mouse.down()
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(x + 1, box.y + 4 + (distance * i) / 8)
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await settle()
}
await pullDown(24)
check('top edge: 24 px downward pull springs back', !(await isOpen()))
await pullDown(60)
check('top edge: 60 px downward pull opens the card', await isOpen())
await page.keyboard.press('Escape')
await settle()

// Settings: the default page stays simple; every legacy preference is one level down.
await page.goto(`${page0}?capture=0&open=1&view=settings`)
await settle()
const simple = await page.evaluate(() => ({
  rows: document.querySelectorAll('#sn-body .sn-row').length,
  sliders: document.querySelectorAll('#sn-body input[type=range]').length,
  edges: [...document.querySelectorAll('[data-setting="edge"]')].map((b) => b.textContent).join(','),
}))
check('default Settings has no sliders and at most 10 rows', simple.sliders === 0 && simple.rows <= 10, `${simple.rows} rows`)
check('Screen edge offers Left, Top and Right', simple.edges === 'Left,Top,Right', simple.edges)
await page.locator('[data-act="advanced"]').click()
await settle()
const advanced = await page.evaluate(() =>
  [...document.querySelectorAll('#sn-body input[type=range]')].map((i) => i.dataset.adv).join(','),
)
check(
  'Advanced keeps the size, notch, density and motion preferences',
  advanced === 'panelWidth,panelRadius,surfaceAlpha,notchWidth,notchHeight,taskRowHeight,taskTextSize,motionMs',
  advanced,
)
await page.locator('[data-adv-choice="notchVisibility"][data-value="On hover"]').click()
await page.keyboard.press('Escape')
await settle()
await page.mouse.move(400, 400)
await settle()
const notchOpacity = () =>
  page.evaluate(() => getComputedStyle(document.querySelector('.sn-notch')).opacity)
await page.evaluate(() => document.activeElement.blur())
await settle()
const hidden = await notchOpacity()
box = await notchBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await settle()
check('hover-only notch is hidden until the pointer reaches the edge', hidden === '0' && (await notchOpacity()) === '1', `${hidden} then visible`)
check('hover-only notch still does not open on hover', !(await isOpen()))

await page.goto(`${page0}?capture=0&toast=1`)
await settle()
check('reminder shows a toast and leaves the card closed', !(await isOpen()) && (await page.locator('.sn-toast.is-visible').count()) === 1)
check('reminder does not take keyboard focus', (await focusId()) === '')

await page.goto(`${page0}?capture=0&motion=reduced&open=1`)
await settle()
const reduced = await page.evaluate(() => {
  const style = getComputedStyle(document.documentElement)
  return [style.getPropertyValue('--sn-reveal-offset').trim(), style.getPropertyValue('--sn-motion-reveal').trim()]
})
check('reduced motion removes travel and shortens the fade', reduced[0] === '0px' && reduced[1] === '120ms', reduced.join(', '))
await context.close()
await browser.close()

writeFileSync(join(out, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`)
if (failures.length) {
  console.error(`${failures.length} check(s) failed`)
  process.exit(1)
}
console.log(`captured ${frames.length} frames, all checks passed`)
