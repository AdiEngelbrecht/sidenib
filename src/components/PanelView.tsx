import { ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from './IconButton'
import { ViewTabs } from './ViewTabs'
import { usePanelChrome } from './panelChrome'

export interface PanelViewProps {
  /** Stable name of the view, exposed as `data-view` for tests and styling. */
  id: string
  title: string
  /** What assistive technology reads for the title when the drawn title is
   *  only part of it, e.g. "Today, Wednesday 18 November". */
  titleLabel?: string
  /** A large figure before the title: the day number on Today. */
  lead?: string
  subtitle?: string
  /** A quiet note at the trailing end of the title line, e.g. "4 open". */
  aside?: string
  /** A back button before the title; `label` names where it goes. */
  back?: { label: string; onBack(): void }
  /** Replaces the title while it is being edited (list rename). */
  titleEditor?: ReactNode
  /** Up to three IconButton or TextButton elements on the title line. */
  actions?: ReactNode
  /** The Settings button at the end of the index line. False in Settings. */
  settingsAction?: boolean
  /** Non-scrolling content between header and body. Calendar grid only. */
  fixed?: ReactNode
  /** Draws the margin rule; rows then keep their controls left of it. */
  margin?: boolean
  /** The scrolling body. */
  children: ReactNode
}

/**
 * The page every view renders exactly once (docs/design/notebook/README.md):
 * the index line with the three views, the title line, the head rule, an
 * optional fixed area and the single scrolling body. The entry line is part
 * of the body and is placed by the view. The card around it never grows;
 * long content scrolls in the body and the rules run on to the foot.
 */
export function PanelView({
  id,
  title,
  titleLabel,
  lead,
  subtitle,
  aside,
  back,
  titleEditor,
  actions,
  settingsAction = true,
  fixed,
  margin = true,
  children,
}: PanelViewProps) {
  const { openSettings, banner } = usePanelChrome()
  const titleId = useId()

  return (
    <section className="sn-view" data-view={id} aria-labelledby={titleId}>
      <header className="sn-header">
        <div className="sn-index-line">
          <ViewTabs />
          {settingsAction ? (
            <IconButton label="Settings" onClick={openSettings}>
              <SlidersHorizontal aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
        <div className="sn-title-line">
          {back ? (
            <button
              type="button"
              className="sn-back"
              aria-label={back.label}
              title={back.label}
              onClick={back.onBack}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
          ) : null}
          {lead ? (
            <span className="sn-lead" aria-hidden="true">
              {lead}
            </span>
          ) : null}
          <div className="sn-header-text">
            {titleEditor ?? (
              <h1
                className="sn-title"
                id={titleId}
                title={titleLabel ?? title}
                aria-label={titleLabel}
              >
                {title}
              </h1>
            )}
            {subtitle ? <p className="sn-subtitle">{subtitle}</p> : null}
          </div>
          {aside ? <p className="sn-aside">{aside}</p> : null}
          {actions ? <div className="sn-header-actions">{actions}</div> : null}
        </div>
      </header>
      {fixed ? <div className="sn-view-fixed">{fixed}</div> : null}
      {banner}
      <div className={`sn-view-body ${margin ? 'has-margin' : ''}`}>
        {children}
        {/* Empty rules to the foot of the page. */}
        <div className="sn-rules" aria-hidden="true" />
      </div>
    </section>
  )
}
