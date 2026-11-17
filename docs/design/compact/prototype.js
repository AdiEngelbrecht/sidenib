/*
 * Sidenib compact prototype behaviour (ADIEN-159).
 * SPDX-License-Identifier: Apache-2.0
 *
 * Review-only. Renders every state in the contract from URL parameters so
 * capture-frames.mjs can photograph them:
 *   ?stage=laptop|short|tiny &theme=light|dark &view=today|calendar|lists|settings
 *   &data=populated|empty|long|overdue|completed &open=1 &toast=1 &annotate=1
 *   &edge=left|top &motion=reduced &list=groceries &scroll=120 &capture=1
 *   &page=advanced &width=560 &height=full &notch=hover
 */

const { SN, computeGeometry, classifyNotchGesture, pullProgress } =
  globalThis.SidenibGeometry

const params = new URLSearchParams(location.search)
const state = {
  stage: params.get('stage') || 'laptop',
  theme: params.get('theme') || 'light',
  view: params.get('view') || 'today',
  data: params.get('data') || 'populated',
  open: params.get('open') === '1',
  toast: params.get('toast') === '1',
  annotate: params.get('annotate') === '1',
  edge: ['left', 'top'].includes(params.get('edge')) ? params.get('edge') : 'right',
  settingsPage: params.get('page') === 'advanced' ? 'advanced' : null,
  // Advanced preferences. Defaults are the compact Sidenib layout.
  adv: {
    panelWidth: Number(params.get('width') ?? 340),
    heightMode: params.get('height') === 'full' ? 'Full' : 'Compact',
    notchWidth: 12,
    notchHeight: 48,
    notchVisibility: params.get('notch') === 'hover' ? 'On hover' : 'Always',
    panelRadius: 24,
    taskRowHeight: 44,
    taskTextSize: 14,
    motionMs: 220,
    surfaceAlpha: 100,
  },
  reduced: params.get('motion') === 'reduced',
  list: params.get('list'),
  capture: params.get('capture') === '1',
  notchY: Number(params.get('notchY') ?? 50),
  completedOpen: false,
  selectedDay: 16,
  entryMode: 'Task',
  lastView: 'today',
  settings: {
    appearance: 'System',
    edge: { left: 'Left', top: 'Top' }[params.get('edge')] ?? 'Right',
    launch: true,
    notifications: true,
    showCompleted: true,
    sort: 'Priority',
  },
}

const STAGES = {
  laptop: { width: 1440, height: 900, menu: 25 },
  short: { width: 1280, height: 600, menu: 25 },
  tiny: { width: 1024, height: 445, menu: 25 },
}

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/>',
  sliders:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
}
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`

const LONG_TITLES = [
  'Write the handoff note for the calendar workspace, including the week-strip fallback on very short displays',
  'Call the landlord',
  'Compare three standing desks under 400 and send the shortlist to Jonas before Thursday',
  'Water the plants',
  'Pick up parcel',
  'Supercalifragilisticexpialidocious-long-unbroken-token-that-must-wrap-not-overflow',
  'Back up photos',
  'Plan Saturday hike',
  'Renew library card',
  'Send invoice 2026-041',
  'Clean bike chain',
  'Read chapter 6',
  'Order printer ink',
  'Book train to Leipzig',
  'Update CV',
  'Return shoes',
  'Fix kitchen shelf',
  'Stretch for ten minutes',
]

const DATA = {
  populated: {
    today: [
      { title: 'Draft release notes for 0.2', flag: true },
      { title: 'Reply to Mara about the venue', due: '14:30' },
      { title: 'Renew passport photos' },
      { title: 'Book dentist', due: '17:00' },
    ],
    pinned: { name: 'Groceries', tasks: ['Oat milk', 'Lemons'] },
    done: ['Capture inbox', 'Stand-up notes'],
  },
  empty: { today: [], done: [] },
  long: {
    today: LONG_TITLES.map((title, index) => ({
      title,
      due: index === 2 ? '09:00' : undefined,
      flag: index === 0,
    })),
    done: ['Capture inbox'],
  },
  overdue: {
    overdue: [
      { title: 'Submit expense report', due: 'Yesterday 16:00' },
      { title: 'Confirm flat viewing', due: 'Fri 13 Nov 09:00' },
    ],
    today: [
      { title: 'Draft release notes for 0.2', flag: true },
      { title: 'Book dentist', due: '17:00' },
    ],
    done: [],
  },
  completed: {
    today: [],
    done: [
      'Draft release notes for 0.2',
      'Reply to Mara about the venue',
      'Renew passport photos',
      'Book dentist',
      'Capture inbox',
    ],
  },
}

const LISTS = [
  { id: 'general', name: 'General', count: 3 },
  { id: 'groceries', name: 'Groceries', count: 2, pinned: true },
  { id: 'reading', name: 'Reading', count: 7 },
  { id: 'trip', name: 'Leipzig trip', count: 4 },
]

const stageEl = document.getElementById('stage')
const wrapEl = document.getElementById('wrap')
let scale = 1
let geometry
let toastTimer = 0

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char],
  )

function taskRow(task, { done = false, overdue = false } = {}) {
  const item = typeof task === 'string' ? { title: task } : task
  const meta = item.due
    ? `<span class="sn-row__meta">${icon('bell')}${escapeHtml(item.due)}</span>`
    : ''
  return `<li class="sn-row${done ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}">
    <button type="button" class="sn-check" role="checkbox" aria-checked="${done}"
      aria-label="${done ? 'Mark not done' : 'Mark done'}: ${escapeHtml(item.title)}">
      <span>${icon('check')}</span>
    </button>
    <div class="sn-row__text">
      <span class="sn-row__title">${escapeHtml(item.title)}</span>${meta}
    </div>
    <div class="sn-row__trail">
      ${item.flag && !done ? '<span class="sn-flag" title="Focus"></span>' : ''}
      <span class="sn-row__actions">
        <button type="button" class="sn-icon-button" aria-label="Set reminder">${icon('bell')}</button>
        <button type="button" class="sn-icon-button" aria-label="More actions">${icon('more')}</button>
      </span>
    </div>
  </li>`
}

function banner() {
  if (!state.toast) return ''
  return `<div class="sn-banner" role="status">
    <div><strong>Reply to Mara about the venue</strong><span>Due 14:30</span></div>
    <button type="button" class="sn-text-button" data-act="toast-snooze">10 min</button>
    <button type="button" class="sn-icon-button" data-act="toast-done" aria-label="Mark done">${icon('check')}</button>
  </div>`
}

function completedSection(done) {
  if (!done.length || !state.settings.showCompleted) return ''
  const open = state.completedOpen || state.data === 'completed'
  return `<button type="button" class="sn-section-label" data-act="toggle-completed" aria-expanded="${open}">
      ${icon(open ? 'chevronDown' : 'chevronRight')}Completed · ${done.length}
    </button>
    ${open ? `<ul class="sn-group">${done.map((t) => taskRow(t, { done: true })).join('')}</ul>` : ''}`
}

function todayView() {
  const data = DATA[state.data]
  const openCount = data.today.length + (data.overdue?.length ?? 0)
  let body = banner()

  if (!openCount && !data.done.length) {
    body += `<div class="sn-empty"><strong>Nothing for today</strong>
      <span>Add a task below, or press <kbd>⌥⇧S</kbd> from any app to open Sidenib.</span></div>`
  } else {
    if (data.overdue?.length) {
      body += `<div class="sn-section-label is-danger">Overdue · ${data.overdue.length}</div>
        <ul class="sn-group">${data.overdue.map((t) => taskRow(t, { overdue: true })).join('')}</ul>
        <div class="sn-section-label">Today</div>`
    }
    if (data.today.length) {
      body += `<ul class="sn-group" data-list="today">${data.today.map((t) => taskRow(t)).join('')}</ul>`
    } else if (!data.overdue?.length) {
      body += `<div class="sn-empty" style="height:auto;min-height:96px"><strong>All done</strong>
        <span>Everything for today is checked off.</span></div>`
    }
    if (data.pinned) {
      body += `<div class="sn-section-label">${escapeHtml(data.pinned.name)}</div>
        <ul class="sn-group">${data.pinned.tasks.map((t) => taskRow(t)).join('')}</ul>`
    }
    body += completedSection(data.done)
  }

  return {
    title: 'Today',
    subtitle: `Monday 16 November${openCount ? ` · ${openCount} open` : ''}`,
    body,
    quick: 'New task',
  }
}

function calendarView(compact) {
  const days = []
  // November 2026 starts on a Sunday; weeks start on Monday.
  for (let i = 0; i < 42; i += 1) {
    const day = i - 5
    const inMonth = day >= 1 && day <= 30
    const label = inMonth ? day : day < 1 ? 31 + day : day - 30
    days.push({ day, label, inMonth })
  }
  const itemDays = new Set([12, 16, 18, 21, 27])
  const overdueDays = state.data === 'overdue' ? new Set([13, 15]) : new Set()
  const selectedWeek = Math.floor((state.selectedDay + 5) / 7)
  const visible = compact
    ? days.slice(selectedWeek * 7, selectedWeek * 7 + 7)
    : days.slice(0, 35 + (days[35].inMonth ? 7 : 0))
  const cells = visible
    .map(({ day, label, inMonth }) => {
      const classes = ['sn-day']
      if (!inMonth) classes.push('is-outside')
      if (inMonth && day === 16) classes.push('is-today')
      if (inMonth && day === state.selectedDay) classes.push('is-selected')
      if (inMonth && overdueDays.has(day)) classes.push('has-items', 'has-overdue')
      else if (inMonth && itemDays.has(day)) classes.push('has-items')
      return `<button type="button" class="${classes.join(' ')}" ${inMonth ? `data-day="${day}"` : 'tabindex="-1"'}
        aria-label="${label} ${inMonth ? 'November' : ''}" ${day === state.selectedDay ? 'aria-current="date"' : ''}><span>${label}</span></button>`
    })
    .join('')
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    .map((d) => `<span>${d}</span>`)
    .join('')
  const agenda =
    state.data === 'empty' || !itemDays.has(state.selectedDay)
      ? `<div class="sn-empty" style="height:auto;min-height:88px"><strong>Nothing on ${state.selectedDay} Nov</strong>
          <span>Add a task or an event for this day below.</span></div>`
      : `<ul class="sn-group">
          ${taskRow({ title: 'Reply to Mara about the venue', due: '14:30' })}
          ${taskRow({ title: 'Team retro (event)', due: '15:00 – 15:45' })}
          ${taskRow({ title: 'Book dentist', due: '17:00' })}
          ${taskRow({ title: 'Pick up parcel before the shop closes at six', due: '17:45' })}
        </ul>`

  return {
    title: 'November',
    subtitle: '2026',
    headerActions: `<button type="button" class="sn-icon-button" aria-label="Previous month">${icon('chevronLeft')}</button>
      <button type="button" class="sn-icon-button" aria-label="Next month">${icon('chevronRight')}</button>
      <button type="button" class="sn-text-button">Today</button>`,
    fixed: `<div class="sn-cal" data-compact="${compact}">
        <div class="sn-cal__weekdays" aria-hidden="true">${weekdays}</div>
        <div class="sn-cal__grid" role="grid" aria-label="November 2026">${cells}</div>
      </div><div class="sn-cal__divider"></div>`,
    body: `${banner()}<div class="sn-section-label">Mon ${state.selectedDay} Nov</div>${agenda}`,
    quick: `Add to ${state.selectedDay} Nov`,
    quickChip: state.entryMode,
  }
}

function listsView() {
  if (state.list) {
    const list = LISTS.find((entry) => entry.id === state.list) ?? LISTS[0]
    return {
      back: 'Lists',
      title: list.name,
      subtitle: `${list.count} open${list.pinned ? ' · shown on Today' : ''}`,
      headerActions: `<button type="button" class="sn-icon-button" aria-label="List actions">${icon('more')}</button>`,
      body: `<ul class="sn-group">${['Oat milk', 'Lemons', 'Dish soap']
        .slice(0, list.count)
        .map((t) => taskRow(t))
        .join('')}</ul>`,
      quick: `New task in ${list.name}`,
    }
  }
  const rows = (state.data === 'empty' ? LISTS.slice(0, 1) : LISTS)
    .map(
      (list) => `<li><button type="button" class="sn-row sn-row--nav sn-row--plain" data-list-id="${list.id}">
        <div class="sn-row__text"><span class="sn-row__title">${escapeHtml(list.name)}</span></div>
        <div class="sn-row__trail"><span>${state.data === 'empty' ? 0 : list.count}</span>${icon('chevronRight')}</div>
      </button></li>`,
    )
    .join('')
  return {
    title: 'Lists',
    subtitle: `${state.data === 'empty' ? 1 : LISTS.length} lists`,
    headerActions: `<button type="button" class="sn-icon-button" aria-label="New list">${icon('plus')}</button>`,
    body: `<ul class="sn-group">${rows}</ul>`,
  }
}

const settingRow = (label, control) =>
  `<li class="sn-row sn-row--plain" style="align-items:center">
    <div class="sn-row__text" style="padding:0"><span class="sn-row__title">${label}</span></div>
    <div class="sn-row__trail">${control}</div></li>`
const segmented = (key, options) =>
  `<div class="sn-segmented" role="group">${options
    .map(
      (option) =>
        `<button type="button" data-setting="${key}" data-value="${option}" aria-pressed="${state.settings[key] === option}">${option}</button>`,
    )
    .join('')}</div>`
const toggle = (key, label) =>
  `<button type="button" class="sn-switch" role="switch" data-switch="${key}" aria-checked="${state.settings[key]}" aria-label="${label}"></button>`

const slider = (key, min, max, step, unit) =>
  `<input type="range" class="sn-slider" data-adv="${key}" min="${min}" max="${max}" step="${step}"
    value="${state.adv[key]}" aria-label="${key}" /><span class="sn-row__value">${state.adv[key]}${unit}</span>`
const advSegmented = (key, options) =>
  `<div class="sn-segmented" role="group">${options
    .map(
      (option) =>
        `<button type="button" data-adv-choice="${key}" data-value="${option}" aria-pressed="${state.adv[key] === option}">${option}</button>`,
    )
    .join('')}</div>`
const navRow = (label, value, attrs = '') =>
  `<li><button type="button" class="sn-row sn-row--nav sn-row--plain" ${attrs}>
    <div class="sn-row__text"><span class="sn-row__title">${label}</span></div>
    <div class="sn-row__trail"><span>${value}</span>${icon('chevronRight')}</div></button></li>`

// Every preference v0.1.14 supports stays available here, clamped to the
// same safe bounds as geometry.js. The default Settings page stays short.
function advancedView() {
  return {
    back: 'Settings',
    title: 'Advanced',
    headerActions: `<button type="button" class="sn-text-button" data-act="settings-done">Done</button>`,
    body: `<div class="sn-section-label">Panel</div>
      <ul class="sn-group">
        ${settingRow('Height', advSegmented('heightMode', ['Compact', 'Full']))}
        ${settingRow('Width', slider('panelWidth', 320, 560, 10, ''))}
        ${settingRow('Corner radius', slider('panelRadius', 12, 28, 1, ''))}
        ${settingRow('Surface opacity', slider('surfaceAlpha', 58, 100, 1, '%'))}
      </ul>
      <div class="sn-section-label">Notch</div>
      <ul class="sn-group">
        ${settingRow('Show', advSegmented('notchVisibility', ['Always', 'On hover']))}
        ${settingRow('Thickness', slider('notchWidth', 10, 112, 1, ''))}
        ${settingRow('Length', slider('notchHeight', 44, 176, 2, ''))}
      </ul>
      <div class="sn-section-label">Density</div>
      <ul class="sn-group">
        ${settingRow('Row height', slider('taskRowHeight', 40, 62, 1, ''))}
        ${settingRow('Text size', slider('taskTextSize', 11, 14, 0.5, ''))}
        ${settingRow('Motion', slider('motionMs', 140, 360, 10, ' ms'))}
      </ul>
      <div class="sn-section-label">Look</div>
      <ul class="sn-group">
        ${navRow('Theme preset', 'Sidenib')}
        ${navRow('Backdrop image', 'None')}
      </ul>`,
  }
}

function settingsView() {
  if (state.settingsPage === 'advanced') return advancedView()
  return {
    title: 'Settings',
    headerActions: `<button type="button" class="sn-text-button" data-act="settings-done">Done</button>`,
    body: `<div class="sn-section-label">Appearance</div>
      <ul class="sn-group">
        ${settingRow('Theme', segmented('appearance', ['System', 'Light', 'Dark']))}
        ${settingRow('Screen edge', segmented('edge', ['Left', 'Top', 'Right']))}
      </ul>
      <div class="sn-section-label">Tasks</div>
      <ul class="sn-group">
        ${settingRow('Sort by', segmented('sort', ['Priority', 'Newest', 'Oldest']))}
        ${settingRow('Show completed', toggle('showCompleted', 'Show completed'))}
        ${settingRow('Tab order', `<span class="sn-row__value">Today, Calendar, Lists</span>${icon('chevronRight')}`)}
      </ul>
      <div class="sn-section-label">Desktop</div>
      <ul class="sn-group">
        ${settingRow('Reminders', toggle('notifications', 'Reminders'))}
        ${settingRow('Launch at login', toggle('launch', 'Launch at login'))}
        ${settingRow('Open or close', '<span class="sn-keys">⌥⇧S</span>')}
      </ul>
      <div class="sn-section-label">More</div>
      <ul class="sn-group">
        ${navRow('Advanced', 'Size, notch, presets', 'data-act="advanced"')}
        <li><button type="button" class="sn-row sn-row--nav sn-row--plain is-danger">
          <div class="sn-row__text"><span class="sn-row__title">Reset settings</span></div></button></li>
      </ul>`,
  }
}

function renderCard() {
  const compact = geometry.compactCalendar
  const view =
    state.view === 'calendar'
      ? calendarView(compact)
      : state.view === 'lists'
        ? listsView()
        : state.view === 'settings'
          ? settingsView()
          : todayView()
  const tabs = [
    ['today', 'Today', 'sun'],
    ['calendar', 'Calendar', 'calendar'],
    ['lists', 'Lists', 'list'],
  ]
  const settingsButton =
    state.view === 'settings'
      ? ''
      : `<button type="button" class="sn-icon-button" data-act="settings" aria-label="Settings">${icon('sliders')}</button>`

  return `
    <header class="sn-header">
      <div class="sn-header__text">
        ${view.back ? `<button type="button" class="sn-text-button" data-act="back" style="margin:0 0 2px -8px">${icon('chevronLeft')}${view.back}</button>` : ''}
        <h1 class="sn-title" id="sn-title">${escapeHtml(view.title)}</h1>
        ${view.subtitle ? `<p class="sn-subtitle">${escapeHtml(view.subtitle)}</p>` : ''}
      </div>
      ${view.headerActions ?? ''}${settingsButton}
    </header>
    ${view.fixed ?? ''}
    <div class="sn-body" id="sn-body" role="tabpanel" tabindex="-1">${view.body}</div>
    ${
      view.quick
        ? `<div class="sn-quick"><label class="sn-field">${icon('plus')}
            <input id="sn-quick-input" type="text" placeholder="${escapeHtml(view.quick)}" aria-label="${escapeHtml(view.quick)}" />
            ${view.quickChip ? `<button type="button" class="sn-chip" data-act="entry-mode" aria-label="Entry type: ${view.quickChip}">${view.quickChip}</button>` : ''}
            <button type="button" class="sn-icon-button" aria-label="Set reminder">${icon('bell')}</button>
          </label></div>`
        : ''
    }
    <div class="sn-tabs" role="tablist" aria-label="Views">
      ${tabs
        .map(
          ([id, label, glyph]) =>
            `<button type="button" class="sn-tab" role="tab" data-tab="${id}" aria-selected="${state.view === id}" tabindex="${state.view === id || (state.view === 'settings' && id === 'today') ? 0 : -1}">${icon(glyph)}${label}</button>`,
        )
        .join('')}
    </div>`
}

function note(text, x, y) {
  const el = document.createElement('div')
  el.className = 'proto-note'
  el.textContent = text
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  stageEl.append(el)
  return el
}

function outline(rect) {
  const el = document.createElement('div')
  el.className = 'proto-outline'
  Object.assign(el.style, {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  })
  stageEl.append(el)
}

function annotate(workArea) {
  const { card, hit, notch, toast } = geometry
  const right = geometry.edge !== 'left'
  const top = geometry.edge === 'top'
  const thickness = top ? notch.height : notch.width
  const length = top ? notch.width : notch.height
  outline(hit)
  outline({ ...workArea, height: workArea.height - 1, width: workArea.width - 1 })
  note(
    `work area ${workArea.width} × ${workArea.height}`,
    workArea.x + 8,
    workArea.y + 8,
  )
  const notchLabel = note(
    `notch ${state.open ? SN.notch.openWidth : thickness} × ${length} visible · hit ${Math.min(hit.width, hit.height)} × ${Math.max(hit.width, hit.height)}`,
    0,
    0,
  )
  const labelWidth = notchLabel.offsetWidth

  if (state.open) {
    const stageCard = stageEl.querySelector('.sn-card')
    const offsetOf = (selector) => {
      const el = stageCard.querySelector(selector)
      return el ? el.offsetTop : null
    }
    const cardLabelX = right ? card.x - 8 : card.x + card.width + 8
    const place = (text, y) => {
      const el = note(text, 0, card.y + y)
      el.style.left = `${right ? cardLabelX - el.offsetWidth : cardLabelX}px`
    }
    place(`card ${card.width} × ${card.height} · radius ${SN.card.radius}`, 0)
    place(`header · title 22/26 bold`, 22)
    if (offsetOf('.sn-cal') !== null) {
      place(
        geometry.compactCalendar ? 'week strip (card < 420)' : 'month grid · fixed',
        offsetOf('.sn-cal') + 8,
      )
    }
    const body = stageCard.querySelector('.sn-body')
    place(
      `body ${body.offsetHeight} high · only scroll region${body.scrollHeight > body.clientHeight ? ` (content ${body.scrollHeight})` : ''}`,
      body.offsetTop + Math.min(40, body.offsetHeight / 2),
    )
    if (offsetOf('.sn-quick') !== null) place('quick add · 36 field', offsetOf('.sn-quick') + 12)
    place('tabs · 36 segmented', offsetOf('.sn-tabs') + 8)
    const gap = note(`${SN.clearance} clearance`, 0, card.y + card.height + 6)
    gap.style.left = `${right ? card.x + card.width - gap.offsetWidth : card.x}px`
    notchLabel.style.left = `${top ? card.x + card.width + 8 : right ? card.x + card.width - labelWidth : card.x}px`
    notchLabel.style.top = `${top ? card.y : card.y - 22}px`
  } else {
    notchLabel.style.left = `${top ? hit.x + hit.width + 8 : right ? hit.x - labelWidth - 8 : hit.x + hit.width + 8}px`
    notchLabel.style.top = `${top ? hit.y + 4 : hit.y - 24}px`
    if (state.toast) {
      const el = note(
        `toast ${toast.width} × ${toast.height} · radius 16 · card stays closed`,
        0,
        toast.y + toast.height + 8,
      )
      el.style.left = `${right ? toast.x + toast.width - el.offsetWidth : toast.x}px`
    }
  }
}

function render() {
  const stage = STAGES[state.stage] ?? STAGES.laptop
  const workArea = {
    x: 0,
    y: stage.menu,
    width: stage.width,
    height: stage.height - stage.menu,
  }
  geometry = computeGeometry(workArea, geometryOptions())
  const { card, hit, toast } = geometry
  const origin =
    state.edge === 'top'
      ? `${geometry.anchor.x - card.x}px 0`
      : `${state.edge === 'right' ? '100%' : '0'} ${geometry.anchor.y - card.y}px`
  const cardVars =
    `--sn-radius-card:${state.adv.panelRadius}px;--sn-row-min-height:${state.adv.taskRowHeight}px;` +
    `--sn-text-body:400 ${state.adv.taskTextSize}px/${Math.round(state.adv.taskTextSize * 1.36)}px var(--sn-font);` +
    `--sn-motion-reveal:${state.reduced ? 120 : state.adv.motionMs}ms;` +
    `background:color-mix(in srgb, var(--sn-surface) ${state.adv.surfaceAlpha}%, transparent)`
  const bodyScroll = document.getElementById('sn-body')?.scrollTop ?? 0

  document.documentElement.dataset.theme = state.theme
  if (state.reduced) document.documentElement.dataset.motion = 'reduced'
  else delete document.documentElement.dataset.motion
  document.body.classList.toggle('is-capture', state.capture)

  stageEl.dataset.wallpaper = state.theme
  stageEl.style.width = `${stage.width}px`
  stageEl.style.height = `${stage.height}px`
  scale = state.capture
    ? 1
    : Math.min(1, wrapEl.clientWidth / stage.width, wrapEl.clientHeight / stage.height)
  stageEl.style.transform = `scale(${scale})`

  const hadCard = stageEl.querySelector('.sn-card')
  const wasOpen = hadCard?.classList.contains('is-open')
  const showToast = state.toast && !state.open

  stageEl.innerHTML = `
    <div class="proto-menubar" style="height:${stage.menu}px"><span>Finder</span><span>File</span><span>Edit</span><span>View</span></div>
    <div class="proto-window" style="left:${Math.round(stage.width * 0.08)}px;top:${stage.menu + 40}px;width:${Math.round(stage.width * 0.58)}px;height:${Math.round((stage.height - stage.menu) * 0.72)}px">
      <i style="top:60px;width:38%"></i><i style="top:84px;width:62%"></i><i style="top:108px;width:51%"></i>
    </div>
    <button type="button" class="sn-notch-hit${state.open ? ' is-open' : ''}${state.toast ? ' has-reminder' : ''}${state.adv.notchVisibility === 'On hover' ? ' is-hover-only' : ''}" id="sn-notch"
      data-edge="${state.edge}" aria-label="${state.open ? 'Close Sidenib' : 'Open Sidenib'}${state.toast ? ', 1 reminder' : ''}"
      aria-expanded="${state.open}" aria-controls="sn-card"
      style="left:${hit.x}px;top:${hit.y}px;width:${hit.width}px;height:${hit.height}px;--sn-notch-width:${state.adv.notchWidth}px;--sn-notch-height:${state.adv.notchHeight}px">
      <span class="sn-notch">${state.toast && !state.open ? '<span class="sn-notch__badge">1</span>' : ''}</span>
    </button>
    <div class="sn-toast${showToast ? ' is-visible' : ''}" data-edge="${state.edge}" role="status" aria-live="polite"
      style="left:${toast.x}px;top:${toast.y}px;width:${toast.width}px;height:${toast.height}px">
      ${icon('bell')}
      <button type="button" class="sn-toast__main" data-act="toast-open" ${showToast ? '' : 'tabindex="-1"'}>
        <strong>Reply to Mara about the venue</strong><span>Due 14:30 · Today</span>
      </button>
      <button type="button" class="sn-text-button" data-act="toast-snooze" ${showToast ? '' : 'tabindex="-1"'}>10 min</button>
      <button type="button" class="sn-icon-button" data-act="toast-done" aria-label="Mark done" ${showToast ? '' : 'tabindex="-1"'}>${icon('check')}</button>
    </div>
    <section class="sn-card${wasOpen && state.open ? ' is-open' : ''}" id="sn-card" data-edge="${state.edge}"
      role="dialog" aria-labelledby="sn-title" tabindex="-1" ${state.open ? '' : 'inert'}
      style="left:${card.x}px;top:${card.y}px;width:${card.width}px;height:${card.height}px;transform-origin:${origin};${cardVars}">
      ${renderCard()}
    </section>`

  const cardEl = stageEl.querySelector('.sn-card')
  const bodyEl = document.getElementById('sn-body')
  bodyEl.scrollTop = Number(params.get('scroll') ?? bodyScroll)
  const syncScrolled = () =>
    cardEl.classList.toggle('is-scrolled', bodyEl.scrollTop > 0)
  bodyEl.addEventListener('scroll', syncScrolled, { passive: true })
  syncScrolled()

  if (state.open && !wasOpen) {
    // Commit the closed style first so the reveal transition runs, then open
    // synchronously: a hidden card cannot receive focus.
    if (!state.capture) cardEl.getBoundingClientRect()
    cardEl.classList.add('is-open')
  }
  if (wasOpen && !state.open && !state.capture) {
    // Replay the dismiss transition on the fresh node.
    cardEl.classList.add('is-open')
    cardEl.getBoundingClientRect()
    cardEl.classList.remove('is-open')
  }

  if (state.annotate) annotate(workArea)
  bindNotch()
  syncControls()
}

function geometryOptions() {
  return {
    edge: state.edge,
    notchY: state.notchY,
    panelWidth: state.adv.panelWidth,
    heightMode: state.adv.heightMode === 'Full' ? 'full' : 'compact',
    notchWidth: state.adv.notchWidth,
    notchHeight: state.adv.notchHeight,
  }
}

// dx is travel away from the docked edge, dy is travel along it.
function gestureAxes(event, drag) {
  const x = (event.clientX - drag.x) / scale
  const y = (event.clientY - drag.y) / scale
  if (state.edge === 'top') return { dx: y, dy: x }
  return { dx: state.edge === 'right' ? -x : x, dy: y }
}

function setOpen(open, { keyboard = false } = {}) {
  if (state.open === open) return
  state.open = open
  if (!open && state.view === 'settings') {
    state.view = state.lastView
    state.settingsPage = null
  }
  render()
  if (open) {
    // Keyboard open lands in quick add; pointer open leaves typing alone.
    const target =
      (keyboard && document.getElementById('sn-quick-input')) ||
      document.getElementById('sn-card')
    target.focus({ preventScroll: true })
  } else {
    document.getElementById('sn-notch').focus({ preventScroll: true })
  }
}

function bindNotch() {
  const notchEl = document.getElementById('sn-notch')
  let drag = null

  notchEl.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    notchEl.setPointerCapture(event.pointerId)
    drag = {
      x: event.clientX,
      y: event.clientY,
      startNotchY: state.notchY,
      lastDx: 0,
      lastTime: event.timeStamp,
      velocity: 0,
      mode: 'pending',
    }
  })

  notchEl.addEventListener('pointermove', (event) => {
    if (!drag) return
    const { dx, dy } = gestureAxes(event, drag)
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime)
    drag.velocity = (dx - drag.lastDx) / elapsed
    drag.lastDx = dx
    drag.lastTime = event.timeStamp
    if (drag.mode === 'pending' || drag.mode === 'pulling') {
      const next = classifyNotchGesture({ dx, dy })
      if (next !== 'pending') drag.mode = drag.mode === 'pulling' ? 'pulling' : next
    }

    const cardEl = document.getElementById('sn-card')
    if (drag.mode === 'pulling' && !state.open) {
      const progress = state.reduced ? (dx >= SN.pull.commit ? 1 : 0) : pullProgress(dx)
      const offset = (1 - progress) * 16 * (state.edge === 'right' ? 1 : -1)
      notchEl.classList.add('is-pulling')
      cardEl.classList.add('is-tracking')
      cardEl.style.opacity = String(progress)
      cardEl.style.transform = `translate${state.edge === 'top' ? 'Y' : 'X'}(${offset}px) scale(${0.96 + 0.04 * progress})`
    } else if (drag.mode === 'reposition' && !state.open) {
      const stage = STAGES[state.stage]
      const height = stage.height - stage.menu
      const travel = state.edge === 'top' ? stage.width : height
      let next = drag.startNotchY + (dy / travel) * 100
      if (Math.abs(next - 50) <= SN.snapCenter) next = 50
      state.notchY = Math.min(100, Math.max(0, next))
      const g = computeGeometry(
        { x: 0, y: stage.menu, width: stage.width, height },
        geometryOptions(),
      )
      notchEl.style.left = `${g.hit.x}px`
      notchEl.style.top = `${g.hit.y}px`
    }
  })

  const finish = (event) => {
    if (!drag) return
    const { dx } = gestureAxes(event, drag)
    const mode = drag.mode
    const velocity = drag.velocity
    drag = null
    const cardEl = document.getElementById('sn-card')
    cardEl.classList.remove('is-tracking')
    cardEl.style.opacity = ''
    cardEl.style.transform = ''
    notchEl.classList.remove('is-pulling')

    if (event.type === 'pointercancel') return render()
    if (mode === 'reposition') return render()
    const result =
      mode === 'pending'
        ? 'click'
        : classifyNotchGesture({ dx, dy: 0, velocity, released: true })
    if (result === 'click') setOpen(!state.open)
    else if (result === 'open') setOpen(true)
  }
  notchEl.addEventListener('pointerup', finish)
  notchEl.addEventListener('pointercancel', finish)
  // Keyboard activation (Enter/Space) arrives as a click with detail 0.
  notchEl.addEventListener('click', (event) => {
    if (event.detail === 0) setOpen(!state.open, { keyboard: true })
  })
}

function clearToast() {
  state.toast = false
  window.clearTimeout(toastTimer)
  render()
}

stageEl.addEventListener('click', (event) => {
  const target = event.target.closest('button')
  if (!target || target.id === 'sn-notch') return
  const act = target.dataset.act

  if (target.dataset.tab) {
    state.view = target.dataset.tab
    state.lastView = state.view
    state.list = null
  } else if (act === 'settings') {
    state.lastView = state.view
    state.view = 'settings'
  } else if (act === 'settings-done') {
    state.view = state.lastView
    state.settingsPage = null
  } else if (act === 'advanced') {
    state.settingsPage = 'advanced'
  } else if (act === 'back') {
    if (state.view === 'settings') state.settingsPage = null
    else state.list = null
  } else if (target.dataset.advChoice) {
    state.adv[target.dataset.advChoice] = target.dataset.value
  } else if (act === 'toggle-completed') {
    state.completedOpen = !state.completedOpen
  } else if (act === 'entry-mode') {
    state.entryMode = state.entryMode === 'Task' ? 'Event' : 'Task'
  } else if (act === 'toast-open') {
    state.view = 'today'
    state.toast = false
    return setOpen(true, { keyboard: event.detail === 0 })
  } else if (act === 'toast-snooze' || act === 'toast-done') {
    return clearToast()
  } else if (target.dataset.listId) {
    state.list = target.dataset.listId
  } else if (target.dataset.day) {
    state.selectedDay = Number(target.dataset.day)
  } else if (target.dataset.setting) {
    state.settings[target.dataset.setting] = target.dataset.value
    if (target.dataset.setting === 'appearance' && target.dataset.value !== 'System') {
      state.theme = target.dataset.value.toLowerCase()
    }
    if (target.dataset.setting === 'edge') state.edge = target.dataset.value.toLowerCase()
  } else if (target.dataset.switch) {
    state.settings[target.dataset.switch] = !state.settings[target.dataset.switch]
  } else if (target.classList.contains('sn-check')) {
    const row = target.closest('.sn-row')
    const done = row.classList.toggle('is-done')
    target.setAttribute('aria-checked', String(done))
    return
  } else {
    return
  }
  render()
  const focusTarget =
    (target.dataset.tab && stageEl.querySelector(`[data-tab="${target.dataset.tab}"]`)) ||
    document.getElementById('sn-card')
  focusTarget.focus({ preventScroll: true })
})

stageEl.addEventListener('keydown', (event) => {
  if (event.target.id === 'sn-quick-input' && event.key === 'Enter') {
    const title = event.target.value.trim()
    const list = stageEl.querySelector('[data-list="today"]')
    if (title && list) {
      list.insertAdjacentHTML('afterbegin', taskRow({ title }))
      event.target.value = ''
    }
  }
  if (event.target.matches?.('.sn-tab') && /^Arrow(Left|Right)$/.test(event.key)) {
    const tabs = [...stageEl.querySelectorAll('.sn-tab')]
    const step = event.key === 'ArrowRight' ? 1 : -1
    tabs[(tabs.indexOf(event.target) + step + tabs.length) % tabs.length].click()
  }
})

document.addEventListener('keydown', (event) => {
  if (event.altKey && event.code === 'KeyT' && !event.metaKey && !event.ctrlKey) {
    event.preventDefault()
    setOpen(!state.open, { keyboard: true })
  } else if (event.key === 'Escape' && state.open) {
    const input = document.getElementById('sn-quick-input')
    // Escape peels one layer: a draft first, then the card.
    if (document.activeElement === input && input.value) input.value = ''
    else setOpen(false)
  }
})

function syncControls() {
  for (const group of document.querySelectorAll('[data-control]')) {
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute(
        'aria-pressed',
        String(state[group.dataset.control] === button.dataset.value),
      )
    }
  }
  const toggles = {
    toast: state.toast,
    reduced: state.reduced,
    annotate: state.annotate,
  }
  for (const button of document.querySelectorAll('[data-toggle]')) {
    button.setAttribute('aria-pressed', String(toggles[button.dataset.toggle]))
  }
}

document.querySelector('.proto-bar').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  const control = button.parentElement.dataset.control
  if (control) {
    state[control] = button.dataset.value
    if (control === 'edge') {
      state.settings.edge = { left: 'Left', top: 'Top', right: 'Right' }[state.edge]
    }
  } else if (button.dataset.toggle === 'toast') {
    state.toast = !state.toast
    window.clearTimeout(toastTimer)
    // After 8 s the toast folds back into the notch badge. It never opens the card.
    if (state.toast) {
      toastTimer = window.setTimeout(() => {
        stageEl.querySelector('.sn-toast')?.classList.remove('is-visible')
      }, 8000)
    }
  } else if (button.dataset.toggle === 'reduced') state.reduced = !state.reduced
  else if (button.dataset.toggle === 'annotate') state.annotate = !state.annotate
  render()
})

// Sliders update their label while dragging and apply on release, so the
// re-render does not interrupt the drag.
stageEl.addEventListener('input', (event) => {
  const key = event.target.dataset?.adv
  if (key) event.target.nextElementSibling.textContent = event.target.value
})
stageEl.addEventListener('change', (event) => {
  const key = event.target.dataset?.adv
  if (!key) return
  state.adv[key] = Number(event.target.value)
  render()
  stageEl.querySelector(`[data-adv="${key}"]`)?.focus({ preventScroll: true })
})

window.addEventListener('resize', render)
render()
