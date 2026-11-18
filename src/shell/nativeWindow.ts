/*
 * Bridge to the native shell in src-tauri/src/shell.rs. Every call is
 * best-effort: in a browser (including the ?runtime=tauri preview used by the
 * smoke tests) there is no bridge and the shell lays itself out inside the
 * viewport instead.
 */
import type { InteractiveRegion, Rect } from './geometry'

export const TRAY_TOGGLE_EVENT = 'sidenib-tray-toggle'
export const SHORTCUT_TOGGLE_EVENT = 'sidenib-shortcut-toggle'
export const TRAY_SETTINGS_EVENT = 'sidenib-tray-settings'
export const HOVER_EVENT = 'sidenib-shell-hover'
export const DISPLAY_EVENT = 'sidenib-display-changed'

export interface DisplayInfo {
  /** Monitor work area in logical pixels, global top-left origin. */
  workArea: Rect
  scaleFactor: number
}

export const isTauriRuntime = () =>
  new URLSearchParams(window.location.search).get('runtime') === 'tauri' ||
  window.location.protocol === 'tauri:' ||
  navigator.userAgent.includes('Tauri') ||
  '__TAURI_INTERNALS__' in window ||
  '__TAURI__' in window

/** True when native commands can actually be invoked. */
export const hasNativeBridge = () => '__TAURI_INTERNALS__' in window

async function invokeShell(command: string, args?: Record<string, unknown>) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')

    await invoke(command, args)
    return true
  } catch {
    return false
  }
}

/**
 * Finds the monitor the shell lives on and returns its work area in logical
 * pixels. `preferCursor` picks the monitor under the pointer, which is how
 * the shell follows the user to another display.
 */
export async function resolveDisplay(
  preferCursor: boolean,
): Promise<DisplayInfo | null> {
  try {
    const { currentMonitor, cursorPosition, monitorFromPoint, primaryMonitor } =
      await import('@tauri-apps/api/window')
    let monitor = null

    if (preferCursor) {
      try {
        const cursor = await cursorPosition()

        monitor = await monitorFromPoint(cursor.x, cursor.y)
      } catch {
        monitor = null
      }
    }

    monitor ??= await currentMonitor()
    monitor ??= await primaryMonitor()

    if (!monitor) {
      return null
    }

    const scaleFactor = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1
    const { position, size } = monitor.workArea

    return {
      scaleFactor,
      workArea: {
        x: position.x / scaleFactor,
        y: position.y / scaleFactor,
        width: size.width / scaleFactor,
        height: size.height / scaleFactor,
      },
    }
  } catch {
    return null
  }
}

export function displayEquals(a: DisplayInfo | null, b: DisplayInfo | null) {
  if (!a || !b) {
    return a === b
  }

  return (
    a.scaleFactor === b.scaleFactor &&
    a.workArea.x === b.workArea.x &&
    a.workArea.y === b.workArea.y &&
    a.workArea.width === b.workArea.width &&
    a.workArea.height === b.workArea.height
  )
}

export function applyNativeLayout(layout: {
  bounds: Rect
  scaleFactor: number
  /** Relative to `bounds`. */
  regions: InteractiveRegion[]
  /** Show the window; used once the first layout is in place. */
  show: boolean
}) {
  return invokeShell('shell_apply_layout', layout)
}

export const setNativeGesture = (active: boolean) =>
  invokeShell('shell_set_gesture', { active })

export const focusNativeShell = () => invokeShell('shell_focus')

export const restoreNativeFocus = () => invokeShell('shell_restore_focus')

export interface ShellEventHandlers {
  onShortcutToggle(): void
  onTrayToggle(): void
  onTraySettings(): void
  onHover(region: string | null): void
  onDisplayChange(): void
}

export async function listenShellEvents(handlers: ShellEventHandlers) {
  try {
    const { listen } = await import('@tauri-apps/api/event')
    const unlisten = await Promise.all([
      listen(SHORTCUT_TOGGLE_EVENT, () => handlers.onShortcutToggle()),
      listen(TRAY_TOGGLE_EVENT, () => handlers.onTrayToggle()),
      listen(TRAY_SETTINGS_EVENT, () => handlers.onTraySettings()),
      listen<{ region: string | null }>(HOVER_EVENT, (event) =>
        handlers.onHover(event.payload?.region ?? null),
      ),
      listen(DISPLAY_EVENT, () => handlers.onDisplayChange()),
    ])

    return () => unlisten.forEach((stop) => stop())
  } catch {
    return () => undefined
  }
}

/** Resolves after `count` animation frames, or a short timeout if frames stall. */
export function nextFrames(count: number) {
  return new Promise<void>((resolve) => {
    let remaining = count
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    const step = () => {
      remaining -= 1

      if (remaining <= 0) {
        finish()
      } else {
        window.requestAnimationFrame(step)
      }
    }

    window.requestAnimationFrame(step)
    window.setTimeout(finish, count * 50)
  })
}

/** Resolves once the web view reports the size the native window was given. */
export function viewportSettles(width: number, height: number) {
  return new Promise<void>((resolve) => {
    const deadline = performance.now() + 240
    const check = () => {
      const settled =
        Math.abs(window.innerWidth - width) < 1.5 &&
        Math.abs(window.innerHeight - height) < 1.5

      if (settled || performance.now() >= deadline) {
        resolve()
      } else {
        window.setTimeout(check, 8)
      }
    }

    check()
  })
}
