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
static LOOPBACK_CALLS: AtomicU64 = AtomicU64::new(0);

/// Third IPC arm (added 2026-09-05 after the real-origin run showed the `ipc://`
/// custom protocol never succeeds from https://setnayan.com — see the finding):
/// a debug-only HTTP listener on 127.0.0.1 taking raw POST bodies. `http://127.0.0.1`
/// is a potentially-trustworthy origin per Secure Contexts, so a secure page may
/// fetch it without mixed-content blocking. Minimal hand parser: OPTIONS (CORS
/// preflight) and POST with Content-Length; `Connection: close` per request.
fn start_loopback() -> Option<u16> {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").ok()?;
    let port = listener.local_addr().ok()?.port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            std::thread::spawn(move || {
                let mut buf = Vec::with_capacity(16 * 1024);
                let mut tmp = [0u8; 8192];
                let head_end;
                loop {
                    match stream.read(&mut tmp) {
                        Ok(0) => return,
                        Ok(n) => buf.extend_from_slice(&tmp[..n]),
                        Err(_) => return,
                    }
                    if let Some(i) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                        head_end = i + 4;
                        break;
                    }
                    if buf.len() > 64 * 1024 { return; }
                }
                let head = String::from_utf8_lossy(&buf[..head_end]).to_string();
                let method = head.split_whitespace().next().unwrap_or("").to_string();
                let content_length: usize = head
                    .lines()
                    .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse().unwrap_or(0)))
                    .unwrap_or(0);
                let content_type = head
                    .lines()
                    .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-type:").map(|v| v.trim().to_string()))
                    .unwrap_or_default();
                while buf.len() - head_end < content_length {
                    match stream.read(&mut tmp) {
                        Ok(0) => break,
                        Ok(n) => buf.extend_from_slice(&tmp[..n]),
                        Err(_) => return,
                    }
                }
                let body_len = buf.len() - head_end;
                let cors = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Max-Age: 600\r\n";
                let (status, body) = match method.as_str() {
                    "OPTIONS" => ("204 No Content", String::new()),
                    "POST" => {
                        let n = LOOPBACK_CALLS.fetch_add(1, Ordering::Relaxed) + 1;
                        if n == 1 || n % 300 == 0 {
                            println!("[probe-loopback] t={} #{n} body_len={body_len} content-type={content_type:?} first_bytes={:?}", now_ms(), &buf[head_end..head_end + body_len.min(4)]);
                        }
                        ("200 OK", format!("raw:{body_len}"))
                    }
                    _ => ("405 Method Not Allowed", String::new()),
                };
                let resp = format!(
                    "HTTP/1.1 {status}\r\n{cors}Content-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(resp.as_bytes());
                let _ = stream.flush();
            });
        }
    });
    Some(port)
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// The custom-protocol path is an HTTP request carrying the page's `Origin` and a
/// `Content-Type`; the postMessage fallback carries only caller-supplied headers
/// (none here). So the header set tells which transport delivered the invoke.
fn transport(request: &Request<'_>) -> &'static str {
    if request.headers().contains_key("origin") {
        "custom-protocol"
    } else {
        "postMessage"
    }
}

#[tauri::command]
pub fn probe_report(request: Request<'_>, json: String) {
    println!(
        "[probe] t={} via={} headers={} {}",
        now_ms(),
        transport(&request),
        request.headers().len(),
        json
    );
}

/// Returns `raw:<len>` or `json:<kind>:<len>` so the page can tally both sides.
#[tauri::command]
pub fn probe_ipc(request: Request<'_>) -> String {
    match request.body() {
        InvokeBody::Raw(bytes) => {
            let n = RAW_CALLS.fetch_add(1, Ordering::Relaxed) + 1;
            if n == 1 || n % 300 == 0 {
                println!(
                    "[probe-ipc] t={} body=Raw #{n} len={} via={} content-type={:?}",
                    now_ms(),
                    bytes.len(),
                    transport(&request),
                    request.headers().get("content-type")
                );
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
                    "[probe-ipc] t={} body=Json #{n} kind={kind} len={len} via={} content-type={:?}",
                    now_ms(),
                    transport(&request),
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
    let settle: u64 = std::env::var("SETNAYAN_PROBE_SETTLE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);
    // One listener per process; later page loads reuse the port.
    static LOOPBACK_PORT: std::sync::OnceLock<Option<u16>> = std::sync::OnceLock::new();
    let loopback = *LOOPBACK_PORT.get_or_init(|| {
        let p = start_loopback();
        println!("[probe] t={} loopback listener 127.0.0.1:{}", now_ms(), p.map(|p| p.to_string()).unwrap_or_else(|| "FAILED".into()));
        p
    });
    let js = format!(
        "window.__SETNAYAN_PROBE_MODE__ = {};\nwindow.__SETNAYAN_PROBE_MINUTES__ = {minutes};\nwindow.__SETNAYAN_PROBE_SETTLE_S__ = {settle};\nwindow.__SETNAYAN_PROBE_LOOPBACK_PORT__ = {};\n{}",
        serde_json::to_string(&mode).unwrap_or_else(|_| "\"matrix\"".into()),
        loopback.map(|p| p.to_string()).unwrap_or_else(|| "null".into()),
        PROBE_JS
    );
    // Bring the window forward so document.visibilityState is "visible" — WebKit
    // throttles timers and IPC callbacks in hidden pages, which would confound both
    // the IPC latency and the encode fps. Every record still carries `visibility`.
    // (Measured 2026-09-05: the first ipc run went out with visibility=hidden and
    // reported p95 = 19 s latency at 19.7 invokes/s — throttling, not IPC.)
    let window = webview.window();
    if let Err(e) = window.set_focus() {
        eprintln!("[probe] set_focus failed: {e}");
    }
    // SETNAYAN_PROBE_TOP=1: shrink to a corner and float above other windows so a
    // 60-minute run stays "visible" while the operator works. Debug-only, opt-in.
    if std::env::var("SETNAYAN_PROBE_TOP").map(|v| v == "1").unwrap_or(false) {
        use tauri::{LogicalPosition, LogicalSize};
        let _ = window.set_min_size(None::<LogicalSize<f64>>);
        let _ = window.set_size(LogicalSize::new(560.0, 360.0));
        if let Ok(Some(mon)) = window.current_monitor() {
            let sf = mon.scale_factor();
            let size = mon.size().to_logical::<f64>(sf);
            let pos = mon.position().to_logical::<f64>(sf);
            let _ = window.set_position(LogicalPosition::new(pos.x + size.width - 580.0, pos.y + size.height - 400.0));
        }
        if let Err(e) = window.set_always_on_top(true) {
            eprintln!("[probe] set_always_on_top failed: {e}");
        }
        println!("[probe] t={} window pinned always-on-top 560x360 (SETNAYAN_PROBE_TOP=1)", now_ms());
    }
    match webview.eval(js) {
        Ok(()) => println!("[probe] t={} eval dispatched mode={mode} origin={}", now_ms(), url.origin().ascii_serialization()),
        Err(e) => eprintln!("[probe] eval failed: {e}"),
    }
}
