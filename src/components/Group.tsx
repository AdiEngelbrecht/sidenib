import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface GroupProps {
  label?: string
  tone?: 'default' | 'danger'
  /** Renders the label as a disclosure; the rows hide while closed. */
  collapsible?: { open: boolean; onToggle(): void }
  children: ReactNode
}

/**
 * The one group: an optional small label and a raised, rounded block of rows
 * separated by inset hairlines. Groups are never nested.
 */
export function Group({ label, tone, collapsible, children }: GroupProps) {
  const labelClass = `sn-section-label ${tone === 'danger' ? 'is-danger' : ''}`
  const isOpen = collapsible ? collapsible.open : true

  return (
    <section className="sn-section">
      {label && collapsible ? (
        <button
          type="button"
          className={labelClass}
          aria-expanded={collapsible.open}
          onClick={collapsible.onToggle}
        >
          {collapsible.open ? (
            <ChevronDown aria-hidden="true" />
          ) : (
            <ChevronRight aria-hidden="true" />
          )}
          {label}
        </button>
      ) : label ? (
        <h2 className={labelClass}>{label}</h2>
      ) : null}
      {isOpen ? <div className="sn-group">{children}</div> : null}
    </section>
  )
}

/** A quiet one-line note inside a section, e.g. "No tasks in this list." */
export function GroupNote({ children }: { children: ReactNode }) {
  return <p className="sn-note">{children}</p>
}
