import { ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from './IconButton'
import { QuickAdd } from './QuickAdd'
import type { QuickAddProps } from './QuickAdd'
import { usePanelChrome } from './panelChrome'

export interface PanelViewProps {
  /** Stable name of the view, exposed as `data-view` for tests and styling. */
  id: string
  title: string
  subtitle?: string
  /** A gold back label above the title, e.g. "Lists". */
  back?: { label: string; onBack(): void }
  /** Replaces the title while it is being edited (list rename). */
  titleEditor?: ReactNode
  /**
   * Up to three IconButton or TextButton elements. The Settings action is
   * appended here by the frame; pass `settingsAction={false}` to leave it out.
   */
  actions?: ReactNode
  settingsAction?: boolean
  /** Non-scrolling content between header and body. Calendar grid only. */
  fixed?: ReactNode
  quickAdd?: QuickAddProps
  /** The scrolling body. */
  children: ReactNode
}

/**
 * The frame every view renders exactly once: header, optional fixed area, the
 * single scrolling body and quick add. App.tsx puts the tabs under it. The
 * card around it never grows; long content scrolls in the body.
 */
export function PanelView({
  id,
  title,
  subtitle,
  back,
  titleEditor,
  actions,
  settingsAction = true,
  fixed,
  quickAdd,
  children,
}: PanelViewProps) {
  const { openSettings } = usePanelChrome()
  const [isScrolled, setIsScrolled] = useState(false)
  const titleId = useId()

  return (
    <section className="sn-view" data-view={id} aria-labelledby={titleId}>
      <header className={`sn-header ${isScrolled ? 'is-scrolled' : ''}`}>
        <div className="sn-header-text">
          {back ? (
            <button type="button" className="sn-back" onClick={back.onBack}>
              <ChevronLeft aria-hidden="true" />
              {back.label}
            </button>
          ) : null}
          {titleEditor ?? (
            <h1 className="sn-title" id={titleId} title={title}>
              {title}
            </h1>
          )}
          {subtitle ? <p className="sn-subtitle">{subtitle}</p> : null}
        </div>
        <div className="sn-header-actions">
          {actions}
          {settingsAction ? (
            <IconButton label="Settings" onClick={openSettings}>
              <SlidersHorizontal aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
      </header>
      {fixed}
      <div
        className="sn-view-body"
        onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 0)}
      >
        {children}
      </div>
      {quickAdd ? (
        <QuickAdd key={quickAdd.draftKey ?? id} {...quickAdd} />
      ) : null}
    </section>
  )
}
