/*
 * The task data the views share: the Today list, the Calendar list, the custom
 * lists, and every change that can be made to them. Storage keys and the
 * stored shapes are the ones the identity work set; nothing here migrates or
 * rewrites existing data.
 *
 * Views receive a `TaskStore` and call its methods. They never touch
 * localStorage themselves.
 */
import { useEffect, useMemo, useState } from 'react'
import { formatCalendarDay } from '../calendar/dates'
import type { GmailThreadSuggestion } from '../gmail'
import { scheduleLocalStorageWrite } from '../storage'
import { initialToday, monthPlan } from '../tasks'
import type { Task } from '../tasks'
import { usePersistentTasks } from '../usePersistentTasks'

const TASK_STORAGE_KEYS = {
  today: 'sidenib.today.v1',
  month: 'sidenib.month.v1',
} as const
const CUSTOM_LISTS_STORAGE_KEY = 'sidenib.custom-lists.v1'

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  focus: 0,
  normal: 1,
  later: 2,
}

export type TaskSortMode = 'priority' | 'newest' | 'oldest'
export type CalendarEntryMode = 'task' | 'event'

/** The two built-in lists. 'month' holds the Calendar's own entries. */
export type BuiltInListId = keyof typeof TASK_STORAGE_KEYS

/** Where a task lives. */
export type TaskRef =
  | { source: BuiltInListId }
  | { source: 'custom'; listId: string }

export type CustomTaskList = {
  id: string
  title: string
  tasks: Task[]
  /** Kept from v0.1.14 storage; the compact Lists view does not use it. */
  collapsed?: boolean
  showOnToday?: boolean
}

/** A task together with where it lives. */
export type TaskEntry = {
  ref: TaskRef
  listTitle: string
  task: Task
}

export interface TaskStore {
  todayTasks: Task[]
  monthTasks: Task[]
  customLists: CustomTaskList[]
  /** Every task in every list, for the calendar and reminders. */
  entries: TaskEntry[]

  addTask(ref: TaskRef, title: string, reminderAt?: string): void
  addCalendarEntry(
    title: string,
    date: Date,
    reminderAt: string,
    kind: CalendarEntryMode,
  ): void
  addGmailTask(suggestion: GmailThreadSuggestion): void
  toggleTask(ref: TaskRef, id: number): void
  cyclePriority(ref: TaskRef, id: number): void
  setReminder(ref: TaskRef, id: number, reminderAt: string | undefined): void
  renameTask(ref: TaskRef, id: number, title: string): void
  deleteTask(ref: TaskRef, id: number): void

  /** Returns the new list's id, or null for an empty title. */
  addList(title: string): string | null
  renameList(listId: string, title: string): void
  deleteList(listId: string): void
  toggleListOnToday(listId: string): void
}

const defaultCustomLists: CustomTaskList[] = [
  {
    id: 'general',
    title: 'General',
    tasks: [],
    collapsed: false,
  },
]

export function sortTasks(tasks: Task[], sortMode: TaskSortMode = 'priority') {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) {
      return a.done ? 1 : -1
    }

    if (sortMode === 'newest') {
      return b.id - a.id
    }

    if (sortMode === 'oldest') {
      return a.id - b.id
    }

    const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]

    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return b.id - a.id
  })
}

export function nextPriority(priority: Task['priority']): Task['priority'] {
  if (priority === 'normal') {
    return 'focus'
  }

  if (priority === 'focus') {
    return 'later'
  }

  return 'normal'
}

export const PRIORITY_LABELS: Record<Task['priority'], string> = {
  focus: 'Focus',
  later: 'Later',
  normal: 'Normal',
}

let lastTaskId = 0

/** Task ids are creation times; two tasks made in one millisecond differ. */
function nextTaskId() {
  lastTaskId = Math.max(Date.now(), lastTaskId + 1)
  return lastTaskId
}

function createTask(title: string, meta: string, reminderAt?: string): Task {
  return {
    id: nextTaskId(),
    title,
    meta,
    priority: 'normal',
    reminderAt: reminderAt || undefined,
  }
}

function loadCustomLists() {
  try {
    const stored = window.localStorage.getItem(CUSTOM_LISTS_STORAGE_KEY)

    if (!stored) {
      return defaultCustomLists
    }

    const parsed = JSON.parse(stored) as CustomTaskList[]

    if (!Array.isArray(parsed)) {
      return defaultCustomLists
    }

    return parsed
      .filter((list) => list && typeof list.id === 'string')
      .map((list) => ({
        id: list.id,
        title: typeof list.title === 'string' ? list.title : 'List',
        tasks: Array.isArray(list.tasks) ? list.tasks : [],
        collapsed: Boolean(list.collapsed),
        showOnToday: Boolean(list.showOnToday),
      }))
  } catch {
    return defaultCustomLists
  }
}

export function useTaskStore(): TaskStore {
  const [todayTasks, setTodayTasks] = usePersistentTasks(
    initialToday,
    TASK_STORAGE_KEYS.today,
  )
  const [monthTasks, setMonthTasks] = usePersistentTasks(
    monthPlan,
    TASK_STORAGE_KEYS.month,
  )
  const [customLists, setCustomLists] =
    useState<CustomTaskList[]>(loadCustomLists)

  useEffect(() => {
    return scheduleLocalStorageWrite(
      CUSTOM_LISTS_STORAGE_KEY,
      JSON.stringify(customLists),
    )
  }, [customLists])

  const actions = useMemo(() => {
    const updateTasks = (ref: TaskRef, updater: (tasks: Task[]) => Task[]) => {
      if (ref.source === 'custom') {
        const { listId } = ref

        setCustomLists((lists) =>
          lists.map((list) =>
            list.id === listId ? { ...list, tasks: updater(list.tasks) } : list,
          ),
        )
        return
      }

      const setter = ref.source === 'today' ? setTodayTasks : setMonthTasks

      setter(updater)
    }
    const patchTask = (
      ref: TaskRef,
      id: number,
      patch: (task: Task) => Task,
    ) => {
      updateTasks(ref, (tasks) =>
        tasks.map((task) => (task.id === id ? patch(task) : task)),
      )
    }

    return {
      addTask(ref: TaskRef, title: string, reminderAt?: string) {
        const trimmed = title.trim()

        if (!trimmed) {
          return
        }

        if (ref.source === 'custom') {
          const { listId } = ref

          // The meta line records the list name at creation, as before.
          setCustomLists((lists) =>
            lists.map((list) =>
              list.id === listId
                ? {
                    ...list,
                    tasks: [
                      createTask(trimmed, list.title, reminderAt),
                      ...list.tasks,
                    ],
                  }
                : list,
            ),
          )
          return
        }

        updateTasks(ref, (tasks) => [
          createTask(
            trimmed,
            ref.source === 'today' ? 'Today' : 'Calendar',
            reminderAt,
          ),
          ...tasks,
        ])
      },
      addCalendarEntry(
        title: string,
        date: Date,
        reminderAt: string,
        kind: CalendarEntryMode,
      ) {
        const trimmed = title.trim()

        if (!trimmed) {
          return
        }

        const isEvent = kind === 'event'

        setMonthTasks((tasks) => [
          {
            id: nextTaskId(),
            title: trimmed,
            kind,
            meta: `${formatCalendarDay(date)} · ${isEvent ? 'Event' : 'Calendar'}`,
            priority: isEvent ? 'focus' : 'normal',
            reminderAt,
          },
          ...tasks,
        ])
      },
      addGmailTask(suggestion: GmailThreadSuggestion) {
        setTodayTasks((tasks) => [
          {
            id: nextTaskId(),
            title: suggestion.subject,
            meta: `Gmail · ${suggestion.from}`,
            priority: 'normal',
            source: {
              from: suggestion.from,
              threadId: suggestion.threadId,
              type: 'gmail',
              url: suggestion.gmailUrl,
            },
          },
          ...tasks,
        ])
      },
      toggleTask(ref: TaskRef, id: number) {
        patchTask(ref, id, (task) => ({ ...task, done: !task.done }))
      },
      cyclePriority(ref: TaskRef, id: number) {
        patchTask(ref, id, (task) => ({
          ...task,
          priority: nextPriority(task.priority),
        }))
      },
      setReminder(ref: TaskRef, id: number, reminderAt: string | undefined) {
        patchTask(ref, id, (task) => ({
          ...task,
          reminderAt: reminderAt || undefined,
        }))
      },
      renameTask(ref: TaskRef, id: number, title: string) {
        const trimmed = title.trim()

        if (trimmed) {
          patchTask(ref, id, (task) => ({ ...task, title: trimmed }))
        }
      },
      deleteTask(ref: TaskRef, id: number) {
        updateTasks(ref, (tasks) => tasks.filter((task) => task.id !== id))
      },
      addList(title: string) {
        const trimmed = title.trim()

        if (!trimmed) {
          return null
        }

        const id = `${nextTaskId()}`

        setCustomLists((lists) => [
          ...lists,
          { id, title: trimmed, tasks: [], collapsed: false },
        ])
        return id
      },
      renameList(listId: string, title: string) {
        const trimmed = title.trim()

        if (trimmed) {
          setCustomLists((lists) =>
            lists.map((list) =>
              list.id === listId ? { ...list, title: trimmed } : list,
            ),
          )
        }
      },
      deleteList(listId: string) {
        setCustomLists((lists) => lists.filter((list) => list.id !== listId))
      },
      toggleListOnToday(listId: string) {
        setCustomLists((lists) =>
          lists.map((list) =>
            list.id === listId
              ? { ...list, showOnToday: !list.showOnToday }
              : list,
          ),
        )
      },
    }
  }, [setMonthTasks, setTodayTasks])

  const entries = useMemo(
    (): TaskEntry[] => [
      ...todayTasks.map((task) => ({
        listTitle: 'Today',
        ref: { source: 'today' as const },
        task,
      })),
      ...monthTasks.map((task) => ({
        listTitle: 'Calendar',
        ref: { source: 'month' as const },
        task,
      })),
      ...customLists.flatMap((list) =>
        list.tasks.map((task) => ({
          listTitle: list.title,
          ref: { source: 'custom' as const, listId: list.id },
          task,
        })),
      ),
    ],
    [customLists, monthTasks, todayTasks],
  )

  return useMemo(
    () => ({ todayTasks, monthTasks, customLists, entries, ...actions }),
    [actions, customLists, entries, monthTasks, todayTasks],
  )
}
