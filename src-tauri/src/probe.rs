//! S0 spike harness — DEBUG BUILDS ONLY (`#[cfg(debug_assertions)] mod probe;` in lib.rs).
//!
//! Answers Questions 1 and 2 of `build-sessions/encoder/S0.md` from INSIDE the real
//! Tauri webview on the REAL origin (https://setnayan.com), not from Safari:
//!
//! * `probe_report(json)` — the page prints a JSON record to the app's stdout.
//! * `probe_ipc(request)` — the page invokes this with a 10 KB `Uint8Array`; Rust
//!   reports whether the body arrived as `InvokeBody::Raw` (binary custom-protocol
//!   IPC) or `InvokeBody::Json` (the permanent postMessage fallback that Tauri's
//!   `ipc-protocol.js` switches to after ONE custom-protocol failure, e.g. a CSP
//!   whose `connect-src` lacks `ipc:` / `http://ipc.localhost`).
//! * `on_page_load` — when `SETNAYAN_PROBE=<mode>` is set in the environment and the
//!   finished page is on setnayan.com, evaluates `probe/encoder-probe.js` in the page.
//!   Nothing runs without the env var, so a plain debug build behaves as before.
//!
//! Run it with `src-tauri/probe/run.sh <mode>`; the finding quotes its output.

use std::sync::atomic::{AtomicU64, Ordering};
use tauri::ipc::{InvokeBody, Request};
use tauri::webview::{PageLoadEvent, PageLoadPayload};
use tauri::{Runtime, Webview};

const PROBE_JS: &str = include_str!("../probe/encoder-probe.js");
const ENV_MODE: &str = "SETNAYAN_PROBE";
/// Set to `any` to evaluate on the tauri://localhost shell page as well — the
/// WEAKER result the S0 prompt says must be labelled as such if it is ever used.
const ENV_ORIGIN: &str = "SETNAYAN_PROBE_ORIGIN";

static RAW_CALLS: AtomicU64 = AtomicU64::new(0);
static JSON_CALLS: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[tauri::command]
pub fn probe_report(json: String) {
    println!("[probe] t={} {}", now_ms(), json);
}

/// Returns `raw:<len>` or `json:<kind>:<len>` so the page can tally both sides.
#[tauri::command]
pub fn probe_ipc(request: Request<'_>) -> String {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let n = RAW_CALLS.fetch_add(1, Ordering::Relaxed) + 1;
            if n == 1 || n % 300 == 0 {
                println!("[probe-ipc] t={} body=Raw #{n} len={}", now_ms(), bytes.len());
            }
            format!("raw:{}", bytes.len())
        }
        InvokeBody::Json(value) => {
            let n = JSON_CALLS.fetch_add(1, Ordering::Relaxed) + 1;
            let (kind, len) = match value {
                serde_json::Value::Array(a) => ("array", a.len()),
                serde_json::Value::Object(o) => ("object", o.len()),
                serde_json::Value::String(s) => ("string", s.len()),
                _ => ("other", 0),
            };
            if n == 1 || n % 300 == 0 {
                println!(
                    "[probe-ipc] t={} body=Json #{n} kind={kind} len={len} content-type={:?}",
                    now_ms(),
                    request.headers().get("content-type")
                );
            }
            format!("json:{kind}:{len}")
        }
    }
}

pub fn on_page_load<R: Runtime>(webview: &Webview<R>, payload: &PageLoadPayload<'_>) {
    let Ok(mode) = std::env::var(ENV_MODE) else { return };
    if mode.is_empty() || !matches!(payload.event(), PageLoadEvent::Finished) {
        return;
    }
    let url = payload.url();
    let host = url.host_str().unwrap_or("");
    let on_target = host == "setnayan.com" || host == "www.setnayan.com";
    let any_origin = std::env::var(ENV_ORIGIN).map(|v| v == "any").unwrap_or(false);
    println!(
        "[probe] t={} page-load finished url={url} on_target_origin={on_target} tauri={}",
        now_ms(),
        tauri::VERSION
    );
    if !on_target && !any_origin {
        println!("[probe] not evaluating on {url} (set {ENV_ORIGIN}=any to force — weaker result)");
        return;
    }
    let minutes: u64 = std::env::var("SETNAYAN_PROBE_MINUTES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60);
    let js = format!(
        "window.__SETNAYAN_PROBE_MODE__ = {};\nwindow.__SETNAYAN_PROBE_MINUTES__ = {minutes};\n{}",
        serde_json::to_string(&mode).unwrap_or_else(|_| "\"matrix\"".into()),
        PROBE_JS
    );
    match webview.eval(js) {
        Ok(()) => println!("[probe] t={} eval dispatched mode={mode} origin={}", now_ms(), url.origin().ascii_serialization()),
        Err(e) => eprintln!("[probe] eval failed: {e}"),
    }
}
