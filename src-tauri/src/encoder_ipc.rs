//! S5 — the webview→Rust transport's command surface
//! (build-sessions/encoder/S5.md). Lives in the APP crate (`setnayan-desktop`),
//! not `crates/encoder` (`setnayan-encoder`): that crate deliberately depends
//! on nothing from Tauri (see its `lib.rs`/`Cargo.toml` headers) so its 42
//! tests run on every PR without compiling tauri/wry/webkit. Tauri commands,
//! by definition, need Tauri — so they live here, exactly where S8's
//! `stream_key` commands already do, and are registered the same way.
//!
//! ── THE TRANSPORT, AS OF THE 2026-09-06 OWNER DECISION ──────────────────────
//! `crates/encoder/src/contract.rs`'s own docblock: raw-binary IPC never
//! reaches Rust from `https://` origins on WebKit (S0 measured 1797/1797
//! chunks arriving as `InvokeBody::Json`, zero as `Raw`). The owner chose to
//! budget a JSON envelope carrying ONE base64 string field rather than serve
//! the app from a Tauri scheme or patch wry for a private WebKit API. So
//! `encoder_config`/`encoder_push` below take a plain `chunk: String` — Tauri
//! deserializes it from JSON the same way regardless of which internal
//! envelope carried the invoke — and decode it with
//! `encoder::contract::EncodedChunk::from_base64`, THE ONE DECODE PATH. A
//! caller that tried to hand over a raw JSON number array (the OLD, ~3.6x
//! envelope `contract.rs` still models as `Envelope::JsonArray` for its own
//! byte-math test) would fail to deserialize into a `String` at all, before
//! this module ever sees it — the type signature IS the guard.
//!
//! ── WHY `encoder_probe` EXISTS AND IS NOT `probe::probe_ipc` ────────────────
//! `probe_ipc` (src/probe.rs) is the S0 spike harness: debug-only, prints to
//! stdout, runs a loopback listener — a diagnostic tool, not product surface.
//! `encoder_probe` ships in EVERY build. The go-live guard
//! (`lib/live-studio-ingest-health.ts`'s `transportEnvelope` input, fed by
//! `apps/web/lib/encoder/go-live-guard.ts`) calls it ONCE before
//! `encoder_start` to record which envelope actually carried the call on this
//! machine, right now — never to refuse go-live merely because the answer is
//! `json` (see `Envelope::is_zero_copy`'s own docblock: a guard that refused
//! on `JsonArray` alone would refuse every macOS user, which is the precise
//! mistake S0 caught in this task's own original wording).
//!
//! ── ACL / TOKEN (S5.md § ACL) ────────────────────────────────────────────────
//! `capabilities/default.json` grants `allow-encoder-{start,config,push,stop}`
//! under the EXISTING `remote.urls` capability for setnayan.com — an ORIGIN
//! grant, not a session grant, so any XSS on setnayan.com could otherwise call
//! these commands directly. `encoder_start` therefore takes a server-minted,
//! single-use token (`lib/live-studio-encoder-tokens.ts`,
//! `POST /api/live-studio/encoder/token`) and verifies it over this process's
//! OWN reqwest/rustls connection — never through the Tauri IPC channel the
//! webview shares — before `Session.authorized` ever becomes `true`.
//! `encoder_config`/`encoder_push`/`encoder_stop` all refuse unless a prior
//! `encoder_start` call authorized the session; there is no other way to set
//! `authorized = true`.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::encoder::contract::{ChunkKind, EncodedChunk};
use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request};
use tauri::State;
use tokio::sync::mpsc;

/// The Setnayan API origin the token-verify call is made against. Hardcoded
/// for the same reason `stream_key.rs`'s `SETNAYAN_API_ORIGIN` is: if the
/// webview could pick this, a compromised page could point Rust's own
/// outbound request at an attacker's server and pose as "verify succeeded"
/// for any token it likes.
const SETNAYAN_API_ORIGIN: &str = "https://setnayan.com";
const VERIFY_PATH: &str = "/api/live-studio/encoder/token/verify";

/// `tokio::sync::mpsc` capacity between `encoder_push`/`encoder_config` and
/// the sink task — S5.md's number.
const CHANNEL_CAPACITY: usize = 256;

/// App state: `.manage(EncoderIpcState::default())` in `lib.rs`.
#[derive(Default)]
pub struct EncoderIpcState(Mutex<Session>);

#[derive(Default)]
struct Session {
    authorized: bool,
    #[allow(dead_code)] // read by future health/diagnostics call sites, not yet any
    event_id: Option<String>,
    #[allow(dead_code)]
    broadcast_id: Option<i64>,
    sender: Option<mpsc::Sender<EncodedChunk>>,
    bytes_received: Arc<AtomicU64>,
    chunks_received: Arc<AtomicU64>,
}

/// Pure gate factored out of the commands so it is testable without a running
/// Tauri `State` harness — same shape as `stream_key.rs`'s `set_pasted_inner`.
fn require_authorized(session: &Session) -> Result<(), String> {
    if !session.authorized {
        return Err("not_authorized".to_string());
    }
    Ok(())
}

/// Pure core of `encoder_config`/`encoder_push`: decode the base64 envelope
/// THE ONE WAY (`EncodedChunk::from_base64`), refuse a `Config` chunk on the
/// media path and vice versa, and hand back the decoded chunk for the caller
/// to forward into the channel. Never touches `State` — testable directly.
fn decode_and_check_kind(chunk_b64: &str, expect_config: bool) -> Result<EncodedChunk, String> {
    let decoded = EncodedChunk::from_base64(chunk_b64).map_err(|e| e.to_string())?;
    let is_config = decoded.header.kind == ChunkKind::Config;
    if expect_config && !is_config {
        return Err("expected_config_chunk".to_string());
    }
    if !expect_config && is_config {
        return Err("config_must_use_encoder_config".to_string());
    }
    Ok(decoded)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyResponse {
    ok: bool,
    #[serde(default)]
    #[allow(dead_code)] // not yet read by any call site — see Session.event_id
    event_id: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    broadcast_id: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncoderStartResult {
    pub authorized: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncoderStopResult {
    pub bytes_received: u64,
    pub chunks_received: u64,
}

/// Verify `token` against the server (S5.md § ACL), and if it authorizes,
/// stand up the bounded channel + stub sink task and mark the session
/// authorized. Every other encoder command refuses until this has succeeded.
#[tauri::command]
pub async fn encoder_start(
    state: State<'_, EncoderIpcState>,
    token: String,
) -> Result<EncoderStartResult, String> {
    if token.trim().is_empty() {
        return Err("empty_token".to_string());
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{SETNAYAN_API_ORIGIN}{VERIFY_PATH}"))
        .json(&serde_json::json!({ "token": token }))
        .send()
        .await
        .map_err(|_| "verify_request_failed".to_string())?;

    if !resp.status().is_success() {
        return Err("token_rejected".to_string());
    }
    let parsed: VerifyResponse = resp
        .json()
        .await
        .map_err(|_| "verify_response_malformed".to_string())?;
    if !parsed.ok {
        return Err("token_rejected".to_string());
    }

    let (tx, mut rx) = mpsc::channel::<EncodedChunk>(CHANNEL_CAPACITY);
    let bytes_received = Arc::new(AtomicU64::new(0));
    let chunks_received = Arc::new(AtomicU64::new(0));

    // STUB SINK — S6 replaces this with the real FLV-tag/RTMP writer
    // (`encoder::tagger` / `encoder::sender`). All this does is prove the
    // pipe: count bytes and chunks so `encoder_stop` can report them.
    {
        let bytes_received = bytes_received.clone();
        let chunks_received = chunks_received.clone();
        tokio::spawn(async move {
            while let Some(chunk) = rx.recv().await {
                bytes_received.fetch_add(chunk.payload.len() as u64, Ordering::Relaxed);
                chunks_received.fetch_add(1, Ordering::Relaxed);
            }
        });
    }

    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    *guard = Session {
        authorized: true,
        event_id: parsed.event_id,
        broadcast_id: parsed.broadcast_id,
        sender: Some(tx),
        bytes_received,
        chunks_received,
    };
    Ok(EncoderStartResult { authorized: true })
}

/// The decoder configuration (`avcC` + `asc`), sent once before any media.
#[tauri::command]
pub fn encoder_config(state: State<'_, EncoderIpcState>, chunk: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    require_authorized(&guard)?;
    let decoded = decode_and_check_kind(&chunk, true)?;
    let sender = guard.sender.as_ref().ok_or_else(|| "not_authorized".to_string())?;
    // try_send, never await: a command handler holding the state lock across
    // an await would also block every other encoder command for the wait.
    sender
        .try_send(decoded)
        .map_err(|_| "channel_full_or_closed".to_string())
}

/// One encoded video or audio chunk, base64-enveloped (S5's owner-decided
/// transport). Refuses a `Config` chunk on this path — `encoder_config` is
/// the one way in for that kind, so a producer bug can't smuggle config
/// bytes past whatever `encoder_push`-specific handling exists downstream.
#[tauri::command]
pub fn encoder_push(state: State<'_, EncoderIpcState>, chunk: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    require_authorized(&guard)?;
    let decoded = decode_and_check_kind(&chunk, false)?;
    let sender = guard.sender.as_ref().ok_or_else(|| "not_authorized".to_string())?;
    sender
        .try_send(decoded)
        .map_err(|_| "channel_full_or_closed".to_string())
}

/// Ends the session: drops the sender (closing the channel, which ends the
/// sink task's `while let Some(..) = rx.recv().await` loop) and reports the
/// stub sink's tallies. Refuses if the session was never authorized — there
/// is nothing to stop.
#[tauri::command]
pub fn encoder_stop(state: State<'_, EncoderIpcState>) -> Result<EncoderStopResult, String> {
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    require_authorized(&guard)?;
    let bytes_received = guard.bytes_received.load(Ordering::Relaxed);
    let chunks_received = guard.chunks_received.load(Ordering::Relaxed);
    *guard = Session::default();
    Ok(EncoderStopResult {
        bytes_received,
        chunks_received,
    })
}

/// Ships in EVERY build (unlike `probe::probe_ipc`, the debug-only S0 spike
/// harness). The go-live guard's ONE probe call before `encoder_start`:
/// reports which envelope carried THIS invoke, and — for the base64 JSON
/// path — whether it actually decodes as a coherent chunk, so a probe can
/// fail on a genuinely broken pipe without ever failing merely for being
/// JSON (see the module docblock; `Envelope::is_zero_copy`'s own comment
/// names the exact refuse-on-JsonArray mistake this must not repeat).
///
/// Takes a raw `Request<'_>` rather than a typed `chunk: String` argument
/// ON PURPOSE: a typed argument would already have been deserialized by the
/// time this function runs, so a `Raw` body (if one ever arrived — it does
/// not, today) would simply fail to bind and never reach here at all. Reading
/// `request.body()` directly is the only way to observe which envelope
/// actually carried the call.
#[tauri::command]
pub fn encoder_probe(request: Request<'_>) -> String {
    match request.body() {
        InvokeBody::Raw(bytes) => format!("raw:{}", bytes.len()),
        InvokeBody::Json(value) => match value.get("chunk").and_then(|v| v.as_str()) {
            Some(chunk) => match EncodedChunk::from_base64(chunk) {
                Ok(_) => "json:base64_ok".to_string(),
                Err(_) => "json:base64_bad".to_string(),
            },
            None => "json:unrecognized".to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_config_b64() -> String {
        let chunk = EncodedChunk {
            header: crate::encoder::contract::ChunkHeader {
                kind: ChunkKind::Config,
                keyframe: false,
                seq: 0,
                ts_us: 0,
            },
            payload: vec![1, 2, 3],
        };
        chunk.to_base64()
    }

    fn fixture_video_b64() -> String {
        let chunk = EncodedChunk {
            header: crate::encoder::contract::ChunkHeader {
                kind: ChunkKind::Video,
                keyframe: true,
                seq: 1,
                ts_us: 33_333,
            },
            payload: vec![9, 9, 9],
        };
        chunk.to_base64()
    }

    // ── COMMAND-WITHOUT-TOKEN GUARD ────────────────────────────────────────
    // A fresh `Session` (never touched by `encoder_start`) must refuse
    // every downstream command. Mutate `require_authorized` to always
    // `Ok(())` and every one of these goes green for a session nothing ever
    // authorized — that is the exact defect this test exists to catch.
    #[test]
    fn a_never_started_session_refuses_every_command() {
        let session = Session::default();
        assert_eq!(require_authorized(&session), Err("not_authorized".to_string()));
    }

    #[test]
    fn an_authorized_session_is_let_through() {
        let mut session = Session::default();
        session.authorized = true;
        assert_eq!(require_authorized(&session), Ok(()));
    }

    // ── JSON-BODY-WITHOUT-BASE64-DECODE GUARD ──────────────────────────────
    // `decode_and_check_kind` is the ONLY path `encoder_config`/`encoder_push`
    // take into a chunk. Feed it garbage that is not valid base64 at all (the
    // shape a naive "just trust the string" implementation would accept
    // unchanged) and require it to be refused, named, by the contract's own
    // error — not silently passed through as bytes.
    #[test]
    fn a_string_that_is_not_base64_is_refused_not_smuggled_through() {
        let err = decode_and_check_kind("not valid base64 at all!!", false).unwrap_err();
        assert!(err.contains("base64"), "expected a base64 decode error, got: {err}");
    }

    #[test]
    fn config_chunk_is_accepted_on_the_config_path_and_refused_on_the_media_path() {
        let b64 = fixture_config_b64();
        assert!(decode_and_check_kind(&b64, true).is_ok());
        assert_eq!(
            decode_and_check_kind(&b64, false).unwrap_err(),
            "config_must_use_encoder_config"
        );
    }

    #[test]
    fn video_chunk_is_accepted_on_the_media_path_and_refused_on_the_config_path() {
        let b64 = fixture_video_b64();
        assert!(decode_and_check_kind(&b64, false).is_ok());
        assert_eq!(
            decode_and_check_kind(&b64, true).unwrap_err(),
            "expected_config_chunk"
        );
    }
}
