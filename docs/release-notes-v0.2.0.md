# Sidenib v0.2.0 release notes

Status: prepared, not published. There is no `v0.2.0` tag and no GitHub
release. The macOS build described here was made locally from this branch.

Sidenib v0.2.0 is the first version of the remake. It starts from
[Todobar](https://github.com/Leonxlnx/todobar) `v0.1.14` by Leonxlnx and
replaces the full-height sidebar with a small notch that opens a compact
card.

## What is new

- **Its own identity.** The Sidenib name, the Peek icon, and a separate app
  identifier, storage, keychain service and login item. It installs beside
  Todobar and does not read Todobar's data.
- **Notch and card.** A 12 × 48 notch halfway down the right edge opens a
  340 × 480 rounded card by click, inward pull, shortcut or menu-bar item.
  The native window is only as large as what is drawn, and everything outside
  the notch and the card passes clicks through to the app underneath.
- **Notes-like views.** Today, Calendar, Lists and Settings rebuilt on shared
  components and design tokens, with System, Light and Dark themes.
- **Calendar.** Clear day states, one-week mode on short screens, and full
  keyboard navigation.
- **Settings.** Ten rows on the first page; sizes, density, presets and the
  backdrop image under Advanced. Every v0.1.14 preference is still there.
- **Reminders.** A toast beside the closed notch, or a banner inside the open
  card. Neither opens the card or takes focus.
- **Shortcut.** `Alt + Shift + S` (`Option + Shift + S` on macOS), with
  `Ctrl + Alt + Shift + S` as the fallback.

The full list is in the [changelog](../CHANGELOG.md).

## Install on macOS

Build it from source, as described in the [README](../README.md#install):

```bash
npm ci
npm run tauri:build
```

This writes `Sidenib.app` and `Sidenib_0.2.0_aarch64.dmg` under
`src-tauri/target/release/bundle/`. To check a copy of the disk image against
the one a build reference names:

```bash
shasum -a 256 Sidenib_0.2.0_aarch64.dmg
```

The pull request that prepared this version records the source commit and
the SHA-256 of the disk image built from it. A rebuild will not produce the
same bytes: the bundle is signed and the disk image is stamped at build time.

The app is ad-hoc signed. It is not signed with an Apple Developer ID and it
is not notarized, so a copy downloaded from the internet has to be allowed
once under System Settings → Privacy & Security.

## Known issues

- Windows and macOS Intel builds are compiled by CI and have not been run.
  On Windows, pointer pass-through uses polling, so a click made within about
  80 ms of crossing the card's edge can land on the wrong side, and focus
  does not return to the previous app when the card closes.
- No Developer ID signing, notarization or auto-update.
- Launch at login is on by default and registers whichever copy of the app
  last ran. A build run from a folder leaves a login item that points at that
  folder; turn the setting off before deleting it, or remove
  `~/Library/LaunchAgents/Sidenib.plist`.
- A new install starts with the inherited sample tasks.
- A reminder banner or toast goes away by itself after nine seconds. The task
  stays marked overdue, and the notch badge goes with the toast.
- The notch colour follows the app theme, not the wallpaper. A dark-theme
  notch on a very light wallpaper is faint.
- The exact reminder time field is the system date control. It was not driven
  natively in testing; presets and stored times were.
- In WebKit, Tab reaches buttons only with Option held or with the system
  keyboard-navigation setting on.
- VoiceOver and Narrator output have not been reviewed.
- The Android companion still has the upstream layout.
- The Gmail connector is in the code and hidden in the app.

## Verification

See [Release verification v0.2.0](release-verification-v0.2.0.md).
