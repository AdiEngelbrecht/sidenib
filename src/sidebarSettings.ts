import { useEffect, useState, useSyncExternalStore } from 'react'
import { scheduleLocalStorageWrite } from './storage'

const STORAGE_KEY = 'sidenib.sidebar.settings.v27'

export type DockEdge = 'right' | 'left' | 'top' | 'bottom'
/** What is drawn. Rendering and the shell only ever see one of these two. */
export type ThemeMode = 'light' | 'dark'
/** What is stored. 'system' follows the OS appearance while the app runs. */
export type ThemePreference = 'system' | ThemeMode
export type TaskSortMode = 'priority' | 'newest' | 'oldest'
export type TabVisibility = 'always' | 'hover'
export type PanelHeightMode = 'compact' | 'full'
export type ThemePreset =
  | 'sidenib'
  | 'codex'
  | 'porcelain'
  | 'frost'
  | 'paper'
  | 'carbon'
  | 'graphite'
  | 'midnight'
  | 'clay'
  | 'blueprint'
export type SectionId = 'today' | 'calendar' | 'lists'

/** The presets that have a palette in each mode, in the order they are listed. */
export const themePresetsByMode: Record<ThemeMode, ThemePreset[]> = {
  dark: ['sidenib', 'carbon', 'graphite', 'midnight', 'clay', 'blueprint'],
  light: ['sidenib', 'porcelain', 'frost', 'paper', 'clay', 'blueprint'],
}

/**
 * Stored preset ids that are another preset under an older name. `codex`
 * (Studio in light, Obsidian in dark) was the v0.1.14 default and has been the
 * Sidenib palette since the compact redesign. A stored `codex` is kept as it
 * is and drawn as `sidenib`; it is never rewritten.
 */
export const legacyThemePresets: Partial<Record<ThemePreset, ThemePreset>> = {
  codex: 'sidenib',
}

const validThemePresets: ThemePreset[] = [
  'sidenib',
  'codex',
  'porcelain',
  'frost',
  'paper',
  'carbon',
  'graphite',
  'midnight',
  'clay',
  'blueprint',
]

/**
 * The preset that is drawn for a stored preset in a mode. A legacy id maps to
 * its current name, and a preset with no palette in this mode (Graphite while
 * the appearance is light) is drawn as Sidenib. The stored value is untouched,
 * so the choice comes back when the mode does.
 */
export function resolveThemePreset(
  preset: ThemePreset,
  mode: ThemeMode,
): ThemePreset {
  const current = legacyThemePresets[preset] ?? preset

  return themePresetsByMode[mode].includes(current) ? current : 'sidenib'
}

export type SidebarSettings = {
  dockEdge: DockEdge
  panelWidth: number
  /** 'compact' is the 480-high card; 'full' fills the work-area height. */
  panelHeightMode: PanelHeightMode
  tabVisibility: TabVisibility
  tabWidth: number
  handleHeight: number
  handleY: number
  motionMs: number
  panelRadius: number
  surfaceAlpha: number
  taskRowHeight: number
  taskGap: number
  taskTextSize: number
  showCompleted: boolean
  launchAtLogin: boolean
  notificationsEnabled: boolean
  taskSortMode: TaskSortMode
  theme: ThemePreference
  visualStyle: ThemePreset
  sectionOrder: SectionId[]
  backdropImage: string
  backdropImageName: string
  backdropOpacity: number
  backdropBlur: number
  backdropDim: number
  /**
   * Which set of defaults the stored values were last written under. See
   * `migrateStoredSettings`. Missing on anything saved before revision 2.
   */
  settingsRevision: number
}

/** Revision 2: the compact notch and the opaque paper are the defaults. */
export const SETTINGS_REVISION = 2

/**
 * Defaults of the full-height sidebar. That app wrote its whole settings
 * object to storage on first run, so these values sit in the profile of
 * anyone who started it once, whether or not they ever opened Settings.
 */
export const PRE_COMPACT_DEFAULTS = {
  tabWidth: 42,
  handleHeight: 84,
  surfaceAlpha: 96,
} as const

export const defaultSidebarSettings: SidebarSettings = {
  // Compact right-middle defaults (docs/design/compact/README.md section 5).
  // They apply to a fresh install and to Reset. Stored values are clamped
  // and kept, except the old defaults that migrateStoredSettings carries
  // forward once.
  dockEdge: 'right',
  panelWidth: 340,
  panelHeightMode: 'compact',
  tabVisibility: 'always',
  tabWidth: 12,
  handleHeight: 48,
  handleY: 50,
  motionMs: 220,
  panelRadius: 24,
  surfaceAlpha: 100,
  taskRowHeight: 44,
  // 0 gives hairline-separated groups; above 0 each row is its own block.
  taskGap: 0,
  taskTextSize: 14,
  showCompleted: true,
  launchAtLogin: true,
  notificationsEnabled: true,
  taskSortMode: 'priority',
  theme: 'system',
  visualStyle: 'sidenib',
  sectionOrder: ['today', 'calendar', 'lists'],
  backdropImage: '',
  backdropImageName: '',
  backdropOpacity: 76,
  backdropBlur: 0,
  backdropDim: 18,
  settingsRevision: SETTINGS_REVISION,
}

/**
 * Carries a profile saved before the compact shell forward, once.
 *
 * A stored value equal to the old default was never distinguishable from a
 * choice, and two of those defaults are wrong for the compact shell: the
 * 42 x 84 notch fills its whole window as a grey slab at the screen edge, and
 * the 96% paper lets the desktop show through the card. Where the stored
 * value is exactly the old default it becomes the current default. Anything
 * else is a choice and is kept, as is everything saved under the current
 * revision, so picking 96% or a 42 x 84 notch in Advanced afterwards holds.
 *
 * - The notch is converted only when both of its sizes are the old defaults.
 * - The paper is converted only when no backdrop image is set; with an image
 *   the translucent paper is what shows it.
 */
export function migrateStoredSettings(
  value: Partial<SidebarSettings>,
): Partial<SidebarSettings> {
  const revision =
    typeof value.settingsRevision === 'number' ? value.settingsRevision : 1

  if (revision >= SETTINGS_REVISION) {
    return value
  }

  const next = { ...value, settingsRevision: SETTINGS_REVISION }

  if (
    value.tabWidth === PRE_COMPACT_DEFAULTS.tabWidth &&
    value.handleHeight === PRE_COMPACT_DEFAULTS.handleHeight
  ) {
    next.tabWidth = defaultSidebarSettings.tabWidth
    next.handleHeight = defaultSidebarSettings.handleHeight
  }

  if (
    value.surfaceAlpha === PRE_COMPACT_DEFAULTS.surfaceAlpha &&
    !value.backdropImage
  ) {
    next.surfaceAlpha = defaultSidebarSettings.surfaceAlpha
  }

  return next
}

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const validSectionIds: SectionId[] = ['today', 'calendar', 'lists']
const legacySectionIds: Record<string, SectionId> = {
  month: 'calendar',
}

function sanitizeSectionOrder(value?: SectionId[]) {
  const incoming = Array.isArray(value) ? value : []
  const normalized = incoming
    .map((section) => legacySectionIds[section] ?? section)
    .filter((section): section is SectionId => validSectionIds.includes(section))
  const unique = normalized.filter(
    (section, index) => normalized.indexOf(section) === index,
  )

  return [
    ...unique,
    ...validSectionIds.filter((section) => !unique.includes(section)),
  ]
}

export function sanitizeSettings(value: Partial<SidebarSettings>): SidebarSettings {
  // A stored 'light' or 'dark' stays an explicit choice; only a missing or
  // unknown value falls back to following the system.
  const theme: ThemePreference = isThemePreference(value.theme)
    ? value.theme
    : defaultSidebarSettings.theme
  // Any known preset is kept, whatever the mode. What is drawn for it is
  // decided by resolveThemePreset, so changing mode never drops the choice.
  const visualStyle = validThemePresets.includes(value.visualStyle as ThemePreset)
    ? (value.visualStyle as ThemePreset)
    : defaultSidebarSettings.visualStyle
  const dockEdge =
    value.dockEdge === 'left' ||
    value.dockEdge === 'right' ||
    value.dockEdge === 'top'
      ? value.dockEdge
      : value.dockEdge === 'bottom'
        ? 'top'
      : 'right'
  const taskSortMode =
    value.taskSortMode === 'newest' || value.taskSortMode === 'oldest'
      ? value.taskSortMode
      : 'priority'
  const tabVisibility = value.tabVisibility === 'hover' ? 'hover' : 'always'
  const backdropImage =
    typeof value.backdropImage === 'string' &&
    value.backdropImage.startsWith('data:image/')
      ? value.backdropImage
      : ''
  const backdropImageName =
    backdropImage && typeof value.backdropImageName === 'string'
      ? value.backdropImageName.slice(0, 80)
      : ''

  return {
    dockEdge,
    panelWidth: clamp(
      value.panelWidth ?? defaultSidebarSettings.panelWidth,
      320,
      560,
    ),
    panelHeightMode: value.panelHeightMode === 'full' ? 'full' : 'compact',
    tabVisibility,
    // Lower bounds are widened from v0.1.14's 22 and 56 to admit the compact
    // notch; upper bounds are unchanged, so every stored value stays valid.
    tabWidth: clamp(value.tabWidth ?? defaultSidebarSettings.tabWidth, 10, 112),
    handleHeight: clamp(
      value.handleHeight ?? defaultSidebarSettings.handleHeight,
      44,
      176,
    ),
    handleY: clamp(value.handleY ?? defaultSidebarSettings.handleY, 0, 100),
    motionMs: clamp(value.motionMs ?? defaultSidebarSettings.motionMs, 140, 360),
    panelRadius: clamp(
      value.panelRadius ?? defaultSidebarSettings.panelRadius,
      12,
      28,
    ),
    surfaceAlpha: clamp(
      value.surfaceAlpha ?? defaultSidebarSettings.surfaceAlpha,
      58,
      100,
    ),
    taskRowHeight: clamp(
      value.taskRowHeight ?? defaultSidebarSettings.taskRowHeight,
      40,
      62,
    ),
    // Lower bound widened from v0.1.14's 4 to admit the grouped default.
    taskGap: clamp(value.taskGap ?? defaultSidebarSettings.taskGap, 0, 14),
    taskTextSize: clamp(
      value.taskTextSize ?? defaultSidebarSettings.taskTextSize,
      11,
      14,
    ),
    showCompleted: value.showCompleted ?? defaultSidebarSettings.showCompleted,
    launchAtLogin:
      value.launchAtLogin ?? defaultSidebarSettings.launchAtLogin,
    notificationsEnabled:
      value.notificationsEnabled ??
      defaultSidebarSettings.notificationsEnabled,
    taskSortMode,
    theme,
    visualStyle,
    sectionOrder: sanitizeSectionOrder(value.sectionOrder),
    backdropImage,
    backdropImageName,
    backdropOpacity: clamp(
      value.backdropOpacity ?? defaultSidebarSettings.backdropOpacity,
      30,
      100,
    ),
    backdropBlur: clamp(
      value.backdropBlur ?? defaultSidebarSettings.backdropBlur,
      0,
      18,
    ),
    backdropDim: clamp(
      value.backdropDim ?? defaultSidebarSettings.backdropDim,
      0,
      70,
    ),
    // Whatever passes through here is written back under the current
    // revision; only `migrateStoredSettings` reads an older one.
    settingsRevision: SETTINGS_REVISION,
  }
}

export function useSidebarSettings() {
  const [settings, setSettings] = useState<SidebarSettings>(() => {
    const params = new URLSearchParams(window.location.search)
    const themeParam = params.get('theme')
    const dockParam = params.get('dock')

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      const base = stored
        ? sanitizeSettings(
            migrateStoredSettings(
              JSON.parse(stored) as Partial<SidebarSettings>,
            ),
          )
        : defaultSidebarSettings

      return sanitizeSettings({
        ...base,
        dockEdge:
          dockParam === 'left' ||
          dockParam === 'right' ||
          dockParam === 'top'
            ? dockParam
            : base.dockEdge,
        theme: isThemePreference(themeParam) ? themeParam : base.theme,
      })
    } catch {
      return sanitizeSettings({
        ...defaultSidebarSettings,
        dockEdge:
          dockParam === 'left' ||
          dockParam === 'right' ||
          dockParam === 'top'
            ? dockParam
            : defaultSidebarSettings.dockEdge,
        theme: isThemePreference(themeParam)
          ? themeParam
          : defaultSidebarSettings.theme,
      })
    }
  })

  useEffect(() => {
    return scheduleLocalStorageWrite(STORAGE_KEY, JSON.stringify(settings), 700)
  }, [settings])

  const updateSettings = (patch: Partial<SidebarSettings>) => {
    setSettings((current) => sanitizeSettings({ ...current, ...patch }))
  }

  const resetSettings = () => setSettings(defaultSidebarSettings)

  return [settings, updateSettings, resetSettings] as const
}

/**
 * Follows a media query while mounted. `fallback` is the answer where
 * `matchMedia` does not exist. The listener is added once per query and
 * removed on unmount; `addListener` covers WebKit before 14.
 */
export function useMediaQuery(query: string, fallback = false) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') {
        return () => {}
      }

      const media = window.matchMedia(query)

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
      }

      media.addListener(onChange)
      return () => media.removeListener(onChange)
    },
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : fallback,
    () => fallback,
  )
}

/**
 * Turns the stored preference into the mode that is drawn. 'system' follows
 * `prefers-color-scheme` live and is light where the system gives no answer.
 * Everything that renders a theme takes this value, never the preference.
 */
export function useResolvedTheme(preference: ThemePreference): ThemeMode {
  const systemIsDark = useMediaQuery('(prefers-color-scheme: dark)')

  if (preference === 'system') {
    return systemIsDark ? 'dark' : 'light'
  }

  return preference
}
