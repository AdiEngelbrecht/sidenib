/*
 * Shell contract shared with the view workspaces (design contract section 8).
 * Views depend on these types only; they never read native window state.
 */
import type { ShellMode } from './geometry'

export type ViewId = 'today' | 'calendar' | 'lists'

export type Route =
  | { view: 'today' }
  | { view: 'calendar'; dateKey?: string } // 'YYYY-MM-DD'
  | { view: 'lists'; listId?: string }
  | { view: 'settings' }

export type OpenSource = 'click' | 'pull' | 'shortcut' | 'tray' | 'toast'

/** How the card should take focus once it is revealed. */
export type FocusTarget = 'input' | 'card'

export const focusTargetFor = (source: OpenSource): FocusTarget =>
  source === 'shortcut' ? 'input' : 'card'

export interface Shell {
  isOpen: boolean
  /** True when the card is shorter than 420. */
  compact: boolean
  open(source: OpenSource): void
  close(): void
  toggle(source: OpenSource): void
}

/** What the shell needs from the stored preferences. */
export interface ShellSettings {
  dockEdge: 'right' | 'left' | 'top' | 'bottom'
  panelWidth: number
  panelHeightMode: 'compact' | 'full'
  panelRadius: number
  tabWidth: number
  handleHeight: number
  handleY: number
  tabVisibility: 'always' | 'hover'
}

export interface ShellPhase {
  /** The user wants the card open. */
  isOpen: boolean
  /** The card is still mounted in its window: open, or playing its dismiss. */
  cardPresent: boolean
  /** An inward pull is in progress. */
  pulling: boolean
  /** A reminder toast is showing beside the closed notch. */
  hasToast: boolean
}

/**
 * Chooses the native window bounds and the pointer regions for a phase.
 *
 * The window stays at the open bounds for as long as the card can be seen,
 * including the pull and the dismiss animation. The pointer regions follow
 * intent instead: once the card is dismissed, or while it is only being
 * pulled, the card no longer intercepts the pointer.
 */
export function resolveModes(phase: ShellPhase): {
  windowMode: ShellMode
  interactiveMode: ShellMode
} {
  const resting: ShellMode = phase.hasToast ? 'toast' : 'collapsed'

  if (phase.isOpen) {
    return { windowMode: 'open', interactiveMode: 'open' }
  }

  if (phase.pulling || phase.cardPresent) {
    return { windowMode: 'open', interactiveMode: 'collapsed' }
  }

  return { windowMode: resting, interactiveMode: resting }
}
