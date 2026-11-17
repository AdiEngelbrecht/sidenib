# Sidenib compact design contract

Task ADIEN-159. This is the single visual and interaction specification for the
compact Sidenib shell. Every later workspace (shell, Today and Lists, Calendar,
Settings, reminders) builds to this document. Nothing here changes production
code: `src/`, `src-tauri/` and the Sidenib brand assets are untouched.

Sidenib is a task utility. Apple's iPhone Notes guides how it looks. It does
not gain a rich-text notes feature.

## What is in this folder

| File | Purpose |
| --- | --- |
| [tokens.css](tokens.css) | Light and dark design tokens. Copied unchanged to `src/design/tokens.css`. |
| [geometry.js](geometry.js) | Reference placement and gesture rules, with a self-check. Ported to `src/shell/geometry.ts`. |
| [prototype.html](prototype.html) | Static, clickable prototype of every state. Open it in a browser; no server or build needed. |
| [prototype.css](prototype.css), [prototype.js](prototype.js) | Prototype styles and behaviour. Classes prefixed `sn-` are the product surface; `proto-` is review chrome. |
| [capture-frames.mjs](capture-frames.mjs) | Regenerates [frames/](frames/) and runs the browser checks listed under Verification. |
| [frames/](frames/) | 22 reference frames, most annotated, plus measured [metrics.json](frames/metrics.json). |
| [baseline/](baseline/) | Screenshots of the v0.1.14 baseline used for the audit. |

If this document and the prototype disagree, this document wins and the
prototype is a bug.

## 1. Baseline audit: why v0.1.14 feels large and rectangular

Measured in the v0.1.14 web preview at 1440 × 900 and 1280 × 600 logical pixels,
and read from `src/App.tsx`, `src/App.css`, `src/sidebarSettings.ts` and
`src-tauri/src/lib.rs`.

![v0.1.14 Today at 1440 × 900](baseline/v0.1.14-laptop-today.png)

| Finding | Baseline value | Effect |
| --- | --- | --- |
| The panel is as tall as the screen | 400 wide × 100% of the work area (`targetHeight = workArea.size.height`) | Three tasks occupy a 900-high column. Most of the surface is empty, and it reads as a docked sidebar. |
| The panel is flush with three screen edges | Top, right and bottom offsets are 0; only the two left corners show the 18 radius | The shape is a rectangle with a rounded side. No corner radius can make a full-height strip feel like a card. |
| A second full-height strip | Navigation rail 46 × 900 inside the panel | Adds a second vertical band and a hard internal line. |
| The closed handle is a visible button | 42 × 84 with an icon and shadow | Always-present chrome on the desktop, roughly 3.5 times the width the brief asks for. |
| Nested boxes | Bordered quick-add box, bordered task group, bordered calendar board, bordered day summary pills, bordered Task/Event switch | Five box styles on one screen. Separators are doing the work that spacing should do. |
| Small, heavy type | Task title 12.5 px at weight 680; Inter is requested but not bundled, so it falls back | Dense and loud at the same time. Not a system-native reading size. |
| Action icons always visible | Four icons on every row: edit, priority, reminder, delete | A three-row list shows twelve controls before the user has asked for one. |
| Cool blue on cool grey | Accent near `#2563EB`, surfaces `#F5F6F7` to `#FFFFFF` | Unrelated to the Sidenib paper, gold and ink identity. |
| The calendar does not fit a short display | At 1280 × 600 the month, day summary and entry switch push the add field to the bottom edge; the agenda is below the fold | The view only works because the panel is full height. |
| Settings are a control panel | 9 theme presets and 13 sliders for width, radius, opacity, row height, text size, motion and backdrop | The user is asked to do the design work. The window scrolls well past two screens. |
| A full-height transparent native window | 442 wide × screen height, with cursor pass-through polled every 72 to 128 ms | Needed only because the panel is full height. A card-sized window removes the polling. |

Other baseline screens: [closed](baseline/v0.1.14-laptop-closed.png),
[calendar](baseline/v0.1.14-laptop-calendar.png),
[lists](baseline/v0.1.14-laptop-lists.png),
[settings](baseline/v0.1.14-laptop-settings.png),
[calendar at 600 high](baseline/v0.1.14-short-calendar.png).

### What stays from the baseline

Local-first storage, the `Task` model, Today, Calendar with task and event
entries, custom lists with "show on Today", inline reminders with snooze, the
focus/normal/later priority, sort order, tab order, launch at login, the tray
menu, `Alt+T` with `Alt+Shift+T` as fallback, dragging the handle along the
edge, and reminders that never open the panel by themselves.

## 2. iPhone Notes reference

The reference is the first-party Notes app on iPhone, together with Apple's
published guidance on
[typography](https://developer.apple.com/design/human-interface-guidelines/typography),
[colour](https://developer.apple.com/design/human-interface-guidelines/color) and
[lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables).
The traits below are observations of the app, not pixel samples, and no Apple
screenshots or artwork are stored in this repository. Sidenib borrows the
language, not the assets.

| Trait | iPhone Notes | v0.1.14 | Sidenib compact |
| --- | --- | --- | --- |
| Typography | System font. One large bold title per screen, regular-weight body, small grey secondary line. | 12.5 px at weight 680 for content; several competing bold labels. | System font. One 22 px bold title per view, 14 px regular body, 12 px secondary line. |
| Surfaces | A warm off-white grouped background with lighter rounded groups on top. Depth comes from two tones, not borders. | White and cool grey, separated by 1 px borders. | Paper `#F6F2E9` card, lighter `#FFFDF7` groups, darker `#EBE6DA` fields. No bordered boxes. |
| Accent | Yellow-gold for the things you can act on and for filled checklist circles. Everything else is ink or grey. | Blue on buttons, checks, progress bar, active rail item and focus. | Gold `#F6C445` only as a fill: today, checked circle, switch, reminder, open notch. Dark amber `#805A00` where gold must be text. |
| Spacing | Generous outer margins, compact rows of about 44 pt. | 20 px margins but 48 px rows packed with icons. | 12 to 16 px margins, 44 px rows, actions hidden until hover or focus. |
| Separators | Hairlines inset to the text edge, never full width, never boxed. | Full-width borders around and between everything. | 0.5 px hairline at 10% ink, inset to the text edge. |
| Checklists | Outlined circle; filled gold with a check when done; done text dims. | Blue filled circle; done text struck through. | Same as Notes. Done text dims to secondary ink, no strike-through. |
| Navigation | A back chevron with the parent's name, in gold. | Icon rail. | Three-segment control at the bottom; a gold back label inside Lists. |

## 3. Geometry

All values are logical pixels. [geometry.js](geometry.js) is the reference
implementation; `node docs/design/compact/geometry.js --check` proves the rules
on eight work areas.

![Collapsed notch with hit target](frames/01-collapsed.png)

| Element | Value | Brief range | Reason |
| --- | --- | --- | --- |
| Notch, visible | 12 × 48, inner corners radius 6, flush with the screen edge | 10–14 × 44–52 | Mid-range. 12 is the narrowest width that still shows a rounded end at 1×. |
| Notch, hover or pulling | 14 × 48 | within range | Confirms the pointer is on it without opening anything. |
| Notch, card open | 6 × 48, gold | revised | It must fit inside the 10 clearance beside the card and still read as the close control. |
| Notch hit target | 28 × 72, centred on the notch, extends inward only | "practical hit target" | 28 wide is reachable when the pointer is thrown at the screen edge (the edge itself is infinitely deep). 72 high tolerates vertical error. It covers 28 × 72 of the desktop, which is less than the baseline's visible 42 × 84 handle. |
| Default notch position | 50% of the work-area height | 50% | As briefed. Within ±3% of centre it snaps to 50%. |
| Open card | 340 × 480 | about 340 × 480 | As briefed. |
| Card radius | 24 | 22–26 | Mid-range. Groups inside use 12 and controls 10, so every nested radius is half or less of its parent. |
| Edge clearance | 10 on every side | 8–12 | Mid-range. It is what makes the card a card: all four corners are visible. |
| Reminder toast | 296 × 60, radius 16, 8 from the notch | not briefed | Wide enough for a 20-character title plus two actions. |

### Sizing inside the work area

The work area is the monitor minus the menu bar, Dock or taskbar
(`monitor.workArea` in Tauri).

```text
cardWidth  = min(340, workArea.width  − 2 × 10)
cardHeight = min(480, workArea.height − 2 × 10)
cardX      = workArea.right − 10 − cardWidth          (right edge)
cardY      = clamp(notchCentreY − cardHeight / 2,
                   workArea.top + 10,
                   workArea.bottom − 10 − cardHeight)
```

- The card is centred on the notch, then pushed back inside the work area. A
  notch dragged to the top or bottom never produces a clipped card.
- The card height never depends on content. A list of 500 tasks produces the
  same 340 × 480 card as an empty one.
- Below 420 card height the Calendar shows one week instead of the month. This
  applies to work areas shorter than 440, which no supported laptop has, but
  it keeps the rule total.
- A work area shorter than 340 is not supported; the card still clamps and
  scrolls.

| Work area | Card | Notes |
| --- | --- | --- |
| 1440 × 875 (13-inch MacBook, Dock hidden) | 340 × 480 | [frame](frames/19-fit-laptop.png) |
| 1280 × 575 (short display) | 340 × 480 | [frame](frames/20-fit-short.png); 47 px spare above and below |
| 1366 × 728 (Windows laptop) | 340 × 480 | self-check |
| 1024 × 420 (very short) | 340 × 400, week-strip calendar | [calendar](frames/21-fit-tiny.png), [long list](frames/22-fit-tiny-long.png) |

### Native window

The shell workspace should size the window to what is drawn instead of the
full screen height:

| Mode | Window rectangle |
| --- | --- |
| Collapsed | the 28 × 72 hit target |
| Toast | hit target plus toast, with a 28 px shadow margin |
| Open | hit target plus card, with a 28 px shadow margin (378 × 536 at default size) |

The window jumps to its final rectangle and the card animates inside it. The
16 px reveal travel fits inside the 28 px margin. This replaces the baseline's
per-frame native window animation and removes the cursor pass-through polling.
The margin is clipped at the work-area edge.

## 4. Card anatomy

![Open Today, annotated](frames/02-today-populated.png)

Top to bottom at 340 × 480:

| Region | Height | Content |
| --- | --- | --- |
| Header | 65 with a secondary line, 56 without | View title (22/26 bold), one secondary line, up to three trailing actions of 28 × 28. Settings is always the last action. |
| Fixed area | 0, or 197 in Calendar | Weekday labels, six 28 px week rows and a hairline. Does not scroll. |
| Body | the remainder: 317 in Today | The only scrolling region. `overflow-y: auto`, `overscroll-behavior: contain`. A hairline appears under the header once scrolled. |
| Quick add | 48 (36 field) | Present in Today, Calendar and list detail. Absent in the Lists index and Settings. |
| Tabs | 50 (36 control) | One segmented control: Today, Calendar, Lists, in the user's tab order. |

Rules:

- Exactly two surface levels inside the card: the card and one group. No group
  inside a group, no bordered boxes.
- One group style, one field style, one segmented style, one switch, one icon
  button, one text button. Views do not introduce variants.
- A task row is 44 high with one line, 52 with a reminder line. The title wraps
  to two lines and then truncates with an ellipsis; an unbroken token wraps
  instead of overflowing.
- Row actions (reminder, more) appear on hover and on keyboard focus, laid over
  the row's trailing edge so nothing shifts. "More" holds rename, priority and
  delete. Delete asks for confirmation as it does today.
- The focus priority shows as a 7 px gold dot at the trailing edge. Normal and
  later show nothing.
- Icons are `lucide-react` (already a dependency) at 16 px with 1.75 stroke.
  No emoji, no second icon set.
- The brand name does not appear inside the card. The title is the view name.
  The Peek mark is for the app icon and the menu bar only.

## 5. States

### Collapsed

[frame](frames/01-collapsed.png). Only the 12 × 48 notch is drawn. Colour is ink
at 42% opacity in light, paper at 50% in dark. It carries no icon and no label.
With an unread reminder it turns gold and shows a 16 px count badge.

### Today

| State | Frame | Specification |
| --- | --- | --- |
| Populated | [02](frames/02-today-populated.png) | Subtitle "Monday 16 November · 4 open". One group of open tasks, then one labelled group per list pinned to Today, then a collapsed "Completed · n" disclosure. |
| Empty | [03](frames/03-today-empty.png) | Centred in the body: "Nothing for today" (15/20 semibold) and one line naming the two ways to add a task. No illustration. Quick add stays in place. |
| Long title | [04](frames/04-today-long.png) | Two-line clamp, then ellipsis. The full title is available through rename and as a tooltip. |
| Long list | [04](frames/04-today-long.png), [scrolled](frames/05-today-long-scrolled.png) | 18 tasks give 903 px of content in a 317 px body. The card stays 480 high. Header, quick add and tabs stay fixed. |
| Overdue | [06](frames/06-today-overdue.png) | An "Overdue · n" group first, label and due line in the danger colour, title in normal ink. Oldest first. The Today group follows under its own label. |
| Completed | [07](frames/07-today-completed.png) | Checked circle filled gold, title in secondary ink. When everything is done: "All done" and the Completed group expanded. Hidden entirely when "Show completed" is off. |

### Calendar

![Calendar, annotated](frames/08-calendar.png)

- Title is the month, secondary line is the year. Trailing actions: previous,
  next, "Today", settings.
- Month grid: 7 columns, weeks start on Monday, 28 px rows, single-letter
  weekday labels. The grid is fixed; only the agenda below it scrolls.
- Today is a gold filled circle with ink text. The selected day has a 1.5 px
  ink ring. A day with entries has a 3 px dot below the number; red when any
  entry is overdue. Days outside the month are tertiary ink.
- Agenda: the selected day's label, then one group of tasks and events sorted
  by time. Events are ordinary rows whose secondary line is a time range. At
  480 high a six-week month leaves about 121 px, which is two rows and a visible
  part of the third; a five-week month leaves 149 px. This is the tightest
  budget in the design and is accepted because the card must not grow.
- Quick add reads "Add to 16 Nov". A chip inside the field switches between
  Task and Event, replacing the baseline's full-width switch.
- Unscheduled tasks ("backlog" in the baseline) follow the agenda in the same
  scrolling body under their own label.
- Card height below 420: the grid shows only the week containing the selected
  day. Previous and next move by week. [frame](frames/21-fit-tiny.png)

### Lists

- Index, [frame](frames/09-lists.png): one group, one row per list with its
  open count and a chevron. Trailing header action "New list". No quick add.
- Detail, [frame](frames/10-list-detail.png): gold "‹ Lists" back label above
  the list title. Secondary line shows the open count and "shown on Today" when
  pinned. The header's "more" action holds rename, show on Today and delete.
  Quick add reads "New task in Groceries".

### Settings

[light](frames/11-settings.png) is the same layout as
[dark](frames/16-dark-settings.png). Settings is a view inside the card, not a
drawer and not a window. It is opened from the header action or the tray menu;
"Done" returns to the previous view. Grouped rows:

| Group | Row | Control |
| --- | --- | --- |
| Appearance | Theme | System, Light, Dark |
| Appearance | Screen edge | Left, Right |
| Tasks | Sort by | Priority, Newest, Oldest |
| Tasks | Show completed | switch |
| Tasks | Tab order | pushes a three-row reorder list |
| Desktop | Reminders | switch |
| Desktop | Launch at login | switch |
| Desktop | Open or close | shows the shortcut, read-only |
| Reset | Reset settings | danger text, confirms first |

Settings that are removed, and the fixed value that replaces each:

| `SidebarSettings` field | Decision | Replacement |
| --- | --- | --- |
| `panelWidth`, `panelRadius`, `tabWidth`, `handleHeight` | remove | Geometry tokens in section 3 |
| `taskRowHeight`, `taskGap`, `taskTextSize` | remove | Type and space tokens |
| `motionMs` | remove | Motion tokens; the system reduced-motion setting is honoured |
| `surfaceAlpha`, `backdropImage`, `backdropImageName`, `backdropOpacity`, `backdropBlur`, `backdropDim` | remove | Solid token surfaces |
| `visualStyle` and the nine presets | remove | One Sidenib theme in light and dark |
| `tabVisibility` | remove | The notch is always visible; at 12 px there is nothing to hide |
| `theme` | extend | `'system' \| 'light' \| 'dark'`, default `'system'` |
| `dockEdge` | narrow | `'right' \| 'left'`; a stored `'top'` becomes `'right'` |
| `handleY` | keep | Notch centre, percent of work-area height |
| `showCompleted`, `launchAtLogin`, `notificationsEnabled`, `taskSortMode`, `sectionOrder` | keep | unchanged |

Removed fields are dropped by the sanitiser when old settings are read; nothing
else migrates.

### Reminder toast

![Reminder toast beside the closed notch](frames/12-reminder-toast.png)

- A due reminder never opens the card and never takes keyboard focus.
- Card closed: the notch turns gold with a count badge, and a 296 × 60 toast
  slides out beside it. It shows the task title on one line, the due time, a
  "10 min" snooze and a "done" check. After 8 seconds it folds back into the
  notch; the badge stays until every reminder is snoozed, completed or opened.
- Several reminders: the toast shows the most recent one and "+2 more" in the
  secondary line. The badge shows the count, "9+" above nine.
- Clicking the toast body is a deliberate action: it opens the card on the view
  that holds the task (Today, or Calendar on the task's date).
- Card already open: no toast. A gold banner appears at the top of the current
  view's body with the same title and actions,
  [frame](frames/13-reminder-banner.png). The view does not switch and the
  scroll position does not move.
- The toast is `role="status"` with `aria-live="polite"`.
- Reminders off in Settings: no toast, no badge, no banner.

### Dark and left edge

[Today with overdue](frames/14-dark-today.png),
[calendar](frames/15-dark-calendar.png),
[settings](frames/16-dark-settings.png),
[toast](frames/17-dark-toast.png). On the left edge everything mirrors:
[frame](frames/18-left-edge.png).

## 6. Tokens

[tokens.css](tokens.css) is the complete system: 5 type styles, 5 spacing
steps, 6 radii, 13 colours per theme, 2 shadows and 3 durations. Components use
tokens only; a raw colour or pixel radius in a component is a defect.

| Group | Tokens |
| --- | --- |
| Type | `--sn-font` (platform system stack), title 22/26 bold, headline 15/20 semibold, body 14/19 regular, caption 12/16 regular, micro 11/14 semibold |
| Space | 4, 8, 12, 16, 20 |
| Radius | card 24, toast 16, group 12, control 10, notch 6, pill |
| Surfaces | `--sn-surface`, `--sn-surface-raised`, `--sn-surface-sunken`, `--sn-surface-hover` |
| Ink | `--sn-ink`, `--sn-ink-secondary`, `--sn-ink-tertiary` |
| Lines | `--sn-separator` (10% ink hairline), `--sn-border` (14% ink, control edges only) |
| Accent | `--sn-accent` (fill), `--sn-accent-ink` (on gold), `--sn-accent-text` (gold as text) |
| Status | `--sn-danger` |
| Focus | `--sn-focus`: 2 px outline, 2 px offset, on every focusable element |
| Icons | 16 px, stroke 1.75 |
| Motion | reveal 220 ms, dismiss 180 ms, quick 120 ms |

Measured contrast (WCAG ratio):

| Pair | Light | Dark |
| --- | --- | --- |
| Ink on card | 13.4 | 14.5 |
| Secondary ink on card | 5.5 | 6.9 |
| Secondary ink on field | 5.0 | n/a |
| Secondary ink on group | n/a | 5.9 |
| Gold-as-text on card | 5.6 | 10.2 |
| Danger on group | 6.3 | 6.1 |
| Ink on gold fill | 9.2 | 9.2 |
| Tertiary ink on card | 3.3 | 3.9 |

Tertiary ink is for outside-month days, disabled controls and the unchecked
circle only. It is never used for text the user needs to read; completed tasks
and placeholders use secondary ink. Gold on paper is 1.5 and is therefore never
text, an outline or the only carrier of meaning in light mode.

### Motion

| Change | Duration and curve | What moves |
| --- | --- | --- |
| Card reveal | 220 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` | Opacity 0 to 1, 16 px toward the screen centre, scale 0.96 to 1. The origin is the notch, so the card grows out of it. |
| Card dismiss | 180 ms, `cubic-bezier(0.4, 0, 1, 1)` | The reverse. |
| Inward pull | follows the pointer | The same three properties, driven by pull distance over 120 px. |
| Toast in and out | 220 ms and 180 ms | Opacity and 16 px. |
| Notch width, check fill, switch, hover | 120 ms | One property each. |
| Changing tab | 120 ms | Opacity cross-fade. No slide. |

There is no bounce, no overshoot and no stagger. Keyboard input is never
blocked by an animation.

Reduced motion (`prefers-reduced-motion: reduce`): reveal, dismiss and toast
become a 120 ms opacity fade with no travel and no scale. The inward pull stops
tracking the pointer; the card fades in when the pull passes the commit
distance.

## 7. Interaction

| Input | Result |
| --- | --- |
| Hover the notch | It widens to 14 and darkens. Nothing opens. |
| Click the notch (press and release within 6 px) | Toggles the card. |
| Pull inward from the notch | After 6 px of mostly horizontal travel the card follows the pointer. Release at 48 px or more, or with an inward flick faster than 0.5 px/ms, and it opens. Release earlier and it closes back. |
| Drag along the edge from the notch | After 6 px of mostly vertical travel the notch moves with the pointer and the position is saved on release (`handleY`). Snaps to centre within ±3%. Only while the card is closed. |
| `Alt+T`, or `⌥T` on macOS; fallback `Alt+Shift+T` | Toggles the card from any app. |
| Tray icon click, tray "Open / Close" | Toggles the card. Tray "Settings" opens the card on Settings. |
| `Escape` | Peels one layer at a time: an open menu, popover or inline rename; then a non-empty quick-add draft; then the card. |
| Click the gold 6 px notch while open | Closes the card. |
| Click elsewhere on the desktop | The card stays open, as in the baseline. It closes only by notch, shortcut, tray or Escape. |
| Left and right arrows on a tab | Move between Today, Calendar and Lists. |
| `Enter` in quick add | Adds the task and keeps focus in the field. |

Focus:

- Opened by keyboard (shortcut, or Enter or Space on the notch): focus goes to
  the quick-add field, or to the first control when the view has none.
- Opened by pointer or toast click: focus goes to the card itself, not to the
  text field.
- Closed: inside the web view, focus returns to the notch. Natively, the app
  that was frontmost before the card opened becomes frontmost again. The shell
  workspace must record it on open and restore it on close; on macOS a
  non-activating panel achieves the same result.
- While the card is closed its content is `inert`: not focusable, not exposed
  to assistive technology.
- The notch is a `button` with `aria-expanded`, `aria-controls` and a label of
  "Open Sidenib" or "Close Sidenib", plus the reminder count when there is one.
  The card is a `dialog` labelled by the view title. It is not modal.

No surprise opening: the card opens only from a click, a completed pull, the
shortcut, the tray, or a click on a toast. Hover, reminders, launch at login,
display changes and adding a task from elsewhere never open it.

## 8. Component interfaces and file ownership

`src/App.tsx` (4,577 lines) and `src/App.css` (5,592 lines) are split as
follows. Each workspace owns the listed paths and edits nothing else without
agreement.

| Path | Owner | Contents |
| --- | --- | --- |
| `src/design/tokens.css` | Shell | Copy of [tokens.css](tokens.css). Changes start in this folder. |
| `src/shell/geometry.ts` | Shell | Port of [geometry.js](geometry.js), same constants, with unit tests of the eight self-check cases. |
| `src/shell/` (`NotchHandle.tsx`, `PanelCard.tsx`, `PanelView.tsx`, `ViewTabs.tsx`, `useShell.ts`, `useNotchGesture.ts`, `shell.css`) | Shell | Notch, card frame, tabs, open and close state, focus rules, native window sizing. |
| `src/components/` (`TaskRow.tsx`, `Group.tsx`, `QuickAdd.tsx`, `EmptyState.tsx`, `Segmented.tsx`, `Switch.tsx`, `IconButton.tsx`) | Shell lands them; all views consume them | The shared primitives. Views do not fork or restyle them. A missing variant is added here. |
| `src/views/today/`, `src/views/lists/` | Today and Lists | The two task views and list management. |
| `src/views/calendar/`, `src/calendar/dates.ts` | Calendar | The view, plus the date helpers moved out of `App.tsx` (`buildCalendarDays`, `formatDateKey`, `addMonths` and related). |
| `src/views/settings/`, `src/sidebarSettings.ts` | Settings | The view, the settings type, and the sanitiser changes in section 5. |
| `src/reminders/` (`useReminders.ts`, `ReminderToast.tsx`, `ReminderBanner.tsx`) | Reminders, or Shell if there is no separate task | The due check moved out of `App.tsx`, the toast and the banner. |
| `src/App.tsx` | Shell | Becomes composition only. Other workspaces add one view import each. |
| `src/App.css` | Shell | Retired as views move. No new rules are added to it. |
| `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json` | Shell for window size and position; Identity for names and identifiers | See cross-workspace notes. |

```ts
// src/shell/types.ts
export type ViewId = 'today' | 'calendar' | 'lists'
export type Route =
  | { view: 'today' }
  | { view: 'calendar'; dateKey?: string } // 'YYYY-MM-DD'
  | { view: 'lists'; listId?: string }
  | { view: 'settings' }
export type OpenSource = 'click' | 'pull' | 'shortcut' | 'tray' | 'toast'

export interface Shell {
  isOpen: boolean
  route: Route
  /** True when the card is shorter than 420. */
  compact: boolean
  open(source: OpenSource, route?: Route): void
  close(): void
  toggle(source: OpenSource): void
  navigate(route: Route): void
}

// src/shell/PanelView.tsx: every view renders exactly one of these.
export interface PanelViewProps {
  title: string
  subtitle?: string
  back?: { label: string; onBack: () => void }
  /** At most three IconButton or text-button elements. Settings is appended by the shell. */
  actions?: ReactNode
  /** Non-scrolling content between header and body. Calendar grid only. */
  fixed?: ReactNode
  quickAdd?: QuickAddProps
  /** The scrolling body. */
  children: ReactNode
}

// src/components
export interface QuickAddProps {
  placeholder: string
  onSubmit(title: string, reminderAt?: string): void
  entryMode?: { value: 'task' | 'event'; onChange(value: 'task' | 'event'): void }
}
export interface GroupProps {
  label?: string
  tone?: 'default' | 'danger'
  /** Renders the label as a disclosure. */
  collapsible?: { open: boolean; onToggle(): void }
  children: ReactNode
}
export interface TaskRowProps {
  task: Task // src/tasks.ts, unchanged
  overdue?: boolean
  onToggleDone(): void
  onRename(title: string): void
  onSetReminder(reminderAt: string | undefined): void
  onCyclePriority(): void
  onDelete(): void
}

// src/views: one default export per view, no props beyond these.
export interface CalendarViewProps { shell: Shell; dateKey?: string }
export interface SettingsViewProps {
  shell: Shell
  settings: SidebarSettings
  onChange(patch: Partial<SidebarSettings>): void
  onReset(): void
}

// src/reminders
export interface ReminderItem {
  id: string
  taskId: number
  title: string
  dueLabel: string
  route: Route // where clicking the toast lands
}
export interface ReminderToastProps {
  items: ReminderItem[] // newest first; the toast shows items[0]
  onOpen(item: ReminderItem): void
  onSnooze(item: ReminderItem, minutes: number): void
  onDone(item: ReminderItem): void
}
```

Class names in the prototype (`sn-card`, `sn-row`, `sn-group` and so on) are a
suggestion; the tokens, dimensions and props above are the contract.

## 9. Verification

Run from the repository root:

```bash
node docs/design/compact/geometry.js --check
node docs/design/compact/capture-frames.mjs
npm run verify
```

`capture-frames.mjs` needs a Chromium that matches the repository's Playwright
(`npx playwright install chromium`), or `SIDENIB_CHROMIUM` set to any Chromium
or Chrome executable.

What was checked for this contract, in headless Chromium:

- Placement on eight work areas, including top, bottom, left edge and a second
  monitor with a negative origin: card inside the work area with 10 clearance.
- All 22 frames: no console errors; open card at most 340 × 480 and inside the
  work area; body shorter than the card; no sideways overflow.
- Long list: 903 px of content scrolls inside a 317 px body at 480, and inside
  a 237 px body on the 420-high work area.
- Calendar present at 875, 575 and 420 work-area heights.
- Interaction: 28 × 72 hit target around a 12 × 48 notch; hover does not open;
  click opens; pointer open leaves focus on the card; Escape closes and returns
  focus to the notch; the shortcut opens and focuses quick add; Escape clears a
  draft before closing; a 24 px pull springs back; a 60 px pull opens; a
  vertical drag moves the notch without opening; a reminder shows the toast,
  keeps the card closed and takes no focus; reduced motion removes travel.

Not verified, because the compact shell is not built yet: the native window on
macOS and Windows, focus return to the previous app, the global shortcut and
tray, WebKit and WebView2 rendering, and VoiceOver or Narrator output. The
prototype uses the CSS `:has()` selector for the 52 px reminder row; the shell
workspace should confirm it in the oldest WebKit it supports or set a class
instead. The baseline was audited in its web preview and source, not by
measuring the installed `/Applications/Todobar.app`.

## 10. Decisions for the user to confirm

These are set as stated above so that work can proceed. Each is cheap to
reverse before the shell lands.

1. The top dock edge is removed. A notch that pulls out sideways into a 340 ×
   480 card has no natural top-edge form. Left and right remain.
2. The nine theme presets, the backdrop image and the size sliders are removed
   in favour of one Sidenib look in light and dark.
3. Clicking outside the card does not close it. This matches the baseline. If
   it should behave like a popover instead, the change is one rule in `useShell`.
