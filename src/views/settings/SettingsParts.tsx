/*
 * The larger Settings controls, moved out of App.tsx with their behaviour
 * kept: the preset dropdown, the backdrop image, and the tab-order list.
 */
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GripVertical,
  ImagePlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { VIEW_LABELS } from '../../components/panelChrome'
import type {
  SectionId,
  SidebarSettings,
  ThemePreset,
} from '../../sidebarSettings'
import type { ThemePresetOption } from './themePresets'

function ThemeSwatch({ id, mode }: { id: ThemePreset; mode: string }) {
  return (
    <span
      className={`theme-swatch theme-preview-${id} is-${mode}`}
      aria-hidden="true"
    />
  )
}

export function ThemePresetDropdown({
  options,
  selectedTheme,
  value,
  onChange,
}: {
  options: ThemePresetOption[]
  selectedTheme: ThemePresetOption
  value: ThemePreset
  onChange: (value: ThemePreset) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={`theme-dropdown ${isOpen ? 'is-open' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget

        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          setIsOpen(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        className="theme-dropdown-trigger"
        aria-label="Theme preset"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <ThemeSwatch id={selectedTheme.id} mode={selectedTheme.mode} />
        <span>
          <strong>{selectedTheme.label}</strong>
          <em>{selectedTheme.note}</em>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="theme-dropdown-menu" role="listbox" aria-label="Theme preset">
          {options.map((preset) => (
            <button
              type="button"
              key={`${preset.mode}-${preset.id}`}
              role="option"
              aria-label={`Choose ${preset.label}`}
              aria-selected={value === preset.id}
              onClick={() => {
                onChange(preset.id)
                setIsOpen(false)
              }}
            >
              <ThemeSwatch id={preset.id} mode={preset.mode} />
              <span>
                <strong>{preset.label}</strong>
                <em>{preset.note}</em>
              </span>
              {value === preset.id ? <Check aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
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
        <strong>{settings.backdropImageName || 'No custom backdrop'}</strong>
        <span>
          {settings.backdropImage
            ? 'Shown softly behind the panel.'
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
