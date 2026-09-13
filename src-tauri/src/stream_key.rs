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

use crate::encoder::reconnect::Destinations;
use crate::encoder::rtmp::RtmpEndpoint;
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

/// YouTube's PRIMARY ingest address, the default an own-channel paste is held
/// against when the couple does not give one.
///
/// THIS IS NOT A GUESSED URL. It is the single documented primary ingest every
/// YouTube channel publishes to — the exact string YouTube Studio prints in its
/// own "Stream URL" box and every OBS tutorial repeats, identical for every
/// channel. `crates/encoder`'s own tests and `examples/publish_probe.rs` already
/// carry it as the primary. What is per-channel is the KEY, which is why the key
/// is the thing the couple pastes and this is the thing we can default.
///
/// ⚠ THE BACKUP IS DELIBERATELY NOT DEFAULTED HERE. `destinations()` documents
/// why at length: a backup host that was never provisioned is where you send a
/// wedding to nowhere. A backup is a real value that must ARRIVE (from the couple
/// or from the exchange response), never a `?backup=1` this module invents.
const YOUTUBE_RTMPS_PRIMARY: &str = "rtmps://a.rtmps.youtube.com/live2";

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
/// S18 UPDATE — `key` and `rtmps_url` are now genuinely read in production, by
/// `StreamKeyState::destinations()` just below, which is what `encoder_start`
/// publishes through. They are no longer test-only and the blanket
/// `#[allow(dead_code)]` this struct used to carry has been removed with them.
///
/// `source` is still read only by this module's tests: nothing downstream
/// behaves differently for a pasted key versus a hosted one — the endpoint is
/// the endpoint. It keeps its own `#[allow]` rather than being deleted because
/// it is what a "whose channel is this?" diagnostic would read, and because
/// losing it would make the two setters indistinguishable after the fact.
struct HeldStreamKey {
    key: Zeroizing<String>,
    rtmps_url: String,
    #[allow(dead_code)]
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

impl StreamKeyState {
    /// S18 — build the publish destination WITHOUT ever handing the key out.
    ///
    /// This is the one reader of `HeldStreamKey.key` outside this module's own
    /// tests, and it deliberately returns a fully-built `Destinations` rather
    /// than the key itself: `RtmpEndpoint` owns the secret from here on and
    /// only ever prints itself through `redacted_url()`. A `-> String` accessor
    /// would have put the raw key back on the caller's stack, which is the
    /// exact thing this module's threat model (see the header) exists to stop —
    /// and once one caller has it, every future caller may.
    ///
    /// `None` means no key is held: the operator has not pasted one and has not
    /// claimed a hosted channel. `encoder_start` turns that into a refusal, so a
    /// broadcast can never begin pointed at nowhere.
    ///
    /// There is no backup ingest yet: `ExchangeResponse.rtmps_backup_url` is
    /// parsed off the wire but never stored on `HeldStreamKey` (see its
    /// `#[allow(dead_code)]`), so `Destinations::new` is the honest constructor
    /// here. Storing it is a separate, small change to the two setters — NOT
    /// something to fake with a guessed `?backup=1` URL, which is how you send a
    /// wedding to a host that was never provisioned.
    pub fn destinations(&self) -> Option<Destinations> {
        let guard = self.0.lock().ok()?;
        let held = guard.as_ref()?;
        let endpoint = RtmpEndpoint::parse(&held.rtmps_url, Some(held.key.as_str())).ok()?;
        Some(Destinations::new(endpoint))
    }

    /// The body of `stream_key_forget`, callable without a command invocation so
    /// `encoder_stop` can do it directly (Part C's own docblock asked for this).
    /// `Err` only on a poisoned lock — the caller decides whether that is worth
    /// failing over; `encoder_stop` does not, because a broadcast that ended
    /// cleanly should not report an error over a mutex.
    pub fn forget(&self) -> Result<(), String> {
        let mut guard = self.0.lock().map_err(|_| "state_poisoned".to_string())?;
        *guard = None; // drops the Zeroizing<String> -> memory scrubbed
        Ok(())
    }
}

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
///
/// ── DSK-1: WHY THIS TAKES AN ADDRESS AT ALL ─────────────────────────────────
/// It used to store `rtmps_url: String::new()`, and the comment where that empty
/// string was written said: "S5's encoder takes the server URL as its own
/// separate, non-secret argument." **No such argument was ever built.**
/// `encoder_start(state, keys, app, token)` takes only a token and resolves the
/// destination from `destinations()`, which calls `RtmpEndpoint::parse` on this
/// field — and an empty string is neither `rtmp://` nor `rtmps://`, so it failed
/// `UnsupportedScheme`, `destinations()` returned `None`, and every own-channel
/// broadcast refused with `no_stream_key`. The DEFAULT tier could not go live at
/// all, while the panel that took the key said "Saved to your desktop encoder."
///
/// So the address is carried WITH the key, from here on, in one of two ways:
/// the couple's own address when they give one, and YouTube's documented primary
/// when they do not.
///
/// ── WHY IT VALIDATES HERE AND NOT ONLY IN `destinations()` ──────────────────
/// `destinations()` returns `Option`, and `encoder_start` can only turn a `None`
/// into `no_stream_key` — a refusal that arrives at GO-LIVE, in front of the
/// guests, attributed to a key the couple did in fact supply. Parsing the pair
/// HERE moves that same failure to the moment of pasting, where it is still
/// fixable and can be named. After this returns `Ok`, `destinations()` cannot be
/// `None` for a pasted key: the test `pasted_key_yields_destinations` pins it.
fn set_pasted_inner(
    current: &mut Option<HeldStreamKey>,
    key: String,
    rtmps_url: Option<String>,
) -> Result<(), String> {
    // BOTH the incoming string and the trimmed copy are wrapped, so each is
    // scrubbed on drop. Before DSK-1 this function moved its `key` parameter
    // straight into `Zeroizing`, which scrubbed that one allocation; trimming
    // into a plain `String` would have left the untrimmed original sitting in
    // freed heap with the key still in it. It is not reachable by the threat this
    // module guards against (a compromised script in the RENDERER — see the
    // header), but "the key exists in exactly one scrubbed place" is the property
    // the whole module is built on, and quietly spending it for a `.trim()` is
    // how such a property goes.
    let raw = Zeroizing::new(key);
    let key = Zeroizing::new(raw.trim().to_string());
    if key.is_empty() {
        return Err("empty_key".into());
    }

    // The couple pasted the Server box into the Key box (or pasted a whole
    // `rtmps://host/live2/KEY` line into it). The web side splits that shape
    // before it ever gets here — `pasteSubmit` in
    // lib/live-studio-encoder-key-paste.ts — and this is the backstop for every
    // other caller, because the alternative is silent: `parse(PRIMARY,
    // Some("rtmps://…/live2/abc"))` succeeds and publishes with the entire URL
    // as the stream key, which YouTube rejects at the handshake with nothing on
    // screen to explain it.
    if key.contains("://") {
        return Err("key_looks_like_ingest_address".into());
    }

    // The couple's own address when they gave one; YouTube's documented primary
    // when they did not. Trimmed-empty counts as "did not" — an empty field is
    // the same intent as an absent one, and it is the exact value that used to
    // be stored unconditionally.
    let address = match rtmps_url.as_deref().map(str::trim) {
        Some(url) if !url.is_empty() => url.to_string(),
        _ => YOUTUBE_RTMPS_PRIMARY.to_string(),
    };

    // Parsed for its verdict only. The endpoint is rebuilt by `destinations()`
    // at go-live rather than stored, so this module keeps holding exactly the
    // two strings it already held and `HeldStreamKey` grows no new field.
    //
    // The pair is validated together, with the real key, because the pair is what
    // has to be valid — `parse` takes the key into an `RtmpEndpoint` that is
    // dropped here without scrubbing, which is the same transient copy
    // `destinations()` already makes on every go-live and the same one
    // `RtmpEndpoint`'s docblock accepts when it says it "owns the secret from
    // here on".
    RtmpEndpoint::parse(&address, Some(key.as_str()))
        .map_err(|_| "unusable_ingest_address".to_string())?;

    *current = Some(HeldStreamKey {
        key,
        rtmps_url: address,
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
///
/// `rtmpsUrl` is the couple's own ingest address and is OPTIONAL and NON-SECRET
/// — omit it (or send an empty string) to hold the key against YouTube's
/// documented primary. It is a separate argument from `key` so the secret stays
/// the one value with a clearing guarantee attached to it; the address may sit
/// in page state as long as the form is open, because it is the same string
/// YouTube Studio shows on screen.
#[tauri::command]
pub fn stream_key_set_pasted(
    state: State<'_, StreamKeyState>,
    key: String,
    rtmps_url: Option<String>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state_poisoned".to_string())?;
    set_pasted_inner(&mut guard, key, rtmps_url)
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
    state.forget()
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
        let err = set_pasted_inner(&mut current, "   ".to_string(), None);
        assert_eq!(err, Err("empty_key".to_string()));
        assert!(current.is_none(), "a blank paste must not populate the sink");
    }

    #[test]
    fn set_pasted_holds_the_key_from_source_pasted() {
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(&mut current, "own-channel-secret".to_string(), None).unwrap();
        let held = current.as_ref().expect("key should be held after a valid paste");
        assert_eq!(held.key.as_str(), "own-channel-secret");
        assert_eq!(held.source, KeySource::Pasted);
    }

    #[test]
    fn forgetting_clears_the_held_key() {
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(&mut current, "some-key".to_string(), None).unwrap();
        assert!(current.is_some());
        current = None; // what `stream_key_forget` does to the guarded Option
        assert!(current.is_none());
    }

    // ── DSK-1 ───────────────────────────────────────────────────────────────
    // THE TEST THAT DID NOT EXIST. Every test above asserts the key is HELD;
    // not one asserted it can be PUBLISHED. `destinations()` was the only
    // reader, it was never called on a pasted key in a test, and it returned
    // `None` for every one of them in production for as long as the paste field
    // has shipped. Both of the next two tests fail on the previous
    // `rtmps_url: String::new()`.

    /// Set a pasted key through the real guarded state and ask the real reader.
    fn paste_then_destinations(
        key: &str,
        rtmps_url: Option<&str>,
    ) -> Result<Option<Destinations>, String> {
        let state = StreamKeyState::default();
        {
            let mut guard = state.0.lock().unwrap();
            set_pasted_inner(&mut guard, key.to_string(), rtmps_url.map(str::to_string))?;
        }
        Ok(state.destinations())
    }

    #[test]
    fn pasted_key_yields_destinations() {
        let destinations = paste_then_destinations("abcd-1234-efgh-5678", None)
            .expect("a plain key paste must be accepted");
        assert!(
            destinations.is_some(),
            "a pasted key must resolve to a publish destination — `None` here is \
             exactly the `no_stream_key` refusal DSK-1 exists to remove"
        );
    }

    #[test]
    fn pasted_key_publishes_to_youtubes_primary_by_default() {
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(&mut current, "abcd-1234".to_string(), None).unwrap();
        let held = current.as_ref().unwrap();
        assert_eq!(held.rtmps_url, YOUTUBE_RTMPS_PRIMARY);

        // And the endpoint that address builds carries the key as the KEY —
        // never folded into the path, which is how a whole URL in the key field
        // fails silently at YouTube's handshake.
        let endpoint = RtmpEndpoint::parse(&held.rtmps_url, Some(held.key.as_str())).unwrap();
        assert_eq!(endpoint.stream_key, "abcd-1234");
        assert_eq!(endpoint.socket_address(), "a.rtmps.youtube.com:443");
    }

    #[test]
    fn a_couples_own_address_outranks_the_default() {
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(
            &mut current,
            "k".to_string(),
            Some("rtmps://ingest.example.com/live".to_string()),
        )
        .unwrap();
        assert_eq!(current.as_ref().unwrap().rtmps_url, "rtmps://ingest.example.com/live");
    }

    #[test]
    fn a_blank_address_field_means_the_default_not_a_refusal() {
        // An empty box and an absent argument are the same intent. This is the
        // exact value that used to be stored unconditionally, so it must not be
        // the one input that still cannot publish.
        let destinations = paste_then_destinations("k", Some("   "))
            .expect("an empty address field must fall back, not refuse");
        assert!(destinations.is_some());
    }

    #[test]
    fn an_unusable_address_is_refused_at_paste_time_and_holds_nothing() {
        let mut current: Option<HeldStreamKey> = None;
        let err = set_pasted_inner(
            &mut current,
            "k".to_string(),
            Some("https://a.rtmps.youtube.com/live2".to_string()),
        );
        assert_eq!(err, Err("unusable_ingest_address".to_string()));
        assert!(
            current.is_none(),
            "a refused address must not leave a key held that cannot publish — \
             that state is indistinguishable from success at the next go-live"
        );
    }

    #[test]
    fn a_whole_ingest_url_in_the_key_field_is_named_not_published() {
        let mut current: Option<HeldStreamKey> = None;
        let err = set_pasted_inner(
            &mut current,
            "rtmps://a.rtmps.youtube.com/live2/abcd-1234".to_string(),
            None,
        );
        assert_eq!(err, Err("key_looks_like_ingest_address".to_string()));
        assert!(current.is_none());
    }

    #[test]
    fn a_pasted_key_is_trimmed_before_it_is_held() {
        // Copying from YouTube Studio brings whitespace with it often enough
        // that an untrimmed key is a real refusal at the RTMP handshake.
        let mut current: Option<HeldStreamKey> = None;
        set_pasted_inner(&mut current, "  abcd-1234\n".to_string(), None).unwrap();
        assert_eq!(current.as_ref().unwrap().key.as_str(), "abcd-1234");
    }
}
