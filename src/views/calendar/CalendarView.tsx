/*
 * Calendar view, extracted from App.tsx (ADIEN-162) with its behaviour kept:
 * month grid, a selected day, task and event entries for that day, and the
 * unscheduled backlog. ADIEN-163 owns this folder and its polish.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  addMonths,
  buildCalendarDays,
  formatCalendarDay,
  formatCalendarMonth,
  formatDateKey,
  formatMonthName,
  parseReminderDate,
} from '../../calendar/dates'
import { Group, GroupNote } from '../../components/Group'
import { IconButton, TextButton } from '../../components/IconButton'
import { PanelView } from '../../components/PanelView'
import { TaskRow } from '../../components/TaskRow'
import { sortTasks } from '../../data/taskStore'
import type {
  CalendarEntryMode,
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
  // The month on show. It starts at the selected day and moves with the arrows.
  const [cursor, setCursor] = useState(() => selectedDate)
  const [entryMode, setEntryMode] = useState<CalendarEntryMode>('task')
  const days = useMemo(
    () => buildCalendarDays(cursor, store.entries, now),
    [cursor, now, store.entries],
  )
  const visibleDays = useMemo(() => {
    if (!compact) {
      return days
    }

    // One week: the selected day's, or the first of the month on show.
    const index = Math.max(
      0,
      days.findIndex((day) => day.key === dateKey),
    )
    const weekStart = index - (index % 7)

    return days.slice(weekStart, weekStart + 7)
  }, [compact, dateKey, days])
  const dayEntries = useMemo(
    () =>
      store.entries
        .filter(({ task }) => {
          const reminderDate = parseReminderDate(task.reminderAt)

          return reminderDate ? formatDateKey(reminderDate) === dateKey : false
        })
        .sort(
          (a, b) =>
            (parseReminderDate(a.task.reminderAt)?.getTime() ?? 0) -
            (parseReminderDate(b.task.reminderAt)?.getTime() ?? 0),
        ),
    [dateKey, store.entries],
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

  const jumpToToday = () => {
    const today = new Date()

    setCursor(today)
    onSelectDate(formatDateKey(today))
  }

  return (
    <PanelView
      id="calendar"
      title={formatMonthName(cursor)}
      subtitle={String(cursor.getFullYear())}
      actions={
        <>
          <IconButton
            label="Previous month"
            onClick={() => setCursor((current) => addMonths(current, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Next month"
            onClick={() => setCursor((current) => addMonths(current, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </IconButton>
          <TextButton aria-label="Jump to today" onClick={jumpToToday}>
            Today
          </TextButton>
        </>
      }
      fixed={
        <div className="sn-cal">
          <div className="sn-cal-weekdays" aria-hidden="true">
            {WEEKDAYS.map(([letter, name]) => (
              <span key={name}>{letter}</span>
            ))}
          </div>
          <div
            className="sn-cal-grid calendar-grid"
            role="grid"
            aria-label={formatCalendarMonth(cursor)}
          >
            {visibleDays.map((day) => (
              <button
                type="button"
                key={day.key}
                className={[
                  'sn-day',
                  day.isCurrentMonth ? '' : 'is-outside',
                  day.isToday ? 'is-today' : '',
                  day.key === dateKey ? 'is-selected' : '',
                  day.taskCount > 0 ? 'has-items' : '',
                  day.overdueCount > 0 ? 'has-overdue' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${formatCalendarDay(day.date)}, ${day.taskCount} scheduled${
                  day.taskCount > 0 ? `, ${day.doneCount} done` : ''
                }`}
                aria-selected={day.key === dateKey}
                role="gridcell"
                onClick={() => {
                  onSelectDate(day.key)

                  if (!day.isCurrentMonth) {
                    setCursor(
                      new Date(day.date.getFullYear(), day.date.getMonth(), 1),
                    )
                  }
                }}
              >
                <span>{day.date.getDate()}</span>
              </button>
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
      <Group
        label={
          dayEntries.length === 0
            ? dayLabel
            : `${dayLabel} · ${openCount} open · ${eventCount} ${
                eventCount === 1 ? 'event' : 'events'
              }`
        }
      >
        {dayEntries.length === 0 ? (
          <GroupNote>Nothing scheduled. Add below or pick another day.</GroupNote>
        ) : null}
        {dayEntries.map(({ ref, listTitle, task }) => (
          <TaskRow
            key={`${ref.source}-${ref.source === 'custom' ? ref.listId : 'base'}-${task.id}`}
            task={task}
            now={now}
            overdue={isOverdue(task, now)}
            detail={task.kind === 'event' ? undefined : listTitle}
            onToggleDone={() => store.toggleTask(ref, task.id)}
            onRename={(title) => store.renameTask(ref, task.id, title)}
            onSetReminder={(reminderAt) =>
              store.setReminder(ref, task.id, reminderAt)
            }
            onCyclePriority={() => store.cyclePriority(ref, task.id)}
            onDelete={() => store.deleteTask(ref, task.id)}
          />
        ))}
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
