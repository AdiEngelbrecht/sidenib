/*
 * Pure state for a pointer gesture that starts on the notch. It tells a click
 * from an inward pull and from a drag along the edge using the 6 px movement
 * threshold in geometry.ts, and latches the decision so a pull that wanders
 * sideways stays a pull.
 */
import { SN, classifyNotchGesture, gestureAxes } from './geometry'
import type { ShellEdge } from './geometry'

export interface GestureSample {
  screenX: number
  screenY: number
  /** Milliseconds, monotonic. */
  time: number
}

export type GestureKind = 'pending' | 'pulling' | 'reposition' | 'ignored'
export type GestureResult = 'click' | 'open' | 'cancel' | 'reposition' | 'none'

export interface GestureState {
  edge: ShellEdge
  /** Pulling and repositioning only start from the closed notch. */
  cardOpen: boolean
  start: GestureSample
  last: GestureSample
  kind: GestureKind
  /** Travel away from the docked edge; positive is inward. */
  inward: number
  /** Travel along the docked edge. */
  along: number
  /** Smoothed inward speed in px/ms at the last move. */
  velocity: number
}

/** A release this long after the last move is not a flick. */
const FLICK_WINDOW_MS = 100

export function beginGesture(
  edge: ShellEdge,
  sample: GestureSample,
  cardOpen: boolean,
): GestureState {
  return {
    edge,
    cardOpen,
    start: sample,
    last: sample,
    kind: 'pending',
    inward: 0,
    along: 0,
    velocity: 0,
  }
}

export function moveGesture(
  state: GestureState,
  sample: GestureSample,
): GestureState {
  const { inward, along } = gestureAxes(
    state.edge,
    sample.screenX - state.start.screenX,
    sample.screenY - state.start.screenY,
  )
  const elapsed = sample.time - state.last.time
  const instant = elapsed > 0 ? (inward - state.inward) / elapsed : 0
  const velocity =
    elapsed > 0 ? state.velocity * 0.4 + instant * 0.6 : state.velocity
  let kind = state.kind

  if (kind === 'pending') {
    const classified = classifyNotchGesture({ dx: inward, dy: along })

    if (classified === 'pulling' || classified === 'reposition') {
      kind = state.cardOpen ? 'ignored' : classified
    }
  }

  return { ...state, last: sample, kind, inward, along, velocity }
}

export function endGesture(
  state: GestureState,
  sample: GestureSample,
): GestureResult {
  const moved = moveGesture(state, sample)

  if (moved.kind === 'pending') {
    return 'click'
  }

  if (moved.kind === 'reposition') {
    return 'reposition'
  }

  if (moved.kind === 'ignored') {
    return 'none'
  }

  // A pause before letting go is a slow pull, not a flick.
  const flick =
    sample.time - state.last.time <= FLICK_WINDOW_MS ? state.velocity : 0

  return moved.inward >= SN.pull.commit || flick >= SN.pull.flick
    ? 'open'
    : 'cancel'
}
