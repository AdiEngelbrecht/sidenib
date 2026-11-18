import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  formatLongDay,
  formatMonthName,
  formatWeekday,
  parseReminderDate,
} from '../../calendar/dates'
import { Group, GroupNote } from '../../components/Group'
import { PanelView } from '../../components/PanelView'
import { QuickAdd } from '../../components/QuickAdd'
import { sortTasks } from '../../data/taskStore'
import type { TaskRef, TaskSortMode, TaskStore } from '../../data/taskStore'
import { isOverdue } from '../../reminders/reminderTime'
import { TaskRows } from '../TaskRows'

export interface TodayViewProps {
  store: TaskStore
  sortMode: TaskSortMode
  showCompleted: boolean
  /** The clock, from `useNow`. Decides what is overdue. */
  now: number
  /** Shown above the tasks. Used for the held-back Gmail suggestions. */
  banner?: ReactNode
}

const TODAY: TaskRef = { source: 'today' }
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const SHORTCUT = isMac ? '⌥⇧S' : 'Alt+Shift+S'

/**
 * Today: overdue first, then the open tasks, then the entry line as the next
 * empty line, then one group per list pinned to Today (each can be folded;
 * the fold is stored with the list), then a Completed disclosure.
 */
export function TodayView({
  store,
  sortMode,
  showCompleted,
  now,
  banner,
}: TodayViewProps) {
  // null follows the default: closed, or open once everything is done.
  const [completedOpen, setCompletedOpen] = useState<boolean | null>(null)
  const { overdue, open, done } = useMemo(() => {
    const sorted = sortTasks(store.todayTasks, sortMode)

    return {
      // Oldest first: the one that has waited longest leads.
      overdue: sorted
        .filter((task) => isOverdue(task, now))
        .sort(
          (a, b) =>
            (parseReminderDate(a.reminderAt)?.getTime() ?? 0) -
            (parseReminderDate(b.reminderAt)?.getTime() ?? 0),
        ),
      open: sorted.filter((task) => !task.done && !isOverdue(task, now)),
      done: sorted.filter((task) => task.done),
    }
  }, [now, sortMode, store.todayTasks])
  const pinnedLists = useMemo(
    () => store.customLists.filter((list) => list.showOnToday),
    [store.customLists],
  )
  const openCount = overdue.length + open.length
  const allDone = openCount === 0 && done.length > 0
  const isCompletedOpen = completedOpen ?? allDone
  const showDone = showCompleted && done.length > 0
  const isEmpty = openCount === 0 && !showDone && pinnedLists.length === 0

  const today = new Date(now)
  const entryLine = (
    <QuickAdd
      key="today"
      ariaLabel="Add a task to Today"
      draftKey="today"
      placeholder="New task"
      onSubmit={(title, reminderAt) => store.addTask(TODAY, title, reminderAt)}
    />
  )

  return (
    <PanelView
      id="today"
      title={formatWeekday(today)}
      titleLabel={`Today, ${formatLongDay(today)}`}
      lead={String(today.getDate())}
      subtitle={formatMonthName(today)}
      aside={`${openCount} open`}
    >
      {banner}
      {overdue.length > 0 ? (
        <Group label={`Overdue · ${overdue.length}`} tone="danger">
          <TaskRows store={store} taskRef={TODAY} tasks={overdue} now={now} />
        </Group>
      ) : null}
      {open.length > 0 ? (
        <Group label={overdue.length > 0 ? 'Today' : undefined}>
          <TaskRows store={store} taskRef={TODAY} tasks={open} now={now} />
        </Group>
      ) : null}
      {entryLine}
      {isEmpty ? (
        <GroupNote>
          Nothing for today. Write the first line above, or press{' '}
          <kbd>{SHORTCUT}</kbd> from any app.
        </GroupNote>
      ) : allDone ? (
        <GroupNote>All done for today.</GroupNote>
      ) : null}
      {pinnedLists.map((list) => {
        const sorted = sortTasks(list.tasks, sortMode)
        const visible = showCompleted
          ? sorted
          : sorted.filter((task) => !task.done)
        const openInList = list.tasks.filter((task) => !task.done).length

        return (
          <Group
            key={list.id}
            // Folded, the label carries what is hidden.
            label={list.collapsed ? `${list.title} · ${openInList}` : list.title}
            collapsible={{
              open: !list.collapsed,
              onToggle: () => store.toggleListCollapsed(list.id),
            }}
          >
            {visible.length > 0 ? (
              <TaskRows
                store={store}
                taskRef={{ source: 'custom', listId: list.id }}
                tasks={visible}
                now={now}
              />
            ) : (
              <GroupNote>No tasks in this list.</GroupNote>
            )}
          </Group>
        )
      })}
      {showDone ? (
        <Group
          label={`Completed · ${done.length}`}
          collapsible={{
            open: isCompletedOpen,
            onToggle: () => setCompletedOpen(!isCompletedOpen),
          }}
        >
          <TaskRows store={store} taskRef={TODAY} tasks={done} now={now} />
        </Group>
      ) : null}
    </PanelView>
  )
}
