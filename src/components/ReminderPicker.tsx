import { X } from 'lucide-react'
import { reminderPresetValue } from '../reminders/reminderTime'
import type { ReminderPreset } from '../reminders/reminderTime'

const PRESETS: Array<{ id: ReminderPreset; label: string; name: string }> = [
  { id: 'soon', label: '30 min', name: '30 minutes from now' },
  { id: 'tomorrow', label: 'Tomorrow', name: 'Tomorrow at the same time' },
  { id: 'nextWeek', label: 'Next week', name: 'Next week at the same time' },
]

/**
 * Reminder choice shown inside a Popover: three presets, an exact time and
 * Clear. Used by quick add and by every task row.
 */
export function ReminderPicker({
  value,
  suggestedValue = '',
  onChange,
  onPicked,
}: {
  /** The current reminder, '' for none. */
  value: string
  /** Shown in the time field while there is no reminder (Calendar's day). */
  suggestedValue?: string
  onChange(value: string): void
  /** Called after a preset or Clear, so the caller can close the popover. */
  onPicked?(): void
}) {
  const inputValue = value || suggestedValue

  return (
    <div className="sn-reminder-picker">
      <div className="sn-reminder-presets" role="group" aria-label="Reminder presets">
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-label={preset.name}
            onClick={() => {
              onChange(reminderPresetValue(preset.id, inputValue))
              onPicked?.()
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="sn-reminder-time">
        <span>Remind at</span>
        <input
          aria-label="Reminder time"
          type="datetime-local"
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {value ? (
        <button
          type="button"
          className="sn-reminder-clear"
          aria-label="Clear reminder"
          onClick={() => {
            onChange('')
            onPicked?.()
          }}
        >
          <X aria-hidden="true" />
          Clear reminder
        </button>
      ) : null}
    </div>
  )
}
