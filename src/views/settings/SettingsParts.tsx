/*
 * The Settings rows and larger controls: a labelled row, a row that pushes a
 * page, the preset list, the backdrop image, and the tab-order list.
 */
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  GripVertical,
  ImagePlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { VIEW_LABELS } from '../../components/panelChrome'
import type {
  SectionId,
  SidebarSettings,
  ThemePreset,
} from '../../sidebarSettings'
import type { ThemePresetOption } from './themePresets'

/** A label on the left and one control on the right. */
export function SettingRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="sn-setting-row">
      <span>{label}</span>
      {children}
    </div>
  )
}

/** A row that pushes another Settings page. `id` is where focus comes back to. */
export function NavRow({
  id,
  label,
  value,
  onOpen,
}: {
  id: string
  label: string
  value?: string
  onOpen(): void
}) {
  return (
    <button
      type="button"
      className="sn-setting-row is-nav"
      data-nav={id}
      onClick={onOpen}
    >
      <span>{label}</span>
      {value ? <em>{value}</em> : null}
      <ChevronRight aria-hidden="true" />
    </button>
  )
}

function ThemeSwatch({ id, mode }: { id: ThemePreset; mode: string }) {
  return (
    <span
      className={`theme-swatch theme-preview-${id} is-${mode}`}
      aria-hidden="true"
    />
  )
}

/**
 * The preset list as native radios: Tab reaches the group, the arrow keys
 * move and choose, as in any radio group.
 */
export function ThemePresetList({
  options,
  value,
  onChange,
}: {
  options: ThemePresetOption[]
  /** The preset being drawn, after legacy and mode resolution. */
  value: ThemePreset
  onChange(value: ThemePreset): void
}) {
  return (
    <div className="sn-preset-list" role="radiogroup" aria-label="Theme preset">
      {options.map((preset) => (
        <label className="sn-setting-row sn-preset-row" key={preset.id}>
          <input
            className="sn-visually-hidden"
            type="radio"
            name="sn-theme-preset"
            checked={value === preset.id}
            onChange={() => onChange(preset.id)}
          />
          <ThemeSwatch id={preset.id} mode={preset.mode} />
          <span>
            <strong>{preset.label}</strong>
            <em>{preset.note}</em>
          </span>
          {value === preset.id ? <Check aria-hidden="true" /> : null}
        </label>
      ))}
    </div>
  )
}

export function BackdropSetting({
  error,
  settings,
  onClear,
  onUpload,
}: {
  error: string
  settings: SidebarSettings
  onClear: () => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="backdrop-setting">
      <div
        className="backdrop-preview"
        style={
          settings.backdropImage
            ? { backgroundImage: `url("${settings.backdropImage}")` }
            : undefined
        }
        aria-hidden="true"
      >
        {settings.backdropImage ? null : <ImagePlus />}
      </div>
      <div className="backdrop-copy">
        <strong>{settings.backdropImage
            ? settings.backdropImageName || 'Custom image'
            : 'No backdrop image'}</strong>
        <span>
          {settings.backdropImage
            ? 'Shown behind the card.'
            : 'PNG, JPG or WebP under 1.5 MB.'}
        </span>
        {error ? <em role="alert">{error}</em> : null}
      </div>
      <div className="backdrop-actions">
        <label className="sn-chip">
          Upload
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onUpload}
          />
        </label>
        <button
          type="button"
          className="sn-chip"
          disabled={!settings.backdropImage}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export function SectionOrderSetting({
  order,
  onMove,
  onReorder,
}: {
  order: SectionId[]
  onMove: (section: SectionId, direction: -1 | 1) => void
  onReorder: (section: SectionId, targetIndex: number) => void
}) {
  const [draggingSection, setDraggingSection] = useState<SectionId | null>(null)
  const [pointerDraggingSection, setPointerDraggingSection] =
    useState<SectionId | null>(null)
  const onDragOverRow = (
    event: DragEvent<HTMLDivElement>,
    section: SectionId,
  ) => {
    if (!draggingSection || draggingSection === section) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  useEffect(() => {
    if (!pointerDraggingSection) {
      return undefined
    }

    const stopDragging = () => setPointerDraggingSection(null)

    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [pointerDraggingSection])

  return (
    <div className="section-order-list" role="group" aria-label="Tab order">
      {order.map((section, index) => (
        <div
          className={`section-order-row ${
            draggingSection === section || pointerDraggingSection === section
              ? 'is-dragging'
              : ''
          }`}
          draggable
          key={section}
          onDragStart={(event) => {
            setDraggingSection(section)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', section)
          }}
          onDragEnd={() => setDraggingSection(null)}
          onDragOver={(event) => onDragOverRow(event, section)}
          onPointerEnter={() => {
            if (pointerDraggingSection && pointerDraggingSection !== section) {
              onReorder(pointerDraggingSection, index)
            }
          }}
          onDrop={(event) => {
            event.preventDefault()

            const droppedSection =
              (event.dataTransfer.getData('text/plain') as SectionId) ||
              draggingSection

            if (droppedSection) {
              onReorder(droppedSection, index)
            }

            setDraggingSection(null)
          }}
        >
          <span
            className="section-order-grip"
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault()
              setPointerDraggingSection(section)
            }}
          >
            <GripVertical />
          </span>
          <span>{VIEW_LABELS[section]}</span>
          <div>
            <button
              type="button"
              className="sn-icon-button"
              aria-label={`Move ${VIEW_LABELS[section]} up`}
              disabled={index === 0}
              onClick={() => onMove(section, -1)}
            >
              <ArrowUp aria-hidden="true" />
            </button>
            <button
              type="button"
              className="sn-icon-button"
              aria-label={`Move ${VIEW_LABELS[section]} down`}
              disabled={index === order.length - 1}
              onClick={() => onMove(section, 1)}
            >
              <ArrowDown aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
