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
//! `apps/web/lib/encoder/encoder-session.ts` — ⚠ this docblock named
//! `go-live-guard.ts` for weeks and THAT FILE HAS NEVER EXISTED, measured
//! 2026-09-09) calls it ONCE before
//! `encoder_start` to record which envelope actually carried the call on this
//! machine, right now — never to refuse go-live merely because the answer is
//! `json` (see `Envelope::is_zero_copy`'s own docblock: a guard that refused
//! on `JsonArray` alone would refuse every macOS user, which is the precise
//! mistake S0 caught in this task's own original wording).
//!
//! ── ENC-1: THE SINK IS REAL NOW ─────────────────────────────────────────────
//! This module used to end at a byte counter. Every stage below it —
//! `tagger` (FLV bodies + the clock), `sender` (TLS, handshake, publish),
//! `reconnect::supervise` (backoff, backup ingest, grace window),
//! `file_sink` (the couple's `.flv`) — had shipped, with 83 tests gating CI,
//! and NOTHING CALLED ANY OF IT: measured 2026-09-09, `src-tauri/src/` held
//! zero references to any of those modules. `encoder_start` now opens the
//! real publish path and `encoder_stop` closes it.
//! 🔑 CI compiles `setnayan-encoder`, never `setnayan-desktop`
//! (`.github/workflows/ci.yml:437`, deliberately — the desktop crate needs
//! tauri + wry + webkit + generated icons). So the half with the tests is
//! the half nobody called, and the half that calls it is the half CI cannot
//! see. Compile this crate LOCALLY (`cargo tauri icon …` then
//! `cargo check -p setnayan-desktop`) before trusting a green PR.
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
    supervise, Destinations, HealthEvent, Ingest, NetworkConnector, RetryPolicy, StopReason,
};
use crate::encoder::rtmp::RtmpEndpoint;
use crate::encoder::tagger::{NoRecording, Pipeline, TagSink, Tagger};
use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request};
use tauri::{Emitter, Manager, State};
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

/// Health events from `reconnect::supervise` to the webview. Small on purpose:
/// `announce` uses `try_send` and DROPS on a full channel by design (its own
/// comment: "a dropped health event costs one line in a status panel; a blocked
/// send costs the ceremony"). A deep buffer here would only let the controller
/// fall further behind the truth before it noticed.
const HEALTH_CAPACITY: usize = 64;

/// The Tauri event names the controller listens on. Named here, once, so the
/// page and Rust cannot drift: `apps/web/lib/encoder/encoder-session.ts`
/// imports the same two strings from `ENCODER_EVENT`.
pub const HEALTH_EVENT: &str = "encoder://health";
pub const ENDED_EVENT: &str = "encoder://ended";

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

/// Serializable mirror of `reconnect::HealthEvent`, which is deliberately
/// serde-free (the encoder crate depends on nothing from Tauri or the web
/// app — that is why its 83 tests run on every PR without compiling webkit).
/// The mapping lives HERE, on the app side, so the crate stays clean.
///
/// `kind` is a flat discriminator rather than serde's externally-tagged enum
/// shape because the page's reducer switches on one string; a nested
/// `{ Reconnecting: { ... } }` object would make every consumer unwrap twice.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HealthEventDto {
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ingest: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempt: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resumed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub for_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_attempt_in_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_bytes: Option<u64>,
    /// ⚠ ALWAYS a redacted string. Every `detail` this carries originates in
    /// `SenderError`, which `sender.rs` has already run through
    /// `Redactor::scrub` — the crate's own `tests/redaction.rs` asserts no
    /// string it emits contains the stream key. Nothing here re-introduces
    /// one, and nothing may: this field crosses into page state.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

fn ingest_label(ingest: Ingest) -> &'static str {
    ingest.label()
}

/// Pure — no `State`, no `AppHandle` — so the mapping is testable directly.
/// Every arm must be present: a `_ =>` fallback here is how a new health event
/// would reach the operator as a blank line instead of a sentence.
pub fn health_dto(event: &HealthEvent) -> HealthEventDto {
    let base = HealthEventDto {
        kind: "",
        ingest: None,
        attempt: None,
        resumed: None,
        for_ms: None,
        next_attempt_in_ms: None,
        free_bytes: None,
        detail: None,
    };
    match event {
        HealthEvent::Connecting { attempt, ingest } => HealthEventDto {
            kind: "connecting",
            ingest: Some(ingest_label(*ingest)),
            attempt: Some(*attempt),
            ..base
        },
        HealthEvent::Publishing { ingest, resumed } => HealthEventDto {
            kind: "publishing",
            ingest: Some(ingest_label(*ingest)),
            resumed: Some(*resumed),
            ..base
        },
        HealthEvent::Reconnecting {
            for_ms,
            attempt,
            next_attempt_in_ms,
            detail,
        } => HealthEventDto {
            kind: "reconnecting",
            attempt: Some(*attempt),
            for_ms: Some(*for_ms),
            next_attempt_in_ms: Some(*next_attempt_in_ms),
            detail: Some(detail.clone()),
            ..base
        },
        HealthEvent::Down { for_ms, detail } => HealthEventDto {
            kind: "down",
            for_ms: Some(*for_ms),
            detail: Some(detail.clone()),
            ..base
        },
        HealthEvent::BroadcastEnded { detail } => HealthEventDto {
            kind: "broadcastEnded",
            detail: Some(detail.clone()),
            ..base
        },
        HealthEvent::RecordingStopped { detail } => HealthEventDto {
            kind: "recordingStopped",
            detail: Some(detail.clone()),
            ..base
        },
        HealthEvent::DiskLow { free_bytes } => HealthEventDto {
            kind: "diskLow",
            free_bytes: Some(*free_bytes),
            ..base
        },
    }
}

/// What the controller is told when the whole supervised stream ends — once,
/// on `encoder://ended`. `stop` is the operator-facing distinction between
/// "you pressed stop", "the broadcast went away" and "we gave up".
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EncoderEndedDto {
    pub stop: &'static str,
    pub sessions: u32,
    pub reconnects: u32,
    pub failed_attempts: u32,
    pub longest_outage_ms: u64,
    pub used_backup: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_fault: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_path: Option<String>,
}

pub fn stop_reason_label(stop: &StopReason) -> (&'static str, Option<String>) {
    match stop {
        StopReason::ProducerFinished => ("producerFinished", None),
        StopReason::BroadcastEnded { detail } => ("broadcastEnded", Some(detail.clone())),
        StopReason::GaveUp { detail } => ("gaveUp", Some(detail.clone())),
    }
}

/// Where the local `.flv` goes, and whether there is one at all.
///
/// RECORDING IS NOT FREE AND MUST NOT SILENTLY FAIL. `judge_disk_for` refuses
/// below 2 GB and warns below 20 GB; a refusal here produces a streaming-only
/// pipeline plus a `RecordingStopped` health event, never a broadcast that
/// quietly keeps nothing. For a hosted-channel couple this file is the only
/// copy that will ever exist (`file_sink.rs`'s own docblock), so "it did not
/// record and nobody said so" is the worst available outcome.
fn open_recording(
    home: Option<std::path::PathBuf>,
    event_public_id: Option<&str>,
    events: &mpsc::Sender<HealthEvent>,
) -> (Box<dyn TagSink>, Option<String>) {
    let Some(event_public_id) = event_public_id.filter(|id| !id.trim().is_empty()) else {
        return (Box::new(NoRecording), None);
    };
    let Some(home) = home else {
        let _ = events.try_send(HealthEvent::RecordingStopped {
            detail: "no home directory to record into".to_string(),
        });
        return (Box::new(NoRecording), None);
    };
    let path = recording_path(&home, event_public_id, CivilDate::today_utc());
    let Some(dir) = path.parent() else {
        return (Box::new(NoRecording), None);
    };
    if let Err(error) = std::fs::create_dir_all(dir) {
        let _ = events.try_send(HealthEvent::RecordingStopped {
            detail: format!("could not create the recordings folder: {error}"),
        });
        return (Box::new(NoRecording), None);
    }
    match judge_disk_for(dir) {
        Ok(verdict) => {
            if !verdict.may_record() {
                let _ = events.try_send(HealthEvent::RecordingStopped {
                    detail: verdict.sentence(),
                });
                return (Box::new(NoRecording), None);
            }
            if verdict.free_bytes() < crate::encoder::file_sink::DISK_WARN_BYTES {
                let _ = events.try_send(HealthEvent::DiskLow {
                    free_bytes: verdict.free_bytes(),
                });
            }
        }
        Err(error) => {
            // Unreadable free space is not a reason to refuse the couple their
            // only copy — it is a reason to say so and carry on.
            let _ = events.try_send(HealthEvent::RecordingStopped {
                detail: format!("could not read free disk space: {error}"),
            });
        }
    }
    match FlvFileWriter::create(&path) {
        Ok(writer) => {
            let where_it_is = writer.path().display().to_string();
            (Box::new(writer), Some(where_it_is))
        }
        Err(error) => {
            let _ = events.try_send(HealthEvent::RecordingStopped {
                detail: format!("could not open the recording file: {error}"),
            });
            (Box::new(NoRecording), None)
        }
    }
}

/// Verify `token` against the server (S5.md § ACL), and if it authorizes, open
/// the real publish path and mark the session authorized. Every other encoder
/// command refuses until this has succeeded.
///
/// ── ENC-1: THIS USED TO BE A STUB, AND THAT WAS THE WHOLE DEFECT ────────────
/// Until now this function stood up the bounded channel and spawned a task that
/// counted bytes and threw them away — its own comment said "S6 replaces this
/// with the real FLV-tag/RTMP writer (`encoder::tagger` / `encoder::sender`)".
/// S6 landed, with 83 passing tests, and nothing ever called it: measured
/// 2026-09-09, `src-tauri/src/` contained ZERO references to `sender`,
/// `tagger`, `rtmp`, `reconnect` or `file_sink`. The crate's own `lib.rs` said
/// so in writing. It is joined here.
///
/// The destination is resolved from `StreamKeyState`, never from an argument
/// carrying a secret: `publish_endpoint` builds the `RtmpEndpoint` inside
/// `stream_key.rs` so the key never crosses a module boundary as a `String`,
/// and the HOSTED path's own address wins over anything the page passes.
#[tauri::command]
pub async fn encoder_start(
    app: tauri::AppHandle,
    state: State<'_, EncoderIpcState>,
    keys: State<'_, crate::stream_key::StreamKeyState>,
    token: String,
    rtmps_url: String,
    rtmps_backup_url: Option<String>,
    record_event_public_id: Option<String>,
) -> Result<EncoderStartResult, String> {
    if token.trim().is_empty() {
        return Err("empty_token".to_string());
    }
    // ASK BEFORE BURNING THE TOKEN. `mintEncoderToken` issues a SINGLE-USE
    // token; verifying it consumes it. A desktop app with no key pasted would
    // otherwise spend the token, fail, and force the operator to reload the
    // page before they could try again.
    if !keys.is_armed() {
        return Err("no_stream_key".to_string());
    }
    let endpoint: RtmpEndpoint = keys.publish_endpoint(&rtmps_url)?;
    let destinations = match rtmps_backup_url.as_deref().map(str::trim).filter(|u| !u.is_empty()) {
        Some(backup) => Destinations::with_backup(endpoint, keys.publish_endpoint(backup)?),
        None => Destinations::new(endpoint),
    };

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
    let (health_tx, mut health_rx) = mpsc::channel::<HealthEvent>(HEALTH_CAPACITY);
    let bytes_received = Arc::new(AtomicU64::new(0));
    let chunks_received = Arc::new(AtomicU64::new(0));

    // The health forwarder. Its own task so a slow webview cannot sit between
    // the supervisor and the socket.
    {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = health_rx.recv().await {
                let _ = app.emit(HEALTH_EVENT, health_dto(&event));
            }
        });
    }

    let home = app.path().home_dir().ok();
    let (sink, recording_where) = open_recording(
        home,
        record_event_public_id.as_deref(),
        &health_tx,
    );

    // THE REAL SINK. `supervise` owns the reconnect loop, the backup ingest,
    // the grace window and the recording — all of it already written and
    // tested in `crates/encoder`; none of it is re-implemented here.
    {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut pipeline = Pipeline::new(Tagger::new(), sink);
            let outcome = supervise(
                &NetworkConnector,
                &destinations,
                StreamMeta::defaults_720p30(),
                &mut rx,
                &mut pipeline,
                &health_tx,
                &RetryPolicy::default(),
            )
            .await;
            let (stop, detail) = stop_reason_label(&outcome.stop);
            let _ = app.emit(
                ENDED_EVENT,
                EncoderEndedDto {
                    stop,
                    sessions: outcome.sessions,
                    reconnects: outcome.reconnects,
                    failed_attempts: outcome.failed_attempts,
                    longest_outage_ms: outcome.longest_outage_ms,
                    used_backup: outcome.used_backup,
                    recording_fault: outcome.recording_fault,
                    detail,
                    recording_path: recording_where,
                },
            );
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

/// Count a chunk that HAS crossed into the publisher's channel.
///
/// ENC-1 moved this off the sink task. Until now the sink was a byte counter
/// and the tally meant "bytes thrown away"; now the sink is
/// `reconnect::supervise`, which owns the receiver, so the honest place to
/// count is the moment a chunk is accepted onto the channel. Deliberately
/// AFTER `try_send` succeeds: a chunk refused by a full channel was never
/// handed over and must not be reported as if it were.
fn tally(session: &Session, len: usize) {
    session.bytes_received.fetch_add(len as u64, Ordering::Relaxed);
    session.chunks_received.fetch_add(1, Ordering::Relaxed);
}

/// The decoder configuration (`avcC` + `asc`), sent once before any media.
#[tauri::command]
pub fn encoder_config(state: State<'_, EncoderIpcState>, chunk: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    require_authorized(&guard)?;
    let decoded = decode_and_check_kind(&chunk, true)?;
    let len = decoded.payload.len();
    let sender = guard.sender.as_ref().ok_or_else(|| "not_authorized".to_string())?;
    // try_send, never await: a command handler holding the state lock across
    // an await would also block every other encoder command for the wait.
    sender
        .try_send(decoded)
        .map_err(|_| "channel_full_or_closed".to_string())?;
    tally(&guard, len);
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
    let len = decoded.payload.len();
    let sender = guard.sender.as_ref().ok_or_else(|| "not_authorized".to_string())?;
    sender
        .try_send(decoded)
        .map_err(|_| "channel_full_or_closed".to_string())?;
    tally(&guard, len);
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
    keys: State<'_, crate::stream_key::StreamKeyState>,
    app: tauri::AppHandle,
) -> Result<EncoderStopResult, String> {
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    require_authorized(&guard)?;
    let bytes_received = guard.bytes_received.load(Ordering::Relaxed);
    let chunks_received = guard.chunks_received.load(Ordering::Relaxed);
    // Dropping the sender closes the channel, which is how `supervise` learns
    // the producer finished (`StopReason::ProducerFinished`) and returns —
    // emitting `encoder://ended` and closing the recording on its way out.
    *guard = Session::default();
    drop(guard);
    // ENC-1: `stream_key.rs`'s Part C docblock asks for exactly this — "intended
    // to be called from `encoder_stop` once S5 lands". The held key is zeroised
    // the moment the broadcast ends, so a desktop app left open overnight is not
    // holding a YouTube stream key in memory for a broadcast that is over.
    keys.forget();
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
