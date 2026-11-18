/*
 * Reminder time helpers: the quick presets and how a reminder is written in a
 * row. Stored values stay `datetime-local` strings, as in v0.1.14.
 */
import {
  formatDateKey,
  parseReminderDate,
  toLocalDateTimeValue,
} from '../calendar/dates'
import type { Task } from '../tasks'

export type ReminderPreset = 'soon' | 'tomorrow' | 'nextWeek'

/**
 * 'soon' is 30 minutes from now. 'tomorrow' and 'nextWeek' keep the time of
 * `current` (or now, without one) and move the day.
 */
export function reminderPresetValue(kind: ReminderPreset, current?: string) {
  const currentDate = parseReminderDate(current)
  const date = currentDate ? new Date(currentDate) : new Date()

  if (kind === 'soon') {
    date.setTime(Date.now())
    date.setMinutes(date.getMinutes() + 30)
  }

  if (kind === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  }

  if (kind === 'nextWeek') {
    date.setDate(date.getDate() + 7)
  }

  date.setSeconds(0, 0)

  return toLocalDateTimeValue(date)
}

/** A reminder `minutes` from now, for snooze. */
export function snoozedReminderValue(minutes: number) {
  const next = new Date()

  next.setMinutes(next.getMinutes() + minutes)
  next.setSeconds(0, 0)

  return toLocalDateTimeValue(next)
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "14:30" today, "Yesterday 16:00", "Tomorrow 09:00", otherwise
 * "Fri 13 Nov 09:00"; the year is added when it is not this year.
 */
export function formatReminder(reminderAt?: string, now: number = Date.now()) {
  const date = parseReminderDate(reminderAt)

  if (!date) {
    return ''
  }

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  const today = new Date(now)
  const dayDelta = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).getTime()) /
      DAY_MS,
  )

  if (formatDateKey(date) === formatDateKey(today)) {
    return time
  }

  if (dayDelta === -1) {
    return `Yesterday ${time}`
  }

  if (dayDelta === 1) {
    return `Tomorrow ${time}`
  }

  const day = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date)

  return `${day} ${time}`
}

/** An open task whose reminder time has passed. */
export function isOverdue(task: Task, now: number) {
  if (task.done) {
    return false
  }

  const date = parseReminderDate(task.reminderAt)

  return date ? date.getTime() < now : false
}
