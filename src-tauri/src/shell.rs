//! Native side of the compact shell: window bounds, pointer pass-through and
//! focus return.
//!
//! The frontend owns geometry (`src/shell/geometry.ts`). It sends this module
//! the window bounds for the current mode together with the regions that are
//! actually drawn: the notch hit target, the card and the reminder toast. This
//! module applies the bounds and makes every other pixel of the transparent
//! window pass pointer events to whatever is underneath.
//!
//! Hit-test strategy:
//!
//! * macOS: event driven. `NSEvent` global and local monitors report pointer
//!   movement; each event tests the pointer against the regions and flips
//!   `ignoresMouseEvents` only when the answer changes. Nothing polls.
//! * Other platforms: a bounded polling fallback. A background thread samples
//!   the cursor every `POLL_NEAR` while it is within `POLL_NEAR_DISTANCE` of the
//!   window, and backs off to the slower `POLL_FAR` watch once it leaves.
//!   Setting `SIDENIB_HIT_TEST=poll` selects the same fallback on macOS so it
//!   can be exercised there.
//!
//! The state never changes while a mouse button is held or while the frontend
//! reports a notch gesture, so a drag that starts on the notch keeps its
//! pointer capture and a drag that starts in another app is never hijacked.

use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

pub const HOVER_EVENT: &str = "sidenib-shell-hover";
pub const DISPLAY_EVENT: &str = "sidenib-display-changed";

const MAIN_WINDOW: &str = "main";
/// Sampling interval while the pointer is near the window. Not shorter than
/// the 72 ms the baseline used.
const POLL_NEAR: Duration = Duration::from_millis(80);
/// Sampling interval once the pointer has left the neighbourhood.
const POLL_FAR: Duration = Duration::from_millis(240);
/// Logical pixels around the window that count as "near".
const POLL_NEAR_DISTANCE: f64 = 160.0;

/// Window bounds in logical pixels, in the global top-left coordinate space.
#[derive(Clone, Copy, Debug, Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// A drawn region that intercepts the pointer. Logical pixels relative to the
/// window's top-left corner; corners are rounded by `radius`.
#[derive(Clone, Debug, Deserialize)]
pub struct Region {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub radius: f64,
}

#[derive(Clone, Serialize)]
struct HoverPayload {
    region: Option<String>,
}

#[derive(Default)]
struct Inner {
    regions: Vec<Region>,
    /// Last value given to `set_ignore_cursor_events`; `None` before the first.
    ignoring: Option<bool>,
    hovered: Option<String>,
    gesture_active: bool,
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    previous_app: Option<i32>,
}

#[derive(Default)]
pub struct ShellState(Mutex<Inner>);

fn debug_enabled() -> bool {
    std::env::var_os("SIDENIB_SHELL_DEBUG").is_some()
}

/// True when the point is inside the region after rounding its corners.
pub fn region_contains(region: &Region, x: f64, y: f64) -> bool {
    if x < region.x
        || y < region.y
        || x >= region.x + region.width
        || y >= region.y + region.height
    {
        return false;
    }

    let radius = region
        .radius
        .min(region.width / 2.0)
        .min(region.height / 2.0)
        .max(0.0);

    if radius == 0.0 {
        return true;
    }

    // Nearest corner-circle centre; only the corner squares need the test.
    let cx = x.clamp(region.x + radius, region.x + region.width - radius);
    let cy = y.clamp(region.y + radius, region.y + region.height - radius);

    (x - cx).hypot(y - cy) <= radius
}

/// The id of the first region under the point, or `None` for pass-through.
pub fn region_at(regions: &[Region], x: f64, y: f64) -> Option<&str> {
    regions
        .iter()
        .find(|region| region_contains(region, x, y))
        .map(|region| region.id.as_str())
}

/// Applies one pointer sample. `point` is in logical pixels relative to the
/// window, `buttons_down` is true while any mouse button is held.
fn apply_pointer(window: &WebviewWindow, point: Option<(f64, f64)>, buttons_down: bool) {
    let state = window.state::<ShellState>();
    let mut became_interactive = false;
    let mut hover_change = None;

    {
        let mut inner = state.0.lock().unwrap_or_else(|error| error.into_inner());
        let hovered = point
            .and_then(|(x, y)| region_at(&inner.regions, x, y))
            .map(str::to_owned);
        let frozen = buttons_down || inner.gesture_active;

        if frozen && inner.ignoring.is_some() {
            return;
        }

        let ignore = hovered.is_none() && !inner.gesture_active;

        if inner.ignoring != Some(ignore) {
            inner.ignoring = Some(ignore);
            became_interactive = !ignore;
            let _ = window.set_ignore_cursor_events(ignore);

            if debug_enabled() {
                eprintln!(
                    "[sidenib-shell] ignore={ignore} point={point:?} region={hovered:?}"
                );
            }
        }

        if inner.hovered != hovered {
            inner.hovered = hovered.clone();
            hover_change = Some(hovered);
        }
    }

    if became_interactive {
        remember_frontmost(window.app_handle());
    }

    if let Some(region) = hover_change {
        let _ = window.emit(HOVER_EVENT, HoverPayload { region });
    }
}

/// Re-tests the pointer against the current regions.
fn evaluate(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };

    let (point, buttons_down) = platform::pointer_sample(&window);
    apply_pointer(&window, point, buttons_down);
}

/// Pointer position relative to the window from Tauri's cross-platform APIs.
fn tauri_pointer_sample(window: &WebviewWindow) -> Option<((f64, f64), bool)> {
    let cursor = window.cursor_position().ok()?;
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let scale = window.scale_factor().ok().filter(|scale| *scale > 0.0)?;
    let x = (cursor.x - f64::from(position.x)) / scale;
    let y = (cursor.y - f64::from(position.y)) / scale;
    let width = f64::from(size.width) / scale;
    let height = f64::from(size.height) / scale;
    let near = x >= -POLL_NEAR_DISTANCE
        && y >= -POLL_NEAR_DISTANCE
        && x <= width + POLL_NEAR_DISTANCE
        && y <= height + POLL_NEAR_DISTANCE;

    Some(((x, y), near))
}

/// Bounded polling fallback: samples quickly only while the pointer is near.
fn spawn_polling(app: AppHandle) {
    std::thread::spawn(move || loop {
        let delay = match app.get_webview_window(MAIN_WINDOW) {
            Some(window) => match tauri_pointer_sample(&window) {
                Some((point, near)) => {
                    apply_pointer(&window, Some(point), false);

                    if near {
                        POLL_NEAR
                    } else {
                        POLL_FAR
                    }
                }
                None => POLL_FAR,
            },
            None => POLL_FAR,
        };

        std::thread::sleep(delay);
    });
}

/// Records the app that is frontmost so closing the card can hand focus back.
pub fn remember_frontmost(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        if let Some(pid) = platform::frontmost_other_pid() {
            let state = app.state::<ShellState>();
            let mut inner = state.0.lock().unwrap_or_else(|error| error.into_inner());
            inner.previous_app = Some(pid);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }
}

/// Installs the pointer pass-through for the main window.
pub fn install(app: &AppHandle) {
    let force_polling = std::env::var("SIDENIB_HIT_TEST")
        .map(|value| value == "poll")
        .unwrap_or(false);

    if force_polling || !platform::install_event_driven(app) {
        spawn_polling(app.clone());
    }

    platform::observe_display_changes(app);
}

/// Sizes and places the window, replaces the hit regions and optionally shows
/// the window for the first time. Bounds and regions change together so the
/// pass-through never lags the window by a frame.
#[tauri::command]
pub fn shell_apply_layout(
    window: WebviewWindow,
    state: State<'_, ShellState>,
    bounds: Bounds,
    scale_factor: f64,
    regions: Vec<Region>,
    show: bool,
) -> Result<(), String> {
    if !(bounds.width >= 1.0 && bounds.height >= 1.0) {
        return Err("window bounds must be at least 1 x 1".into());
    }

    {
        let mut inner = state.0.lock().unwrap_or_else(|error| error.into_inner());
        inner.regions = regions;
    }

    if debug_enabled() {
        eprintln!("[sidenib-shell] bounds={bounds:?} scale={scale_factor} show={show}");
    }

    platform::set_bounds(&window, bounds, scale_factor)?;

    if show {
        platform::show_without_activating(&window);
    }

    evaluate(window.app_handle());
    Ok(())
}

/// Keeps the window interactive for the length of a notch gesture.
#[tauri::command]
pub fn shell_set_gesture(window: WebviewWindow, state: State<'_, ShellState>, active: bool) {
    {
        let mut inner = state.0.lock().unwrap_or_else(|error| error.into_inner());
        inner.gesture_active = active;

        if active && inner.ignoring != Some(false) {
            inner.ignoring = Some(false);
            let _ = window.set_ignore_cursor_events(false);
        }
    }

    if !active {
        evaluate(window.app_handle());
    }
}

/// Gives the card keyboard focus, remembering which app had it before.
#[tauri::command]
pub fn shell_focus(window: WebviewWindow) {
    remember_frontmost(window.app_handle());
    let _ = window.set_focus();
}

/// Hands focus back to the app that was frontmost before the card opened.
/// Does nothing when the user has already moved on to another app.
#[tauri::command]
pub fn shell_restore_focus(window: WebviewWindow, state: State<'_, ShellState>) {
    #[cfg(target_os = "macos")]
    {
        let previous = {
            let mut inner = state.0.lock().unwrap_or_else(|error| error.into_inner());
            inner.previous_app.take()
        };

        platform::restore_frontmost(&window, previous);
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Not implemented off macOS: the card closes and the window simply
        // stops taking input. See docs/shell.md.
        let _ = (window, state);
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::ptr::NonNull;

    use block2::RcBlock;
    use objc2::{sel, MainThreadMarker};
    use objc2_app_kit::{
        NSApplication, NSApplicationActivationOptions,
        NSApplicationDidChangeScreenParametersNotification, NSEvent, NSEventMask,
        NSRunningApplication, NSScreen, NSWindow, NSWorkspace,
    };
    use objc2_foundation::{
        NSNotification, NSNotificationCenter, NSObjectProtocol, NSPoint, NSRect, NSSize,
    };
    use tauri::{AppHandle, Emitter, WebviewWindow};

    use super::{evaluate, Bounds, DISPLAY_EVENT};

    fn ns_window(window: &WebviewWindow) -> Option<&NSWindow> {
        let pointer = window.ns_window().ok()? as *const NSWindow;

        // SAFETY: Tauri hands out the live NSWindow backing this window, and
        // every caller below runs on the main thread while the window exists.
        unsafe { pointer.as_ref() }
    }

    fn on_main_thread(window: &WebviewWindow, work: impl FnOnce(&WebviewWindow) + Send + 'static) {
        if MainThreadMarker::new().is_some() {
            work(window);
        } else {
            let handle = window.clone();
            let _ = window.run_on_main_thread(move || work(&handle));
        }
    }

    /// Pointer position relative to the window's top-left corner, in points,
    /// and whether any mouse button is held.
    pub fn pointer_sample(window: &WebviewWindow) -> (Option<(f64, f64)>, bool) {
        if MainThreadMarker::new().is_none() {
            // The polling fallback runs off the main thread.
            return match super::tauri_pointer_sample(window) {
                Some((point, _)) => (Some(point), false),
                None => (None, false),
            };
        }

        let Some(ns_window) = ns_window(window) else {
            return (None, false);
        };
        let location = ns_window.mouseLocationOutsideOfEventStream();
        let height = ns_window.frame().size.height;
        let buttons_down = NSEvent::pressedMouseButtons() != 0;

        (Some((location.x, height - location.y)), buttons_down)
    }

    pub fn install_event_driven(app: &AppHandle) -> bool {
        if MainThreadMarker::new().is_none() {
            return false;
        }

        let mask = NSEventMask::MouseMoved
            | NSEventMask::LeftMouseDragged
            | NSEventMask::RightMouseDragged
            | NSEventMask::OtherMouseDragged
            | NSEventMask::LeftMouseUp
            | NSEventMask::RightMouseUp
            | NSEventMask::OtherMouseUp;

        // Events that go to other apps: the pointer is over a pass-through
        // pixel or another app is frontmost.
        let global_app = app.clone();
        let global = RcBlock::new(move |_event: NonNull<NSEvent>| {
            evaluate(&global_app);
        });
        let global_token = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(mask, &global);

        // Events that come to Sidenib itself.
        let local_app = app.clone();
        let local = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            evaluate(&local_app);
            event.as_ptr()
        });
        // SAFETY: the block returns the event it was given, unchanged.
        let local_token =
            unsafe { NSEvent::addLocalMonitorForEventsMatchingMask_handler(mask, &local) };

        let installed = global_token.is_some() && local_token.is_some();

        // The monitors live for the whole process.
        std::mem::forget(global_token);
        std::mem::forget(local_token);

        if let Some(window) = app_main_window(app) {
            if let Some(ns_window) = ns_window(&window) {
                ns_window.setAcceptsMouseMovedEvents(true);
            }
        }

        installed
    }

    fn app_main_window(app: &AppHandle) -> Option<WebviewWindow> {
        use tauri::Manager;

        app.get_webview_window(super::MAIN_WINDOW)
    }

    /// Tells the frontend when displays are added, removed or rearranged so it
    /// can recompute the work area.
    pub fn observe_display_changes(app: &AppHandle) {
        let handle = app.clone();
        let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
            let _ = handle.emit(DISPLAY_EVENT, ());
        });

        // SAFETY: the block only touches the Send + Sync AppHandle, and the
        // notification is delivered on the posting (main) thread.
        let observer = unsafe {
            NSNotificationCenter::defaultCenter().addObserverForName_object_queue_usingBlock(
                Some(NSApplicationDidChangeScreenParametersNotification),
                None,
                None,
                &block,
            )
        };

        // Observed for the whole process.
        std::mem::forget(observer);
    }

    /// Applies position and size in one `setFrame:` so the notch never shows
    /// at a half-updated place.
    pub fn set_bounds(
        window: &WebviewWindow,
        bounds: Bounds,
        _scale_factor: f64,
    ) -> Result<(), String> {
        on_main_thread(window, move |window| {
            let Some(mtm) = MainThreadMarker::new() else {
                return;
            };
            let Some(ns_window) = ns_window(window) else {
                return;
            };
            // Tauri's logical coordinates have their origin at the top-left of
            // the primary display; AppKit's origin is its bottom-left.
            let Some(primary) = NSScreen::screens(mtm).firstObject() else {
                return;
            };
            let primary_height = primary.frame().size.height;
            let frame = NSRect::new(
                NSPoint::new(bounds.x, primary_height - bounds.y - bounds.height),
                NSSize::new(bounds.width, bounds.height),
            );

            ns_window.setFrame_display(frame, true);
        });

        Ok(())
    }

    /// Shows the window at launch without making Sidenib the active app.
    pub fn show_without_activating(window: &WebviewWindow) {
        on_main_thread(window, |window| {
            if let Some(ns_window) = ns_window(window) {
                ns_window.orderFrontRegardless();
            }
        });
    }

    pub fn frontmost_other_pid() -> Option<i32> {
        let app = NSWorkspace::sharedWorkspace().frontmostApplication()?;
        let pid = app.processIdentifier();

        (pid > 0 && pid != std::process::id() as i32).then_some(pid)
    }

    pub fn restore_frontmost(window: &WebviewWindow, previous: Option<i32>) {
        on_main_thread(window, move |_window| {
            let Some(mtm) = MainThreadMarker::new() else {
                return;
            };
            let Some(pid) = previous else {
                return;
            };

            // Only hand focus back when Sidenib still has it.
            if !NSRunningApplication::currentApplication().isActive() {
                return;
            }

            let Some(target) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
            else {
                return;
            };
            let app = NSApplication::sharedApplication(mtm);

            // macOS 14 and later: activation is cooperative.
            if app.respondsToSelector(sel!(yieldActivationToApplication:)) {
                app.yieldActivationToApplication(&target);
            }

            target.activateWithOptions(NSApplicationActivationOptions(0));
        });
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    use tauri::{AppHandle, PhysicalPosition, PhysicalSize, WebviewWindow};

    use super::Bounds;

    pub fn pointer_sample(window: &WebviewWindow) -> (Option<(f64, f64)>, bool) {
        match super::tauri_pointer_sample(window) {
            Some((point, _)) => (Some(point), false),
            None => (None, false),
        }
    }

    /// No event-driven hit test here yet; the caller starts the polling
    /// fallback.
    pub fn install_event_driven(_app: &AppHandle) -> bool {
        false
    }

    /// Scale changes are forwarded from the window event in `lib.rs`.
    pub fn observe_display_changes(_app: &AppHandle) {}

    pub fn set_bounds(
        window: &WebviewWindow,
        bounds: Bounds,
        scale_factor: f64,
    ) -> Result<(), String> {
        let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };
        let size = PhysicalSize::new(
            (bounds.width * scale).round().max(1.0) as u32,
            (bounds.height * scale).round().max(1.0) as u32,
        );
        let position = PhysicalPosition::new(
            (bounds.x * scale).round() as i32,
            (bounds.y * scale).round() as i32,
        );

        window.set_size(size).map_err(|error| error.to_string())?;
        window
            .set_position(position)
            .map_err(|error| error.to_string())
    }

    pub fn show_without_activating(window: &WebviewWindow) {
        let _ = window.show();
    }
}

#[cfg(test)]
mod tests {
    use super::{region_at, region_contains, Region};

    fn region(id: &str, x: f64, y: f64, width: f64, height: f64, radius: f64) -> Region {
        Region {
            id: id.into(),
            x,
            y,
            width,
            height,
            radius,
        }
    }

    #[test]
    fn rounded_corners_pass_through() {
        let card = region("card", 28.0, 28.0, 340.0, 480.0, 24.0);

        // The corner pixel of the bounding box is outside the rounded shape.
        assert!(!region_contains(&card, 28.5, 28.5));
        assert!(!region_contains(&card, 367.5, 507.5));
        // Just inside the arc, on the diagonal.
        assert!(region_contains(&card, 36.0, 36.0));
        // Edge midpoints and the centre are inside.
        assert!(region_contains(&card, 28.0, 268.0));
        assert!(region_contains(&card, 198.0, 28.0));
        assert!(region_contains(&card, 198.0, 268.0));
    }

    #[test]
    fn margins_pass_through() {
        let regions = [
            region("card", 28.0, 28.0, 340.0, 480.0, 24.0),
            region("notch", 368.0, 232.0, 10.0, 72.0, 0.0),
        ];

        assert_eq!(region_at(&regions, 10.0, 10.0), None);
        assert_eq!(region_at(&regions, 372.0, 100.0), None);
        assert_eq!(region_at(&regions, 372.0, 260.0), Some("notch"));
        assert_eq!(region_at(&regions, 200.0, 260.0), Some("card"));
        // The far edge is exclusive.
        assert_eq!(region_at(&regions, 378.0, 260.0), None);
    }

    #[test]
    fn oversized_radius_is_capped() {
        let pill = region("toast", 0.0, 0.0, 100.0, 20.0, 999.0);

        assert!(region_contains(&pill, 50.0, 10.0));
        assert!(!region_contains(&pill, 0.5, 0.5));
    }
}
