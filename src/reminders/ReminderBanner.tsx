import { X } from 'lucide-react'
import type { ReminderToastItem } from './ReminderToast'

/**
 * A due reminder while the card is open: a gold banner at the top of the
 * current view's body, with the same actions as the toast. The frame
 * (PanelView) places it above the scrolling body, so the view does not
 * switch, nothing scrolls and nothing takes focus.
 */
export function ReminderBanner<Item extends ReminderToastItem>({
  items,
  onOpen,
  onSnooze,
  onDismiss,
}: {
  /** Newest first; the banner shows items[0]. */
  items: Item[]
  onOpen(item: Item): void
  onSnooze(item: Item): void
  onDismiss(item: Item): void
}) {
  const item = items[0]
  const more = items.length - 1

  if (!item) {
    return null
  }

  return (
    <section
      className="sn-banner"
      aria-label="Reminder alerts"
      aria-live="polite"
      aria-atomic="false"
    >
      <article className="sn-banner-item" key={item.id} role="status">
        <button
          type="button"
          className="sn-banner-main"
          aria-label={`Open reminder ${item.title}`}
          onClick={() => onOpen(item)}
        >
          <strong>{item.title}</strong>
          <span>
            Due {item.dueLabel}
            {more > 0 ? ` · +${more} more` : ''}
          </span>
        </button>
        <button
          type="button"
          className="sn-banner-action"
          aria-label={`Snooze ${item.title} 10 minutes`}
          onClick={() => onSnooze(item)}
        >
          10 min
        </button>
        <button
          type="button"
          className="sn-banner-action is-icon"
          aria-label={`Dismiss reminder ${item.title}`}
          onClick={() => onDismiss(item)}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </article>
    </section>
  )
}
