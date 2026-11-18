import {
  Bell,
  BellRing,
  Check,
  Ellipsis,
  Flag,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { PRIORITY_LABELS } from '../data/taskStore'
import { formatReminder } from '../reminders/reminderTime'
import { taskNote } from '../tasks'
import type { Task } from '../tasks'
import { IconButton } from './IconButton'
import { ConfirmDelete, MenuItem, Popover } from './Popover'
import { ReminderPicker } from './ReminderPicker'

export interface TaskRowProps {
  task: Task
  /** The reminder time has passed; the reminder line turns to the danger colour. */
  overdue?: boolean
  /** Extra words for the secondary line, e.g. the list name in the Calendar. */
  detail?: string
  /** The list the task is in, so a stored note that only names it is hidden. */
  listTitle?: string
  /** The clock used to word the reminder ("Yesterday 16:00"). */
  now?: number
  onToggleDone(): void
  onRename(title: string): void
  onSetReminder(reminderAt: string | undefined): void
  onCyclePriority(): void
  onDelete(): void
}

type Layer = 'none' | 'reminder' | 'menu' | 'confirm'

/**
 * One task on one ruled line. The check sits in the margin; the reminder
 * time, an event mark, a note and the list name sit at the trailing end of
 * the first line. The title wraps to two lines and then truncates; the full
 * title is its tooltip and is shown whole while renaming. Focus priority is
 * a highlighter stroke on the title.
 *
 * Reminder and More sit over the trailing edge on hover or keyboard focus, so
 * nothing shifts. More holds Rename, Priority and Delete. Double-clicking the
 * title also renames.
 */
export function TaskRow({
  task,
  overdue = false,
  detail,
  listTitle,
  now,
  onToggleDone,
  onRename,
  onSetReminder,
  onCyclePriority,
  onDelete,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const [layer, setLayer] = useState<Layer>('none')
  const bellRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const reminderLabel = formatReminder(task.reminderAt, now)
  const isEvent = task.kind === 'event'
  const gmailUrl = task.source?.type === 'gmail' ? task.source.url : undefined
  const note = taskNote(task, listTitle)
  const hasMeta = Boolean(
    reminderLabel || detail || note || isEvent || gmailUrl,
  )

  useLayoutEffect(() => {
    const field = editRef.current

    if (isEditing && field) {
      // Grow to show the whole title, however long it is.
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight}px`
    }
  }, [draft, isEditing])

  const startRename = () => {
    setDraft(task.title)
    setLayer('none')
    setIsEditing(true)
  }
  const commitRename = () => {
    const nextTitle = draft.trim()

    if (nextTitle && nextTitle !== task.title) {
      onRename(nextTitle)
    }

    setIsEditing(false)
  }

  return (
    <div
      className={[
        'sn-row',
        'sn-task',
        task.done ? 'is-done' : '',
        overdue ? 'is-overdue' : '',
        hasMeta ? 'has-meta' : '',
        task.priority === 'focus' ? 'is-focus' : '',
        layer !== 'none' ? 'is-active' : '',
        isEditing ? 'is-editing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="sn-check"
        aria-label={
          task.done ? `Mark ${task.title} open` : `Complete ${task.title}`
        }
        onClick={onToggleDone}
      >
        <span>{task.done ? <Check aria-hidden="true" /> : null}</span>
      </button>
      <div className="sn-row-text">
        {isEditing ? (
          <textarea
            ref={editRef}
            className="sn-row-edit"
            aria-label={`Edit ${task.title}`}
            rows={1}
            value={draft}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onBlur={commitRename}
            onChange={(event) => setDraft(event.target.value.replace(/\n/g, ' '))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRename()
              }

              if (event.key === 'Escape') {
                // Escape leaves the rename; it does not close the card.
                event.preventDefault()
                event.stopPropagation()
                setIsEditing(false)
              }
            }}
          />
        ) : (
          <span
            className="sn-row-title"
            title={task.title}
            onDoubleClick={startRename}
          >
            <span className="sn-row-title-text">{task.title}</span>
            {task.priority === 'focus' ? (
              <span className="sn-visually-hidden sn-flag">
                , focus priority
              </span>
            ) : null}
          </span>
        )}
      </div>
      {hasMeta && !isEditing ? (
        <span className="sn-row-meta">
          {isEvent ? <span className="sn-row-kind task-kind-pill">Event</span> : null}
          {note ? <span className="sn-row-detail sn-row-note">{note}</span> : null}
          {detail ? <span className="sn-row-detail">{detail}</span> : null}
          {gmailUrl ? (
            <a href={gmailUrl} rel="noreferrer" target="_blank">
              Gmail
            </a>
          ) : null}
          {reminderLabel ? (
            <span className="task-reminder">
              {overdue ? <span className="sn-visually-hidden">Overdue, </span> : null}
              {reminderLabel}
            </span>
          ) : null}
        </span>
      ) : null}
      <div className="sn-row-actions">
        <IconButton
          ref={bellRef}
          label={
            task.reminderAt
              ? `Reminder ${reminderLabel} for ${task.title}. Change`
              : `Add reminder for ${task.title}`
          }
          className={task.reminderAt ? 'is-set' : ''}
          aria-haspopup="dialog"
          aria-expanded={layer === 'reminder'}
          onClick={() =>
            setLayer((current) => (current === 'reminder' ? 'none' : 'reminder'))
          }
        >
          {task.reminderAt ? (
            <BellRing aria-hidden="true" />
          ) : (
            <Bell aria-hidden="true" />
          )}
        </IconButton>
        <IconButton
          ref={moreRef}
          label={`More actions for ${task.title}`}
          aria-haspopup="menu"
          aria-expanded={layer === 'menu' || layer === 'confirm'}
          onClick={() =>
            setLayer((current) => (current === 'none' ? 'menu' : 'none'))
          }
        >
          <Ellipsis aria-hidden="true" />
        </IconButton>
      </div>

      <Popover
        open={layer === 'reminder'}
        anchorRef={bellRef}
        label={`Reminder for ${task.title}`}
        onClose={() => setLayer('none')}
      >
        <ReminderPicker
          value={task.reminderAt ?? ''}
          onChange={(value) => onSetReminder(value || undefined)}
          onPicked={() => setLayer('none')}
        />
      </Popover>
      <Popover
        open={layer === 'menu'}
        anchorRef={moreRef}
        role="menu"
        label={`Actions for ${task.title}`}
        onClose={() => setLayer('none')}
      >
        <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={startRename}>
          Rename
        </MenuItem>
        <MenuItem
          icon={<Flag aria-hidden="true" />}
          label={`Priority: ${PRIORITY_LABELS[task.priority]}. Change`}
          onSelect={onCyclePriority}
        >
          Priority
          <em>{PRIORITY_LABELS[task.priority]}</em>
        </MenuItem>
        <MenuItem
          icon={<Trash2 aria-hidden="true" />}
          tone="danger"
          onSelect={({ shiftKey }) => {
            // Shift skips the confirmation, as it always has.
            if (shiftKey) {
              setLayer('none')
              onDelete()
              return
            }

            setLayer('confirm')
          }}
        >
          Delete
        </MenuItem>
      </Popover>
      <Popover
        open={layer === 'confirm'}
        anchorRef={moreRef}
        role="alertdialog"
        label={`Confirm delete ${task.title}`}
        onClose={() => setLayer('none')}
      >
        <ConfirmDelete
          question="Delete task?"
          onCancel={() => setLayer('none')}
          onConfirm={onDelete}
        />
      </Popover>
    </div>
  )
}
