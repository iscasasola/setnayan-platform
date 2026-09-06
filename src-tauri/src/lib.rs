// The native RTMPS/FLV encoder (S6). Pure protocol code plus one socket; the crate
// itself holds no Tauri commands ON PURPOSE — see its own `lib.rs`/`Cargo.toml`
// headers — so its 42 tests run on every pull request without compiling tauri, wry
// and webkit first. S5's webview→Rust transport command surface (`encoder_ipc`,
// below) lives in THIS crate instead, and calls into `encoder::contract` to decode
// the wire format.
//
// Re-exported here so `encoder::…` resolves the same as when it was a module.
pub use setnayan_encoder as encoder;

// S0 spike harness — compiled ONLY into debug builds (see build.rs + src/probe.rs).
// A release build has no probe commands, no page-load hook and no capability for them.
#[cfg(debug_assertions)]
mod probe;

// S10: keep-awake assertions held around the (not-yet-built) encoder. Ships in
// every build — release included — unlike `probe`.
mod keep_awake;

// S8 — the stream key, two sources, one Rust sink (build-sessions/encoder/S8.md).
// Ships in EVERY build: real product surface, not a spike.
mod stream_key;

// S5 — the webview→Rust transport's command surface (build-sessions/encoder/S5.md).
// Ships in EVERY build: real product surface, not a spike (unlike `probe`, above).
mod encoder_ipc;

// S12 — the auto-updater (build-sessions/encoder/S12.md). Ships in EVERY
// build: checked from Rust at launch and again after every `encoder_stop`,
// never from the web page (see the module's own docblock).
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // System-browser OAuth (see Cargo.toml): the bundled web app calls
        // plugin:oauth|start to open a localhost loopback, opens the provider URL
        // in the system browser via plugin:opener|open_url, and receives the
        // redirect back on the `oauth://url` event.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        // S12: no webview-invokable commands are registered for this plugin
        // (see updater.rs's docblock — the check is driven entirely from
        // Rust), so capabilities/default.json needs no new grant for it.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(stream_key::StreamKeyState::default())
        .manage(encoder_ipc::EncoderIpcState::default())
        .manage(updater::UpdaterState::default())
        .setup(|app| {
            // Fire-and-forget: check for an update the moment the app is up.
            // Deferred entirely inside `check_and_maybe_install` if a
            // broadcast is somehow already live (e.g. a crash-relaunch mid-
            // stream); never blocks startup on a network round-trip.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(updater::check_and_maybe_install(handle));
            Ok(())
        });

    // NOTE: `invoke_handler` SETS the builder's handler rather than merging with a
    // prior call, so every command a profile ships must be listed in that profile's
    // SINGLE `generate_handler!` call — S8's stream-key commands, S10's keep-awake
    // commands and (debug only) S0's probe commands together. A second call would
    // silently drop the first one's commands.
    #[cfg(debug_assertions)]
    let builder = builder
        .invoke_handler(tauri::generate_handler![
            keep_awake::start_keep_awake,
            keep_awake::stop_keep_awake,
            stream_key::stream_key_set_pasted,
            stream_key::stream_key_claim_hosted,
            stream_key::stream_key_forget,
            encoder_ipc::encoder_start,
            encoder_ipc::encoder_config,
            encoder_ipc::encoder_push,
            encoder_ipc::encoder_stop,
            encoder_ipc::encoder_probe,
            probe::probe_report,
            probe::probe_ipc,
        ])
        .on_page_load(probe::on_page_load);

    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        keep_awake::start_keep_awake,
        keep_awake::stop_keep_awake,
        stream_key::stream_key_set_pasted,
        stream_key::stream_key_claim_hosted,
        stream_key::stream_key_forget,
        encoder_ipc::encoder_start,
        encoder_ipc::encoder_config,
        encoder_ipc::encoder_push,
        encoder_ipc::encoder_stop,
        encoder_ipc::encoder_probe,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running setnayan desktop");
}
