# Views and shared components

Task ADIEN-162. This is what is inside the card: the view frame, the shared
primitives, Today and Lists, and the Calendar and Settings views extracted
from the old `App.tsx`. It implements sections 4, 5 (Today, Lists) and 6 of the
[compact design contract](design/compact/README.md). The card frame, the notch,
the toast and the native window are the [shell](shell.md) and are not touched
here.

`src/App.tsx` went from 3,656 lines to composition only, and `src/App.css` from
4,769 lines to the shell root and the browser preview.

## Reference frames

Captured from the running app at the real 340 × 480 card size.

| State | Frame |
| --- | --- |
| Today, populated, with a pinned list | [light](design/views/today-populated-light.png) |
| Today, overdue and completed | [dark](design/views/today-overdue-dark.png) |
| Today, empty | [light](design/views/today-empty-light.png) |
| Long and unbroken titles, 18 tasks | [clamped](design/views/today-long-light.png), [renaming](design/views/long-title-rename.png) |
| Row actions and the More menu | [light](design/views/row-menu.png) |
| List detail | [light](design/views/list-detail-light.png) |
| Calendar and Settings as extracted | [calendar](design/views/calendar-light.png), [settings](design/views/settings-light.png) |

## Who owns what

| Path | Owner | Contents |
| --- | --- | --- |
| `src/App.tsx` | Views (ADIEN-162) | Composition: shell, data hooks, route state, one view at a time. Later tasks change only the props they pass to their own view. |
| `src/App.css`, `src/index.css` | Views | Shell root and browser preview. No view rules go here. |
| `src/components/` | Views lands them; every view consumes them | `PanelView`, `ViewTabs`, `QuickAdd`, `TaskRow`, `Group`, `EmptyState`, `IconButton`, `Popover`, `ReminderPicker`, `controls` (Segmented, Switch, Slider), `panelChrome`, and `components.css`. |
| `src/views/TaskRows.tsx` | Views | Rows for one list, wired to the store. |
| `src/views/today/`, `src/views/lists/` | Views | `TodayView`, `ListsView`, and the held-back `GmailInboxSuggestions`. |
| `src/views/calendar/`, `src/calendar/` | Calendar (ADIEN-163) | `CalendarView.tsx`, `calendar.css`, `dates.ts`, `useNow.ts`. |
| `src/views/settings/`, `src/sidebarSettings.ts`, `src/design/presets.css` | Settings (ADIEN-164) | `SettingsView.tsx`, `SettingsParts.tsx`, `ConnectorSetting.tsx`, `themePresets.ts`, `settings.css`, the settings type and defaults, and the presets. |
| `src/data/taskStore.ts` | Views | Task and list state, every mutation, and storage. |
| `src/reminders/` | Shell for `ReminderToast.tsx`; Views for `ReminderBanner.tsx`, `useReminders.ts` and `reminderTime.ts` | The toast, the in-card banner, the due check and the reminder time helpers. |
| `src/shell/`, `src-tauri/`, `src/design/tokens.css` | Shell | Unchanged by this task. |

## How a view is built

Every view renders exactly one `PanelView`. It draws the header (title,
optional secondary line, optional gold back label, up to three actions, and
the Settings action it appends itself), an optional fixed area, the one
scrolling body, and quick add. `App.tsx` draws the tabs once under whichever
view is showing.

```ts
// src/components/PanelView.tsx
// PanelView also draws PanelChrome.banner (the reminder banner) above the body.
interface PanelViewProps {
  id: string                 // data-view, for tests and scoped styles
  title: string
  subtitle?: string
  back?: { label: string; onBack(): void }
  titleEditor?: ReactNode    // replaces the title while renaming
  actions?: ReactNode        // IconButton / TextButton elements
  settingsAction?: boolean   // false only in Settings
  fixed?: ReactNode          // non-scrolling; the calendar grid
  quickAdd?: QuickAddProps
  children: ReactNode        // the scrolling body
}

// src/components/QuickAdd.tsx
interface QuickAddProps {
  placeholder: string
  ariaLabel: string
  onSubmit(title: string, reminderAt?: string): void
  entryMode?: { value: 'task' | 'event'; onChange(value): void }
  suggestedReminder?: string
  draftKey?: string          // keeps unsent text across tab changes
}

// src/components/TaskRow.tsx
interface TaskRowProps {
  task: Task
  overdue?: boolean
  detail?: string            // extra words on the secondary line
  listTitle?: string         // hides a stored note that only names the list
  now?: number
  onToggleDone(): void
  onRename(title: string): void
  onSetReminder(reminderAt: string | undefined): void
  onCyclePriority(): void
  onDelete(): void
}

// src/components/Group.tsx
interface GroupProps {
  label?: string
  tone?: 'default' | 'danger'
  collapsible?: { open: boolean; onToggle(): void }
  children: ReactNode
}
```

The view props, as `App.tsx` passes them:

```ts
interface TodayViewProps {
  store: TaskStore; sortMode: TaskSortMode; showCompleted: boolean
  now: number; banner?: ReactNode
}
interface ListsViewProps {
  store: TaskStore; sortMode: TaskSortMode; showCompleted: boolean
  now: number; listId?: string; onOpenList(listId: string | undefined): void
}
interface CalendarViewProps {
  store: TaskStore; sortMode: TaskSortMode; showCompleted: boolean
  now: number; compact: boolean
  dateKey: string; onSelectDate(dateKey: string): void
}
interface SettingsViewProps {
  settings: SidebarSettings
  onChange(patch: Partial<SidebarSettings>): void
  onReset(): void; onClose(): void
  gmail?: GmailConnectorController
}
```

## Data ownership

- **Tasks and lists** live in `useTaskStore()` (`src/data/taskStore.ts`). A
  view receives the `TaskStore` and calls `addTask`, `toggleTask`,
  `cyclePriority`, `setReminder`, `renameTask`, `deleteTask`,
  `addCalendarEntry`, `addList`, `renameList`, `deleteList`,
  `toggleListOnToday` and `toggleListCollapsed`. A task is addressed by a `TaskRef`:
  `{ source: 'today' | 'month' }` or `{ source: 'custom', listId }`.
  `store.entries` is every task with its ref and list title.
- **Storage** is unchanged: `sidenib.today.v1`, `sidenib.month.v1`,
  `sidenib.custom-lists.v1`, `sidenib.notified-reminders.v1`,
  `sidenib.settings.groups.v1` and the settings key. Shapes are the ones the
  identity task set. The `collapsed` flag on a custom list folds that list's
  group on Today. Views never read or write `localStorage`.
- **Settings** stay in `useSidebarSettings()`. Only `SettingsView` receives
  the settings object. Other views get `sortMode` and `showCompleted`.
- **Route** is state in `App.tsx`: the active tab, the calendar's selected
  day, the open list, and whether Settings is showing. The calendar day and
  the open list are remembered while another tab is showing. A reminder
  toast navigates with `navigate({ view: 'calendar', dateKey })`.
- **The clock** comes from `useNow()` so nothing reads the time during
  render. It refreshes every 30 s and decides what is overdue.
- **Reminders**: `useReminders(entries, enabled)` returns the alerts and
  `dismiss`. Snooze is `store.setReminder(ref, id, snoozedReminderValue(10))`.
  With the card closed the shell draws the newest alert as the toast. With
  the card open `App.tsx` passes a `ReminderBanner` through `PanelChrome`,
  and `PanelView` places it above the scrolling body of whichever view is
  showing.

## Tokens and styling

- Components and views read `--sn-*` tokens only. A raw colour in a view is a
  defect. The exceptions are the browser-preview background in `App.css` and
  the preset swatch colours in `settings.css`.
- `components.css` owns every shared class (`sn-panel`, `sn-view`, `sn-header`,
  `sn-view-body`, `sn-group`, `sn-row`, `sn-check`, `sn-field`, `sn-tabs`,
  `sn-popover`, `sn-segmented`, `sn-switch`, `sn-slider`, `sn-chip` and so on).
  Views do not restyle them; a missing variant is added there.
- A view's own stylesheet is scoped to its own classes: `.sn-cal` and `.sn-day`
  in `calendar.css`, `.sn-settings` and the settings controls in
  `settings.css`. Each view imports its stylesheet itself.
- Preferences reach components as token overrides on the shell root, set in
  `App.tsx`:

  | Preference | Token or class |
  | --- | --- |
  | `taskRowHeight` | `--sn-row-min-height` |
  | `taskTextSize` | `--sn-text-body` |
  | `taskGap` | `--sn-row-gap`, and `.sn-rows-spaced` when above 0 |
  | `surfaceAlpha` | `--sn-surface-alpha` |
  | `backdropImage`, `backdropOpacity`, `backdropBlur`, `backdropDim` | `--sn-backdrop-image`, `--sn-backdrop-opacity`, `--sn-backdrop-blur`, `--sn-backdrop-dim` |
  | `theme` | `data-theme` on the root element, as before |
  | `visualStyle` | `.style-*` on the shell root, read by `src/design/presets.css` |
  | `panelWidth`, `panelRadius`, `motionMs`, notch sizes | set by the shell (`controller.rootStyle`) |

- `src/design/presets.css` maps the nine baseline presets onto the tokens.
  `codex` (Studio in light, Obsidian in dark) is the stored default and is the
  Sidenib palette unchanged. The other presets keep their v0.1.14 palettes.
  Measured contrast of secondary ink is 4.6:1 or better on every surface of
  every preset.

## Behaviour worth knowing

- **Row actions.** Reminder and More lie over the row's trailing edge on hover
  and on keyboard focus. They stay in the tab order while hidden. More holds
  Rename, Priority and Delete. Delete asks first; Shift skips the question, as
  before. Double-clicking a title also renames.
- **Reminders on a row** are chosen from a small picker (30 min, Tomorrow,
  Next week, an exact time, Clear). This replaces the old button that cycled
  through three fixed values.
- **Long titles** clamp to two lines with an ellipsis, and an unbroken token
  wraps. The full title is the tooltip, and the rename field grows to show
  all of it.
- **Popovers** (`Popover.tsx`) use fixed positioning clamped inside the card,
  so the scrolling body cannot clip them and they never leave the card's
  pointer region. Escape, a press outside, scrolling, or closing the card
  dismisses them, and focus returns to the control that opened them.
- **Escape** peels one layer: a popover, a rename, a quick-add draft, then
  Settings, then the card. Inner layers call `preventDefault()`, which the
  shell's key handler already respects.
- **Today** shows Overdue (oldest first, danger label), the open tasks, one
  labelled group per pinned list, and a Completed disclosure that opens by
  itself once everything is done. A pinned list's label folds its group; the
  fold is the list's stored `collapsed` flag, and a folded label shows how
  many tasks are open.
- **Task notes.** A task's stored `meta` is shown on the row's second line
  without the labels the view already gives: "Today · 40 min" shows
  "40 min", and "Today", "16 Nov · Calendar" or the list's own name show
  nothing (`taskNote` in `src/tasks.ts`). New tasks are stored with an empty
  note. Stored text is never rewritten.
- **Lists** is an index, then one list in detail. Rename, Show on Today and
  Delete are in the detail header's More menu.

## Shell interface notes

Two things in the view layer exist because the shell looks for them. Neither
needed a shell change.

- `QuickAdd` keeps the class `quick-add` on its wrapper. `focusCard` in
  `src/shell/useShell.ts` uses `.quick-add input` to focus the field when the
  card is opened by shortcut.
- `PanelCard` is labelled with the current view title, so the card is exposed
  as the dialog "Today", "Calendar", "Lists" or "Settings".

`tests/shell.spec.ts` changed in five places, selectors only: the quick-add
placeholder is "New task", the Settings button is named "Settings", and the
scrolling body is `.sn-view-body`.

A reminder that fires while the card is open is the in-body banner
(`src/reminders/ReminderBanner.tsx`, styled in `components.css`). It sits
between the header (or the calendar grid) and the scrolling body, so the view
does not switch and the scroll position does not move. It lies inside the
card, so the native pointer regions did not change. Like the toast, it goes
away by itself after nine seconds; the task stays marked overdue.

The scrolled hairline belongs to whatever sits directly above the body.
`PanelView` wraps `fixed` in `.sn-view-fixed` and marks that instead of the
header, and the calendar widens its own divider under the grid.

## For ADIEN-163 (Calendar)

- Work in `src/views/calendar/` and `src/calendar/`. `App.tsx` needs no change
  unless the props change.
- What exists: month title with the year as the secondary line, previous,
  next and Today actions, a fixed 7-column grid of 28 px rows with a dot under
  days that have entries (red when one is overdue), the selected day's agenda
  and the backlog in the scrolling body, and quick add with the Task/Event
  chip. Rows are the shared `TaskRow`.
- Left for you: week-by-week navigation when `compact` is true (the grid
  already shows one week, but the arrows still move by month), keyboard
  navigation inside the grid, agenda ordering beyond time, and visual polish.
- `buildCalendarDays(cursor, entries, now)` returns `overdueCount` per day in
  addition to the v0.1.14 fields.

## For ADIEN-164 (Settings)

- Work in `src/views/settings/`, `src/sidebarSettings.ts` and
  `src/design/presets.css`.
- What exists: every v0.1.14 preference in collapsible groups (the collapsed
  state is still stored), built from `Segmented`, `Switch` and `Slider`. No
  preference was removed and no stored value is converted.
- Left for you: the short default page with an Advanced page, the `'system'`
  theme, the explicit `'sidenib'` preset, the remaining default changes
  (`surfaceAlpha`, `theme`, `visualStyle`), and the "Open or close" shortcut
  row.
- This task changed two defaults in `sidebarSettings.ts` because the task
  rows depend on them: `taskTextSize` 12.5 to 14, and `taskGap` 7 to 0 with
  its lower bound widened from 4 to 0. Stored values are still only clamped.
- With a backdrop image the paper is drawn at 88% of the chosen surface
  opacity so the image shows through. That factor is a starting point.

## Avoiding collisions

- Do not add rules to `App.css` or `components.css` for one view. Put them in
  the view's stylesheet under the view's own class.
- If a shared primitive needs a new variant, add a prop and a rule in
  `src/components/`, and say so in the pull request, since the other view
  task may be reading the same file.
- `tests/sidebar-smoke.spec.ts` has one long flow that crosses all views. Add
  a new `test()` for your view instead of editing inside that flow.

## Verification

```bash
npm run verify && npm run lint && npm run build
npm run test:smoke          # tests/shell.spec.ts and tests/sidebar-smoke.spec.ts
node docs/design/compact/geometry.js --check
```

Checked in headless Chromium at the real card size, light and dark: Today
empty, populated, overdue, all done, 18 tasks scrolled to the end, and long
and unbroken titles; row hover, keyboard focus, the More menu, delete
confirmation, the reminder picker and rename; Lists index, detail and its
menu; Calendar and Settings; the 400-high card on a 420-high work area; a
stored v0.1.14 density with a preset; and the left edge.

These views were later exercised in the native macOS window; see
[Release verification v0.2.0](release-verification-v0.2.0.md). Not checked:
the native window on Windows, WebView2 rendering, and VoiceOver or Narrator
output.
