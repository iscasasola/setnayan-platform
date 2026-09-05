//! S8 — the stream key, two sources, one Rust sink, never in page state.
//! build-sessions/encoder/S8.md.
//!
//! THREAT MODEL (stated once, matching lib/live-studio-encoder-claims.ts on the
//! server side): the operator can always obtain their own stream key. This
//! module protects against XSS / a compromised third-party script on
//! setnayan.com reading a Setnayan-HELD key out of the renderer — not against
//! the operator themselves. The durable mitigation is a per-broadcast key that
//! YouTube revokes the moment the broadcast completes (panood-youtube.ts's
//! `deleteYoutubeStream`, called from `endPanoodBroadcast`).
//!
//! TWO SOURCES, per rule 20 (`lib/live-studio-manual-air.ts`):
//!   · OWN-CHANNEL (default tier) — the couple's own YouTube key. They paste it
//!     (same as they would into OBS); `stream_key_set_pasted` is the ONLY time
//!     it crosses the Tauri IPC boundary, and it is held here from then on.
//!   · HOSTED-CHANNEL (add-on) — a Setnayan-held key. The webview never sees
//!     it: it mints a single-use nonce (`/api/live-studio/encoder/claim`) and
//!     hands ONLY that nonce to `stream_key_claim_hosted`, which exchanges it
//!     for the real credentials over its OWN `reqwest`/rustls TLS connection —
//!     never through the IPC channel the webview shares. The Tauri command's
//!     return value to JS carries no secret (see `ClaimedEncoderTarget`).
//!
//! ONE SINK: both paths land in the same `Mutex<Option<HeldStreamKey>>` app
//! state. `HeldStreamKey` wraps the key in `zeroize::Zeroizing`, which scrubs
//! the backing buffer on drop — so replacing the held key (a re-paste, a new
//! claim) or the app exiting zeroises the old one with no extra code, and
//! `stream_key_forget` (Part C) does it explicitly and immediately. S5's real
//! `encoder_start` / `encoder_stop` do not exist on this branch yet (S5's
//! transport envelope is an open owner decision — see S0-FINDING.md) — once
//! they land, `encoder_stop` should call `stream_key_forget` (or drop the same
//! state) instead of this module growing a second holder.
//!
//! `redact_url` BELOW IS A LOCAL STAND-IN. S6 (the RTMP/FLV Rust session, whose
//! own doc references "S6's `redact_url`") has not landed on origin/main as of
//! this session — verified by `git grep redact_url origin/main` returning only
//! the S6.md / S8.md spec files, and `git grep -e rtmp -e RTMP origin/main --
//! src-tauri` returning nothing. This copy has the SAME behavior S6.md
//! documents (`rtmps://…/live2/****`) so a later session can delete this one
//! and depend on S6's without changing any call site's expectations.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use zeroize::Zeroizing;

/// The Setnayan API origin the hosted-channel exchange call is made against.
/// Deliberately NOT accepted as a command argument: if the webview could pick
/// this, a compromised page could point Rust's own outbound request at an
/// attacker's server, which would then get to pose as "the exchange response"
/// for whatever nonce the page hands over. Hardcoding it keeps that decision
/// out of the IPC boundary entirely. Matches `capabilities/default.json`'s
/// `remote.urls`.
const SETNAYAN_API_ORIGIN: &str = "https://setnayan.com";
const EXCHANGE_PATH: &str = "/api/live-studio/encoder/exchange";

/// Strip the secret path segment out of an rtmps(-like) URL before it can ever
/// reach a log line or an error string, e.g.
/// `rtmps://a.rtmps.youtube.com/live2/abcd-1234-efgh` →
/// `rtmps://a.rtmps.youtube.com/live2/****`.
///
/// Deliberately conservative: only the LAST path segment is redacted (the
/// stream key), so the ingest app name ("live2") stays visible for diagnostics
/// — matching the exact shape S6.md's own docblock specifies. A URL with no
/// path segment to redact (or that fails to parse as a URL at all) is returned
/// with its whole tail masked, never returned unredacted — the safe failure
/// direction for a redaction helper is to over-hide, not under-hide.
///
/// Not yet called from production code on this branch — there is no
/// diagnostics/logging call site upstream of it yet (S5's encoder, which would
/// generate the log lines this exists to sanitize, hasn't landed). Exercised
/// by this module's own tests; `#[allow(dead_code)]` documents why rather than
/// hiding the gap.
#[allow(dead_code)]
pub fn redact_url(url: &str) -> String {
    let Some(scheme_end) = url.find("://") else {
        return "****".to_string();
    };
    let after_scheme = &url[scheme_end + 3..];
    match after_scheme.rfind('/') {
        Some(last_slash) if last_slash + 1 < after_scheme.len() => {
            let prefix = &url[..scheme_end + 3 + last_slash + 1];
            format!("{prefix}****")
        }
        // No '/' after the host, or it's the final character already — nothing
        // safe to keep past the host. Redact the whole authority+path tail.
        _ => format!("{}****", &url[..scheme_end + 3]),
    }
}

/// The key currently held in Rust memory, from whichever source. Zeroized on
/// drop (Zeroizing) and never `Debug`/`Display`-derived, so an accidental
/// `{:?}` in a log line cannot print it either.
///
/// `key` and `source` are read today only by this module's own tests — the
/// consumer that reads them to actually push bytes to an encoder is S5's
/// `encoder_start`, which has not landed on this branch (see the module
/// docblock). `#[allow(dead_code)]` says so rather than silently deleting the
/// field a future session needs.
#[allow(dead_code)]
struct HeldStreamKey {
    key: Zeroizing<String>,
    rtmps_url: String,
    source: KeySource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum KeySource {
    Pasted,
    Hosted,
}

/// App state: `.manage(StreamKeyState::default())` in `lib.rs`.
#[derive(Default)]
pub struct StreamKeyState(Mutex<Option<HeldStreamKey>>);

/// What `stream_key_claim_hosted` hands back to JS — deliberately NOT the same
/// shape as the server's `/exchange` response. No `stream_key` field exists on
/// this type, so there is no way for a caller of this command (including a
/// mistaken future edit) to serialize the secret back across IPC — the guard
/// is in the type, not just in the code that builds it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimedEncoderTarget {
    pub ready: bool,
    pub rtmps_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExchangeResponse {
    rtmps_url: String,
    #[serde(default)]
    #[allow(dead_code)] // not yet persisted anywhere upstream — see the .ts module docblock
    rtmps_backup_url: Option<String>,
    stream_key: String,
}

/// Pure core of `stream_key_set_pasted`, factored out so it is testable
/// without a running Tauri `State` harness.
fn set_pasted_inner(current: &mut Option<HeldStreamKey>, key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("empty_key".into());
    }
    *current = Some(HeldStreamKey {
        key: Zeroizing::new(key),
        // Own-channel: the RTMP server address is whatever the couple's own
        // YouTube Studio page told them (OBS's "Server" field) — this module
        // doesn't learn it, and doesn't need to: S5's encoder takes the server
        // URL as its own separate, non-secret argument.
        rtmps_url: String::new(),
        source: KeySource::Pasted,
    });
    Ok(())
}

/// OWN-CHANNEL (default tier): the couple pastes their own YouTube stream key,
/// same as they would into OBS's "Stream Key" field. This is the ONLY moment
/// this key exists in the webview at all — `key` is consumed here and the
/// caller (the paste field's submit handler) must clear its own local state
/// immediately after invoking this command; see the mutation-tested guard in
/// the web app's `lib/live-studio-encoder-key-paste.ts` / `.test.ts`.
#[tauri::command]
pub fn stream_key_set_pasted(
    state: State<'_, StreamKeyState>,
    key: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    set_pasted_inner(&mut guard, key)
}

/// HOSTED-CHANNEL (add-on): exchange a single-use claim nonce (minted by
/// `POST /api/live-studio/encoder/claim` on the webview side) for the real
/// encoder credentials, entirely over this process's own TLS connection. The
/// nonce is the only thing that ever came from JS; the response's
/// `stream_key` never leaves this function.
#[tauri::command]
pub async fn stream_key_claim_hosted(
    state: State<'_, StreamKeyState>,
    claim_token: String,
) -> Result<ClaimedEncoderTarget, String> {
    if claim_token.trim().is_empty() {
        return Err("empty_claim_token".into());
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{SETNAYAN_API_ORIGIN}{EXCHANGE_PATH}"))
        .json(&serde_json::json!({ "claimToken": claim_token }))
        .send()
        .await
        .map_err(|_| "exchange_request_failed".to_string())?;

    if !resp.status().is_success() {
        // Never interpolate the response body or the nonce into this error —
        // both could end up in a UI toast or a log line.
        return Err("exchange_rejected".to_string());
    }

    let parsed: ExchangeResponse = resp
        .json()
        .await
        .map_err(|_| "exchange_response_malformed".to_string())?;

    let rtmps_url = parsed.rtmps_url.clone();
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    *guard = Some(HeldStreamKey {
        key: Zeroizing::new(parsed.stream_key),
        rtmps_url: rtmps_url.clone(),
        source: KeySource::Hosted,
    });

    Ok(ClaimedEncoderTarget {
        ready: true,
        rtmps_url,
    })
}

/// Part C — forget the held key immediately (zeroizing it), rather than
/// waiting on `Drop`. Intended to be called from `encoder_stop` once S5 lands;
/// until then, the desktop UI should call it when the broadcast ends (mirrors
/// the couple pressing "End broadcast" on the web-only flow, which already
/// deletes the YouTube-side stream — see `endPanoodBroadcast`).
#[tauri::command]
pub fn stream_key_forget(state: State<'_, StreamKeyState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    *guard = None; // drops the Zeroizing<String> -> memory scrubbed
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_the_final_path_segment_only() {
        let input = "rtmps://a.rtmps.youtube.com/live2/abcd-1234-efgh-5678";
        assert_eq!(
            redact_url(input),
            "rtmps://a.rtmps.youtube.com/live2/****"
        );
    }

    #[test]
    fn redacted_output_never_contains_the_key() {
        let key = "super-secret-stream-key-xyz";
        let input = format!("rtmps://ingest.example.com/live2/{key}");
        let out = redact_url(&input);
        assert!(!out.contains(key), "redaction leaked the key: {out}");
    }

    #[test]
    fn handles_a_bare_host_with_no_path() {
        // No path segment to preserve past the host — the safe failure
        // direction is to over-hide, so the whole authority is redacted too.
        let input = "rtmps://ingest.example.com";
        assert_eq!(redact_url(input), "rtmps://****");
    }

    #[test]
    fn non_url_input_is_fully_redacted() {
        assert_eq!(redact_url("not-a-url-at-all"), "****");
    }

    #[test]
    fn set_pasted_rejects_blank_key_and_holds_nothing() {
        let mut current: Option<HeldStreamKey> = None;
        let err = set_pasted_inner(&mut current, "   ".to_string());
        assert_eq!(err, Err("empty_key".to_string()));
        assert!(current.is_none(), "a blank paste must not populate the sink");
    }

    #[test]
    fn set_pasted_holds_the_key_from_source_pasted() {
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(&mut current, "own-channel-secret".to_string()).unwrap();
        let held = current.as_ref().expect("key should be held after a valid paste");
        assert_eq!(held.key.as_str(), "own-channel-secret");
        assert_eq!(held.source, KeySource::Pasted);
    }

    #[test]
    fn forgetting_clears_the_held_key() {
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(&mut current, "some-key".to_string()).unwrap();
        assert!(current.is_some());
        current = None; // what `stream_key_forget` does to the guarded Option
        assert!(current.is_none());
    }
}
