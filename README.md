# Sidenib

[![CI](https://github.com/AdiEngelbrecht/sidenib/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiEngelbrecht/sidenib/actions/workflows/ci.yml)

<img src="docs/design/sidenib/exports/app-128.png" alt="Sidenib app icon" width="96" height="96">

Sidenib (side-nib) is a small task companion at the edge of the screen for
macOS and Windows. It stays out of the way as a small edge handle, opens into a
task panel for Today, Calendar, and Lists, and is built for fast capture while
you work in other apps.

Sidenib is Adi Engelbrecht's independent remake of
[Todobar](https://github.com/Leonxlnx/todobar) by Leonxlnx. It is a personal
portfolio project and is not affiliated with or endorsed by the Todobar
project. See [Origin and attribution](#origin-and-attribution).

The foundation is inherited and real: Tauri v2, React, local persisted tasks,
reminders, custom in-app reminder toasts, global shortcuts, autostart,
single-instance behavior, and build automation for Windows, macOS, and Android.
The compact notch-and-panel redesign is in progress: the shell and the Today
and Lists views are in the compact Notes-like style; Calendar and Settings
work inside the same card and are still being refined.

## Origin and attribution

| | |
| --- | --- |
| Upstream project | [Leonxlnx/todobar](https://github.com/Leonxlnx/todobar) |
| Upstream baseline release | `v0.1.14` (tag commit `12a49c9`) |
| Starting source commit | `809b0d5857b03b3fec946f227ddaffb70cbe2789` (upstream `main`, three commits after `v0.1.14`) |
| License | Apache License 2.0, unchanged |

The full upstream Git history is preserved in this repository. The original
copyright line stays in [`LICENSE`](LICENSE), and [`NOTICE`](NOTICE) records
what Sidenib changed. The name, app icon, app identifier, and storage
namespaces are Sidenib's own; see [Sidenib identity](docs/sidenib-identity.md)
for the details, including how it coexists with an installed Todobar.

Documents under [`docs/`](docs/) that predate the remake, including the
`release-verification-v0.1.*` records, describe upstream Todobar and keep its
name as a historical record.

## Why

Most todo apps are full windows. Sidenib is designed as a desktop utility:

- always reachable from the edge of the screen
- fast enough for one-line capture
- clean enough to leave visible during focused work
- local-first by default
- ready for future AI and MCP integrations without making AI mandatory

## Current Features

- Dockable native sidebar for Windows and macOS
- Right, left, and wider top dock placement modes
- Small draggable handle that opens and closes the panel
- Global shortcut: `Alt + Shift + S`, with `Ctrl + Alt + Shift + S` as a
  fallback (`Option + Shift + S` and `Control + Option + Shift + S` on macOS)
- Native tray/menu-bar control for open, settings, and quit
- Autostart on system login
- Single-instance desktop behavior
- Always-on-top frameless window
- Click-through transparent area outside the handle and open panel
- One segmented tab control for Today, Calendar, and Lists, with Settings in
  the header
- Today shows overdue tasks first, then open tasks, pinned lists, and a
  Completed disclosure
- Today tasks
- Real calendar view with month navigation, selected-day capture, and scheduled
  task and event actions
- Custom task lists
- Pin custom lists onto Today as goal groups
- Add, edit, complete, prioritize, collapse, and delete tasks
- Rename and delete custom lists
- Add reminder times while capturing tasks
- Reminder presets, an exact time, and Clear on existing tasks
- Row actions (reminder, rename, priority, delete) on hover or keyboard focus
- Custom Sidenib reminder toasts that appear inside the overlay instead of the
  operating system notification tray
- 10-minute snooze from reminder toasts
- Optional completed-task visibility
- Local persistence through browser storage
- Light and dark modes with matching mode-specific theme presets
- Custom theme dropdown with five matching light presets and five matching dark
  presets
- Optional custom backdrop image with strength, dim, and blur controls
- Custom backdrop images also texture the visible edge tab/native dock surface
- Optional hover-only visible tab mode for a quieter desktop edge
- Theme-matched custom scrollbars in the sidebar and settings surfaces
- Rearrange Today, Calendar, and Lists from settings
- Collapse settings groups while tuning the sidebar, with the open/closed state
  remembered locally
- Gmail read-only connector foundation is implemented in code but hidden from
  the product UI until Google OAuth verification and a public rollout plan are
  ready.
- Adjustable panel width, visible tab size, handle height, edge position,
  motion speed, corner radius, task sort mode, task row height, task spacing,
  task text size, completed-task visibility, launch-at-login, notifications,
  and surface opacity
- Responsive sizing for different monitor heights and widths
- Native Android companion with a floating edge bubble, Today, Calendar, Lists,
  Settings, local tasks, reminders, and matching English product language

## Platform Status

| Platform | Status | Notes |
| --- | --- | --- |
| Windows | Working | Built locally and in GitHub Actions. Release includes `.exe` and `.msi`. |
| macOS Apple Silicon | Built in CI | Release includes `.dmg`. Unsigned until Apple signing is configured. |
| macOS Intel | Built in CI | Release includes `.dmg`. Unsigned until Apple signing is configured. |
| Android | Companion APK | Release includes an installable `.apk`. Overlay permission is required for the floating bubble. |

## Verification Status

Pull requests and `main` are checked by GitHub Actions on Windows and macOS.
Local verification for the current version is recorded in
[Release verification v0.2.0](docs/release-verification-v0.2.0.md).

What is verified:

- TypeScript and Vite production build
- ESLint
- Project consistency checks for versions, docs links, scripts, and workflows
- Playwright sidebar smoke test
- Responsive sidebar layout checks for desktop, narrow, and short viewports
- Rust check
- Tauri no-bundle native build smoke test
- Android release APK build

What is not fully verified yet:

- Physical macOS QA on real hardware
- Windows certificate signing and Apple notarization
- Signed auto-update
- Full keyboard/accessibility pass

## Roadmap

Sidenib is planned in product layers:

- Version 0: dockable planner with local Today, Calendar, custom lists,
  launch-at-login, global shortcut, tray/menu-bar control, and responsive native
  shell.
- Version 1: better planner with editable tasks, undo, reminders,
  notifications, recurring tasks, keyboard-first triage, SQLite storage, and
  import/export.
- Version 2: assistant layer with AI suggestions, task splitting, Today
  planning, source/confidence display, approval flow, and audit log.
- Version 3: MCP/context connectors for local files, GitHub, Gmail, calendar,
  Notion/docs, and issue trackers.
- Companion manager: a larger settings/planning window for connectors,
  notification rules, provider setup, bulk editing, backups, and assistant
  history.

The detailed plan lives in [Product vision](docs/product-vision.md) and
[Roadmap](docs/roadmap.md).

## Install

Current version: `v0.2.0` (in development).

Sidenib has not published a release yet, so there are no installers to
download. Build it from source with the steps in [Development](#development);
`npm run tauri:build` produces `Sidenib.app` and a `.dmg` on macOS, and `.exe`
and `.msi` installers on Windows.

Local macOS builds are unsigned. If macOS blocks the first launch, right-click
the app and choose Open.

Sidenib installs as its own app (`io.github.adiengelbrecht.sidenib`) and can
run beside an installed Todobar. It starts with empty data and does not read or
migrate Todobar's tasks or settings; see
[Sidenib identity](docs/sidenib-identity.md).

## Usage

- Click the edge handle to open or close Sidenib.
- Drag the handle along its docked edge to change its position.
- Press `Alt + Shift + S` (`Option + Shift + S` on macOS) to toggle it from any
  app.
- If another app already owns that shortcut, use `Ctrl + Alt + Shift + S`. The
  tray/menu-bar menu shows the shortcut that is active.
- Use the tray/menu-bar icon to toggle Sidenib, open settings, or quit.
- Press `Esc` to close the panel.
- Use the tabs at the foot of the card to move between Today, Calendar, and
  Lists; the left and right arrow keys work there too.
- Use the settings button to adjust appearance, dock edge, desktop startup,
  window size, handle shape, task density, sorting, backdrop image, motion,
  radius, and opacity.
## Gmail Integration Status

Gmail is implemented as a production-minded foundation, not as a frontend
placeholder, but it is currently hidden from the normal Sidenib UI:

- Primary path: direct Gmail API OAuth, not MCP.
- Scope: `https://www.googleapis.com/auth/gmail.readonly`.
- Current reads: recent unread Inbox threads only.
- Current actions: convert a selected suggestion into a local Sidenib task,
  open the original Gmail thread, or ignore the suggestion locally.
- Not implemented: sending email, composing drafts, deleting email, archiving,
  labeling, or mutating Gmail in any way.
- Token storage: native OS credential store only. Windows uses Credential
  Manager. macOS uses Keychain. OAuth tokens are never stored in frontend
  `localStorage`.
- Browser preview uses mock connector state for tests and design QA only.

Normal users should not need a Google Cloud project. Maintainers of public
builds still need to configure and verify the Google OAuth client before
publishing a Gmail-enabled release. Until then, Gmail remains an internal
foundation rather than a visible product feature.

## Data and Privacy

Sidenib is local-first in this prototype. Task data and settings are stored in
local browser storage inside the app webview. Gmail-derived tasks stay local in
the same task store. There is no analytics layer and no general network sync.

When Gmail is connected, Sidenib uses the Gmail API only for the read-only
connector features listed above. Every Gmail read performed by the UI is shown in
the connector activity area. Disconnecting Gmail removes the stored OAuth token
from the native OS credential store.

Future AI and MCP features should stay optional, permissioned, and visible. The
core task app must remain useful without AI.

## Development

Requirements:

- Node.js 22 LTS or newer, with npm
- Rust stable 1.77.2 or newer, installed with [rustup](https://rustup.rs)
- [Tauri v2 platform prerequisites](https://v2.tauri.app/start/prerequisites/):
  Xcode Command Line Tools on macOS (`xcode-select --install`); Microsoft C++
  Build Tools and WebView2 on Windows
- Optional: JDK 17 and the Android SDK (platform 34) for the Android companion

Install dependencies:

```bash
npm install
```

Run the web preview:

```bash
npm run dev
```

Run the native desktop app:

```bash
npm run tauri:dev
```

For local Gmail OAuth testing, provide a Google OAuth desktop client ID to the
native process:

```bash
# macOS
SIDENIB_GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com" npm run tauri:dev
```

```powershell
# Windows
$env:SIDENIB_GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com"
npm run tauri:dev
```

If your OAuth client requires a secret, keep it in the native environment only,
as `SIDENIB_GMAIL_CLIENT_SECRET`.

Do not put OAuth secrets in React code, static assets, or browser storage.

Build the app locally:

```bash
npm run tauri:build
```

Validate the project:

```bash
npm run verify
npm run build
npm run lint
npm run test:smoke
npm run test:native
cargo check --manifest-path src-tauri/Cargo.toml
```

Build the Android APK locally:

```powershell
cd android
.\gradlew.bat assembleRelease
```

`npm run test:smoke` runs a browser smoke test against the Vite preview. If
Chromium is missing locally, run `npx playwright install chromium` once.

`npm run test:native` runs a no-bundle Tauri release build. It validates the
native desktop shell without creating installers.

## Release Builds

The repository includes GitHub Actions workflows:

- `ci.yml` checks TypeScript, linting, browser smoke tests, Rust, and no-bundle
  native Tauri builds on Windows and macOS.
- `release.yml` builds release artifacts for:
  - Windows
  - macOS Apple Silicon
  - macOS Intel
- `android.yml` builds an Android release APK and attaches it to version
  releases.

No Sidenib release has been tagged yet. When one is ready, create it by pushing
a version tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Before tagging, bump the version in `package.json`, `package-lock.json`,
`src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, and
`android/app/build.gradle.kts`.

The Tauri release workflow uploads the platform installers to GitHub Releases.
The rolling Android prerelease is published only when the Android workflow is
started manually.

Regenerate the native icon set from the approved artwork with `npm run icons`.

Release workflow output:

- Windows setup `.exe`
- Windows `.msi`
- macOS Apple Silicon `.dmg`
- macOS Intel `.dmg`
- macOS `.app.tar.gz` archives
- Android `.apk`

## Architecture

Sidenib uses:

- React + TypeScript for the UI
- Tauri v2 for native desktop APIs
- `@tauri-apps/plugin-global-shortcut` for the open/close shortcut
- `@tauri-apps/plugin-autostart` for launch-at-login
- Tauri tray/menu-bar APIs for desktop control while the window is skipped from
  the taskbar
- `tauri-plugin-single-instance` to prevent duplicate sidebars
- local browser storage for the current prototype task store

Native window behavior is intentionally kept in a small layer:

- the Tauri window is positioned per dock edge
- the visible tab remains docked to the chosen screen edge
- transparent regions pass clicks through to the app behind Sidenib
- panel width is clamped so it still fits on narrow monitors

The long-term architecture keeps native integrations behind adapters so the UI
can stay portable while desktop capabilities remain explicit and permissioned.

## Open Source

Sidenib is licensed under the Apache License 2.0, the same license as the
Todobar source it starts from. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

Roadmap and release follow-ups are kept in the docs so the public issue tracker
stays focused on real user reports:

- physical macOS QA
- Windows signing and macOS notarization
- signed auto-update channel
- keyboard and accessibility hardening

Contributions are welcome, especially around:

- Windows and macOS edge-window behavior
- accessibility and keyboard-first task flows
- local-first data storage
- release signing and auto-update
- MCP connector design
- AI planning UX with strong privacy boundaries

## Documentation

Planning and research notes live in [`docs/`](docs/).

Useful starting points:

- [Architecture](docs/architecture.md)
- [Gmail integration](docs/gmail-integration.md)
- [Product vision](docs/product-vision.md)
- [UI direction](docs/ui-direction.md)
- [Platform support](docs/platform-support.md)
- [Sidenib identity](docs/sidenib-identity.md)
- [Brand direction](docs/brand-direction.md)
- [Release verification v0.2.0](docs/release-verification-v0.2.0.md)
- [Upstream release verification v0.1.14](docs/release-verification-v0.1.14.md)
- [Roadmap](docs/roadmap.md)
- [Native test matrix](docs/native-test-matrix.md)
- [Security model](docs/security-model.md)
- [Open source plan](docs/open-source-plan.md)
