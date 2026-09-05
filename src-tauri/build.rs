fn main() {
    // S0 spike harness (build-sessions/encoder/S0-FINDING.md) — DEBUG BUILDS ONLY.
    //
    // The two probe commands (`probe_report`, `probe_ipc`) and the capability that
    // grants them to https://setnayan.com live in `src/probe.rs` behind
    // `#[cfg(debug_assertions)]` and in `capabilities-debug/`, a directory the
    // default `./capabilities/**/*` glob never reads. Cargo sets `PROFILE` for build
    // scripts ("debug" for `cargo build` / `cargo tauri build --debug`, "release"
    // for `cargo tauri build`), so a release binary neither compiles the commands
    // nor carries the grant. Verify: `strings target/release/setnayan-desktop |
    // grep -c probe_report` must print 0.
    let debug = std::env::var("PROFILE").map(|p| p == "debug").unwrap_or(false);
    let mut attrs = tauri_build::Attributes::new();
    if debug {
        attrs = attrs
            .app_manifest(tauri_build::AppManifest::new().commands(&["probe_report", "probe_ipc"]))
            .capabilities_path_pattern("./capabilities*/**/*.json");
        println!("cargo:rerun-if-changed=capabilities-debug");
        println!("cargo:rerun-if-changed=probe/encoder-probe.js");
    }
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
