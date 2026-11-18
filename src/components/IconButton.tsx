import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

/** The one icon button: 28 x 28, labelled, with the label as its tooltip. */
export function IconButton({
  label,
  children,
  className = '',
  ref,
  ...rest
}: {
  label: string
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'type'>) {
  return (
    <button
      ref={ref}
      type="button"
      className={`sn-icon-button ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  )
}

/** The one text button: gold label, used for Back, Done and Today. */
export function TextButton({
  children,
  className = '',
  ref,
  ...rest
}: {
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) {
  return (
    <button
      ref={ref}
      type="button"
      className={`sn-text-button ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
