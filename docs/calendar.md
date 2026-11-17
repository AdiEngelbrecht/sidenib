# Calendar view

Task ADIEN-163. This polishes the calendar that [the views task](views.md)
extracted, to section 5 (Calendar) of the
[compact design contract](design/compact/README.md). What the calendar does is
unchanged: a month, a selected day, tasks and events on that day, capture onto
it, and the unscheduled backlog. The props are the ones in `views.md`; nothing
outside `src/views/calendar/` and `src/calendar/` changed.

## Reference frames

Captured from the running app in Chromium at the real card sizes, with the
clock fixed at Monday 16 November 2026, 10:00.

| State | 340 × 480, month | 340 × 400, one week |
| --- | --- | --- |
| Today selected | [light](design/calendar/month-light.png), [dark](design/calendar/month-dark.png) | [light](design/calendar/week-light.png), [dark](design/calendar/week-dark.png) |
| Another day selected | [light](design/calendar/month-selected-light.png), [dark, an overdue day](design/calendar/month-selected-dark.png) | |
| Keyboard focus on a day | [light](design/calendar/month-focus-light.png) | |
| Five-week month | [December](design/calendar/month-five-weeks-light.png) | |
| Long agenda, scrolled | [light](design/calendar/month-long-agenda-light.png) | [dark](design/calendar/week-long-agenda-dark.png) |
| Week across the year boundary | | [week 53](design/calendar/week-year-boundary-light.png) |

Regenerate them with a dev server running:

```bash
SIDENIB_TEST_URL=http://127.0.0.1:5183 node docs/design/calendar/capture-frames.mjs
```

## What a day looks like

Each state has a cue besides colour, and the same words in its accessible name.

| State | Cue | Announced as |
| --- | --- | --- |
| Today | Gold filled disc, bold number | "Today, …", `aria-current="date"` |
| Selected | 1.5 px ink ring, semibold number | `aria-selected="true"` |
| Outside the month | 12 px number instead of 14, tertiary ink | the full date, with its own month |
| Scheduled, something open | 4 px dot under the number | "2 scheduled" |
| Scheduled, something overdue | 10 × 3 bar in the danger colour | "2 scheduled, 1 overdue" |
| Scheduled, everything done | hollow 5 px dot | "1 scheduled, 1 done" |

On today's gold disc the mark is ink in both themes.

## Navigation

- **Month** (card 420 or taller): the arrows are "Previous month" and "Next
  month". The grid draws only the weeks the month needs: four for a 28-day
  February that starts on a Monday, six for a long month that starts late in
  the week, otherwise five. The agenda gets the rows a short month frees.
- **Week** (card shorter than 420): one week, and the arrows are "Previous
  week" and "Next week". The title is the month that holds the week's
  Thursday and the secondary line is the year and ISO week, so 28 December
  2026 to 3 January 2027 reads "December, 2026 · Week 53".
- Moving the period never changes the selected day. **Today** selects today
  and shows it. Picking a day of the next or previous month turns to it.
- **Keyboard.** The grid is one tab stop (the day you last moved to, else the
  selected day, else today). Arrow keys move by day and week, Home and End go
  to Monday and Sunday, Page Up and Page Down move a month, with Shift a year.
  A move past the edge of the period turns the page and focus follows. Enter
  or Space selects. A month step keeps the day and clamps it: Page Up from
  31 March 2028 is 29 February; Shift + Page Down from there is 28 February
  2029.

## Agenda

- The heading is the day with its weekday ("Mon 16 Nov", with the year when
  it is not this year) and the counts that are not zero.
- Order: time; at the same time events before tasks; then the user's sort
  preference (priority, newest, oldest); then the order of creation. Quick
  capture puts entries at 09:00, so the tie rules matter. Completing an entry
  does not move it. `compareAgendaEntries` in `src/calendar/dates.ts`.
- The body is the only scrolling region. Selecting another day returns it to
  the top, and an entry captured onto the selected day is scrolled into view.

## Date helpers

`src/calendar/dates.ts` gained `addDays`, `shiftMonthKeepingDay`,
`startOfWeek`, `weekAnchor`, `isoWeekNumber`, `parseDateKey`, `daysInMonth`,
`buildMonthWeeks`, `buildWeek`, `formatAgendaDay`, `formatFullDay` and
`compareAgendaEntries`. Everything the other views import (`formatDateKey`,
`parseReminderDate`, `toLocalDateTimeValue`, `formatCalendarDay`,
`formatLongDay`, `addMonths`, `buildCalendarDays`) keeps its signature and
result. `useNow` is untouched.

## Verification

```bash
npm run verify && npm run lint && npm run build
npm run test:smoke                     # includes tests/calendar.spec.ts
npx playwright test tests/calendar.spec.ts --browser=webkit
```

`tests/calendar.spec.ts` checks the helpers (leap days, month and year
boundaries, four, five and six-week months, ISO weeks, agenda order) and, in
the browser at 340 × 480 and 340 × 400: the day states in light and dark,
month and week navigation across the year, the keyboard, leap day 2028,
capture, complete, rename, reschedule and delete on a selected day, and a
14-entry agenda scrolling inside the card.

Not checked: the native window on macOS and Windows with this view, WebView2,
and VoiceOver or Narrator output. In WebKit, Tab reaches buttons (the days
included) only with Option held or with the system keyboard-navigation
setting on; that is the platform's rule for every button in the card.
