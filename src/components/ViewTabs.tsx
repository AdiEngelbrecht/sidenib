import { CalendarDays, List, Sun } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { ViewId } from '../shell/types'
import { usePanelChrome, VIEW_LABELS } from './panelChrome'

const ICONS: Record<ViewId, typeof Sun> = {
  calendar: CalendarDays,
  lists: List,
  today: Sun,
}

/**
 * The one segmented control at the foot of the card: Today, Calendar and
 * Lists in the user's order. Left and right arrows move between them.
 */
export function ViewTabs() {
  const { tabs, activeTab, selectTab } = usePanelChrome()

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0

    if (step === 0) {
      return
    }

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    )
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = tabs[(index + step + tabs.length) % tabs.length]

    event.preventDefault()
    selectTab(next)
    buttons[tabs.indexOf(next)]?.focus()
  }

  return (
    <div
      className="sn-tabs"
      role="tablist"
      aria-label="Views"
      onKeyDown={onKeyDown}
    >
      {tabs.map((view) => {
        const Icon = ICONS[view]
        const selected = view === activeTab

        return (
          <button
            type="button"
            key={view}
            className="sn-tab"
            role="tab"
            aria-selected={selected}
            // One tab stop: the selected tab, or the first while Settings shows.
            tabIndex={selected || (activeTab === null && view === tabs[0]) ? 0 : -1}
            onClick={() => selectTab(view)}
          >
            <Icon aria-hidden="true" />
            {VIEW_LABELS[view]}
          </button>
        )
      })}
    </div>
  )
}
