/*
 * Preference helpers: the preset catalogue as it is listed, the shortcut
 * labels, and the tab-order moves.
 */
import { legacyThemePresets, themePresetsByMode } from '../../sidebarSettings'
import type {
  SectionId,
  ThemeMode,
  ThemePreset,
} from '../../sidebarSettings'

/**
 * Sidenib plus the baseline presets, per mode. The v0.1.14 `codex` preset
 * (Studio, Obsidian) is not listed separately: it is the Sidenib palette and
 * resolves to it (see `legacyThemePresets`).
 */
export const THEME_PRESETS = [
  { id: 'sidenib', label: 'Sidenib', mode: 'light', note: 'Paper and gold' },
  { id: 'porcelain', label: 'Porcelain', mode: 'light', note: 'Soft white' },
  { id: 'frost', label: 'Frostline', mode: 'light', note: 'Cool blue' },
  { id: 'paper', label: 'Paper Trail', mode: 'light', note: 'Warm matte' },
  { id: 'clay', label: 'Terra', mode: 'light', note: 'Muted warm' },
  { id: 'blueprint', label: 'Blueprint', mode: 'light', note: 'Light blue' },
  { id: 'sidenib', label: 'Sidenib', mode: 'dark', note: 'Ink and gold' },
  { id: 'carbon', label: 'Carbon', mode: 'dark', note: 'Soft black' },
  { id: 'graphite', label: 'Graphite', mode: 'dark', note: 'Deep focus' },
  { id: 'midnight', label: 'Nightfall', mode: 'dark', note: 'Blue black' },
  { id: 'clay', label: 'Ember', mode: 'dark', note: 'Warm dark' },
  { id: 'blueprint', label: 'Gridlock', mode: 'dark', note: 'Dark blue' },
] as const satisfies Array<{
  id: ThemePreset
  label: string
  mode: ThemeMode
  note: string
}>

export type ThemePresetOption = (typeof THEME_PRESETS)[number]

export function getThemeOptions(mode: ThemeMode) {
  const allowed = themePresetsByMode[mode]

  return THEME_PRESETS.filter(
    (preset) => preset.mode === mode && allowed.includes(preset.id),
  )
}

/**
 * The stored preset when it has no palette in `mode`, so the page can say
 * which choice is being kept. Undefined when the stored preset is drawn.
 */
export function getParkedPreset(stored: ThemePreset, mode: ThemeMode) {
  const current = legacyThemePresets[stored] ?? stored

  if (themePresetsByMode[mode].includes(current)) {
    return undefined
  }

  return THEME_PRESETS.find((preset) => preset.id === current)
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The global shortcut pair registered in src-tauri/src/lib.rs
 * (TOGGLE_SHORTCUTS). The second is used when another app holds the first.
 */
export const TOGGLE_SHORTCUT = isMac
  ? {
      primary: { keys: '⌥⇧S', spoken: 'Option Shift S' },
      fallback: { keys: '⌃⌥⇧S', spoken: 'Control Option Shift S' },
      icon: 'menu bar icon',
    }
  : {
      primary: { keys: 'Alt+Shift+S', spoken: 'Alt Shift S' },
      fallback: { keys: 'Ctrl+Alt+Shift+S', spoken: 'Control Alt Shift S' },
      icon: 'tray icon',
    }

export function moveSectionOrder(
  sections: SectionId[],
  section: SectionId,
  direction: -1 | 1,
) {
  const currentIndex = sections.indexOf(section)
  const nextIndex = currentIndex + direction

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) {
    return sections
  }

  const next = [...sections]
  const [item] = next.splice(currentIndex, 1)

  next.splice(nextIndex, 0, item)
  return next
}

export function moveSectionOrderToIndex(
  sections: SectionId[],
  section: SectionId,
  targetIndex: number,
) {
  const currentIndex = sections.indexOf(section)

  if (currentIndex === -1 || currentIndex === targetIndex) {
    return sections
  }

  const next = sections.filter((item) => item !== section)
  const boundedIndex = Math.min(Math.max(targetIndex, 0), next.length)

  next.splice(boundedIndex, 0, section)
  return next
}
