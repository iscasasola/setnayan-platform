//! S12 (`build-sessions/encoder/S12.md`) — the auto-updater. Owner-locked
//! (DECISION_LOG 2026-09-03 ②): the shell is a meta-refresh to setnayan.com,
//! so WEB changes reach users instantly — only the NATIVE half (this Rust
//! encoder) is version-locked, and a bug in it would otherwise mean asking
//! couples to reinstall the week of their wedding.
//!
//! ── WHY THE CHECK LIVES HERE, NOT ON THE WEB PAGE ───────────────────────────
//! The bundled web app is the same for every visitor (browser or desktop
//! shell) — it cannot know it is running inside THIS particular native build,
//! let alone decide whether upgrading it mid-broadcast is safe. So the check
//! runs from Rust, at launch (`lib.rs`'s `.setup()` spawns
//! `check_and_maybe_install`), and again the moment a broadcast ends
//! (`encoder_ipc::encoder_stop` calls `recheck_after_stop` after resetting
//! its session) — never from a JS-callable "check now" command the webview
//! could invoke on its own schedule.
//!
//! ── WHY THE ENDPOINT IS R2, NOT A GITHUB RELEASE (PREMISE E8 MISSED) ────────
//! This repo is private. A GitHub Release asset URL 404s for anyone but a
//! logged-in collaborator regardless of `prerelease` — see
//! `build-desktop.yml`'s own header comment, which retired that path for
//! exactly this reason. `EXPECTED_ENDPOINT_HOST` is the ONE public host this
//! build's manifest may ever come from: the `setnayan-media` R2 bucket's
//! custom domain, the same one `apps/web/lib/r2.ts`'s `publicUrlFor` and
//! `apps/web/lib/desktop-release.test.ts`'s own fixtures use.
//!
//! ── WHY A SEPARATE SIGNATURE GUARD, WHEN THE PLUGIN ALREADY VERIFIES ────────
//! `tauri-plugin-updater`'s own `Update::download` calls `verify_signature`
//! against the configured pubkey before installing anything — but that check
//! only runs AFTER a network download, and only refuses a signature that
//! fails cryptographic verification. `build-desktop.yml`'s `publish-latest`
//! job writes a literal `signature: ""` placeholder for any platform S11's
//! signing pipeline hasn't reached yet (its own comment: "honest about not
//! wired yet, not a bug") — `manifest_signature_ok` refuses that BEFORE
//! spending the download, and is this session's own guard, not a re-test of
//! the plugin's crypto.
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::encoder_ipc::EncoderIpcState;

/// The one public host `plugins.updater.endpoints` in `tauri.conf.json` may
/// ever resolve to. Mirrors `apps/web/lib/r2.ts`'s `publicUrlFor` doc comment
/// and `apps/web/lib/desktop-release.test.ts`'s own fixture host — the
/// `setnayan-media` R2 bucket's custom domain, the only PUBLICLY-served R2
/// bucket in this project.
pub const EXPECTED_ENDPOINT_HOST: &str = "media.setnayan.com";

/// Event the (non-modal) frontend toast listens for. Payload:
/// `DeferredUpdateNotice`.
const UPDATE_READY_EVENT: &str = "setnayan://update-ready";

/// Holds an update `check()` found and deferred because the encoder was
/// mid-broadcast, so `recheck_after_stop` has something to install once the
/// session goes idle without paying for a second network round-trip.
#[derive(Default)]
pub struct UpdaterState(Mutex<Option<Update>>);

/// GUARD — "unsigned manifest accepted -> red". A well-formed minisign
/// signature is never empty; `""` is exactly what an unsigned platform entry
/// in `latest.json` looks like today (see the module docblock). Mutating this
/// to `true` (or deleting the call site) is the literal defect: an update
/// with no real signature would be installed sight-unseen.
pub fn manifest_signature_ok(signature: &str) -> bool {
    !signature.trim().is_empty()
}

/// GUARD — "endpoint not R2 -> red". Requires the URL's origin to be exactly
/// `https://EXPECTED_ENDPOINT_HOST` — not merely containing that string
/// somewhere in the URL (`https://media.setnayan.com.evil.example/...` and
/// `https://evil.example/media.setnayan.com/...` must both fail) and not
/// merely `http` (an unencrypted manifest fetch is its own compromise, and
/// `tauri-plugin-updater`'s own config also refuses non-`https` outside
/// debug builds).
pub fn is_r2_endpoint(url: &str) -> bool {
    match url.strip_prefix("https://") {
        Some(rest) => rest.split('/').next().unwrap_or("") == EXPECTED_ENDPOINT_HOST,
        None => false,
    }
}

/// GUARD — "update attempted while publishing -> red". `idle` is
/// `EncoderIpcState::is_idle()`: `false` while a broadcast session is
/// authorized. Mutating the branches (or inverting `idle`) is the literal
/// defect this decision exists to catch — an update installed mid-stream.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum UpdateAction {
    Install,
    Defer,
}

pub fn decide_action(idle: bool) -> UpdateAction {
    if idle {
        UpdateAction::Install
    } else {
        UpdateAction::Defer
    }
}

#[derive(Clone, serde::Serialize)]
struct DeferredUpdateNotice {
    version: String,
    /// The exact copy from S12's task spec — a small native notice, nothing
    /// modal during a broadcast.
    message: String,
}

/// One check-and-maybe-install pass. Called once from `lib.rs`'s `.setup()`
/// at launch, and again from `recheck_after_stop` below. Never installs
/// without a non-empty manifest signature; never installs while the encoder
/// is mid-broadcast (defers + notifies instead).
pub async fn check_and_maybe_install(app: AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[s12-updater] plugin unavailable: {e}");
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => return, // already current
        Err(e) => {
            eprintln!("[s12-updater] check failed: {e}");
            return;
        }
    };

    // GUARD — "endpoint not R2 -> red", the runtime half: `endpoints` in
    // tauri.conf.json is fixed at compile time (the config-file test below
    // covers that), but `download_url` is attacker-reachable CONTENT of
    // whatever `latest.json` says — a compromised or misconfigured manifest
    // could point the actual artifact fetch anywhere. Refuse before ever
    // downloading if it isn't the real R2 host.
    if !is_r2_endpoint(update.download_url.as_str()) {
        eprintln!(
            "[s12-updater] refusing update {} — download_url {} is not the real R2 host ({EXPECTED_ENDPOINT_HOST})",
            update.version, update.download_url
        );
        return;
    }

    if !manifest_signature_ok(&update.signature) {
        eprintln!(
            "[s12-updater] refusing update {} — manifest signature is empty (platform not signed yet, see build-desktop.yml)",
            update.version
        );
        return;
    }

    let idle = app
        .try_state::<EncoderIpcState>()
        .map(|s| s.is_idle())
        .unwrap_or(true);

    match decide_action(idle) {
        UpdateAction::Install => install_now(app, update).await,
        UpdateAction::Defer => {
            let version = update.version.clone();
            if let Some(state) = app.try_state::<UpdaterState>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(update);
                }
            }
            println!("[s12-updater] update {version} ready, deferred — encoder is not idle");
            let _ = app.emit(
                UPDATE_READY_EVENT,
                DeferredUpdateNotice {
                    version,
                    message: "Update ready — installs when you're not streaming".to_string(),
                },
            );
        }
    }
}

/// Downloads + installs, then restarts the app. `download_and_install`
/// itself re-verifies the signature cryptographically against the configured
/// pubkey (`tauri-plugin-updater`'s own `verify_signature`) before touching
/// disk — this function is only ever reached after `manifest_signature_ok`
/// already refused an empty one, so that second check is defense in depth,
/// not this session's guard.
async fn install_now(app: AppHandle, update: Update) {
    let version = update.version.clone();
    match update.download_and_install(|_chunk, _total| {}, || {}).await {
        Ok(()) => {
            println!("[s12-updater] installed {version}, restarting");
            app.restart(); // never returns
        }
        Err(e) => {
            eprintln!("[s12-updater] install of {version} failed: {e}");
        }
    }
}

/// Called from `encoder_ipc::encoder_stop` right after it resets the session
/// to idle. If launch (or an earlier stop) found and deferred an update, this
/// is what actually installs it now that streaming has ended — "Re-check on
/// `encoder_stop`" from the task spec. If nothing was pending, runs a fresh
/// check in case one was published while this session was live.
pub fn recheck_after_stop(app: AppHandle) {
    let pending = app
        .try_state::<UpdaterState>()
        .and_then(|s| s.0.lock().ok().and_then(|mut guard| guard.take()));

    match pending {
        Some(update) => {
            tauri::async_runtime::spawn(async move {
                install_now(app, update).await;
            });
        }
        None => {
            tauri::async_runtime::spawn(check_and_maybe_install(app));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── "update attempted while publishing -> red" ──────────────────────────
    #[test]
    fn decide_action_installs_only_when_idle() {
        assert_eq!(decide_action(true), UpdateAction::Install);
    }

    #[test]
    fn decide_action_defers_when_the_encoder_is_not_idle() {
        assert_eq!(decide_action(false), UpdateAction::Defer);
    }

    // ── "unsigned manifest accepted -> red" ─────────────────────────────────
    #[test]
    fn an_empty_signature_is_never_accepted() {
        assert!(!manifest_signature_ok(""));
    }

    #[test]
    fn a_whitespace_only_signature_is_never_accepted() {
        assert!(!manifest_signature_ok("   "));
    }

    #[test]
    fn a_real_looking_signature_is_accepted() {
        assert!(manifest_signature_ok(
            "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQpSV1J5OTNjNkJVWGxKZHU="
        ));
    }

    // ── "endpoint not R2 -> red" ─────────────────────────────────────────────
    #[test]
    fn is_r2_endpoint_accepts_the_real_host() {
        assert!(is_r2_endpoint(
            "https://media.setnayan.com/desktop/latest/latest.json"
        ));
    }

    #[test]
    fn is_r2_endpoint_rejects_a_lookalike_suffix_host() {
        // "media.setnayan.com" is a PREFIX of this host, which a naive
        // `.starts_with(...)` or `.contains(...)` check would wrongly accept.
        assert!(!is_r2_endpoint(
            "https://media.setnayan.com.evil.example/desktop/latest/latest.json"
        ));
    }

    #[test]
    fn is_r2_endpoint_rejects_the_host_string_merely_appearing_in_the_path() {
        assert!(!is_r2_endpoint(
            "https://evil.example/media.setnayan.com/latest.json"
        ));
    }

    #[test]
    fn is_r2_endpoint_rejects_plain_http() {
        assert!(!is_r2_endpoint(
            "http://media.setnayan.com/desktop/latest/latest.json"
        ));
    }

    #[test]
    fn is_r2_endpoint_rejects_a_github_release_url() {
        // PREMISE E8 MISSED — this is the literal defect S12 replaces: a
        // GitHub Release asset URL 404s for the public because this repo is
        // private.
        assert!(!is_r2_endpoint(
            "https://github.com/iscasasola/setnayan-platform/releases/download/desktop-latest/latest.json"
        ));
    }

    // ── the ACTUAL configured endpoint, read live from tauri.conf.json ──────
    // Rule 8: read the live object, never a comment. This parses the real
    // config file this binary ships with — a mutation that pointed
    // `plugins.updater.endpoints` at any non-R2 host fails this test.
    #[test]
    fn tauri_conf_json_updater_endpoint_is_the_real_r2_host() {
        let conf = include_str!("../tauri.conf.json");
        let parsed: serde_json::Value =
            serde_json::from_str(conf).expect("tauri.conf.json must be valid JSON");
        let endpoints = parsed["plugins"]["updater"]["endpoints"]
            .as_array()
            .expect("plugins.updater.endpoints must be an array");
        assert!(
            !endpoints.is_empty(),
            "plugins.updater.endpoints must not be empty"
        );
        for endpoint in endpoints {
            let url = endpoint.as_str().expect("each endpoint must be a string");
            assert!(
                is_r2_endpoint(url),
                "configured updater endpoint {url} is not the real R2 host ({EXPECTED_ENDPOINT_HOST})"
            );
        }
    }

    #[test]
    fn tauri_conf_json_still_carries_s11s_updater_pubkey() {
        let conf = include_str!("../tauri.conf.json");
        let parsed: serde_json::Value =
            serde_json::from_str(conf).expect("tauri.conf.json must be valid JSON");
        let pubkey = parsed["plugins"]["updater"]["pubkey"]
            .as_str()
            .expect("plugins.updater.pubkey must be a string");
        assert!(
            !pubkey.trim().is_empty(),
            "plugins.updater.pubkey must not be empty — S11's signing key must stay wired"
        );
    }

    #[test]
    fn tauri_conf_json_turns_on_updater_artifacts() {
        let conf = include_str!("../tauri.conf.json");
        let parsed: serde_json::Value =
            serde_json::from_str(conf).expect("tauri.conf.json must be valid JSON");
        assert_eq!(
            parsed["bundle"]["createUpdaterArtifacts"],
            serde_json::Value::Bool(true),
            "bundle.createUpdaterArtifacts must be true or tauri build emits no .sig files"
        );
    }
}
