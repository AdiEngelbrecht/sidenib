use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod gmail;
mod shell;

const TRAY_TOGGLE_EVENT: &str = "sidenib-tray-toggle";
const SHORTCUT_TOGGLE_EVENT: &str = "sidenib-shortcut-toggle";
const TRAY_SETTINGS_EVENT: &str = "sidenib-tray-settings";

// Sidenib uses its own shortcut pair so it can run beside the upstream
// baseline app (Alt+T / Alt+Shift+T) without both toggling at once. The
// second entry is the fallback when another app already holds the first.
const TOGGLE_SHORTCUTS: [&str; 2] = ["Alt+Shift+S", "Control+Alt+Shift+S"];

/// Forwards a tray or shortcut action to the shell. The window is not focused
/// here: the frontend decides whether the action opens the card (and takes
/// focus) or closes it (and hands focus back), so the app that is frontmost
/// right now is recorded first.
fn emit_to_main(app: &tauri::AppHandle, event: &str) {
    shell::remember_frontmost(app);
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
                    emit_to_main(app, SHORTCUT_TOGGLE_EVENT);
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
        .manage(shell::ShellState::default())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::ScaleFactorChanged { .. }) {
                let _ = window.emit(shell::DISPLAY_EVENT, ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            shell::shell_apply_layout,
            shell::shell_focus,
            shell::shell_restore_focus,
            shell::shell_set_gesture,
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
            }

            // The window starts hidden at the size of the closed notch. The
            // frontend places it from the saved dock edge and shows it, so
            // launch never flashes a full-height or misplaced surface.
            shell::install(app.handle());

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
