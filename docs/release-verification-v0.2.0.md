# Release Verification v0.2.0

This page records the checks for Sidenib `v0.2.0`. No tag, installer or
GitHub release has been published. There are two passes: the integrated
release build on 2026-11-17, and the identity pass on 2026-11-16 that it
builds on.

## Integrated build, 2026-11-17

Branch `sidenib-integrated-release`: identity, compact shell, Today and Lists,
Calendar and Settings merged, plus the integration fixes listed in the
[changelog](../CHANGELOG.md).

### Environment

- macOS 26 (Darwin 25.6.0) on Apple Silicon, one 1800 × 1169 display at 2×,
  system appearance dark
- Node.js 24.20.0, npm 11.19.0, Rust stable
- Todobar `v0.1.14` installed at `/Applications/Todobar.app`

### Automated checks

| Command | Result |
| --- | --- |
| `npm run verify` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run test:smoke` | 100 of 100 Playwright tests passed in Chromium |
| `node docs/design/compact/geometry.js --check` | Passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed |
| `npm run tauri build -- --bundles app,dmg` | Built `Sidenib.app` and `Sidenib_0.2.0_aarch64.dmg` |
| `codesign --verify --deep --strict Sidenib.app` | Passed (ad-hoc signature, identifier `io.github.adiengelbrecht.sidenib`) |

The browser tests run the web interface in Chromium. They do not show
anything about the native window, transparency or click-through.

### Native checks on macOS

Run against the release `Sidenib.app` started from the build folder, with a
plain backdrop window underneath that logged every click it received.
Pointer and key input was synthetic (`CGEvent`), the window list came from
`CGWindowListCopyWindowInfo`, and screenshots were taken with `screencapture`.
Nobody used a physical mouse for this pass.

| Area | What was done | Result |
| --- | --- | --- |
| Launch | Started the app | One 28 × 72 window at the right edge, centred in the work area, transparent, no flash, another app stayed frontmost |
| Click | Clicked the notch eight times each way | Opened to 378 × 536 and closed every time |
| Pull | Dragged inward 30 px, then 76 px | The short pull closed back; the long pull opened |
| Reposition | Dragged the notch 150 px up, opened, dragged back | The notch and card moved together, and it snapped to the centre |
| Click-through, open | Clicked the shadow margin left of and above the card, all four corner boxes, and the gap at the screen edge | All seven reached the backdrop. Clicks on the card body and just inside a rounded corner did not. |
| Click-through, closed | Clicked where the card had been, beside the notch and above it | All three reached the backdrop. A click on the notch did not. |
| Shortcut | `Option + Shift + S` from another app | Opened with the text cursor in quick add; typing and Enter added a task. Pressed again, the card closed and the other app was frontmost. `Control + Option + Shift + S` also toggles. |
| Tasks | Added by keyboard, completed, saw row actions on hover | Worked; the Completed count followed |
| Lists | Created a list, added two tasks, pinned it, folded its group on Today | Worked |
| Calendar | Selected a day by click, moved with the arrow key and Enter, captured a task and an event | Worked; the day got its mark and the agenda its count |
| Themes | System on a dark Mac, then Light, then Dark | Each applied at once |
| Restart | Quit and started again, twice | Tasks, lists, the pin, the fold and the theme were as left; the stored values were read back from the web view's storage |
| Reminder, card closed | A task came due while closed | Window grew to 344 × 116, toast and badge showed, nothing took focus. Clicks in the toast's shadow margin and corner reached the backdrop. "10 min" moved the reminder ten minutes on. |
| Reminder, card open | A task came due while open | Gold banner between the header and the body; the header stayed visible and the view did not change. Its main area opened Calendar on that day. |
| Escape | In a list menu, in Settings, then on the card | One layer each time |
| Menu bar | Read the item through the accessibility API, chose Settings, then Quit | Tooltip "Sidenib"; items "Open / Close Sidenib", "Settings", "Quit Sidenib"; Settings opened the card on Settings; Quit ended the process |
| Clipping | Today with more rows than fit | The body scrolled inside the card; the card kept its size and corners |
| Beside Todobar | Started `/Applications/Todobar.app` while Sidenib ran | Two processes, two windows, separate identifiers. Todobar's binary and login item were byte-identical afterwards. |

The reminder times for the two reminder rows were written into the test
profile's stored tasks before launch, because the system date field could not
be driven with synthetic keys.

One thing the pass turned up was fixed: a pointer click that an input source
reports with a click count of zero toggled the notch twice. Real mice do not
do this; the test tool did.

### Not checked in this pass

- Windows, on any machine. macOS on Intel.
- More than one display, a display at 1×, fractional scales, unplugging a
  display, and Dock or menu-bar changes while running. The earlier shell pass
  covered two displays at 1× and 2×; see [shell.md](shell.md).
- The left and top edges, the hover-only notch, the full-height option, the
  one-week calendar, the Advanced settings pages and Reset, natively.
- Dismiss on the banner and a reminder opened from the toast, natively. Both
  are covered in the browser tests.
- The app following a system appearance change while it runs.
- Launch at login after an actual login.
- VoiceOver.
- Installing from the `.dmg` into `/Applications`. The image was built and
  its contents listed; the app was run from the build folder.
- Developer ID signing and notarization. Neither was done.

### Left on this Mac

The test profile was removed afterwards and the Sidenib web view data and
`~/Library/LaunchAgents/Sidenib.plist` that were there before were put back
unchanged. That login item predates this pass and points at a build in
another working folder.

## Identity pass, 2026-11-16

### Scope

- Repository: `AdiEngelbrecht/sidenib`
- Upstream baseline: Todobar `v0.1.14`, starting source commit
  `809b0d5857b03b3fec946f227ddaffb70cbe2789`
- Change: product name, Peek icon set, app identifier, storage and credential
  namespaces, global shortcut, repository metadata, and documentation. See
  [Sidenib identity](sidenib-identity.md).

At the time of this pass the interface was still the inherited sidebar.

### Environment

- macOS 26 (Darwin 25.6.0) on Apple Silicon, dark appearance
- Node.js 24.20.0, npm 11.19.0
- Rust 1.100.0 stable, installed with rustup
- Todobar `v0.1.14` installed at `/Applications/Todobar.app`

### Automated checks

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

### Native checks on macOS

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

### Not verified

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
