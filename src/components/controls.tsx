/*
 * The three setting controls: Segmented, Switch and Slider. One style each;
 * Settings and any other view use these and do not restyle them.
 */

export function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Names the group for assistive technology. */
  label: string
  value: Value
  options: Array<{ value: Value; label: string; ariaLabel?: string }>
  onChange(value: Value): void
}) {
  return (
    <div className="sn-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A labelled row with a switch. The whole row toggles it. */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange(checked: boolean): void
}) {
  return (
    <label className="sn-control-row">
      <span>{label}</span>
      <input
        className="sn-switch"
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

/** A labelled row with a bounded numeric value. */
export function Slider({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange(value: number): void
}) {
  return (
    <label className="sn-control-row sn-slider-row">
      <span>{label}</span>
      <em>
        {value}
        {suffix}
      </em>
      <input
        className="sn-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {description ? <small>{description}</small> : null}
    </label>
  )
}
