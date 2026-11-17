import type { ShellController } from './useShell'

/**
 * The closed notch and its pointer target. A click toggles the card, an
 * inward pull reveals it, and a drag along the edge moves the notch.
 */
export function NotchHandle({
  controller,
  reminderCount,
  controls,
}: {
  controller: ShellController
  reminderCount: number
  /** id of the card element this button controls. */
  controls: string
}) {
  const { notch, notchRef } = controller
  const action = notch.isOpen ? 'Close Sidenib' : 'Open Sidenib'
  const label =
    reminderCount > 0
      ? `${action}, ${reminderCount} ${reminderCount === 1 ? 'reminder' : 'reminders'}`
      : action
  const className = [
    'sn-notch',
    notch.isOpen ? 'is-open' : '',
    notch.isHovered ? 'is-hovered' : '',
    notch.isPulling ? 'is-pulling' : '',
    notch.isDragging ? 'is-dragging' : '',
    notch.hoverOnly ? 'is-hover-only' : '',
    reminderCount > 0 ? 'has-reminder' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={notchRef}
      className={className}
      type="button"
      aria-label={label}
      aria-expanded={notch.isOpen}
      aria-controls={controls}
      onPointerDown={notch.onPointerDown}
      onPointerMove={notch.onPointerMove}
      onPointerUp={notch.onPointerUp}
      onPointerCancel={notch.onPointerCancel}
      onClick={(event) => {
        // Pointer presses are handled by the gesture; this is Enter or Space.
        if (event.detail === 0) {
          notch.onKeyboardActivate()
        }
      }}
    >
      <span className="sn-notch-pill" aria-hidden="true">
        {reminderCount > 0 && !notch.isOpen ? (
          <span className="sn-notch-badge">
            {reminderCount > 9 ? '9+' : reminderCount}
          </span>
        ) : null}
      </span>
    </button>
  )
}
