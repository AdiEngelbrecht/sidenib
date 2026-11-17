import { TaskRow } from '../components/TaskRow'
import type { TaskRef, TaskStore } from '../data/taskStore'
import { isOverdue } from '../reminders/reminderTime'
import type { Task } from '../tasks'

/**
 * Task rows for one list, wired to the store. Every view that shows tasks
 * from a single list renders them through this, so a row behaves the same
 * wherever it appears.
 */
export function TaskRows({
  store,
  taskRef,
  tasks,
  now,
}: {
  store: TaskStore
  taskRef: TaskRef
  tasks: Task[]
  now: number
}) {
  const listTitle =
    taskRef.source === 'custom'
      ? store.customLists.find((list) => list.id === taskRef.listId)?.title
      : undefined

  return tasks.map((task) => (
    <TaskRow
      key={task.id}
      task={task}
      now={now}
      listTitle={listTitle}
      overdue={isOverdue(task, now)}
      onToggleDone={() => store.toggleTask(taskRef, task.id)}
      onRename={(title) => store.renameTask(taskRef, task.id, title)}
      onSetReminder={(reminderAt) =>
        store.setReminder(taskRef, task.id, reminderAt)
      }
      onCyclePriority={() => store.cyclePriority(taskRef, task.id)}
      onDelete={() => store.deleteTask(taskRef, task.id)}
    />
  ))
}
