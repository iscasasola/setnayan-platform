// The native RTMPS/FLV encoder (S6). Pure protocol code plus one socket; it holds no
// Tauri commands, because S5 — which owns the webview→Rust transport — is re-scoped
// pending an owner decision (build-sessions/encoder/S0-FINDING.md § 7). Compiled into
// every build so it typechecks and tests with the app, reachable from nothing yet.
pub mod encoder;

// S0 spike harness — compiled ONLY into debug builds (see build.rs + src/probe.rs).
// A release build has no probe commands, no page-load hook and no capability for them.
#[cfg(debug_assertions)]
mod probe;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // System-browser OAuth (see Cargo.toml): the bundled web app calls
        // plugin:oauth|start to open a localhost loopback, opens the provider URL
        // in the system browser via plugin:opener|open_url, and receives the
        // redirect back on the `oauth://url` event.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|_app| Ok(()));

    #[cfg(debug_assertions)]
    let builder = builder
        .invoke_handler(tauri::generate_handler![probe::probe_report, probe::probe_ipc])
        .on_page_load(probe::on_page_load);

    builder
        .run(tauri::generate_context!())
        .expect("error while running setnayan desktop");
}
