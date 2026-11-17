import type { ReactNode } from 'react'
import type { ShellController } from './useShell'

/**
 * The open card frame: bounded size, rounded on every corner, clipped, and
 * revealed out of the notch. Content scrolls inside it; the frame never grows
 * with its content. While closed the content is inert.
 */
export function PanelCard({
  controller,
  id,
  label,
  children,
}: {
  controller: ShellController
  id: string
  label: string
  children: ReactNode
}) {
  const { card, cardRef } = controller
  const className = [
    'sn-card',
    card.isOpen ? 'is-open' : '',
    card.isPulling ? 'is-pulling' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={cardRef}
      id={id}
      className={className}
      role="dialog"
      aria-label={label}
      aria-hidden={!card.isOpen}
      inert={!card.isOpen}
      tabIndex={-1}
      style={card.style}
    >
      {children}
    </div>
  )
}
