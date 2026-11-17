/*
 * Shell state: open and close, the notch gesture, focus, and keeping the
 * native window and its pointer regions in step with what is drawn.
 *
 * Views use the returned `shell` (see types.ts). Everything else on the
 * controller is for the shell's own components.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  SN,
  computeGeometry,
  notchPercent,
  pullProgress,
  relativeTo,
  repositionPercent,
  revealTransform,
  snapToDevicePixels,
} from './geometry'
import type { Rect, ShellEdge, ShellGeometry, ShellMode } from './geometry'
import { beginGesture, endGesture, moveGesture } from './gesture'
import type { GestureState } from './gesture'
import {
  applyNativeLayout,
  displayEquals,
  focusNativeShell,
  hasNativeBridge,
  isTauriRuntime,
  listenShellEvents,
  nextFrames,
  resolveDisplay,
  restoreNativeFocus,
  setNativeGesture,
  viewportSettles,
} from './nativeWindow'
import type { DisplayInfo } from './nativeWindow'
import { focusTargetFor, resolveModes } from './types'
import type { OpenSource, Shell, ShellSettings } from './types'

const REVEAL_MS = 220
const DISMISS_MS = 180
const REDUCED_MOTION_MS = 120
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface LayoutRequest {
  geometry: ShellGeometry
  windowMode: ShellMode
  interactiveMode: ShellMode
  scaleFactor: number
}

/** A request the native window has reached. */
interface AppliedLayout extends LayoutRequest {
  bounds: Rect
}

export interface ShellController {
  shell: Shell
  isNative: boolean
  edge: ShellEdge
  geometry: ShellGeometry
  /** Class names and CSS variables for the shell root element. */
  rootClassName: string
  rootStyle: CSSProperties
  notchRef: RefObject<HTMLButtonElement | null>
  cardRef: RefObject<HTMLDivElement | null>
  notch: {
    isOpen: boolean
    isHovered: boolean
    isPulling: boolean
    isDragging: boolean
    hoverOnly: boolean
    onPointerDown(event: ReactPointerEvent<HTMLButtonElement>): void
    onPointerMove(event: ReactPointerEvent<HTMLButtonElement>): void
    onPointerUp(event: ReactPointerEvent<HTMLButtonElement>): void
    onPointerCancel(event: ReactPointerEvent<HTMLButtonElement>): void
    onKeyboardActivate(): void
  }
  card: {
    /** Revealed and interactive. */
    isOpen: boolean
    /** Following the pointer during an inward pull. */
    isPulling: boolean
    style: CSSProperties
  }
  toast: {
    /** The toast sits beside the closed notch. */
    isBeside: boolean
  }
}

const subscribeViewport = (notify: () => void) => {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}
const viewportWidth = () => window.innerWidth
const viewportHeight = () => window.innerHeight
const zeroViewport = () => 0

const subscribeReducedMotion = (notify: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)

  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const prefersReducedMotion = () =>
  window.matchMedia(REDUCED_MOTION_QUERY).matches

const px = (value: number) => `${Math.round(value * 100) / 100}px`

function rectVars(name: string, rect: Rect) {
  return {
    [`--sn-${name}-x`]: px(rect.x),
    [`--sn-${name}-y`]: px(rect.y),
    [`--sn-${name}-w`]: px(rect.width),
    [`--sn-${name}-h`]: px(rect.height),
  }
}

function focusCard(card: HTMLElement | null, target: 'input' | 'card') {
  if (!card) {
    return
  }

  if (target === 'input') {
    const field = card.querySelector<HTMLElement>(
      '.quick-add input:not([disabled]), input[type="text"]:not([disabled])',
    )
    const fallback = card.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const next = field ?? fallback

    if (next) {
      next.focus({ preventScroll: true })
      return
    }
  }

  card.focus({ preventScroll: true })
}

export function useShell(options: {
  settings: ShellSettings
  /** Reveal duration preference in milliseconds. */
  motionMs: number
  /** A reminder is waiting to be shown beside the closed notch. */
  hasToast: boolean
  /** The user dragged the notch along its edge to a new percentage. */
  onNotchMove(percent: number): void
  /** The tray asked for Settings. */
  onOpenSettings(): void
  /** Lets the view consume Escape for an inner layer. Return true if it did. */
  onEscape?(): boolean
}): ShellController {
  const { settings, motionMs, hasToast, onNotchMove, onOpenSettings, onEscape } =
    options
  const [isNative] = useState(isTauriRuntime)
  const [hasBridge] = useState(() => isTauriRuntime() && hasNativeBridge())
  const [isOpen, setIsOpen] = useState(
    () => new URLSearchParams(window.location.search).get('open') === '1',
  )
  const [cardPresent, setCardPresent] = useState(isOpen)
  const [pullInward, setPullInward] = useState<number | null>(null)
  const [dragPercent, setDragPercent] = useState<number | null>(null)
  const [display, setDisplay] = useState<DisplayInfo | null>(null)
  const [applied, setApplied] = useState<AppliedLayout | null>(null)
  const [isBlank, setIsBlank] = useState(false)
  const [nativeHover, setNativeHover] = useState<string | null>(null)
  // With a native bridge the work area comes from the monitor, and the web
  // view's own size must not feed back into geometry.
  const innerWidth = useSyncExternalStore(
    subscribeViewport,
    hasBridge ? zeroViewport : viewportWidth,
  )
  const innerHeight = useSyncExternalStore(
    subscribeViewport,
    hasBridge ? zeroViewport : viewportHeight,
  )
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
  )

  const notchRef = useRef<HTMLButtonElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const gesture = useRef<GestureState | null>(null)
  const gestureStart = useRef<{ geometry: ShellGeometry; percent: number } | null>(
    null,
  )
  const lingerTimer = useRef(0)
  const openSource = useRef<OpenSource>('click')
  const displayRef = useRef<DisplayInfo | null>(null)
  const appliedRef = useRef<AppliedLayout | null>(null)
  const queue = useRef<{ running: boolean; pending: LayoutRequest | null }>({
    running: false,
    pending: null,
  })

  const revealMs = reducedMotion ? REDUCED_MOTION_MS : motionMs
  const dismissMs = reducedMotion
    ? REDUCED_MOTION_MS
    : Math.round((motionMs * DISMISS_MS) / REVEAL_MS)

  // ---- geometry -----------------------------------------------------------

  const workArea = useMemo<Rect | null>(() => {
    if (hasBridge) {
      return display?.workArea ?? null
    }

    return { x: 0, y: 0, width: innerWidth, height: innerHeight }
  }, [display, hasBridge, innerHeight, innerWidth])

  const geometry = useMemo(
    () =>
      computeGeometry(
        workArea ?? { x: 0, y: 0, width: innerWidth, height: innerHeight },
        {
          edge: settings.dockEdge,
          notchY: dragPercent ?? settings.handleY,
          panelWidth: settings.panelWidth,
          heightMode: settings.panelHeightMode,
          notchWidth: settings.tabWidth,
          notchHeight: settings.handleHeight,
          cardRadius: settings.panelRadius,
        },
      ),
    [
      dragPercent,
      innerHeight,
      innerWidth,
      settings.dockEdge,
      settings.handleHeight,
      settings.handleY,
      settings.panelHeightMode,
      settings.panelRadius,
      settings.panelWidth,
      settings.tabWidth,
      workArea,
    ],
  )

  const { windowMode, interactiveMode } = resolveModes({
    isOpen,
    cardPresent,
    pulling: pullInward !== null,
    hasToast,
  })

  const request = useMemo<LayoutRequest>(
    () => ({
      geometry,
      windowMode,
      interactiveMode,
      scaleFactor: display?.scaleFactor ?? 1,
    }),
    [display, geometry, interactiveMode, windowMode],
  )

  // ---- native window ------------------------------------------------------

  const commitLayouts = useCallback(async () => {
    const state = queue.current

    if (state.running) {
      return
    }

    state.running = true

    try {
      while (state.pending) {
        const next = state.pending
        const previous = appliedRef.current
        const bounds = snapToDevicePixels(
          next.geometry.windows[next.windowMode],
          next.scaleFactor,
        )
        const resized =
          !previous ||
          previous.bounds.width !== bounds.width ||
          previous.bounds.height !== bounds.height

        state.pending = null

        // A resize repaints a frame late. Hide what is drawn first so the
        // notch never shows at the old offset inside the new bounds.
        if (previous && resized) {
          setIsBlank(true)
          await nextFrames(2)
        }

        await applyNativeLayout({
          bounds,
          scaleFactor: next.scaleFactor,
          regions: next.geometry.interactive[next.interactiveMode].map(
            (region) => relativeTo(region, bounds),
          ),
          show: !previous,
        })

        if (previous && resized) {
          await viewportSettles(bounds.width, bounds.height)
        }

        const layout = { ...next, bounds }

        appliedRef.current = layout
        setApplied(layout)
        setIsBlank(false)
      }
    } finally {
      state.running = false
    }
  }, [])

  useEffect(() => {
    if (!hasBridge || !display) {
      return
    }

    queue.current.pending = request
    void commitLayouts()
  }, [commitLayouts, display, hasBridge, request])

  const refreshDisplay = useCallback(
    async (preferCursor: boolean) => {
      if (!hasBridge) {
        return
      }

      const next = await resolveDisplay(preferCursor)

      if (next && !displayEquals(next, displayRef.current)) {
        displayRef.current = next
        setDisplay(next)
      }
    },
    [hasBridge],
  )

  useEffect(() => {
    // Launch: start on the display the pointer is on, as the baseline did.
    void refreshDisplay(true)
  }, [refreshDisplay])

  // What is on screen right now. Without a bridge the request is the layout.
  const layout: AppliedLayout = useMemo(() => {
    if (hasBridge) {
      return (
        applied ?? {
          ...request,
          bounds: snapToDevicePixels(
            request.geometry.windows[request.windowMode],
            request.scaleFactor,
          ),
        }
      )
    }

    return {
      ...request,
      bounds: { x: 0, y: 0, width: innerWidth, height: innerHeight },
    }
  }, [applied, hasBridge, innerHeight, innerWidth, request])

  const isReady = !hasBridge || applied !== null
  const cardOpen = isOpen && layout.windowMode === 'open'
  const isPulling = pullInward !== null && layout.windowMode === 'open'
  const toastBeside = !isOpen && layout.windowMode === 'toast'

  // ---- open and close -----------------------------------------------------

  const linger = useCallback(() => {
    window.clearTimeout(lingerTimer.current)
    setCardPresent(true)
    lingerTimer.current = window.setTimeout(
      () => setCardPresent(false),
      dismissMs + 40,
    )
  }, [dismissMs])

  const open = useCallback(
    (source: OpenSource) => {
      const reveal = () => {
        openSource.current = source
        window.clearTimeout(lingerTimer.current)
        setCardPresent(true)
        setIsOpen(true)
      }

      if (hasBridge && (source === 'shortcut' || source === 'tray')) {
        // Follow the pointer to its display before the card appears.
        void refreshDisplay(true).finally(reveal)
        return
      }

      reveal()
      void refreshDisplay(false)
    },
    [hasBridge, refreshDisplay],
  )

  const isOpenRef = useRef(isOpen)

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  const close = useCallback(() => {
    if (isOpenRef.current) {
      // Keep the window at the open bounds while the card eases out.
      linger()
    }

    setIsOpen(false)
    void refreshDisplay(false)
  }, [linger, refreshDisplay])

  const toggle = useCallback(
    (source: OpenSource) => {
      if (isOpenRef.current) {
        close()
      } else {
        open(source)
      }
    },
    [close, open],
  )

  useEffect(() => () => window.clearTimeout(lingerTimer.current), [])

  // ---- focus --------------------------------------------------------------

  const wasCardOpen = useRef(false)

  useEffect(() => {
    if (cardOpen === wasCardOpen.current) {
      return
    }

    wasCardOpen.current = cardOpen

    if (cardOpen) {
      const target = focusTargetFor(openSource.current)

      if (hasBridge) {
        void focusNativeShell().then(() => focusCard(cardRef.current, target))
      } else {
        focusCard(cardRef.current, target)
      }

      return
    }

    const active = document.activeElement

    if (active instanceof HTMLElement && cardRef.current?.contains(active)) {
      notchRef.current?.focus({ preventScroll: true })
    }

    if (hasBridge) {
      // Hand focus back to the app that had it before the card opened.
      void restoreNativeFocus()
    }
  }, [cardOpen, hasBridge])

  // ---- keyboard, tray and native events -----------------------------------

  const handlers = useRef({ close, onEscape, onOpenSettings, open, toggle })

  useEffect(() => {
    handlers.current = { close, onEscape, onOpenSettings, open, toggle }
  }, [close, onEscape, onOpenSettings, open, toggle])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggle =
        event.altKey &&
        event.shiftKey &&
        event.code === 'KeyS' &&
        !event.metaKey

      if (isToggle) {
        event.preventDefault()
        handlers.current.toggle('shortcut')
        return
      }

      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      if (!isOpenRef.current) {
        return
      }

      event.preventDefault()

      // Escape peels one layer at a time; the card is the last layer.
      if (!handlers.current.onEscape?.()) {
        handlers.current.close()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!hasBridge) {
      return
    }

    let stop: (() => void) | undefined
    let cancelled = false

    void listenShellEvents({
      onShortcutToggle: () => handlers.current.toggle('shortcut'),
      onTrayToggle: () => handlers.current.toggle('tray'),
      onTraySettings: () => {
        handlers.current.onOpenSettings()
        handlers.current.open('tray')
      },
      onHover: setNativeHover,
      onDisplayChange: () => void refreshDisplay(false),
    }).then((unlisten) => {
      if (cancelled) {
        unlisten()
      } else {
        stop = unlisten
      }
    })

    return () => {
      cancelled = true
      stop?.()
    }
  }, [hasBridge, refreshDisplay])

  // ---- notch gesture ------------------------------------------------------

  const lastPointerEnd = useRef(-Infinity)

  const endNotchGesture = useCallback(() => {
    gesture.current = null
    gestureStart.current = null
    setPullInward(null)
    setDragPercent(null)

    if (hasBridge) {
      void setNativeGesture(false)
    }
  }, [hasBridge])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || gesture.current) {
        return
      }

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Capture is best-effort; the gesture still works inside the notch.
      }

      gesture.current = beginGesture(
        geometry.edge,
        {
          screenX: event.screenX,
          screenY: event.screenY,
          time: event.timeStamp,
        },
        isOpen,
      )
      gestureStart.current = { geometry, percent: notchPercent(geometry) }

      if (hasBridge) {
        void setNativeGesture(true)
      }
    },
    [geometry, hasBridge, isOpen],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const current = gesture.current
      const start = gestureStart.current

      if (!current || !start) {
        return
      }

      const next = moveGesture(current, {
        screenX: event.screenX,
        screenY: event.screenY,
        time: event.timeStamp,
      })

      gesture.current = next

      if (next.kind === 'pulling') {
        setPullInward(Math.max(0, next.inward))
      } else if (next.kind === 'reposition') {
        setDragPercent(
          repositionPercent(start.geometry, start.percent, next.along),
        )
      }
    },
    [],
  )

  const finishPointer = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
      const current = gesture.current
      const start = gestureStart.current

      if (!current || !start) {
        return
      }

      lastPointerEnd.current = performance.now()

      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Capture can already be gone after a native pointer handoff.
      }

      const sample = {
        screenX: event.screenX,
        screenY: event.screenY,
        time: event.timeStamp,
      }
      const result = cancelled
        ? current.kind === 'pulling'
          ? 'cancel'
          : 'none'
        : endGesture(current, sample)

      if (result === 'reposition') {
        const moved = moveGesture(current, sample)

        onNotchMove(
          Math.round(
            repositionPercent(start.geometry, start.percent, moved.along) * 10,
          ) / 10,
        )
      } else if (result === 'cancel') {
        // The card eases back before the window shrinks.
        linger()
      } else if (result === 'open') {
        open('pull')
      } else if (result === 'click') {
        toggle('click')
      }

      endNotchGesture()
    },
    [endNotchGesture, linger, onNotchMove, open, toggle],
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => finishPointer(event, false),
    [finishPointer],
  )
  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => finishPointer(event, true),
    [finishPointer],
  )
  // Enter or Space on the notch arrives as a click with no pointer press. Some
  // input sources (assistive and automation tools) also report a pointer
  // click that way; the gesture has already handled those, so a click that
  // lands right after a pointer release is not a second activation.
  const onKeyboardActivate = useCallback(() => {
    if (performance.now() - lastPointerEnd.current < 400) {
      return
    }

    toggle('shortcut')
  }, [toggle])

  // ---- what the components draw -------------------------------------------

  const drawn = layout.geometry
  const origin = layout.bounds
  const edge = drawn.edge
  const notchIsOpen = cardOpen
  const hitRect = relativeTo(notchIsOpen ? drawn.hitOpen : drawn.hit, origin)
  const notchRect = notchIsOpen ? drawn.notchOpen : drawn.notch
  const thickness = edge === 'top' ? notchRect.height : notchRect.width
  const length = edge === 'top' ? notchRect.width : notchRect.height
  const cardRect = relativeTo(drawn.card, origin)
  const toastRect = relativeTo(drawn.toast, origin)

  // Under reduced motion the pull does not track the pointer: the card fades
  // in once the pull passes the commit distance.
  const pullAmount =
    pullInward === null
      ? null
      : reducedMotion
        ? pullInward >= SN.pull.commit
          ? 1
          : 0
        : pullProgress(pullInward)

  const cardStyle = useMemo<CSSProperties>(() => {
    if (!isPulling || pullAmount === null || reducedMotion) {
      return isPulling && pullAmount !== null ? { opacity: pullAmount } : {}
    }

    const reveal = revealTransform(edge, pullAmount)

    return {
      opacity: reveal.opacity,
      transform: `translate(${px(reveal.translateX)}, ${px(reveal.translateY)}) scale(${reveal.scale})`,
      transition: 'none',
    }
  }, [edge, isPulling, pullAmount, reducedMotion])

  const rootStyle = useMemo(
    () =>
      ({
        ...rectVars('hit', hitRect),
        ...rectVars('card', cardRect),
        ...rectVars('toast', toastRect),
        '--sn-notch-thickness': px(thickness),
        '--sn-notch-length': px(length),
        '--sn-radius-card': px(drawn.cardRadius),
        // The reveal grows out of the notch.
        '--sn-card-origin-x': px(drawn.anchor.x - drawn.card.x),
        '--sn-card-origin-y': px(drawn.anchor.y - drawn.card.y),
        '--sn-motion-reveal': `${revealMs}ms`,
        '--sn-motion-dismiss': `${dismissMs}ms`,
      }) as CSSProperties,
    [
      cardRect,
      dismissMs,
      drawn.anchor.x,
      drawn.anchor.y,
      drawn.card.x,
      drawn.card.y,
      drawn.cardRadius,
      hitRect,
      length,
      revealMs,
      thickness,
      toastRect,
    ],
  )

  const rootClassName = [
    'sn-shell',
    `sn-edge-${edge}`,
    `sn-mode-${layout.windowMode}`,
    hasBridge ? 'sn-bridged' : '',
    isBlank || !isReady ? 'sn-blank' : '',
    drawn.compactCalendar ? 'sn-compact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const shell = useMemo<Shell>(
    () => ({
      isOpen,
      compact: geometry.compactCalendar,
      open,
      close,
      toggle,
    }),
    [close, geometry.compactCalendar, isOpen, open, toggle],
  )

  return {
    shell,
    isNative,
    edge,
    geometry: drawn,
    rootClassName,
    rootStyle,
    notchRef,
    cardRef,
    notch: {
      isOpen: notchIsOpen,
      isHovered: nativeHover === 'notch',
      isPulling: pullInward !== null,
      isDragging: dragPercent !== null,
      hoverOnly: settings.tabVisibility === 'hover',
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyboardActivate,
    },
    card: {
      isOpen: cardOpen,
      isPulling,
      style: cardStyle,
    },
    toast: {
      isBeside: toastBeside,
    },
  }
}
