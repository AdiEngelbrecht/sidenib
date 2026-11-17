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
export function formatLongDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date)
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
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

/** Six Monday-first weeks around the month of `cursor`. */
export function buildCalendarDays(
  cursor: Date,
  tasks: Array<{ task: Task }>,
  now: number = Date.now(),
): CalendarDay[] {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = new Date(monthStart)
  const mondayOffset = (monthStart.getDay() + 6) % 7
  const todayKey = formatDateKey(new Date(now))
  const countsByDate = new Map<
    string,
    {
      doneCount: number
      eventCount: number
      overdueCount: number
      taskCount: number
    }
  >()

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

  gridStart.setDate(monthStart.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)

    const key = formatDateKey(date)
    const counts = countsByDate.get(key)

    return {
      date,
      doneCount: counts?.doneCount ?? 0,
      eventCount: counts?.eventCount ?? 0,
      isCurrentMonth: date.getMonth() === cursor.getMonth(),
      isToday: key === todayKey,
      key,
      overdueCount: counts?.overdueCount ?? 0,
      taskCount: counts?.taskCount ?? 0,
    }
  })
}
