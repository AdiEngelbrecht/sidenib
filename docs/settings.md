# Settings

Task ADIEN-164. Settings is one view inside the card: a short default page and
an Advanced page, with three smaller pages pushed from them. It implements the
Settings part of section 5 of the
[compact design contract](design/compact/README.md). The view frame and the
shared controls are described in [views.md](views.md).

## Pages

| Page | Reached from | Contents |
| --- | --- | --- |
| Settings | the header action, the tray menu | Theme, Screen edge, Sort by, Show completed, Tab order, Reminders, Launch at login, Open or close, Advanced, Reset settings. Ten rows, no sliders. |
| Tab order | Settings | The three-row reorder list (drag, or the arrow buttons). |
| Advanced | Settings | Panel: height, width, corner radius, surface opacity. Notch: show, thickness, length, position. Density: row height, row spacing, text size, motion. Look: theme preset, backdrop image. |
| Theme preset | Advanced | Sidenib and the five baseline presets of the current mode, as a radio group. |
| Backdrop image | Advanced | Upload, clear, strength, dim and blur. |

Every v0.1.14 preference is still here; the tuning controls moved one level
down. A page replaces the previous one in the same scrolling body, so nothing
leaves the card. The reset confirmation is the shared `Popover`, which is
clamped to the card. The Gmail connector row is rendered on Advanced only when
`gmail` is passed, which no current build does.

## Theme

`settings.theme` is `'system' | 'light' | 'dark'`. `useResolvedTheme` in
`src/sidebarSettings.ts` turns it into `'light'` or `'dark'`, following
`prefers-color-scheme` while the app runs and falling back to light where the
query is unavailable. `App.tsx` resolves it once and uses the result for
`data-theme`, `theme-*` and `style-*`. The preference itself is never used for
rendering and nothing native receives it.

`settings.visualStyle` keeps whatever is stored. `resolveThemePreset` decides
what is drawn:

| Stored | Drawn |
| --- | --- |
| `sidenib` | Sidenib (the tokens, unchanged). The default. |
| `codex` (Studio or Obsidian, the v0.1.14 default) | Sidenib. It is the same palette under its old name and is not listed separately. |
| a preset the current mode has | that preset |
| a preset the current mode lacks, such as Graphite in light | Sidenib, until the mode comes back. The page says which preset is being kept. |

Choosing a preset on the page is the only thing that writes `visualStyle`.

## Stored values and reset

- The sanitiser clamps numbers and keeps every known value. A stored explicit
  `light` or `dark` and a stored `codex` load as they were and are written
  back unchanged. Sizes and densities do too, unless they are an earlier
  default (see revision 3 below).
- Two old defaults are carried forward once, by `migrateStoredSettings`. The
  full-height app wrote its whole settings object on first run, so its
  defaults are in the profile of anyone who started it, chosen or not. Drawn
  in the compact shell they were the faults reported against v0.2.0: a
  42 × 84 notch is a grey block that fills its window at the screen edge, and
  96% paper lets the desktop show through the card. On the first load of a
  profile with no `settingsRevision`:
  - `tabWidth: 42` together with `handleHeight: 84` becomes 12 and 48. If
    either differs, both are kept.
  - `surfaceAlpha: 96` becomes 100, unless a backdrop image is set.
  - Every other value is kept, and `settingsRevision: 2` is written.
- A profile that already has `settingsRevision: 2` is never converted, so a
  96% surface or a 42 × 84 notch picked in Advanced afterwards stays. Someone
  who had picked exactly those values on purpose before has to pick them once
  more; the stored data cannot tell that case apart.
- The notebook page (ADIEN-172) is revision 3 and carries the presentation
  values forward the same way. The earlier layouts drew tiles on a tinted
  ground, and their densities defeat a ruled page: the profile found on the
  user's Mac held a 400-wide card, radius 18, 7 px row gaps and 12.5 px text,
  all of them first-run defaults of the full-height app. On the first load of
  a profile below revision 3, each of these that is still an earlier default
  becomes the notebook default:

  | Field | Earlier defaults | Notebook default |
  | --- | --- | --- |
  | `panelWidth` | 400, 340 | 340 |
  | `panelRadius` | 18, 24 | 16 |
  | `taskRowHeight` | 44 | 36 |
  | `taskGap` | 7, 0 | 0 |
  | `taskTextSize` | 12.5, 14 | 14 |
  | `motionMs` | 230, 220 | 220 |

  Any other value was chosen and is kept: a 480-wide card, radius 20 or 13 px
  text load as they were. Theme, preset, dock edge, notch position and size,
  surface opacity, backdrop, sort order, tab order, Show completed, Reminders
  and Launch at login are not touched by this step.
- Before a converted profile is written back, the settings exactly as they
  were stored are saved under `sidenib.sidebar.settings.backup.rev2`. That
  key is written once and never replaced. To go back, copy its values into
  Advanced, or restore it over `sidenib.sidebar.settings.v27` with the app
  closed.
- The ambiguity is the same as before and cannot be removed: stored data
  does not say whether 400 was picked or inherited. A value equal to an
  earlier default is treated as inherited, including in a revision 2 profile,
  because revision 2 was stamped on profiles that still held the full-height
  defaults. Someone who chose exactly one of those values has to choose it
  once more; under revision 3 it then holds.
- "Row spacing" above zero now adds to the height of every ruled line. It no
  longer turns rows into separate tiles.
- Only a missing or unknown `theme` becomes `system`, and only an unknown
  preset becomes `sidenib`.
- New defaults (`theme: 'system'`, `visualStyle: 'sidenib'`,
  `surfaceAlpha: 100`, with the compact sizes already set by the shell and
  views work) apply to a fresh install and to Reset settings.
- The collapsed-group state under `sidenib.settings.groups.v1` is no longer
  read or written. An existing key is left alone.

## Keyboard

- Every control is a native button, checkbox, range or radio. Rows that push a
  page are buttons; the preset list uses arrow keys like any radio group.
- Pushing a page moves focus to its back label. Going back returns focus to
  the row that pushed it.
- Escape peels one layer: the confirmation, then a pushed page, then Settings,
  then the card.
- The reset confirmation opens with Cancel focused.
- WebKit on macOS moves Tab between text fields only unless the system
  "Keyboard navigation" setting is on; Option+Tab visits every control. This
  applies to the whole app, not only Settings.

## Shortcut help

The Open or close row shows the primary global shortcut and the note under it
names the fallback. Both come from `TOGGLE_SHORTCUT` in
`src/views/settings/themePresets.ts`, which mirrors `TOGGLE_SHORTCUTS` in
`src-tauri/src/lib.rs`. The frontend does not know which of the two
registered; the tray menu does.

## Verification

```bash
npm run verify && npm run lint && npm run build
npm run test:smoke          # includes tests/settings.spec.ts
```

`tests/settings.spec.ts` covers the model (defaults, legacy values, the
one-time carry-forward, preset resolution), the ten-row page, System following the device while running,
legacy preferences surviving a reload, a parked preset, reset by pointer and
keyboard, Tab order, focus and Escape across pages, Advanced values
persisting, reduced motion, every page on a 420-high work area, and contrast
of the settings text on all twelve preset palettes. It passes in Chromium and
WebKit.

In the native macOS window: System drew dark on a Mac set to dark, Light and
Dark applied at once and survived a restart, and the menu-bar Settings item
opened the card on this page. Not checked natively: the web view following
an appearance change while running, the Advanced pages and Reset, WebView2
rendering, and VoiceOver or Narrator output. Launch at login writes
`~/Library/LaunchAgents/Sidenib.plist` for whichever copy of the app last
ran; see the note in
[Release verification v0.2.0](release-verification-v0.2.0.md).
