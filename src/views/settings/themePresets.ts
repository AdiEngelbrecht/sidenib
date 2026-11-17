/*
 * Preference helpers moved out of App.tsx unchanged: the preset catalogue and
 * the tab-order moves. ADIEN-164 owns this folder.
 */
import { themePresetsByMode } from '../../sidebarSettings'
import type {
  SectionId,
  ThemeMode,
  ThemePreset,
} from '../../sidebarSettings'

export const THEME_PRESETS = [
  { id: 'codex', label: 'Studio', mode: 'light', note: 'Sidenib paper' },
  { id: 'porcelain', label: 'Porcelain', mode: 'light', note: 'Soft white' },
  { id: 'frost', label: 'Frostline', mode: 'light', note: 'Cool blue' },
  { id: 'paper', label: 'Paper Trail', mode: 'light', note: 'Warm matte' },
  { id: 'clay', label: 'Terra', mode: 'light', note: 'Muted warm' },
  { id: 'blueprint', label: 'Blueprint', mode: 'light', note: 'Light blue' },
  { id: 'codex', label: 'Obsidian', mode: 'dark', note: 'Sidenib ink' },
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

export function getThemeOptions(theme: ThemeMode) {
  const allowed = themePresetsByMode[theme]

  return THEME_PRESETS.filter(
    (preset) => preset.mode === theme && allowed.includes(preset.id),
  )
}

/** Switches light and dark, keeping the preset when the other mode has it. */
export function getNextThemePatch(
  currentTheme: ThemeMode,
  currentPreset: ThemePreset,
) {
  const theme: ThemeMode = currentTheme === 'dark' ? 'light' : 'dark'
  const allowed = themePresetsByMode[theme]

  return {
    theme,
    visualStyle: allowed.includes(currentPreset) ? currentPreset : allowed[0],
  }
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
