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
 * A run of rows on the page under an optional label. The label is its own
 * ruled line; a collapsible label keeps its chevron in the margin. Nothing is
 * raised or boxed, and groups are never nested.
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
          <span className="sn-margin-cell" aria-hidden="true">
            {collapsible.open ? <ChevronDown /> : <ChevronRight />}
          </span>
          <span>{label}</span>
        </button>
      ) : label ? (
        <h2 className={labelClass}>
          <span className="sn-margin-cell" aria-hidden="true" />
          <span>{label}</span>
        </h2>
      ) : null}
      {isOpen ? <div className="sn-group">{children}</div> : null}
    </section>
  )
}

/** A quiet one-line note inside a section, e.g. "No tasks in this list." */
export function GroupNote({ children }: { children: ReactNode }) {
  return <p className="sn-note">{children}</p>
}
