# Release Verification v0.2.0

This page records the checks for Sidenib `v0.2.0`, the version that introduces
the Sidenib identity. `v0.2.0` is in development: no tag, installer, or GitHub
release has been published.

## Scope

- Repository: `AdiEngelbrecht/sidenib`
- Upstream baseline: Todobar `v0.1.14`, starting source commit
  `809b0d5857b03b3fec946f227ddaffb70cbe2789`
- Change: product name, Peek icon set, app identifier, storage and credential
  namespaces, global shortcut, repository metadata, and documentation. See
  [Sidenib identity](sidenib-identity.md).

The interface is still the inherited sidebar. The compact redesign is tracked
separately.

## Environment

- macOS 26 (Darwin 25.6.0) on Apple Silicon, dark appearance
- Node.js 24.20.0, npm 11.19.0
- Rust 1.100.0 stable, installed with rustup
- Todobar `v0.1.14` installed at `/Applications/Todobar.app`

## Automated checks

Run on 2026-11-16, in the working tree and again in a fresh clone of the
committed branch after `npm ci`:

| Command | Result |
| --- | --- |
| `npm run verify` | Passed, including the identity and attribution checks |
| `npm run build` | Passed |
| `npm run lint` | Passed |
| `npm run test:smoke` | 11 of 11 Playwright tests passed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Passed |
| `npm run test:native` | Passed (release build without bundling) |
| `npx tauri build --ci --bundles app` | Built `Sidenib.app` (working tree only) |

## Native checks on macOS

Run against the locally built, unsigned `Sidenib.app`, started from the build
folder. It was not copied to `/Applications`.

- The bundle reports `CFBundleName` and `CFBundleDisplayName` `Sidenib`,
  identifier `io.github.adiengelbrecht.sidenib`, version `0.2.0`, executable
  `sidenib`, and the Sidenib icon.
- Sidenib created its own `~/Library/WebKit/io.github.adiengelbrecht.sidenib/`
  and `~/Library/Caches/io.github.adiengelbrecht.sidenib/` folders, its own
  `~/Library/LaunchAgents/Sidenib.plist`, and its own single-instance socket.
- With only Sidenib running, every file in Todobar's WebKit data, caches, and
  `/Applications/Todobar.app` kept the same size and modification time as
  before the launch.
- Todobar was then started. Both processes ran together, each with its own
  window and bundle identifier. Starting a second Sidenib left one Sidenib
  process and did not affect Todobar.
- Both shortcuts registered without an error. Read through the accessibility
  API, the menu-bar item has the tooltip `Sidenib`, and its menu lists
  "Open / Close Sidenib" with `Option + Shift + S`, "Settings", and
  "Quit Sidenib".
- No `sidenib.gmail` Keychain item exists before Gmail is connected, and no
  `todobar.gmail` item was read or written.

After the checks, both apps were quit, and the `Sidenib.plist` login item that
pointed at the build folder was removed.

## Not verified

- The look of the menu-bar template mark in light and dark appearance. Screen
  capture was not available in the verification session, so the mark was
  checked only as an alpha-only image flagged as a template.
- Toggling the panel with the global shortcut by hand. Synthetic key presses
  did not produce a measurable window change for either app in the
  verification session, so this needs a manual press.
- Windows builds and behavior, beyond the shared checks above. CI runs the
  Windows build on pull requests.
- The Android companion. No JDK or Android SDK was available locally; the
  Android workflow builds the APK on pull requests that touch `android/`.
- Gmail sign-in. The connector stays hidden in the product UI, and no OAuth
  client is configured for Sidenib.
- Code signing and notarization. Local builds are unsigned.
