/*
 * Settings view, extracted from App.tsx (ADIEN-162) with every preference
 * kept: theme and preset, screen edge, tab order, desktop switches, backdrop,
 * panel and notch sizes, task density, motion, radius and opacity. Nothing is
 * removed and no stored value is converted. ADIEN-164 owns this folder and
 * the move to a short default page with an Advanced page.
 */
import { Moon, RotateCcw, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Segmented, Slider, Switch } from '../../components/controls'
import { Group } from '../../components/Group'
import { IconButton, TextButton } from '../../components/IconButton'
import { PanelView } from '../../components/PanelView'
import { Popover } from '../../components/Popover'
import type { GmailConnectorController } from '../../gmail'
import type {
  DockEdge,
  SidebarSettings,
  TabVisibility,
  TaskSortMode,
} from '../../sidebarSettings'
import { scheduleLocalStorageWrite } from '../../storage'
import { ConnectorSetting } from './ConnectorSetting'
import {
  BackdropSetting,
  SectionOrderSetting,
  ThemePresetDropdown,
} from './SettingsParts'
import {
  getNextThemePatch,
  getThemeOptions,
  moveSectionOrder,
  moveSectionOrderToIndex,
  THEME_PRESETS,
} from './themePresets'
import './settings.css'

export interface SettingsViewProps {
  settings: SidebarSettings
  onChange(patch: Partial<SidebarSettings>): void
  onReset(): void
  /** "Done": back to the view Settings was opened from. */
  onClose(): void
  /** Only passed while the held-back Gmail connector is enabled. */
  gmail?: GmailConnectorController
}

const SETTINGS_GROUPS_STORAGE_KEY = 'sidenib.settings.groups.v1'

type SettingsGroupId =
  | 'theme'
  | 'edge'
  | 'layout'
  | 'desktop'
  | 'connectors'
  | 'backdrop'
  | 'window'
  | 'tasks'
  | 'feel'

type CollapsedGroups = Partial<Record<SettingsGroupId, boolean>>

function loadCollapsedGroups(): CollapsedGroups {
  try {
    const stored = window.localStorage.getItem(SETTINGS_GROUPS_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as CollapsedGroups) : {}

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function SettingsView({
  settings,
  onChange,
  onReset,
  onClose,
  gmail,
}: SettingsViewProps) {
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(loadCollapsedGroups)
  const [panelWidthDraft, setPanelWidthDraft] = useState(() => ({
    base: settings.panelWidth,
    value: settings.panelWidth,
  }))
  const [backdropError, setBackdropError] = useState('')
  const resetRef = useRef<HTMLButtonElement>(null)
  const availableThemes = getThemeOptions(settings.theme)
  const selectedTheme =
    availableThemes.find((preset) => preset.id === settings.visualStyle) ??
    availableThemes[0] ??
    THEME_PRESETS[0]
  // The width is applied on Save, so the card does not resize under the
  // slider while it is being dragged.
  const draftPanelWidth =
    panelWidthDraft.base === settings.panelWidth
      ? panelWidthDraft.value
      : settings.panelWidth

  useEffect(() => {
    return scheduleLocalStorageWrite(
      SETTINGS_GROUPS_STORAGE_KEY,
      JSON.stringify(collapsed),
      180,
    )
  }, [collapsed])

  const group = (id: SettingsGroupId, title: string, children: ReactNode) => (
    <Group
      label={title}
      collapsible={{
        open: !collapsed[id],
        onToggle: () =>
          setCollapsed((current) => ({ ...current, [id]: !current[id] })),
      }}
    >
      {children}
    </Group>
  )

  const onBackdropUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setBackdropError('Use PNG, JPG, or WebP.')
      return
    }

    if (file.size > 1_500_000) {
      setBackdropError('Keep the image under 1.5 MB.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''

      if (!result.startsWith('data:image/')) {
        setBackdropError('Could not read that image.')
        return
      }

      setBackdropError('')
      onChange({ backdropImage: result, backdropImageName: file.name })
    }

    reader.onerror = () => setBackdropError('Could not read that image.')
    reader.readAsDataURL(file)
  }

  return (
    <PanelView
      id="settings"
      title="Settings"
      settingsAction={false}
      actions={
        <>
          <IconButton
            label={
              settings.theme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
            onClick={() =>
              onChange(getNextThemePatch(settings.theme, settings.visualStyle))
            }
          >
            {settings.theme === 'dark' ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </IconButton>
          <IconButton
            ref={resetRef}
            label="Reset settings"
            aria-expanded={isResetConfirmOpen}
            onClick={() => setIsResetConfirmOpen((current) => !current)}
          >
            <RotateCcw aria-hidden="true" />
          </IconButton>
          <TextButton onClick={onClose}>Done</TextButton>
          <Popover
            open={isResetConfirmOpen}
            anchorRef={resetRef}
            role="alertdialog"
            label="Reset settings confirmation"
            onClose={() => setIsResetConfirmOpen(false)}
          >
            <div className="sn-confirm">
              <span>
                Reset settings? Layout, theme, motion and sizing return to
                defaults. Tasks are kept.
              </span>
              <div>
                <button
                  type="button"
                  className="sn-confirm-button"
                  onClick={() => setIsResetConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sn-confirm-button is-danger"
                  onClick={() => {
                    onReset()
                    setIsResetConfirmOpen(false)
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </Popover>
        </>
      }
    >
      <div className="sn-settings">
        {group(
          'theme',
          'Theme',
          <ThemePresetDropdown
            key={settings.theme}
            options={availableThemes}
            selectedTheme={selectedTheme}
            value={settings.visualStyle}
            onChange={(visualStyle) => onChange({ visualStyle })}
          />,
        )}

        {group(
          'edge',
          'Screen edge',
          <div className="sn-control-block">
            <Segmented<DockEdge>
              label="Dock edge"
              value={settings.dockEdge}
              options={[
                { value: 'left', label: 'Left', ariaLabel: 'Dock left' },
                { value: 'top', label: 'Top', ariaLabel: 'Dock top' },
                { value: 'right', label: 'Right', ariaLabel: 'Dock right' },
              ]}
              onChange={(dockEdge) => onChange({ dockEdge })}
            />
          </div>,
        )}

        {group(
          'layout',
          'Tab order',
          <SectionOrderSetting
            order={settings.sectionOrder}
            onReorder={(section, targetIndex) =>
              onChange({
                sectionOrder: moveSectionOrderToIndex(
                  settings.sectionOrder,
                  section,
                  targetIndex,
                ),
              })
            }
            onMove={(section, direction) =>
              onChange({
                sectionOrder: moveSectionOrder(
                  settings.sectionOrder,
                  section,
                  direction,
                ),
              })
            }
          />,
        )}

        {group(
          'desktop',
          'Desktop',
          <>
            <Switch
              label="Launch at login"
              checked={settings.launchAtLogin}
              onChange={(launchAtLogin) => onChange({ launchAtLogin })}
            />
            <Switch
              label="Notifications"
              checked={settings.notificationsEnabled}
              onChange={(notificationsEnabled) =>
                onChange({ notificationsEnabled })
              }
            />
          </>,
        )}

        {gmail
          ? group('connectors', 'Connectors', <ConnectorSetting gmail={gmail} />)
          : null}

        {group(
          'tasks',
          'Tasks',
          <>
            <div className="sn-control-block">
              <Segmented<TaskSortMode>
                label="Task sort order"
                value={settings.taskSortMode}
                options={[
                  { value: 'priority', label: 'Priority' },
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                ]}
                onChange={(taskSortMode) => onChange({ taskSortMode })}
              />
            </div>
            <Switch
              label="Show completed"
              checked={settings.showCompleted}
              onChange={(showCompleted) => onChange({ showCompleted })}
            />
            <Slider
              label="Row height"
              value={settings.taskRowHeight}
              min={40}
              max={62}
              step={1}
              suffix="px"
              onChange={(taskRowHeight) => onChange({ taskRowHeight })}
            />
            <Slider
              label="Row gap"
              value={settings.taskGap}
              min={0}
              max={14}
              step={1}
              suffix="px"
              onChange={(taskGap) => onChange({ taskGap })}
            />
            <Slider
              label="Text size"
              value={settings.taskTextSize}
              min={11}
              max={14}
              step={0.5}
              suffix="px"
              onChange={(taskTextSize) => onChange({ taskTextSize })}
            />
          </>,
        )}

        {group(
          'backdrop',
          'Backdrop',
          <>
            <BackdropSetting
              error={backdropError}
              settings={settings}
              onClear={() =>
                onChange({ backdropImage: '', backdropImageName: '' })
              }
              onUpload={onBackdropUpload}
            />
            {settings.backdropImage ? (
              <>
                <Slider
                  label="Image strength"
                  value={settings.backdropOpacity}
                  min={30}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(backdropOpacity) => onChange({ backdropOpacity })}
                />
                <Slider
                  label="Background dim"
                  value={settings.backdropDim}
                  min={0}
                  max={70}
                  step={1}
                  suffix="%"
                  onChange={(backdropDim) => onChange({ backdropDim })}
                />
                <Slider
                  label="Soft blur"
                  value={settings.backdropBlur}
                  min={0}
                  max={18}
                  step={1}
                  suffix="px"
                  onChange={(backdropBlur) => onChange({ backdropBlur })}
                />
              </>
            ) : null}
          </>,
        )}

        {group(
          'window',
          'Panel and notch',
          <>
            <Slider
              label="Panel width"
              value={draftPanelWidth}
              min={320}
              max={560}
              step={4}
              suffix="px"
              onChange={(value) =>
                setPanelWidthDraft({ base: settings.panelWidth, value })
              }
            />
            <div className="sn-control-block">
              <button
                type="button"
                className="sn-chip"
                disabled={draftPanelWidth === settings.panelWidth}
                onClick={() => {
                  onChange({ panelWidth: draftPanelWidth })
                  setPanelWidthDraft({
                    base: draftPanelWidth,
                    value: draftPanelWidth,
                  })
                }}
              >
                Save width
              </button>
            </div>
            <Switch
              label="Full-height panel"
              checked={settings.panelHeightMode === 'full'}
              onChange={(checked) =>
                onChange({ panelHeightMode: checked ? 'full' : 'compact' })
              }
            />
            <Switch
              label="Hover-only tab"
              checked={settings.tabVisibility === 'hover'}
              onChange={(checked) =>
                onChange({
                  tabVisibility: (checked ? 'hover' : 'always') as TabVisibility,
                })
              }
            />
            <Slider
              label="Visible tab"
              value={settings.tabWidth}
              min={10}
              max={112}
              step={2}
              suffix="px"
              onChange={(tabWidth) => onChange({ tabWidth })}
            />
            <Slider
              label="Button height"
              value={settings.handleHeight}
              min={44}
              max={176}
              step={2}
              suffix="px"
              onChange={(handleHeight) => onChange({ handleHeight })}
            />
            <Slider
              label="Edge position"
              value={settings.handleY}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(handleY) => onChange({ handleY })}
            />
          </>,
        )}

        {group(
          'feel',
          'Feel',
          <>
            <Slider
              label="Motion"
              value={settings.motionMs}
              min={140}
              max={360}
              step={10}
              suffix="ms"
              onChange={(motionMs) => onChange({ motionMs })}
            />
            <Slider
              label="Corner radius"
              value={settings.panelRadius}
              min={12}
              max={28}
              step={1}
              suffix="px"
              onChange={(panelRadius) => onChange({ panelRadius })}
            />
            <Slider
              label="Panel opacity"
              value={settings.surfaceAlpha}
              min={58}
              max={100}
              step={1}
              suffix="%"
              description="Lower values let more of the desktop show through."
              onChange={(surfaceAlpha) => onChange({ surfaceAlpha })}
            />
          </>,
        )}
      </div>
    </PanelView>
  )
}
