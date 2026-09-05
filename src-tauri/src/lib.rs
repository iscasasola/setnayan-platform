// The native RTMPS/FLV encoder (S6). Pure protocol code plus one socket; it holds no
// Tauri commands, because S5 — which owns the webview→Rust transport — is re-scoped
// pending an owner decision (build-sessions/encoder/S0-FINDING.md § 7). Compiled into
// every build so it typechecks and tests with the app, reachable from nothing yet.
pub mod encoder;

// S0 spike harness — compiled ONLY into debug builds (see build.rs + src/probe.rs).
// A release build has no probe commands, no page-load hook and no capability for them.
#[cfg(debug_assertions)]
mod probe;

// S8 — the stream key, two sources, one Rust sink (build-sessions/encoder/S8.md).
// Ships in EVERY build: real product surface, not a spike.
mod stream_key;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // System-browser OAuth (see Cargo.toml): the bundled web app calls
        // plugin:oauth|start to open a localhost loopback, opens the provider URL
        // in the system browser via plugin:opener|open_url, and receives the
        // redirect back on the `oauth://url` event.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .manage(stream_key::StreamKeyState::default())
        .setup(|_app| Ok(()));

    // NOTE: `invoke_handler` is called exactly ONCE below — it SETS the
    // builder's handler rather than merging with a prior call, so the S0 probe
    // commands and the S8 stream-key commands must be registered in the SAME
    // `generate_handler!` call for debug builds, or the second call would
    // silently drop the first one's commands.
    #[cfg(debug_assertions)]
    let builder = builder
        .invoke_handler(tauri::generate_handler![
            stream_key::stream_key_set_pasted,
            stream_key::stream_key_claim_hosted,
            stream_key::stream_key_forget,
            probe::probe_report,
            probe::probe_ipc,
        ])
        .on_page_load(probe::on_page_load);

    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        stream_key::stream_key_set_pasted,
        stream_key::stream_key_claim_hosted,
        stream_key::stream_key_forget,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running setnayan desktop");
}
