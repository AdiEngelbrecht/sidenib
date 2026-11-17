import { useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { usePanelChrome } from './panelChrome'

const MARGIN = 8
const GAP = 4
const FOCUSABLE =
  '[role^="menuitem"]:not(:disabled), button:not(:disabled), input:not(:disabled)'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/**
 * A small surface anchored to a control: menus, the reminder picker, delete
 * confirmation. It is placed with fixed positioning and kept inside the card,
 * so the scrolling body cannot clip it and it never reaches outside the
 * card's pointer region.
 *
 * Escape, a press outside, scrolling the body or closing the card dismisses
 * it. Focus moves in when it opens and returns to the anchor when it closes.
 */
export function Popover({
  open,
  anchorRef,
  onClose,
  label,
  role = 'dialog',
  className = '',
  children,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose(): void
  label: string
  role?: 'dialog' | 'menu' | 'alertdialog'
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const { isOpen: cardOpen } = usePanelChrome()

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const node = ref.current
    const anchor = anchorRef.current

    if (!open || !node || !anchor) {
      return
    }

    const place = () => {
      const at = anchor.getBoundingClientRect()
      const frame = anchor.closest('.sn-card')?.getBoundingClientRect() ?? {
        bottom: window.innerHeight,
        left: 0,
        right: window.innerWidth,
        top: 0,
      }
      const width = node.offsetWidth
      const height = node.offsetHeight
      const below = at.bottom + GAP
      const top =
        below + height > frame.bottom - MARGIN ? at.top - GAP - height : below

      node.style.left = `${clamp(
        at.right - width,
        frame.left + MARGIN,
        frame.right - MARGIN - width,
      )}px`
      node.style.top = `${clamp(
        top,
        frame.top + MARGIN,
        frame.bottom - MARGIN - height,
      )}px`
    }

    place()
    node.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
    window.addEventListener('resize', place)

    // A menu that turns into a confirmation changes size; keep it in place.
    const observer = new ResizeObserver(place)

    observer.observe(node)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, open])

  useEffect(() => {
    const anchor = anchorRef.current

    if (!open) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target

      if (
        target instanceof Node &&
        (ref.current?.contains(target) || anchor?.contains(target))
      ) {
        return
      }

      closeRef.current()
    }
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return
      }

      closeRef.current()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)

      // Hand focus back unless the user has already put it somewhere else.
      if (anchor?.isConnected && document.activeElement === document.body) {
        anchor.focus({ preventScroll: true })
      }
    }
  }, [anchorRef, open])

  useEffect(() => {
    if (open && !cardOpen) {
      closeRef.current()
    }
  }, [cardOpen, open])

  if (!open) {
    return null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Escape peels this layer only; the shell sees the event as handled.
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }

    if (role !== 'menu') {
      return
    }

    if (event.key === 'Tab') {
      onClose()
      return
    }

    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        '[role^="menuitem"]:not(:disabled)',
      ) ?? [],
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'ArrowDown'
        ? items[(index + 1) % items.length]
        : event.key === 'ArrowUp'
          ? items[(index - 1 + items.length) % items.length]
          : event.key === 'Home'
            ? items[0]
            : event.key === 'End'
              ? items[items.length - 1]
              : null

    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  return (
    <div
      ref={ref}
      className={`sn-popover ${className}`}
      role={role}
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

/** One action in a `role="menu"` popover. */
export function MenuItem({
  icon,
  children,
  tone,
  checked,
  label,
  onSelect,
}: {
  icon?: ReactNode
  children: ReactNode
  tone?: 'danger'
  /** Set for an on/off item; renders `menuitemcheckbox`. */
  checked?: boolean
  /** Accessible name when it should say more than the visible text. */
  label?: string
  onSelect(event: { shiftKey: boolean }): void
}) {
  return (
    <button
      type="button"
      className={`sn-menu-item ${tone === 'danger' ? 'is-danger' : ''}`}
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => onSelect({ shiftKey: event.shiftKey })}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

/** "Delete task?" with Cancel and Delete, shown inside a popover. */
export function ConfirmDelete({
  question,
  onCancel,
  onConfirm,
}: {
  question: string
  onCancel(): void
  onConfirm(): void
}) {
  return (
    <div className="sn-confirm">
      <span>{question}</span>
      <div>
        <button type="button" className="sn-confirm-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="sn-confirm-button is-danger"
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
