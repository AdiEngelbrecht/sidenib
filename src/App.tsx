/*
 * Composition only: the shell (notch, card frame, toast), the data hooks, and
 * one view at a time inside the card. Views live in src/views, shared
 * primitives in src/components. See docs/views.md for the boundaries.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './design/tokens.css'
import './design/presets.css'
import './App.css'
import './shell/shell.css'
import './components/components.css'
import { formatDateKey, parseReminderDate } from './calendar/dates'
import { useNow } from './calendar/useNow'
import { PanelChromeContext, VIEW_LABELS } from './components/panelChrome'
import type { PanelChrome } from './components/panelChrome'
import { ViewTabs } from './components/ViewTabs'
import { useTaskStore } from './data/taskStore'
import { useGmailConnector } from './gmail'
import type { GmailThreadSuggestion } from './gmail'
import { ReminderToast } from './reminders/ReminderToast'
import { snoozedReminderValue } from './reminders/reminderTime'
import { useReminders } from './reminders/useReminders'
import type { ReminderAlert } from './reminders/useReminders'
import { NotchHandle } from './shell/NotchHandle'
import { PanelCard } from './shell/PanelCard'
import type { Route, ViewId } from './shell/types'
import { useShell } from './shell/useShell'
import {
  resolveThemePreset,
  useResolvedTheme,
  useSidebarSettings,
} from './sidebarSettings'
import { CalendarView } from './views/calendar/CalendarView'
import { ListsView } from './views/lists/ListsView'
import { SettingsView } from './views/settings/SettingsView'
import { GmailInboxSuggestions } from './views/today/GmailInboxSuggestions'
import { TodayView } from './views/today/TodayView'

// The Gmail connector is held back; its UI stays in the tree but unrendered.
const GMAIL_CONNECTOR_VISIBLE = false
const SHELL_CARD_ID = 'sidenib-card'

function App() {
  const [settings, updateSettings, resetSettings] = useSidebarSettings()
  const store = useTaskStore()
  const gmail = useGmailConnector()
  const now = useNow()

  // The route: one of the three tabs, with the calendar's day and the open
  // list remembered while the user is on another tab. Settings lies over it.
  const [view, setView] = useState<ViewId>('today')
  const [calendarDateKey, setCalendarDateKey] = useState(() =>
    formatDateKey(new Date()),
  )
  const [calendarVisit, setCalendarVisit] = useState(0)
  const [listId, setListId] = useState<string | undefined>(undefined)
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    () => new URLSearchParams(window.location.search).get('settings') === '1',
  )
  const navigate = useCallback((route: Route) => {
    if (route.view === 'settings') {
      setIsSettingsOpen(true)
      return
    }

    if (route.view === 'calendar' && route.dateKey) {
      setCalendarDateKey(route.dateKey)
      // A fresh visit, so the month on show follows the requested day.
      setCalendarVisit((current) => current + 1)
    }

    if (route.view === 'lists') {
      setListId(route.listId)
    }

    setView(route.view)
    setIsSettingsOpen(false)
  }, [])

  const reminders = useReminders(store.entries, settings.notificationsEnabled)
  const openSettings = useCallback(() => setIsSettingsOpen(true), [])
  const moveNotch = useCallback(
    (handleY: number) => updateSettings({ handleY }),
    [updateSettings],
  )
  // Escape peels one layer: Settings first, then the card. Menus, renames and
  // a quick-add draft take Escape themselves before it gets here.
  const peelEscapeLayer = useCallback(() => {
    if (!isSettingsOpen) {
      return false
    }

    setIsSettingsOpen(false)
    return true
  }, [isSettingsOpen])
  const controller = useShell({
    settings,
    motionMs: settings.motionMs,
    hasToast: reminders.alerts.length > 0,
    onNotchMove: moveNotch,
    onOpenSettings: openSettings,
    onEscape: peelEscapeLayer,
  })
  const { shell, isNative } = controller

  useEffect(() => {
    document.documentElement.dataset.runtime = isNative ? 'tauri' : 'web'

    return () => {
      delete document.documentElement.dataset.runtime
    }
  }, [isNative])

  // 'system' is resolved here, once; nothing below sees the preference.
  const theme = useResolvedTheme(settings.theme)
  const preset = resolveThemePreset(settings.visualStyle, theme)

  useEffect(() => {
    // The tokens (src/design/tokens.css) follow the resolved theme.
    document.documentElement.dataset.theme = theme

    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  useEffect(() => {
    if (!isNative || import.meta.env.DEV) {
      return
    }

    const syncAutostart = async () => {
      try {
        const { disable, enable, isEnabled } = await import(
          '@tauri-apps/plugin-autostart'
        )
        const enabled = await isEnabled()

        if (settings.launchAtLogin) {
          if (enabled) {
            await disable()
          }

          await enable()
          return
        }

        if (enabled) {
          await disable()
        }
      } catch {
        // Autostart is best-effort; the UI stays usable if the OS denies it.
      }
    }

    void syncAutostart()
  }, [isNative, settings.launchAtLogin])

  const openReminder = (alert: ReminderAlert) => {
    const reminderDate = parseReminderDate(alert.reminderAt)

    navigate({
      view: 'calendar',
      dateKey: reminderDate ? formatDateKey(reminderDate) : calendarDateKey,
    })
    shell.open('toast')
    reminders.dismiss(alert.id)
  }
  const snoozeReminder = (alert: ReminderAlert) => {
    store.setReminder(alert.ref, alert.taskId, snoozedReminderValue(10))
    reminders.dismiss(alert.id)
  }
  const convertGmailSuggestion = (suggestion: GmailThreadSuggestion) => {
    store.addGmailTask(suggestion)
    gmail.ignoreSuggestion(suggestion.threadId, suggestion.subject)
    gmail.recordActivity(
      'convert',
      `Created local task from Gmail thread: ${suggestion.subject}`,
    )
    navigate({ view: 'today' })
  }

  const chrome = useMemo(
    (): PanelChrome => ({
      tabs: settings.sectionOrder,
      activeTab: isSettingsOpen ? null : view,
      selectTab: (next) => navigate({ view: next }),
      openSettings,
      isOpen: shell.isOpen,
    }),
    [
      isSettingsOpen,
      navigate,
      openSettings,
      settings.sectionOrder,
      shell.isOpen,
      view,
    ],
  )

  // Advanced preferences reach the views only as token overrides on the
  // shell root; components keep reading tokens and never read settings.
  const rootStyle = {
    ...controller.rootStyle,
    '--sn-row-min-height': `${settings.taskRowHeight}px`,
    '--sn-row-gap': `${settings.taskGap}px`,
    '--sn-text-body': `400 ${settings.taskTextSize}px/${Math.round(
      settings.taskTextSize * 1.36,
    )}px var(--sn-font)`,
    '--sn-surface-alpha': `${
      settings.backdropImage
        ? Math.round(settings.surfaceAlpha * 0.88)
        : settings.surfaceAlpha
    }%`,
    '--sn-backdrop-image': settings.backdropImage
      ? `url("${settings.backdropImage}")`
      : 'none',
    '--sn-backdrop-opacity': settings.backdropImage
      ? `${settings.backdropOpacity / 100}`
      : '0',
    '--sn-backdrop-blur': `${settings.backdropBlur}px`,
    '--sn-backdrop-dim': `${settings.backdropDim / 100}`,
  } as CSSProperties
  const rootClassName = [
    'workspace',
    controller.rootClassName,
    isNative ? 'is-native' : 'is-web-preview',
    shell.isOpen ? 'is-sidebar-open' : 'is-sidebar-closed',
    settings.backdropImage ? 'has-custom-backdrop' : '',
    settings.taskGap > 0 ? 'sn-rows-spaced' : '',
    `dock-${settings.dockEdge}`,
    `tab-${settings.tabVisibility}`,
    `theme-${theme}`,
    `style-${preset}`,
  ]
    .filter(Boolean)
    .join(' ')
  const viewProps = {
    store,
    now,
    showCompleted: settings.showCompleted,
    sortMode: settings.taskSortMode,
  }

  return (
    <main className={rootClassName} style={rootStyle}>
      <section
        className="desktop-preview"
        aria-label="Browser preview"
        aria-hidden={isNative}
      >
        <p className="desktop-preview-note">
          <strong>Sidenib</strong>
          Browser preview. The notch sits on the screen edge; click or pull it
          to open the card.
        </p>
      </section>

      <NotchHandle
        controller={controller}
        reminderCount={reminders.alerts.length}
        controls={SHELL_CARD_ID}
      />

      <ReminderToast
        items={reminders.alerts}
        placement={
          controller.toast.isBeside
            ? 'beside'
            : controller.card.isOpen
              ? 'inside'
              : 'hidden'
        }
        onOpen={openReminder}
        onSnooze={snoozeReminder}
        onDismiss={(alert) => reminders.dismiss(alert.id)}
      />

      <PanelCard
        controller={controller}
        id={SHELL_CARD_ID}
        label={isSettingsOpen ? 'Settings' : VIEW_LABELS[view]}
      >
        <PanelChromeContext value={chrome}>
          <div className="sn-panel">
            {isSettingsOpen ? (
              <SettingsView
                settings={settings}
                onChange={updateSettings}
                onReset={resetSettings}
                onClose={() => setIsSettingsOpen(false)}
                gmail={GMAIL_CONNECTOR_VISIBLE ? gmail : undefined}
              />
            ) : view === 'today' ? (
              <TodayView
                {...viewProps}
                banner={
                  GMAIL_CONNECTOR_VISIBLE ? (
                    <GmailInboxSuggestions
                      gmail={gmail}
                      onConvert={convertGmailSuggestion}
                    />
                  ) : null
                }
              />
            ) : view === 'calendar' ? (
              <CalendarView
                key={calendarVisit}
                {...viewProps}
                compact={shell.compact}
                dateKey={calendarDateKey}
                onSelectDate={setCalendarDateKey}
              />
            ) : (
              <ListsView {...viewProps} listId={listId} onOpenList={setListId} />
            )}
            <ViewTabs />
          </div>
        </PanelChromeContext>
      </PanelCard>
    </main>
  )
}

export default App
