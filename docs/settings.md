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
  `light` or `dark`, a stored `codex`, and the old sizes all load as they were
  and are written back unchanged.
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

`tests/settings.spec.ts` covers the model (defaults, legacy values, preset
resolution), the ten-row page, System following the device while running,
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
