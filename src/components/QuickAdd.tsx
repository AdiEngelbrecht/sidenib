import { ArrowUp, Bell, BellRing, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Popover } from './Popover'
import { ReminderPicker } from './ReminderPicker'

export type EntryMode = 'task' | 'event'

export interface QuickAddProps {
  placeholder: string
  /** Accessible name of the field, e.g. "Add a task to Today". */
  ariaLabel: string
  onSubmit(title: string, reminderAt?: string): void
  /** Calendar only: a chip in the field that switches Task and Event. */
  entryMode?: { value: EntryMode; onChange(value: EntryMode): void }
  /** Calendar only: the time offered before a reminder is chosen. */
  suggestedReminder?: string
  /**
   * Keeps the unsent text while the user looks at another tab. Fields with
   * the same key share a draft; it is not written to disk.
   */
  draftKey?: string
}

const drafts = new Map<string, { title: string; reminder: string }>()

/**
 * The entry line: the next empty line of the page, placed by the view after
 * its open tasks. Enter adds the task and keeps focus here; Escape clears a
 * draft before the shell is allowed to close the card. It sticks to the top
 * or the foot of the scrolling body, so it is in view however long the list.
 *
 * The outer `quick-add` class is the hook the shell uses to focus the field
 * when the card is opened by shortcut (src/shell/useShell.ts).
 */
export function QuickAdd({
  placeholder,
  ariaLabel,
  onSubmit,
  entryMode,
  suggestedReminder,
  draftKey,
}: QuickAddProps) {
  const saved = draftKey ? drafts.get(draftKey) : undefined
  const [title, setTitle] = useState(saved?.title ?? '')
  const [reminder, setReminder] = useState(saved?.reminder ?? '')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasDraft = title.trim().length > 0

  const remember = (nextTitle: string, nextReminder: string) => {
    if (!draftKey) {
      return
    }

    if (nextTitle || nextReminder) {
      drafts.set(draftKey, { title: nextTitle, reminder: nextReminder })
    } else {
      drafts.delete(draftKey)
    }
  }
  const update = (nextTitle: string, nextReminder: string) => {
    setTitle(nextTitle)
    setReminder(nextReminder)
    remember(nextTitle, nextReminder)
  }
  const submit = () => {
    if (!hasDraft) {
      return
    }

    onSubmit(title.trim(), reminder || undefined)
    update('', '')
    setIsPickerOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="sn-quick quick-add">
      <div className={`sn-field ${reminder ? 'has-reminder' : ''}`}>
        <span className="sn-margin-cell" aria-hidden="true">
          <Plus />
        </span>
        <input
          ref={inputRef}
          type="text"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={title}
          autoComplete="off"
          onChange={(event) => update(event.target.value, reminder)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit()
            }

            if (event.key === 'Escape' && (title || reminder)) {
              event.preventDefault()
              update('', '')
            }
          }}
        />
        {entryMode ? (
          <button
            type="button"
            className="sn-chip"
            aria-label={`Entry type: ${
              entryMode.value === 'event' ? 'Event' : 'Task'
            }. Switch to ${entryMode.value === 'event' ? 'Task' : 'Event'}`}
            onClick={() =>
              entryMode.onChange(entryMode.value === 'event' ? 'task' : 'event')
            }
          >
            {entryMode.value === 'event' ? 'Event' : 'Task'}
          </button>
        ) : null}
        <button
          ref={bellRef}
          type="button"
          className="sn-icon-button sn-quick-bell"
          aria-label={reminder ? 'Edit reminder time' : 'Add reminder time'}
          title={reminder ? 'Edit reminder time' : 'Add reminder time'}
          aria-expanded={isPickerOpen}
          aria-haspopup="dialog"
          onClick={() => setIsPickerOpen((current) => !current)}
        >
          {reminder ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
        </button>
        {hasDraft ? (
          <button
            type="button"
            className="sn-quick-submit"
            aria-label="Add task"
            title="Add task"
            onClick={submit}
          >
            <ArrowUp aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Popover
        open={isPickerOpen}
        anchorRef={bellRef}
        label="Reminder"
        onClose={() => setIsPickerOpen(false)}
      >
        <ReminderPicker
          value={reminder}
          suggestedValue={suggestedReminder}
          onChange={(value) => update(title, value)}
          onPicked={() => {
            setIsPickerOpen(false)
            inputRef.current?.focus()
          }}
        />
      </Popover>
    </div>
  )
}
