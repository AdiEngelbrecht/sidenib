# Sidenib identity

Sidenib is Adi Engelbrecht's independent remake of
[Todobar](https://github.com/Leonxlnx/todobar) by Leonxlnx. This page records
where the project comes from, what identifies the app on a machine, and how it
behaves next to an installed Todobar. The name and icon are described in
[Brand direction](brand-direction.md).

## Provenance

| | |
| --- | --- |
| Repository | <https://github.com/AdiEngelbrecht/sidenib> (`origin`) |
| Upstream | <https://github.com/Leonxlnx/todobar> (`upstream`, fetch only) |
| Upstream baseline release | `v0.1.14`, tag commit `12a49c9` |
| Starting source commit | `809b0d5857b03b3fec946f227ddaffb70cbe2789`, upstream `main` |
| First Sidenib commit | `3cffc258d72b3cc2dc2ee6a85e535d2b922e2fa7`, name and icon assets |
| License | Apache License 2.0, unchanged; see [LICENSE](../LICENSE) and [NOTICE](../NOTICE) |

The starting commit is three commits after the `v0.1.14` tag: the release
verification record and the merged Android companion update. The whole upstream
history is kept, so `git log` and `git blame` still credit the original
authors. Upstream release tags are not republished in the Sidenib repository;
Sidenib tags its own releases from `v0.2.0` onward.

To compare with upstream in a fresh clone:

```bash
git remote add upstream https://github.com/Leonxlnx/todobar
git remote set-url --push upstream DISABLED
git fetch upstream
git log --oneline upstream/main..main
```

The disabled push URL keeps Sidenib work from being pushed to the upstream
project by mistake.

## Native identity

| Item | Sidenib | Todobar baseline |
| --- | --- | --- |
| Display name | `Sidenib` | `Todobar` |
| App identifier | `io.github.adiengelbrecht.sidenib` | `dev.todobar.desktop` |
| Package and binary | `sidenib` | `todobar` |
| Web storage keys | `sidenib.*` | `todobar.*` |
| Gmail credential service | `sidenib.gmail` | `todobar.gmail` |
| Gmail OAuth variables | `SIDENIB_GMAIL_CLIENT_ID`, `SIDENIB_GMAIL_CLIENT_SECRET` | `TODOBAR_GMAIL_*` |
| Tray events | `sidenib-tray-toggle`, `sidenib-tray-settings` | `todobar-tray-*` |
| Global shortcut | `Alt+Shift+S`, fallback `Control+Alt+Shift+S` | `Alt+T`, fallback `Alt+Shift+T` |
| Android application id | `io.github.adiengelbrecht.sidenib.mobile` | `dev.todobar.mobile` |

On macOS the identifier and product name decide where data lives:

- Tasks, lists, and settings: web storage under
  `~/Library/WebKit/io.github.adiengelbrecht.sidenib/`
- Caches: `~/Library/Caches/io.github.adiengelbrecht.sidenib/`
- Gmail token: a login Keychain item with service `sidenib.gmail`
- Launch at login: `~/Library/LaunchAgents/Sidenib.plist`
- Single-instance lock: a socket named after the identifier in `/tmp`

On Windows the same identifier names the WebView2 data folder under
`%LOCALAPPDATA%`, the Gmail token is a Credential Manager entry for
`sidenib.gmail`, and launch at login is a `Sidenib` value under the current
user's `Run` registry key.

## Running beside Todobar

Sidenib and Todobar are separate apps to the operating system. Both can be
installed and running at once, each with its own edge handle, tray/menu-bar
item, data, and login item.

The global shortcut is the one place two apps could collide, and macOS does not
report a collision when two apps register the same combination. Sidenib
therefore uses its own pair instead of Todobar's:

- `Alt + Shift + S` (`Option + Shift + S` on macOS) is the default.
- `Ctrl + Alt + Shift + S` is registered as the fallback.

The tray/menu-bar menu shows the shortcut that actually registered next to
"Open / Close Sidenib". If another app already holds the first combination, the
menu shows the fallback; if both are taken it shows none, and the tray icon and
edge handle still open the panel. A registration failure is also written to the
app's standard error output.

With both apps docked to the same edge at the same height, the two handles
overlap. Move one of them along the edge, or dock one to another edge in its
settings.

## Migration behavior

Sidenib does not migrate anything from Todobar, by design:

- It never reads, copies, changes, or deletes Todobar's web storage, Keychain
  item, login item, or settings.
- A first launch starts with empty Today, Calendar, and Lists, default
  settings, and no Gmail connection.
- Uninstalling either app leaves the other one's data in place.

To carry tasks over, re-enter them in Sidenib. An explicit import may be added
later; it would be a visible action that the user starts, not something that
happens on launch.

Launch at login follows the inherited default and is on for a new install, so
the first launch writes `Sidenib.plist` pointing at the app that was started.
Turn it off in Settings, or delete that file, after running a build from a
temporary location.

## Icon assets

The approved artwork lives in [`docs/design/sidenib/`](design/sidenib/). The
native icon set in `src-tauri/icons/` and the web favicon are generated from
it:

```bash
npm run icons
```

- Windows, Linux, and store tiles use the icon tile as drawn.
- The macOS `.icns` scales the same artwork onto Apple's 824 px body inside the
  1024 px canvas, so Sidenib matches the size of its neighbors in the Dock.
- `tray-template.png` is the alpha-only Peek mark. macOS treats it as a
  template image and recolors it for light and dark menu bars. Windows uses
  the full-color app icon in the notification area.

## Android companion

The Android companion carries the Sidenib label, version, and application id so
it installs beside the Todobar APK. Its Kotlin source package keeps the
inherited `dev.todobar.mobile` name, and its interface is outside the desktop
redesign.
