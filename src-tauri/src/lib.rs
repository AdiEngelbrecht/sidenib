use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod gmail;

const TRAY_TOGGLE_EVENT: &str = "sidenib-tray-toggle";
const TRAY_SETTINGS_EVENT: &str = "sidenib-tray-settings";

// Sidenib uses its own shortcut pair so it can run beside the upstream
// baseline app (Alt+T / Alt+Shift+T) without both toggling at once. The
// second entry is the fallback when another app already holds the first.
const TOGGLE_SHORTCUTS: [&str; 2] = ["Alt+Shift+S", "Control+Alt+Shift+S"];

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(true);
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn emit_to_main(app: &tauri::AppHandle, event: &str) {
    focus_main_window(app);
    let _ = app.emit_to("main", event, ());
}

fn setup_tray(app: &tauri::App, active_shortcut: Option<&str>) -> tauri::Result<()> {
    // The menu shows whichever shortcut actually registered, so an occupied
    // primary shortcut surfaces the fallback instead of a dead hint.
    let toggle = MenuItem::with_id(
        app,
        "toggle",
        "Open / Close Sidenib",
        true,
        active_shortcut,
    )?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Sidenib", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &settings, &quit])?;
    // macOS menu bars expect an alpha-only template image that follows the
    // system appearance; other platforms keep the full-color app icon.
    #[cfg(target_os = "macos")]
    let icon = Some(tauri::include_image!("icons/tray-template.png"));
    #[cfg(not(target_os = "macos"))]
    let icon = app.default_window_icon().cloned();

    let mut tray = TrayIconBuilder::with_id("sidenib")
        .tooltip("Sidenib")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => emit_to_main(app, TRAY_TOGGLE_EVENT),
            "settings" => emit_to_main(app, TRAY_SETTINGS_EVENT),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                emit_to_main(tray.app_handle(), TRAY_TOGGLE_EVENT);
            }
        });

    if let Some(icon) = icon {
        tray = tray.icon(icon).icon_as_template(cfg!(target_os = "macos"));
    }

    tray.build(app)?;
    Ok(())
}

/// Registers the toggle shortcuts and returns the first one that is active.
fn setup_global_shortcuts(app: &tauri::App) -> Option<&'static str> {
    let mut active = None;

    for shortcut in TOGGLE_SHORTCUTS {
        let result = app
            .global_shortcut()
            .on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    emit_to_main(app, TRAY_TOGGLE_EVENT);
                }
            });

        match result {
            Ok(()) => {
                active.get_or_insert(shortcut);
            }
            Err(error) => {
                eprintln!("failed to register global shortcut {shortcut}: {error}");
            }
        }
    }

    active
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            gmail::gmail_connect,
            gmail::gmail_disconnect,
            gmail::gmail_fetch_unread,
            gmail::gmail_status,
        ])
        .setup(|app| {
            let active_shortcut = setup_global_shortcuts(app);
            setup_tray(app, active_shortcut)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.set_resizable(false);
                let _ = window.set_always_on_top(true);
                let _ = window.set_skip_taskbar(true);
                let _ = window.set_background_color(Some(tauri::utils::config::Color(0, 0, 0, 0)));

                let monitor = window
                    .cursor_position()
                    .ok()
                    .and_then(|position| {
                        window
                            .monitor_from_point(position.x, position.y)
                            .ok()
                            .flatten()
                    })
                    .or_else(|| window.current_monitor().ok().flatten());

                if let Some(monitor) = monitor {
                    let monitor_size = monitor.size();
                    let monitor_position = monitor.position();
                    let scale_factor = monitor.scale_factor();
                    let window_width = (442.0_f64 * scale_factor).round() as u32;
                    let tab_width = (42.0_f64 * scale_factor).round() as u32;
                    let closed_offset = (2.0_f64 * scale_factor).round() as i32;

                    let _ = window
                        .set_size(tauri::PhysicalSize::new(window_width, monitor_size.height));
                    let _ = window.set_position(tauri::PhysicalPosition::new(
                        monitor_position.x + monitor_size.width as i32 - tab_width as i32
                            + closed_offset,
                        monitor_position.y,
                    ));
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
