import type { ReactNode } from 'react'

/** Centred in the scrolling body: one headline and one line. No artwork. */
export function EmptyState({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="sn-empty">
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  )
}
