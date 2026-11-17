/*
 * The due check, moved out of App.tsx unchanged in behaviour: every 30 s it
 * looks for open tasks whose reminder time has passed, raises each one once
 * (remembered across launches), and keeps up to three toasts for 9 s.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskEntry, TaskRef } from '../data/taskStore'
import { formatReminder } from './reminderTime'

const NOTIFIED_REMINDERS_STORAGE_KEY = 'sidenib.notified-reminders.v1'
const TOAST_LIFETIME_MS = 9000
const CHECK_INTERVAL_MS = 30000

export type ReminderAlert = {
  id: string
  title: string
  dueLabel: string
  reminderAt?: string
  ref: TaskRef
  taskId: number
}

function loadNotifiedReminderKeys() {
  try {
    const stored = window.localStorage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as Record<string, boolean>) : {}

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function useReminders(entries: TaskEntry[], enabled: boolean) {
  const [alerts, setAlerts] = useState<ReminderAlert[]>([])
  const notifiedKeys = useRef<Record<string, boolean> | null>(null)

  const dismiss = useCallback((id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id))
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const raise = ({ ref, task }: TaskEntry) => {
      const id = `${task.id}:${task.reminderAt ?? 'now'}`
      const alert: ReminderAlert = {
        id,
        ref,
        title: task.title,
        dueLabel: formatReminder(task.reminderAt) || 'now',
        reminderAt: task.reminderAt,
        taskId: task.id,
      }

      setAlerts((current) =>
        [alert, ...current.filter((item) => item.id !== id)].slice(0, 3),
      )
      window.setTimeout(() => {
        setAlerts((current) => current.filter((item) => item.id !== id))
      }, TOAST_LIFETIME_MS)
    }

    const check = () => {
      const now = Date.now()
      const notified = (notifiedKeys.current ??= loadNotifiedReminderKeys())

      for (const entry of entries) {
        const { task } = entry

        if (!task.reminderAt || task.done) {
          continue
        }

        const dueTime = new Date(task.reminderAt).getTime()

        if (!Number.isFinite(dueTime) || dueTime > now) {
          continue
        }

        const key = `${task.id}:${task.reminderAt}`

        if (notified[key]) {
          continue
        }

        notified[key] = true
        window.localStorage.setItem(
          NOTIFIED_REMINDERS_STORAGE_KEY,
          JSON.stringify(notified),
        )
        raise(entry)
      }
    }

    check()

    const interval = window.setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [enabled, entries])

  return { alerts, dismiss }
}
