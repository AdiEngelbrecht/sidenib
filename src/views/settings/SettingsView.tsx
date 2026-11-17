/*
 * Settings (ADIEN-164): a short default page of everyday choices and an
 * Advanced page that keeps every tuning control from v0.1.14. Tab order, the
 * theme preset and the backdrop image are pushed pages. Everything stays
 * inside the card: pages replace each other in the one scrolling body, and
 * the reset confirmation is a popover clamped to the card.
 *
 * No preference is removed and no stored value is converted; see
 * src/sidebarSettings.ts for the defaults and the legacy preset mapping.
 */
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Segmented, Slider, Switch } from '../../components/controls'
import { Group } from '../../components/Group'
import { TextButton } from '../../components/IconButton'
import { VIEW_LABELS, usePanelChrome } from '../../components/panelChrome'
import { PanelView } from '../../components/PanelView'
import { Popover } from '../../components/Popover'
import type { GmailConnectorController } from '../../gmail'
import {
  resolveThemePreset,
  useMediaQuery,
  useResolvedTheme,
} from '../../sidebarSettings'
import type {
  DockEdge,
  PanelHeightMode,
  SidebarSettings,
  TabVisibility,
  TaskSortMode,
  ThemePreference,
} from '../../sidebarSettings'
import { ConnectorSetting } from './ConnectorSetting'
import {
  BackdropSetting,
  NavRow,
  SectionOrderSetting,
  SettingRow,
  ThemePresetList,
} from './SettingsParts'
import {
  getParkedPreset,
  getThemeOptions,
  moveSectionOrder,
  moveSectionOrderToIndex,
  TOGGLE_SHORTCUT,
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

type SettingsPage = 'main' | 'tab-order' | 'advanced' | 'preset' | 'backdrop'

const PAGES: Record<
  SettingsPage,
  { title: string; parent?: SettingsPage }
> = {
  main: { title: 'Settings' },
  'tab-order': { title: 'Tab order', parent: 'main' },
  advanced: { title: 'Advanced', parent: 'main' },
  preset: { title: 'Theme preset', parent: 'advanced' },
  backdrop: { title: 'Backdrop image', parent: 'advanced' },
}

export function SettingsView({
  settings,
  onChange,
  onReset,
  onClose,
  gmail,
}: SettingsViewProps) {
  const [page, setPage] = useState<SettingsPage>('main')
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [panelWidthDraft, setPanelWidthDraft] = useState(() => ({
    base: settings.panelWidth,
    value: settings.panelWidth,
  }))
  const [backdropError, setBackdropError] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<HTMLButtonElement>(null)
  // Where focus goes once the next page is on screen: the back label after a
  // push, the row that pushed after a return.
  const pendingFocus = useRef<string | null>(null)
  const { isOpen: cardOpen } = usePanelChrome()
  const mode = useResolvedTheme(settings.theme)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const presetOptions = getThemeOptions(mode)
  const drawnPreset = resolveThemePreset(settings.visualStyle, mode)
  const parkedPreset = getParkedPreset(settings.visualStyle, mode)
  const drawnPresetLabel =
    presetOptions.find((preset) => preset.id === drawnPreset)?.label ??
    'Sidenib'
  // The width is applied on request, so the card does not resize under the
  // slider while it is being dragged.
  const draftPanelWidth =
    panelWidthDraft.base === settings.panelWidth
      ? panelWidthDraft.value
      : settings.panelWidth
  const parent = PAGES[page].parent

  const push = (next: SettingsPage) => {
    pendingFocus.current = '.sn-back'
    setPage(next)
  }

  useEffect(() => {
    const selector = pendingFocus.current

    pendingFocus.current = null

    if (selector) {
      bodyRef.current
        ?.closest('.sn-view')
        ?.querySelector<HTMLElement>(selector)
        ?.focus()
    }
  }, [page])

  // Escape peels a pushed page before the shell closes Settings. Popovers
  // stop the event themselves, and the shell skips a prevented one.
  useEffect(() => {
    if (!parent || !cardOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      event.preventDefault()
      pendingFocus.current = `[data-nav="${page}"]`
      setPage(parent)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cardOpen, page, parent])

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

  const mainPage = (
    <>
      <Group label="Appearance">
        <SettingRow label="Theme">
          <Segmented<ThemePreference>
            label="Theme"
            value={settings.theme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(theme) => onChange({ theme })}
          />
        </SettingRow>
        <SettingRow label="Screen edge">
          <Segmented<DockEdge>
            label="Screen edge"
            value={settings.dockEdge}
            options={[
              { value: 'left', label: 'Left', ariaLabel: 'Dock left' },
              { value: 'top', label: 'Top', ariaLabel: 'Dock top' },
              { value: 'right', label: 'Right', ariaLabel: 'Dock right' },
            ]}
            onChange={(dockEdge) => onChange({ dockEdge })}
          />
        </SettingRow>
      </Group>

      <Group label="Tasks">
        <SettingRow label="Sort by">
          <Segmented<TaskSortMode>
            label="Sort by"
            value={settings.taskSortMode}
            options={[
              { value: 'priority', label: 'Priority' },
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
            ]}
            onChange={(taskSortMode) => onChange({ taskSortMode })}
          />
        </SettingRow>
        <Switch
          label="Show completed"
          checked={settings.showCompleted}
          onChange={(showCompleted) => onChange({ showCompleted })}
        />
        <NavRow
          id="tab-order"
          label="Tab order"
          value={settings.sectionOrder
            .map((section) => VIEW_LABELS[section])
            .join(', ')}
          onOpen={() => push('tab-order')}
        />
      </Group>

      <Group label="Desktop">
        <Switch
          label="Reminders"
          checked={settings.notificationsEnabled}
          onChange={(notificationsEnabled) =>
            onChange({ notificationsEnabled })
          }
        />
        <Switch
          label="Launch at login"
          checked={settings.launchAtLogin}
          onChange={(launchAtLogin) => onChange({ launchAtLogin })}
        />
        <SettingRow label="Open or close">
          <kbd>
            <span aria-hidden="true">{TOGGLE_SHORTCUT.primary.keys}</span>
            <span className="sn-visually-hidden">
              {TOGGLE_SHORTCUT.primary.spoken}
            </span>
          </kbd>
        </SettingRow>
      </Group>
      <p className="sn-settings-note">
        Works from any app. If another app already uses that shortcut,{' '}
        <kbd>
          <span aria-hidden="true">{TOGGLE_SHORTCUT.fallback.keys}</span>
          <span className="sn-visually-hidden">
            {TOGGLE_SHORTCUT.fallback.spoken}
          </span>
        </kbd>{' '}
        takes over. The notch and the {TOGGLE_SHORTCUT.icon} always work.
      </p>

      <Group label="More">
        <NavRow
          id="advanced"
          label="Advanced"
          onOpen={() => push('advanced')}
        />
        <button
          ref={resetRef}
          type="button"
          className="sn-setting-row is-danger"
          aria-haspopup="dialog"
          aria-expanded={isResetConfirmOpen}
          onClick={() => setIsResetConfirmOpen((current) => !current)}
        >
          <span>Reset settings</span>
        </button>
      </Group>
      <Popover
        open={isResetConfirmOpen}
        anchorRef={resetRef}
        role="alertdialog"
        label="Reset settings confirmation"
        onClose={() => setIsResetConfirmOpen(false)}
      >
        <div className="sn-confirm sn-reset-confirm">
          <span>
            Reset all settings? Appearance, screen edge, sizes and tab order
            return to their defaults, and the backdrop image is removed. Tasks
            and lists are kept.
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
  )

  const tabOrderPage = (
    <>
      <Group>
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
        />
      </Group>
      <p className="sn-settings-note">
        Drag a row, or use the arrows. The tabs below follow this order.
      </p>
    </>
  )

  const advancedPage = (
    <>
      <Group label="Panel">
        <SettingRow label="Height">
          <Segmented<PanelHeightMode>
            label="Panel height"
            value={settings.panelHeightMode}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'full', label: 'Full' },
            ]}
            onChange={(panelHeightMode) => onChange({ panelHeightMode })}
          />
        </SettingRow>
        <Slider
          label="Width"
          value={draftPanelWidth}
          min={320}
          max={560}
          step={4}
          suffix="px"
          onChange={(value) =>
            setPanelWidthDraft({ base: settings.panelWidth, value })
          }
        />
        {draftPanelWidth === settings.panelWidth ? null : (
          <div className="sn-setting-row is-apply">
            <span>The card resizes when you apply.</span>
            <button
              type="button"
              className="sn-chip"
              onClick={() => {
                onChange({ panelWidth: draftPanelWidth })
                setPanelWidthDraft({
                  base: draftPanelWidth,
                  value: draftPanelWidth,
                })
              }}
            >
              Apply width
            </button>
          </div>
        )}
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
          label="Surface opacity"
          value={settings.surfaceAlpha}
          min={58}
          max={100}
          step={1}
          suffix="%"
          onChange={(surfaceAlpha) => onChange({ surfaceAlpha })}
        />
      </Group>

      <Group label="Notch">
        <SettingRow label="Show">
          <Segmented<TabVisibility>
            label="Show notch"
            value={settings.tabVisibility}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'hover', label: 'On hover' },
            ]}
            onChange={(tabVisibility) => onChange({ tabVisibility })}
          />
        </SettingRow>
        <Slider
          label="Thickness"
          value={settings.tabWidth}
          min={10}
          max={112}
          step={2}
          suffix="px"
          onChange={(tabWidth) => onChange({ tabWidth })}
        />
        <Slider
          label="Length"
          value={settings.handleHeight}
          min={44}
          max={176}
          step={2}
          suffix="px"
          onChange={(handleHeight) => onChange({ handleHeight })}
        />
        <Slider
          label="Position"
          value={settings.handleY}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(handleY) => onChange({ handleY })}
        />
      </Group>

      <Group label="Density">
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
          label="Row spacing"
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
        <Slider
          label="Motion"
          value={settings.motionMs}
          min={140}
          max={360}
          step={10}
          suffix="ms"
          description={
            reducedMotion
              ? 'Reduce Motion is on for this device, so the card fades instead.'
              : undefined
          }
          onChange={(motionMs) => onChange({ motionMs })}
        />
      </Group>

      <Group label="Look">
        <NavRow
          id="preset"
          label="Theme preset"
          value={drawnPresetLabel}
          onOpen={() => push('preset')}
        />
        <NavRow
          id="backdrop"
          label="Backdrop image"
          value={
            settings.backdropImage
              ? settings.backdropImageName || 'Custom image'
              : 'None'
          }
          onOpen={() => push('backdrop')}
        />
      </Group>

      {gmail ? (
        <Group label="Connectors">
          <ConnectorSetting gmail={gmail} />
        </Group>
      ) : null}
    </>
  )

  const presetPage = (
    <>
      <Group label={mode === 'dark' ? 'Dark presets' : 'Light presets'}>
        <ThemePresetList
          options={presetOptions}
          value={drawnPreset}
          onChange={(visualStyle) => onChange({ visualStyle })}
        />
      </Group>
      <p className="sn-settings-note" role="status">
        {parkedPreset
          ? `${parkedPreset.label} is a ${parkedPreset.mode} preset, so Sidenib is shown for now. It comes back when the appearance is ${parkedPreset.mode}, unless you choose another here.`
          : settings.theme === 'system'
            ? 'Theme is set to System, so this list follows your device.'
            : null}
      </p>
    </>
  )

  const backdropPage = (
    <>
      <Group>
        <BackdropSetting
          error={backdropError}
          settings={settings}
          onClear={() => onChange({ backdropImage: '', backdropImageName: '' })}
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
              label="Dim"
              value={settings.backdropDim}
              min={0}
              max={70}
              step={1}
              suffix="%"
              onChange={(backdropDim) => onChange({ backdropDim })}
            />
            <Slider
              label="Blur"
              value={settings.backdropBlur}
              min={0}
              max={18}
              step={1}
              suffix="px"
              onChange={(backdropBlur) => onChange({ backdropBlur })}
            />
          </>
        ) : null}
      </Group>
      <p className="sn-settings-note">
        The image sits behind the card. Lower Surface opacity in Advanced to
        let more of it through.
      </p>
    </>
  )

  return (
    <PanelView
      // A pushed page is a fresh view: it fades in and starts at the top.
      key={page}
      id="settings"
      title={PAGES[page].title}
      back={
        parent
          ? {
              label: PAGES[parent].title,
              onBack: () => {
                pendingFocus.current = `[data-nav="${page}"]`
                setPage(parent)
              },
            }
          : undefined
      }
      settingsAction={false}
      actions={<TextButton onClick={onClose}>Done</TextButton>}
    >
      <div className="sn-settings" data-page={page} ref={bodyRef}>
        {page === 'main'
          ? mainPage
          : page === 'tab-order'
            ? tabOrderPage
            : page === 'advanced'
              ? advancedPage
              : page === 'preset'
                ? presetPage
                : backdropPage}
      </div>
    </PanelView>
  )
}
