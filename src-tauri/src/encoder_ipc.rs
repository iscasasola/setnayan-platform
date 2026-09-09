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
use crate::encoder::file_sink::{judge_disk_for, recording_path, CivilDate, FlvFileWriter};
use crate::encoder::flv::StreamMeta;
use crate::encoder::reconnect::{
    supervise, HealthEvent, NetworkConnector, RetryPolicy, StopReason,
};
use crate::encoder::tagger::{NoRecording, Pipeline, TagSink, Tagger};
use crate::stream_key::StreamKeyState;
use serde::{Deserialize, Serialize};
use tauri::ipc::{Channel, InvokeBody, Request};
use tauri::{Manager, State};
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

impl EncoderIpcState {
    /// S12 (`build-sessions/encoder/S12.md`) reads this before ever installing
    /// an update: "idle" here means NOT mid-broadcast — no session has been
    /// authorized by `encoder_start`, or a prior one was already ended by
    /// `encoder_stop`. There is no separate encoder-state enum; `authorized`
    /// IS the broadcasting flag (see the module docblock's ACL section). A
    /// poisoned lock (a panic while some other command held it) reports
    /// `false` — not idle — because the safe direction when the true state
    /// is unknown is to defer an install, never risk one mid-stream.
    pub fn is_idle(&self) -> bool {
        match self.0.lock() {
            Ok(guard) => !guard.authorized,
            Err(_) => false,
        }
    }
}

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

/// ── S18 · THE HEALTH READING THIS PROCESS PUSHES TO THE CONTROLLER ──────────
/// Shaped to drop straight into `EncoderHealthInput` in
/// `apps/web/lib/live-studio-ingest-health.ts` — which has accepted this shape
/// since S9 while always being handed `null`, because nothing produced it.
///
/// `droppedFrames` and `bitrateRung` are NOT here on purpose: both are decided
/// in the page (the worker's ring counts its own drops; `stepBitrateRung` in
/// `live-studio-encoder-bitrate.ts` owns the ladder). Rust reports only what
/// Rust alone can see — the state of the socket and of the recording — and the
/// page composes the final input. Emitting a guessed `bitrateRung` from here
/// would put two deciders on one value, which is rule 24's whole complaint.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthUpdate {
    /// One of `EncoderRtmpState`: idle · connecting · publishing · reconnecting · down.
    pub rtmp: &'static str,
    pub reconnecting_for_ms: u64,
    pub recording: bool,
    /// `primary` / `backup`, once a connection has been attempted.
    pub ingest: Option<&'static str>,
    /// Already redacted upstream — `reconnect.rs` scrubs the stream key out of
    /// every `detail` string it builds (see `Redactor`). Never build one here
    /// from an endpoint.
    pub detail: Option<String>,
}

/// Folds the supervisor's event stream into the strip's five-state reading.
///
/// A STATE MACHINE, not a per-event `match`, for one reason worth stating:
/// `RecordingStopped` and `DiskLow` say nothing about the socket. A stateless
/// mapper has to invent an `rtmp` value for them, and whatever it invents is
/// wrong — a full disk mid-ceremony would either blank the strip to `idle` or
/// claim the broadcast is `down` while it is in fact still publishing happily.
/// Carrying the previous wire state across those two events is the entire
/// reason this type exists.
struct HealthProjection {
    rtmp: &'static str,
    reconnecting_for_ms: u64,
    recording: bool,
}

impl HealthProjection {
    fn new(recording: bool) -> HealthProjection {
        HealthProjection { rtmp: "idle", reconnecting_for_ms: 0, recording }
    }

    fn apply(&mut self, event: &HealthEvent) -> HealthUpdate {
        let mut ingest = None;
        let mut detail = None;
        match event {
            HealthEvent::Connecting { ingest: which, .. } => {
                self.rtmp = "connecting";
                self.reconnecting_for_ms = 0;
                ingest = Some(which.label());
            }
            HealthEvent::Publishing { ingest: which, .. } => {
                self.rtmp = "publishing";
                self.reconnecting_for_ms = 0;
                ingest = Some(which.label());
            }
            HealthEvent::Reconnecting { for_ms, detail: why, .. } => {
                self.rtmp = "reconnecting";
                self.reconnecting_for_ms = *for_ms;
                detail = Some(why.clone());
            }
            HealthEvent::Down { for_ms, detail: why } => {
                self.rtmp = "down";
                self.reconnecting_for_ms = *for_ms;
                detail = Some(why.clone());
            }
            HealthEvent::BroadcastEnded { detail: why } => {
                self.rtmp = "down";
                detail = Some(why.clone());
            }
            // NEITHER of these touches `self.rtmp` — see the type's docblock.
            HealthEvent::RecordingStopped { detail: why } => {
                self.recording = false;
                detail = Some(why.clone());
            }
            HealthEvent::DiskLow { free_bytes } => {
                detail = Some(format!("{free_bytes} bytes free"));
            }
        }
        HealthUpdate {
            rtmp: self.rtmp,
            reconnecting_for_ms: self.reconnecting_for_ms,
            recording: self.recording,
            ingest,
            detail,
        }
    }
}

/// `~` on both platforms. `HOME` is not set on Windows; `USERPROFILE` is not set
/// on macOS. Returning `None` means "record nowhere" — never "write to the
/// current working directory", which for a bundled `.app` is `/`.
fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)
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

/// Verify `token` against the server (S5.md § ACL), and if it authorizes, open
/// the publish destination S8 is holding, stand up the bounded channel, and run
/// `reconnect::supervise` on it for as long as the wedding lasts.
///
/// ── S18 · THIS IS WHERE THE PIPELINE JOINS ──────────────────────────────────
/// Until this session, the channel below fed a STUB that counted bytes and threw
/// them away, and `crates/encoder`'s `supervise`/`RtmpSender` — 83 passing tests
/// of them — had exactly one caller in the whole repository:
/// `examples/publish_probe.rs`. S5's own comment said "S6 replaces this"; S6
/// merged BEFORE S5 and never did; no row in the plan's ladder owned the join.
/// Every stage was green and no wedding could reach YouTube. `publish_probe.rs`
/// is the reference wiring this follows — deliberately the same call, in the
/// same order, so the tool the acceptance run uses and the tool a couple uses
/// cannot diverge.
///
/// ORDER MATTERS AND IS NOT ARBITRARY: the destination is resolved BEFORE the
/// session is marked authorized. A couple who has not pasted a key (or claimed
/// a hosted channel) is refused here, at the one moment there is still a human
/// looking at the screen — rather than being told "you are live", encoding for
/// twenty minutes into a channel that was never opened, and finding out from
/// their guests.
#[tauri::command]
pub async fn encoder_start(
    state: State<'_, EncoderIpcState>,
    keys: State<'_, StreamKeyState>,
    app: tauri::AppHandle,
    token: String,
    health: Channel<HealthUpdate>,
) -> Result<EncoderStartResult, String> {
    if token.trim().is_empty() {
        return Err("empty_token".to_string());
    }

    // Resolved before the network call so a missing key costs nothing and is
    // reported as itself, not as a token failure.
    let destinations = keys.destinations().ok_or_else(|| "no_stream_key".to_string())?;

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

    // ── the recording ───────────────────────────────────────────────────────
    // For a hosted-channel couple this file is the ONLY copy that will ever
    // exist (`file_sink.rs`'s own docblock), so it is opened here, before the
    // socket, where a failure is still reportable.
    //
    // A DISK TOO FULL TO RECORD DOES NOT REFUSE THE BROADCAST. Going to air
    // without a local copy is a worse wedding than not going to air at all only
    // if you have never been to a wedding. The operator is told (`DiskLow` /
    // `recording: false` on the health channel) and the ceremony still airs.
    let event_public_id = parsed.event_id.clone().unwrap_or_default();
    let mut recording = false;
    let (sink, disk_warning): (Box<dyn TagSink>, Option<u64>) = match home_dir() {
        Some(home) => {
            let path = recording_path(&home, &event_public_id, CivilDate::today_utc());
            let verdict = judge_disk_for(&path).ok();
            let refused = verdict.as_ref().is_some_and(|v| !v.may_record());
            let low = verdict
                .as_ref()
                .filter(|v| v.free_bytes() < crate::encoder::file_sink::DISK_WARN_BYTES)
                .map(|v| v.free_bytes());
            if refused {
                (Box::new(NoRecording), low)
            } else {
                match FlvFileWriter::create(&path) {
                    Ok(writer) => {
                        recording = true;
                        (Box::new(writer), low)
                    }
                    Err(_) => (Box::new(NoRecording), low),
                }
            }
        }
        None => (Box::new(NoRecording), None),
    };
    let mut pipeline = Pipeline::new(Tagger::new(), sink);

    // ── the session ─────────────────────────────────────────────────────────
    // Spawned, not awaited: this command must return so the page can start
    // pushing. `supervise` owns the socket for the rest of the broadcast and
    // ends only when the producer closes the channel (`encoder_stop` drops the
    // sender) or it gives up.
    let app_for_reset = app.clone();
    tokio::spawn(async move {
        let (events, mut event_rx) = mpsc::channel::<HealthEvent>(64);

        // The forwarder HANDS THE CHANNEL BACK when it finishes, so the final
        // reading can be sent after `supervise` returns without requiring
        // `Channel` to be cloneable.
        let forwarder = tokio::spawn(async move {
            let mut projection = HealthProjection::new(recording);
            if let Some(free_bytes) = disk_warning {
                let _ = health.send(projection.apply(&HealthEvent::DiskLow { free_bytes }));
            }
            while let Some(event) = event_rx.recv().await {
                let _ = health.send(projection.apply(&event));
            }
            (health, projection)
        });

        let outcome = supervise(
            &NetworkConnector,
            &destinations,
            StreamMeta::defaults_720p30(),
            &mut rx,
            &mut pipeline,
            &events,
            &RetryPolicy::default(),
        )
        .await;

        drop(events);
        if let Ok((health, mut projection)) = forwarder.await {
            // The stream is over however it ended — say so once, so a strip that
            // last heard "publishing" does not sit green over a dead socket.
            let closing = match &outcome.stop {
                StopReason::ProducerFinished => HealthEvent::BroadcastEnded {
                    detail: "stopped".to_string(),
                },
                StopReason::BroadcastEnded { detail } => HealthEvent::BroadcastEnded {
                    detail: detail.clone(),
                },
                StopReason::GaveUp { detail } => HealthEvent::BroadcastEnded {
                    detail: detail.clone(),
                },
            };
            let _ = health.send(projection.apply(&closing));
        }

        // The broadcast is over, so the state must read idle again — otherwise
        // `EncoderIpcState::is_idle` reports "mid-broadcast" forever and S12
        // defers every update until the app is restarted. Resetting here covers
        // the case the operator never pressed stop (the supervisor gave up);
        // `encoder_stop` resetting the same state is idempotent with it.
        let state = app_for_reset.state::<EncoderIpcState>();
        // Bound to a local first: `if let Ok(g) = state.0.lock()` keeps the
        // temporary `Result` alive to the end of the enclosing block, which
        // outlives the `State` borrow it came from.
        let locked = state.0.lock();
        if let Ok(mut guard) = locked {
            *guard = Session::default();
        }
    });

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
    let len = decoded.payload.len() as u64;
    // try_send, never await: a command handler holding the state lock across
    // an await would also block every other encoder command for the wait.
    sender
        .try_send(decoded)
        .map_err(|_| "channel_full_or_closed".to_string())?;
    // S18 — COUNTED HERE, NOT IN THE SINK. The stub sink used to tally these on
    // the way past; the real sink is `supervise`, which owns the receiver and
    // cannot report back synchronously. Counting on the accepted-send keeps
    // `encoder_stop`'s numbers meaning exactly what their names say — what this
    // IPC surface received and queued — and never counts a rejected chunk.
    guard.bytes_received.fetch_add(len, Ordering::Relaxed);
    guard.chunks_received.fetch_add(1, Ordering::Relaxed);
    Ok(())
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
    let len = decoded.payload.len() as u64;
    sender
        .try_send(decoded)
        .map_err(|_| "channel_full_or_closed".to_string())?;
    guard.bytes_received.fetch_add(len, Ordering::Relaxed);
    guard.chunks_received.fetch_add(1, Ordering::Relaxed);
    Ok(())
}

/// Ends the session: drops the sender (closing the channel, which ends the
/// sink task's `while let Some(..) = rx.recv().await` loop) and reports the
/// stub sink's tallies. Refuses if the session was never authorized — there
/// is nothing to stop.
///
/// `app` is injected by Tauri (every command may take an `AppHandle`
/// parameter; the frontend never supplies it) — S12
/// (`build-sessions/encoder/S12.md`) uses it to re-check for a deferred
/// update the MOMENT this session goes back to idle, from Rust, exactly as
/// the task requires ("Re-check on `encoder_stop`"). The state reset above
/// happens first, so `updater::recheck_after_stop`'s own idle read (via
/// `EncoderIpcState::is_idle`) always sees the post-stop state.
#[tauri::command]
pub fn encoder_stop(
    state: State<'_, EncoderIpcState>,
    keys: State<'_, StreamKeyState>,
    app: tauri::AppHandle,
) -> Result<EncoderStopResult, String> {
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    require_authorized(&guard)?;
    let bytes_received = guard.bytes_received.load(Ordering::Relaxed);
    let chunks_received = guard.chunks_received.load(Ordering::Relaxed);
    // Dropping the Session drops the `mpsc::Sender`, which closes the channel,
    // which is what ends `supervise`'s loop with `StopReason::ProducerFinished`
    // — a clean end, the recording finalised, the socket shut. There is no
    // second "stop" path into the session task and there should not be.
    *guard = Session::default();
    drop(guard);
    // S18 — what `stream_key.rs`'s own docblock asked the real `encoder_stop`
    // to do: "encoder_stop should call stream_key_forget (or drop the same
    // state) instead of this module growing a second holder." The broadcast is
    // over, so the key's reason to be in memory is over; `Zeroizing` scrubs it.
    // A next broadcast pastes or claims again, which is the same two taps the
    // couple already made.
    let _ = keys.forget();
    crate::updater::recheck_after_stop(app);
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

    // ── S12'S "MID-BROADCAST" READ (`EncoderIpcState::is_idle`) ─────────────
    // The updater's whole "never mid-broadcast" guard rests on this being
    // accurate: a fresh (never-started) state must read idle, and a state an
    // `encoder_start` call has authorized must read NOT idle. Mutating either
    // branch of `is_idle` to always return the same value is exactly the
    // defect that would let S12 install over a live stream.
    #[test]
    fn a_fresh_encoder_state_is_idle() {
        let state = EncoderIpcState::default();
        assert!(state.is_idle());
    }

    #[test]
    fn an_authorized_encoder_state_is_not_idle() {
        let state = EncoderIpcState::default();
        state.0.lock().unwrap().authorized = true;
        assert!(!state.is_idle());
    }

    #[test]
    fn is_idle_flips_back_true_once_the_session_resets_to_default() {
        let state = EncoderIpcState::default();
        state.0.lock().unwrap().authorized = true;
        assert!(!state.is_idle());
        *state.0.lock().unwrap() = Session::default();
        assert!(state.is_idle());
    }
}
