// Zubo Desktop — Tauri v2 entry point
// Spawns the Zubo backend (bun run src/index.ts start) and wraps it in a native window.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Discover the port Zubo is listening on by reading its stdout.
/// Looks for a line containing "localhost:" followed by digits.
fn discover_port(reader: &mut BufReader<impl std::io::Read>) -> Option<u16> {
    let mut buf = String::new();
    // Read up to 50 lines looking for the port announcement
    for _ in 0..50 {
        buf.clear();
        if reader.read_line(&mut buf).unwrap_or(0) == 0 {
            break;
        }
        // Match patterns like "http://localhost:3000" or "localhost:3000"
        if let Some(idx) = buf.find("localhost:") {
            let after = &buf[idx + "localhost:".len()..];
            let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(port) = digits.parse::<u16>() {
                return Some(port);
            }
        }
    }
    None
}

/// Spawn the Zubo backend process. The working directory is the project root
/// (one level above the `desktop/` folder).
fn spawn_zubo() -> (Child, u16) {
    let project_root = std::env::current_dir()
        .expect("cannot determine cwd")
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::current_dir().unwrap());

    let mut child = Command::new("bun")
        .args(["run", "src/index.ts", "start"])
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("failed to spawn Zubo process — is `bun` installed?");

    let stdout = child.stdout.take().expect("failed to capture Zubo stdout");
    let mut reader = BufReader::new(stdout);

    let port = discover_port(&mut reader).unwrap_or_else(|| {
        eprintln!("warn: could not discover Zubo port from stdout, falling back to 3000");
        3000
    });

    // Continue draining stdout in a background thread so the child process
    // does not block on a full pipe buffer.
    std::thread::spawn(move || {
        let mut sink = String::new();
        loop {
            sink.clear();
            match reader.read_line(&mut sink) {
                Ok(0) | Err(_) => break,
                _ => {} // discard
            }
        }
    });

    (child, port)
}

fn main() {
    let (child, port) = spawn_zubo();
    let child: Mutex<Option<Child>> = Mutex::new(Some(child));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(move |app| {
            // ── Main window ──────────────────────────────────────────
            let url = format!("http://localhost:{}", port);
            let window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title("Zubo")
            .inner_size(1000.0, 700.0)
            .center()
            .decorations(true)
            .hidden_title(true)
            .title_bar_style(tauri::TitleBarStyle::Transparent)
            .build()?;

            // ── System tray ──────────────────────────────────────────
            let open_item = MenuItemBuilder::with_id("open", "Open Zubo").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&open_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(Image::from_bytes(include_bytes!("../icons/icon.png")).unwrap_or_else(|_| {
                    // Fallback: 1x1 transparent PNG if icon file is missing / invalid
                    Image::from_bytes(include_bytes!("../icons/icon.png"))
                        .expect("tray icon not found")
                }))
                .menu(&tray_menu)
                .on_menu_event(move |app_handle, event| match event.id().as_ref() {
                    "open" => {
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // ── Global shortcut: Cmd+Shift+Z (macOS) / Ctrl+Shift+Z ─
            let shortcut: Shortcut = if cfg!(target_os = "macos") {
                "CmdOrCtrl+Shift+Z".parse().unwrap()
            } else {
                "Ctrl+Shift+Z".parse().unwrap()
            };

            let handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            if let Some(w) = handle.get_webview_window("main") {
                                if w.is_visible().unwrap_or(false) {
                                    let _ = w.hide();
                                } else {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                        }
                    })
                    .build(),
            )?;
            app.global_shortcut().register(shortcut)?;

            // ── Hide on close instead of quitting ────────────────────
            let win = window.clone();
            win.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Tauri app");

    app.run(move |_app_handle, event| {
        if let RunEvent::ExitRequested { .. } = &event {
            // Clean up the Zubo child process
            if let Ok(mut guard) = child.lock() {
                if let Some(ref mut c) = *guard {
                    let _ = c.kill();
                    let _ = c.wait();
                }
                *guard = None;
            }
        }
    });
}
