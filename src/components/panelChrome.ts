/*
 * What every view's frame needs from the app: the tabs, the Settings action
 * and whether the card is open. App.tsx provides it once; PanelView and the
 * popovers read it, so views do not pass it around.
 */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ViewId } from '../shell/types'

export interface PanelChrome {
  /** Tabs in the user's order. */
  tabs: ViewId[]
  /** null while Settings is showing. */
  activeTab: ViewId | null
  selectTab(view: ViewId): void
  openSettings(): void
  /** False while the card is closed; open popovers close with it. */
  isOpen: boolean
  /** Shown above the body of whichever view is up: the reminder banner. */
  banner?: ReactNode
}

export const PanelChromeContext = createContext<PanelChrome>({
  tabs: ['today', 'calendar', 'lists'],
  activeTab: 'today',
  selectTab: () => {},
  openSettings: () => {},
  isOpen: true,
})

export const usePanelChrome = () => useContext(PanelChromeContext)

export const VIEW_LABELS: Record<ViewId, string> = {
  calendar: 'Calendar',
  lists: 'Lists',
  today: 'Today',
}
