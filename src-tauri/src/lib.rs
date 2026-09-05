// S0 spike harness — compiled ONLY into debug builds (see build.rs + src/probe.rs).
// A release build has no probe commands, no page-load hook and no capability for them.
#[cfg(debug_assertions)]
mod probe;

// S10: keep-awake assertions held around the (not-yet-built) encoder. Ships in
// every build — release included — unlike `probe`.
mod keep_awake;

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

    // `invoke_handler` REPLACES rather than appends, so the debug/release variants
    // each list every command they ship rather than layering a second call on top
    // of the release one (which would silently drop the release-only commands from
    // debug builds).
    #[cfg(debug_assertions)]
    let builder = builder
        .invoke_handler(tauri::generate_handler![
            keep_awake::start_keep_awake,
            keep_awake::stop_keep_awake,
            probe::probe_report,
            probe::probe_ipc,
        ])
        .on_page_load(probe::on_page_load);

    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        keep_awake::start_keep_awake,
        keep_awake::stop_keep_awake,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running setnayan desktop");
}
