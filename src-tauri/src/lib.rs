#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // System-browser OAuth (see Cargo.toml): the bundled web app calls
        // plugin:oauth|start to open a localhost loopback, opens the provider URL
        // in the system browser via plugin:opener|open_url, and receives the
        // redirect back on the `oauth://url` event.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running setnayan desktop");
}
