# Compact shell

Task ADIEN-161. The shell is the part of Sidenib that sits on the desktop: the
notch at the screen edge, the card frame it reveals, the reminder toast, the
native window behind them, and pointer pass-through. It implements sections 3,
5 (collapsed, toast), 6 (motion) and 7 of the
[compact design contract](design/compact/README.md). What is inside the card is
not the shell's business.

## What is on screen

| State | Drawn | Native window |
| --- | --- | --- |
| Closed | A 12 × 48 notch, halfway down the right edge by default | 28 × 72, the notch's pointer target |
| Reminder | The notch plus a 296 × 60 toast beside it | The two plus 28 of shadow room |
| Open | A 340 × 480 card, radius 24, 10 from the screen edges, and a 6-wide gold notch in the gap. A due reminder is a banner inside the card, not a toast. | 378 × 536 at the default size |

The window is never as tall as the screen. Left and top dock edges, the stored
notch size, panel width, corner radius, hover-only notch and the opt-in
full-height panel are all still honoured; they are clamped when applied and
never rewritten.

## Module boundary

| Path | Contents |
| --- | --- |
| `src/shell/geometry.ts` | The one place that computes where things are: notch, card, toast, the window bounds per mode and the regions that take the pointer. Port of `docs/design/compact/geometry.js`. |
| `src/shell/gesture.ts` | Pure click / inward pull / drag-along-the-edge classification with the 6 px threshold. |
| `src/shell/types.ts` | `Shell`, `Route`, `OpenSource` and `resolveModes` (which window bounds and pointer regions a phase uses). |
| `src/shell/useShell.ts` | Open and close state, focus, keyboard, tray and shortcut events, and keeping the native window in step with what is drawn. |
| `src/shell/nativeWindow.ts` | The only file that talks to Tauri for the window. |
| `src/shell/NotchHandle.tsx`, `PanelCard.tsx`, `shell.css` | The notch, the card frame and their styles. |
| `src/reminders/ReminderToast.tsx` | The compact toast. |
| `src-tauri/src/shell.rs` | Window frame, pointer pass-through and focus return. |

Views get a `Shell` (`isOpen`, `compact`, `open`, `close`, `toggle`) and render
inside `<PanelCard>`. They never read window size or position. `App.tsx` still
holds the active view and the Settings flag; moving those into `Route` belongs
to the view work.

## Native window

The frontend computes geometry from the monitor work area in logical pixels
and sends `shell_apply_layout` the window bounds and the pointer regions in one
call. On macOS the bounds are applied with a single `setFrame:`.

- **Launch.** The window is created hidden at 28 × 72. The frontend places it
  from the stored dock edge and notch position, then asks for it to be shown
  without activating the app. Nothing full height is ever shown.
- **Open.** The window grows to the open bounds first; the card then animates
  with CSS inside bounds that no longer change. Native and CSS motion never
  overlap. Closing plays the CSS dismiss and shrinks the window afterwards.
- **Resizing.** The web view repaints a frame after a resize, so the shell
  draws nothing for the two frames around one. The notch cannot appear at a
  stale offset.
- **Transparency.** The web view is transparent (`macOSPrivateApi`), so only
  the notch, card and toast are drawn. That API rules out the Mac App Store.
- **Displays.** The shell lives on one monitor at a time and follows the
  pointer's display when opened by shortcut or tray, as v0.1.14 did. It
  recomputes on display changes, scale changes and every open and close.

## Pointer pass-through

Only the notch target, the card and the toast take the pointer, each rounded
by its radius. The shadow margin, the area outside each rounded corner and the
gap between the card and the screen edge go to whatever is underneath.

- **macOS: event driven.** `NSEvent` global and local monitors report pointer
  movement. Each event tests the pointer against the regions and flips
  `ignoresMouseEvents` only when the answer changes. There is no timer.
- **Windows and Linux: bounded polling.** A background thread samples the
  cursor every 80 ms while it is within 160 px of the window and every 240 ms
  otherwise. A click made within one interval of entering or leaving a region
  can land on the wrong side. `SIDENIB_HIT_TEST=poll` selects this path on
  macOS for testing.
- The state is frozen while a mouse button is down, so a notch drag keeps its
  pointer capture and a drag begun in another app is never taken over.
- During the pull and the dismiss animation the card is drawn but does not
  take the pointer. During the 220 ms reveal the regions are the card's final
  rectangle, up to 16 px from where it is drawn.

`SIDENIB_SHELL_DEBUG=1` logs every bounds change and pass-through flip.

## Focus

- Opened by shortcut or by Enter or Space on the notch: focus goes to the
  quick-add field. A click that follows a pointer press is never read as
  Enter, whatever click count the input source reports. Opened by click, pull, tray or toast: focus goes to the
  card.
- Closed: inside the web view focus returns to the notch. On macOS the app
  that was frontmost before the card opened becomes frontmost again, unless
  the user has already switched away. Focus return is not implemented on
  Windows.
- Escape closes Settings first, then the card. While closed the card content
  is `inert`.

## Verification

```bash
node docs/design/compact/geometry.js --check
npm run test:smoke          # tests/shell.spec.ts and tests/sidebar-smoke.spec.ts
cargo test --manifest-path src-tauri/Cargo.toml shell
```

Checked on the real app on macOS 26, twice: during the shell work (3440 ×
1440 at 1× with a second 1800 × 1169 display at 2× below it), and on the
integrated release build (one 1800 × 1169 display at 2×). Both used a probe
window underneath and synthetic pointer and key events. The second pass is
recorded in [Release verification v0.2.0](release-verification-v0.2.0.md).

- Launch: one 28 × 72 window at the right-middle of the work area, transparent.
- Click opens and closes; a 70 px pull opens; a 30 px pull closes back; a drag
  along the edge moves the notch and snaps to the centre.
- Clicks in the shadow margin, in each rounded corner of the card's bounding
  box, in the edge gap, beside the closed notch and where the card had been
  all reached the probe window. Clicks on the notch and the card did not.
- The reminder toast: the window grows to 344 × 116 for it, nothing takes
  focus, and clicks in its shadow margin and corner reached the probe window.
- The global shortcut opens and closes; Escape closes; the previously
  frontmost app is frontmost again after closing.
- The menu-bar item opens the card on Settings and quits the app.
- Shortcut with the pointer on the 2× display (first pass): the card opens
  there at the right place and size.
- The polling fallback (`SIDENIB_HIT_TEST=poll`) passes the same click checks
  (first pass).

Not checked natively: Windows and Linux (compiled by CI only), the left and
top docks, the hover-only notch, Dock or menu-bar changes while running,
unplugging a display, three or more displays, fractional Windows scales, and
VoiceOver. Those have browser and geometry coverage only.
