/*
 * Date helpers shared by the views. Moved out of App.tsx unchanged in
 * behaviour; the Calendar workspace owns this file from here on.
 */
import type { Task } from '../tasks'

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/** Value for an `<input type="datetime-local">`, in local time. */
export function toLocalDateTimeValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}

export function parseReminderDate(reminderAt?: string) {
  if (!reminderAt) {
    return null
  }

  const date = new Date(reminderAt)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatCalendarMonth(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatMonthName(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date)
}

export function formatCalendarDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** "Monday 16 November", for the Today subtitle. */
/** "Wednesday". */
export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)
}

export function formatLongDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date)
}

/** "Mon 16 Nov"; the year is added when it is not the year of `now`. */
export function formatAgendaDay(date: Date, now: number = Date.now()) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year:
      date.getFullYear() === new Date(now).getFullYear()
        ? undefined
        : 'numeric',
  }).format(date)
}

/** "Monday 16 November 2026", the spoken name of a day in the grid. */
export function formatFullDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date)
}

/** Local midday of a 'YYYY-MM-DD' key, or null when it is not a real date. */
export function parseDateKey(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)

  if (!match) {
    return null
  }

  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ]
  const date = new Date(year, month - 1, day, 12)

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null
}

/** The first of the month `amount` months away. */
export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

/** The same calendar day `amount` days away. Safe across DST changes. */
export function addDays(date: Date, amount: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount,
    date.getHours(),
    date.getMinutes(),
  )
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * The same day of the month `amount` months away, pulled back to the last day
 * when that month is shorter: 31 January + 1 is 28 or 29 February, and
 * 29 February + 12 is 28 February.
 */
export function shiftMonthKeepingDay(date: Date, amount: number) {
  const first = new Date(date.getFullYear(), date.getMonth() + amount, 1)
  const day = Math.min(
    date.getDate(),
    daysInMonth(first.getFullYear(), first.getMonth()),
  )

  return new Date(first.getFullYear(), first.getMonth(), day, 12)
}

/** Monday of the week that holds `date`, at local midday. */
export function startOfWeek(date: Date) {
  const mondayOffset = (date.getDay() + 6) % 7

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - mondayOffset,
    12,
  )
}

/**
 * The day that names a week: its Thursday, as in ISO 8601. A week belongs to
 * the month and year that hold most of it, so 29 Dec 2025 to 4 Jan 2026 is
 * January 2026, week 1.
 */
export function weekAnchor(date: Date) {
  return addDays(startOfWeek(date), 3)
}

/** ISO 8601 week number, 1 to 53. */
export function isoWeekNumber(date: Date) {
  const thursday = weekAnchor(date)
  const firstThursday = weekAnchor(new Date(thursday.getFullYear(), 0, 4))

  return (
    1 +
    Math.round(
      (Date.UTC(
        thursday.getFullYear(),
        thursday.getMonth(),
        thursday.getDate(),
      ) -
        Date.UTC(
          firstThursday.getFullYear(),
          firstThursday.getMonth(),
          firstThursday.getDate(),
        )) /
        (7 * 24 * 60 * 60 * 1000),
    )
  )
}

export type CalendarDay = {
  date: Date
  doneCount: number
  eventCount: number
  isCurrentMonth: boolean
  isToday: boolean
  key: string
  /** Open entries on this day whose time has passed. */
  overdueCount: number
  taskCount: number
}

type DayCounts = Pick<
  CalendarDay,
  'doneCount' | 'eventCount' | 'overdueCount' | 'taskCount'
>

function countEntriesByDay(tasks: Array<{ task: Task }>, now: number) {
  const countsByDate = new Map<string, DayCounts>()

  for (const { task } of tasks) {
    const reminderDate = parseReminderDate(task.reminderAt)

    if (!reminderDate) {
      continue
    }

    const key = formatDateKey(reminderDate)
    const counts = countsByDate.get(key) ?? {
      doneCount: 0,
      eventCount: 0,
      overdueCount: 0,
      taskCount: 0,
    }

    counts.taskCount += 1
    counts.doneCount += task.done ? 1 : 0
    counts.eventCount += task.kind === 'event' ? 1 : 0
    counts.overdueCount += !task.done && reminderDate.getTime() < now ? 1 : 0
    countsByDate.set(key, counts)
  }

  return countsByDate
}

/** `length` consecutive days from `start`, marked against `month`. */
function buildDays(
  start: Date,
  length: number,
  month: Date,
  tasks: Array<{ task: Task }>,
  now: number,
): CalendarDay[] {
  const todayKey = formatDateKey(new Date(now))
  const countsByDate = countEntriesByDay(tasks, now)

  return Array.from({ length }, (_, index) => {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    )
    const key = formatDateKey(date)
    const counts = countsByDate.get(key)

    return {
      date,
      doneCount: counts?.doneCount ?? 0,
      eventCount: counts?.eventCount ?? 0,
      isCurrentMonth:
        date.getMonth() === month.getMonth() &&
        date.getFullYear() === month.getFullYear(),
      isToday: key === todayKey,
      key,
      overdueCount: counts?.overdueCount ?? 0,
      taskCount: counts?.taskCount ?? 0,
    }
  })
}

/** Six Monday-first weeks around the month of `cursor`. */
export function buildCalendarDays(
  cursor: Date,
  tasks: Array<{ task: Task }>,
  now: number = Date.now(),
): CalendarDay[] {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)

  return buildDays(startOfWeek(monthStart), 42, monthStart, tasks, now)
}

/**
 * The Monday-first weeks that hold a day of the month of `cursor`: four for a
 * 28-day February that starts on a Monday, six for a long month that starts
 * late in the week, otherwise five.
 */
export function buildMonthWeeks(
  cursor: Date,
  tasks: Array<{ task: Task }>,
  now: number = Date.now(),
): CalendarDay[][] {
  const days = buildCalendarDays(cursor, tasks, now)
  const weeks: CalendarDay[][] = []

  for (let index = 0; index < days.length; index += 7) {
    const week = days.slice(index, index + 7)

    if (week.some((day) => day.isCurrentMonth)) {
      weeks.push(week)
    }
  }

  return weeks
}

/**
 * The one Monday-first week that holds `anchor`. Days are marked against the
 * month that names the week (see `weekAnchor`).
 */
export function buildWeek(
  anchor: Date,
  tasks: Array<{ task: Task }>,
  now: number = Date.now(),
): CalendarDay[] {
  return buildDays(startOfWeek(anchor), 7, weekAnchor(anchor), tasks, now)
}

export type AgendaSortMode = 'priority' | 'newest' | 'oldest'

const AGENDA_PRIORITY: Record<Task['priority'], number> = {
  focus: 0,
  normal: 1,
  later: 2,
}

/**
 * Order of one day's agenda. Time first. Entries at the same time (quick
 * capture puts everything at 09:00) are ordered by events before tasks, then
 * the user's sort preference, then the order they were created. Completing an
 * entry does not move it, so a row stays where it was ticked.
 */
export function compareAgendaEntries(
  a: { task: Task },
  b: { task: Task },
  sortMode: AgendaSortMode = 'priority',
) {
  const timeDelta =
    (parseReminderDate(a.task.reminderAt)?.getTime() ?? 0) -
    (parseReminderDate(b.task.reminderAt)?.getTime() ?? 0)

  if (timeDelta !== 0) {
    return timeDelta
  }

  const kindDelta =
    (a.task.kind === 'event' ? 0 : 1) - (b.task.kind === 'event' ? 0 : 1)

  if (kindDelta !== 0) {
    return kindDelta
  }

  if (sortMode === 'newest') {
    return b.task.id - a.task.id
  }

  if (sortMode === 'priority') {
    const priorityDelta =
      AGENDA_PRIORITY[a.task.priority] - AGENDA_PRIORITY[b.task.priority]

    if (priorityDelta !== 0) {
      return priorityDelta
    }
  }

  return a.task.id - b.task.id
}
