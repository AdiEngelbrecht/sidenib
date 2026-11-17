import { BellRing, X } from 'lucide-react'

export interface ReminderToastItem {
  id: string
  title: string
  dueLabel: string
}

/**
 * The compact reminder toast. Beside the closed notch it shows the newest
 * reminder and how many more are waiting. With the card open the reminder is
 * the ReminderBanner inside the view instead. It never opens the card by
 * itself and never takes focus.
 */
export function ReminderToast<Item extends ReminderToastItem>({
  items,
  placement,
  onOpen,
  onSnooze,
  onDismiss,
}: {
  /** Newest first; the toast shows items[0]. */
  items: Item[]
  placement: 'beside' | 'hidden'
  onOpen(item: Item): void
  onSnooze(item: Item): void
  onDismiss(item: Item): void
}) {
  const item = items[0]
  const more = items.length - 1

  return (
    <section
      className={`sn-toast is-${placement}`}
      aria-label="Reminder alerts"
      aria-live="polite"
      aria-atomic="false"
      inert={placement === 'hidden'}
    >
      {item ? (
        <article className="sn-toast-item" key={item.id} role="status">
          <button
            type="button"
            className="sn-toast-main"
            aria-label={`Open reminder ${item.title}`}
            onClick={() => onOpen(item)}
          >
            <BellRing size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="sn-toast-copy">
              <strong>{item.title}</strong>
              <span>
                Due {item.dueLabel}
                {more > 0 ? ` · +${more} more` : ''}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="sn-toast-action"
            aria-label={`Snooze ${item.title} 10 minutes`}
            onClick={() => onSnooze(item)}
          >
            10 min
          </button>
          <button
            type="button"
            className="sn-toast-action is-icon"
            aria-label={`Dismiss reminder ${item.title}`}
            onClick={() => onDismiss(item)}
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </article>
      ) : null}
    </section>
  )
}
