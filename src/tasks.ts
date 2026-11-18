export type Task = {
  id: number
  title: string
  meta: string
  priority: 'focus' | 'normal' | 'later'
  kind?: 'task' | 'event'
  reminderAt?: string
  source?: {
    from?: string
    threadId?: string
    type: 'gmail'
    url?: string
  }
  done?: boolean
}

export const initialToday: Task[] = [
  {
    id: 1,
    title: 'Design sidebar shell',
    meta: 'Today · 40 min',
    priority: 'focus',
  },
  {
    id: 2,
    title: 'Prototype desktop shortcut',
    meta: 'Today · Native hook',
    priority: 'normal',
  },
  {
    id: 3,
    title: 'Capture inbox',
    meta: 'Quick add',
    priority: 'normal',
    done: true,
  },
]

export const monthPlan: Task[] = [
  {
    id: 4,
    title: 'Open source roadmap',
    meta: 'May · Milestone 0.1',
    priority: 'focus',
  },
  {
    id: 5,
    title: 'Later',
    meta: 'Park ideas without pressure',
    priority: 'later',
  },
]

/** Labels the views already show another way: the list, the day, the kind. */
const DERIVED_META = new Set(['today', 'calendar', 'event'])

/**
 * The part of a task's stored `meta` worth showing on its second line.
 *
 * v0.1.14 drew `meta` under every title. Most of it repeated where the task
 * lives ("Today", "16 Nov · Calendar"), which the compact views say with the
 * view, the group and the reminder. What is left is the user-relevant part:
 * "Today · 40 min" gives "40 min", "Gmail · Mara" gives "Mara". The stored
 * value is never rewritten.
 */
export function taskNote(
  task: Pick<Task, 'meta' | 'source'>,
  /** The list the task is in; a note that only names it is not repeated. */
  listTitle?: string,
): string {
  const parts = (typeof task.meta === 'string' ? task.meta : '')
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean)
  const last = parts.at(-1)?.toLowerCase()

  // "<day> · Calendar" and "<day> · Event" are written by calendar capture;
  // the day there is the reminder, which the row shows and keeps current.
  if (parts.length === 2 && (last === 'calendar' || last === 'event')) {
    return ''
  }

  return parts
    .filter((part) => {
      const label = part.toLowerCase()

      return !(
        DERIVED_META.has(label) ||
        label === listTitle?.trim().toLowerCase() ||
        (label === 'gmail' && task.source?.type === 'gmail')
      )
    })
    .join(' · ')
}
