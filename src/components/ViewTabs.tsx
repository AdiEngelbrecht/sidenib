import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { usePanelChrome, VIEW_LABELS } from './panelChrome'

/**
 * The index line at the head of the page: Today, Calendar and Lists as words,
 * in the user's order. Left and right arrows move between them.
 */
export function ViewTabs() {
  const { tabs, activeTab, selectTab, holdTabFocus, takeTabFocus } =
    usePanelChrome()
  const listRef = useRef<HTMLDivElement>(null)

  // The index is drawn inside each view's header, so choosing a tab replaces
  // the tab that was focused. The next index to mount takes the focus back.
  useEffect(() => {
    if (takeTabFocus()) {
      listRef.current
        ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        ?.focus()
    }
  }, [takeTabFocus])

  const choose = (view: (typeof tabs)[number]) => {
    // Only when focus was on the index; a tray or toast navigation leaves
    // focus where it is.
    if (
      view !== activeTab &&
      listRef.current?.contains(document.activeElement)
    ) {
      holdTabFocus()
    }

    selectTab(view)
  }

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
    choose(next)
    buttons[tabs.indexOf(next)]?.focus()
  }

  return (
    <div
      ref={listRef}
      className="sn-index"
      role="tablist"
      aria-label="Views"
      onKeyDown={onKeyDown}
    >
      {tabs.map((view) => {
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
            onClick={() => choose(view)}
          >
            {VIEW_LABELS[view]}
          </button>
        )
      })}
    </div>
  )
}
