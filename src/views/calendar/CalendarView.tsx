/*
 * Calendar view (ADIEN-163). Month grid, or one week when the card is short,
 * a selected day, that day's tasks and events, and the unscheduled backlog.
 * The grid is fixed; only the agenda under it scrolls. All task changes go
 * through the store and the shared rows.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  addDays,
  addMonths,
  buildMonthWeeks,
  buildWeek,
  compareAgendaEntries,
  formatAgendaDay,
  formatCalendarDay,
  formatCalendarMonth,
  formatDateKey,
  formatFullDay,
  formatMonthName,
  isoWeekNumber,
  parseDateKey,
  parseReminderDate,
  shiftMonthKeepingDay,
  startOfWeek,
  weekAnchor,
} from '../../calendar/dates'
import type { CalendarDay } from '../../calendar/dates'
import { Group, GroupNote } from '../../components/Group'
import { IconButton, TextButton } from '../../components/IconButton'
import { PanelView } from '../../components/PanelView'
import { TaskRow } from '../../components/TaskRow'
import { sortTasks } from '../../data/taskStore'
import type {
  CalendarEntryMode,
  TaskEntry,
  TaskSortMode,
  TaskStore,
} from '../../data/taskStore'
import { isOverdue } from '../../reminders/reminderTime'
import { TaskRows } from '../TaskRows'
import './calendar.css'

export interface CalendarViewProps {
  store: TaskStore
  sortMode: TaskSortMode
  showCompleted: boolean
  now: number
  /** The card is shorter than 420: show one week instead of the month. */
  compact: boolean
  /** The selected day, 'YYYY-MM-DD'. Held in the route by App.tsx. */
  dateKey: string
  onSelectDate(dateKey: string): void
}

const WEEKDAYS = [
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
  ['S', 'Sunday'],
] as const
const MONTH_LIST = { source: 'month' } as const

const entryKey = ({ ref, task }: TaskEntry) =>
  `${ref.source}-${ref.source === 'custom' ? ref.listId : 'base'}-${task.id}`

/** What a day holds, in words: the grid shows it as a mark under the number. */
function describeDay(day: CalendarDay) {
  if (day.taskCount === 0) {
    return 'nothing scheduled'
  }

  return [
    `${day.taskCount} scheduled`,
    day.overdueCount > 0 ? `${day.overdueCount} overdue` : '',
    day.doneCount > 0 ? `${day.doneCount} done` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

/** The day an arrow, Home, End or Page key moves to; null for other keys. */
function keyTarget(event: KeyboardEvent, from: Date) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null
  }

  switch (event.key) {
    case 'ArrowLeft':
      return addDays(from, -1)
    case 'ArrowRight':
      return addDays(from, 1)
    case 'ArrowUp':
      return addDays(from, -7)
    case 'ArrowDown':
      return addDays(from, 7)
    case 'Home':
      return startOfWeek(from)
    case 'End':
      return addDays(startOfWeek(from), 6)
    case 'PageUp':
      return shiftMonthKeepingDay(from, event.shiftKey ? -12 : -1)
    case 'PageDown':
      return shiftMonthKeepingDay(from, event.shiftKey ? 12 : 1)
    default:
      return null
  }
}

export function CalendarView({
  store,
  sortMode,
  showCompleted,
  now,
  compact,
  dateKey,
  onSelectDate,
}: CalendarViewProps) {
  const selectedDate = useMemo(() => new Date(`${dateKey}T09:00:00`), [dateKey])
  // A day inside the period on show: its month, or its week when compact. It
  // starts at the selected day and moves with the arrows and the keyboard.
  const [cursor, setCursor] = useState(() => selectedDate)
  // The grid is one tab stop. This is the day that holds it once the user
  // has moved inside the grid; before that the selected day does.
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [entryMode, setEntryMode] = useState<CalendarEntryMode>('task')
  const gridRef = useRef<HTMLDivElement>(null)
  const focusAfterRender = useRef(false)
  const seenEntries = useRef<{ dateKey: string; keys: string[] } | null>(null)

  // The month that names the period: a compact week belongs to the month
  // that holds its Thursday.
  const period = useMemo(
    () => (compact ? weekAnchor(cursor) : cursor),
    [compact, cursor],
  )
  const weeks = useMemo(
    () =>
      compact
        ? [buildWeek(cursor, store.entries, now)]
        : buildMonthWeeks(cursor, store.entries, now),
    [compact, cursor, now, store.entries],
  )
  const tabStopKey = useMemo(() => {
    // Days of the month on show can hold the tab stop; in a week, all seven.
    const candidates = weeks
      .flat()
      .filter((day) => compact || day.isCurrentMonth)
    const has = (key: string | null) =>
      candidates.some((day) => day.key === key)

    return (
      [activeKey, dateKey, formatDateKey(new Date(now))].find(has) ??
      candidates[0]?.key
    )
  }, [activeKey, compact, dateKey, now, weeks])
  const dayEntries = useMemo(
    () =>
      store.entries
        .filter(({ task }) => {
          const reminderDate = parseReminderDate(task.reminderAt)

          return reminderDate ? formatDateKey(reminderDate) === dateKey : false
        })
        .sort((a, b) => compareAgendaEntries(a, b, sortMode)),
    [dateKey, sortMode, store.entries],
  )
  const backlog = useMemo(() => {
    const sorted = sortTasks(
      store.monthTasks.filter((task) => !task.reminderAt),
      sortMode,
    )

    return showCompleted ? sorted : sorted.filter((task) => !task.done)
  }, [showCompleted, sortMode, store.monthTasks])
  const openCount = dayEntries.filter(({ task }) => !task.done).length
  const eventCount = dayEntries.filter(
    ({ task }) => task.kind === 'event',
  ).length
  const dayLabel = formatCalendarDay(selectedDate)
  const agendaLabel = formatAgendaDay(selectedDate, now)
  const unit = compact ? 'week' : 'month'
  // "Mon 16 Nov · 2 open · 1 event": only the counts that are not zero.
  const agendaHeading = [
    agendaLabel,
    openCount > 0 ? `${openCount} open` : '',
    dayEntries.length > 0 && openCount === 0 ? 'all done' : '',
    eventCount > 0
      ? `${eventCount} ${eventCount === 1 ? 'event' : 'events'}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')

  // Keyboard moves re-render the grid, sometimes with another month or week;
  // focus follows to the day that now holds the tab stop.
  useEffect(() => {
    if (!focusAfterRender.current) {
      return
    }

    focusAfterRender.current = false
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-date="${tabStopKey}"]`)
      ?.focus()
  }, [tabStopKey, weeks])

  // The body is the frame's one scrolling region. Another day starts at the
  // top of its agenda; an entry added to this day is scrolled into view, since
  // only two or three rows show under a six-week month.
  useEffect(() => {
    const body = gridRef.current
      ?.closest('.sn-view')
      ?.querySelector<HTMLElement>('.sn-view-body')
    const keys = dayEntries.map(entryKey)
    const seen = seenEntries.current

    seenEntries.current = { dateKey, keys }

    if (!body || !seen) {
      return
    }

    if (seen.dateKey !== dateKey) {
      body.scrollTop = 0
      return
    }

    const added = keys.filter((key) => !seen.keys.includes(key))

    if (added.length === 1) {
      const rows = body
        .querySelector('.sn-section')
        ?.querySelectorAll<HTMLElement>('.sn-task')

      rows?.[keys.indexOf(added[0])]?.scrollIntoView({ block: 'nearest' })
    }
  }, [dateKey, dayEntries])

  const step = (direction: -1 | 1) => {
    setActiveKey(null)
    setCursor((current) =>
      compact ? addDays(current, direction * 7) : addMonths(current, direction),
    )
  }
  const jumpToToday = () => {
    const today = new Date()

    setActiveKey(null)
    setCursor(today)
    onSelectDate(formatDateKey(today))
  }
  const selectDay = (day: CalendarDay) => {
    // Picking a day from the next or previous month turns the page to it,
    // which moves the button; keep focus on the day if the grid had it.
    focusAfterRender.current =
      gridRef.current?.contains(document.activeElement) ?? false
    setActiveKey(day.key)
    setCursor(day.date)
    onSelectDate(day.key)
  }
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const fromKey = (event.target as HTMLElement).dataset?.date
    const from = fromKey ? parseDateKey(fromKey) : null
    const target = from ? keyTarget(event, from) : null

    if (!target) {
      return
    }

    event.preventDefault()
    focusAfterRender.current = true
    setActiveKey(formatDateKey(target))
    setCursor(target)
  }

  return (
    <PanelView
      id="calendar"
      title={formatMonthName(period)}
      subtitle={
        compact
          ? `${period.getFullYear()} · Week ${isoWeekNumber(cursor)}`
          : String(period.getFullYear())
      }
      actions={
        <>
          <IconButton label={`Previous ${unit}`} onClick={() => step(-1)}>
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <IconButton label={`Next ${unit}`} onClick={() => step(1)}>
            <ChevronRight aria-hidden="true" />
          </IconButton>
          <TextButton aria-label="Jump to today" onClick={jumpToToday}>
            Today
          </TextButton>
        </>
      }
      fixed={
        <div className={`sn-cal ${compact ? 'is-week' : 'is-month'}`}>
          <div
            ref={gridRef}
            className="sn-cal-grid calendar-grid"
            role="grid"
            aria-label={
              compact
                ? `Week ${isoWeekNumber(cursor)}, ${formatCalendarMonth(period)}`
                : formatCalendarMonth(period)
            }
            onKeyDown={onGridKeyDown}
          >
            <div className="sn-cal-weekdays" role="row">
              {WEEKDAYS.map(([letter, name]) => (
                <span key={name} role="columnheader" aria-label={name}>
                  {letter}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div className="sn-cal-week" role="row" key={week[0].key}>
                {week.map((day) => {
                  const isSelected = day.key === dateKey
                  const mark =
                    day.taskCount === 0
                      ? null
                      : day.overdueCount > 0
                        ? 'is-overdue'
                        : day.doneCount === day.taskCount
                          ? 'is-done'
                          : 'is-open'

                  return (
                    <button
                      type="button"
                      key={day.key}
                      className={[
                        'sn-day',
                        day.isCurrentMonth ? '' : 'is-outside',
                        day.isToday ? 'is-today' : '',
                        isSelected ? 'is-selected' : '',
                        day.taskCount > 0 ? 'has-items' : '',
                        day.overdueCount > 0 ? 'has-overdue' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      role="gridcell"
                      data-date={day.key}
                      tabIndex={day.key === tabStopKey ? 0 : -1}
                      aria-label={`${day.isToday ? 'Today, ' : ''}${formatFullDay(
                        day.date,
                      )}, ${describeDay(day)}`}
                      aria-selected={isSelected}
                      aria-current={day.isToday ? 'date' : undefined}
                      onClick={() => selectDay(day)}
                      onFocus={() => setActiveKey(day.key)}
                    >
                      <span className="sn-day-number">
                        {day.date.getDate()}
                        {mark ? (
                          <i
                            className={`sn-day-mark ${mark}`}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="sn-cal-divider" />
        </div>
      }
      quickAdd={{
        ariaLabel: 'Add a task to selected calendar day',
        draftKey: 'calendar',
        entryMode: { value: entryMode, onChange: setEntryMode },
        placeholder: `Add to ${dayLabel}`,
        suggestedReminder: `${dateKey}T09:00`,
        onSubmit: (title, reminderAt) =>
          store.addCalendarEntry(
            title,
            selectedDate,
            reminderAt || `${dateKey}T09:00`,
            entryMode,
          ),
      }}
    >
      <Group label={agendaHeading}>
        {dayEntries.length === 0 ? (
          <GroupNote>
            Nothing scheduled. Add below or pick another day.
          </GroupNote>
        ) : null}
        {dayEntries.map((entry) => {
          const { ref, listTitle, task } = entry

          return (
            <TaskRow
              key={entryKey(entry)}
              task={task}
              now={now}
              overdue={isOverdue(task, now)}
              detail={task.kind === 'event' ? undefined : listTitle}
              listTitle={listTitle}
              onToggleDone={() => store.toggleTask(ref, task.id)}
              onRename={(title) => store.renameTask(ref, task.id, title)}
              onSetReminder={(reminderAt) =>
                store.setReminder(ref, task.id, reminderAt)
              }
              onCyclePriority={() => store.cyclePriority(ref, task.id)}
              onDelete={() => store.deleteTask(ref, task.id)}
            />
          )
        })}
      </Group>
      {backlog.length > 0 ? (
        <Group label={`Backlog · ${backlog.length}`}>
          <TaskRows
            store={store}
            taskRef={MONTH_LIST}
            tasks={backlog}
            now={now}
          />
        </Group>
      ) : null}
    </PanelView>
  )
}
