## 2026-09-05 · feat(desktop): S8 — the stream key, two sources, one Rust sink, never in page state

Part of the S-series encoder plan (`build-sessions/encoder/README.md`), superseding E6. Builds the
own-channel paste flow, the hosted-channel single-use claim/exchange, the Rust-side zeroizing sink,
and the desktop UI gate — without depending on S5 (not landed on this branch) or S6 (also not
landed; see COORDINATION below).

**A. Own-channel (default tier)** — `apps/web/app/_components/encoder-key-panel.tsx` (new)
renders a password-type paste field inside the desktop shell (`window.__TAURI__`) instead of the
web reveal/copy UI. `apps/web/lib/live-studio-encoder-key-paste.ts` (new) is the pure "what happens
on submit" core — `nextFieldValue` is typed as the literal `''`, not `string`, so the field can
never end up holding the key it just sent. `apps/web/lib/desktop-stream-key.ts` (new) invokes
`stream_key_set_pasted` through the same `window.__TAURI__` accessor `lib/desktop-oauth.ts` already
uses for OAuth (that accessor is now `export`ed instead of private, so this module doesn't
re-declare the shape).

**B. Hosted-channel (add-on)** — `POST /api/live-studio/encoder/claim` (new route) mints a
single-use, 60s-TTL nonce bound to (event, active broadcast, requesting host) in the new
`live_studio_encoder_claims` table (migration `20271207322067`, same RLS-enabled-no-policy /
delete-on-read posture as the `live_studio_channel_oauth_state` precedent it's modelled on — see
that migration's own header). The webview hands ONLY the nonce to the Rust command
`stream_key_claim_hosted`, which exchanges it via its own `reqwest`/rustls request to
`POST /api/live-studio/encoder/exchange` (new route, backed by `lib/live-studio-encoder-claims.ts`)
— never through the Tauri IPC channel the webview shares. The command's return type
(`ClaimedEncoderTarget`) has no `stream_key` field at all, so there is no way to serialize the
secret back across IPC even by mistake.

**C. Rust sink** — `src-tauri/src/stream_key.rs` (new): one `Mutex<Option<HeldStreamKey>>` app
state for both sources, the key wrapped in `zeroize::Zeroizing` (scrubbed on drop — a re-paste, a
new claim, or app exit all zeroize the old value with no extra code) plus an explicit
`stream_key_forget` command for immediate clearing. `redact_url()` strips the final rtmps path
segment (`rtmps://…/live2/****`) — verified by 4 unit tests including a mutation check (identity-
leak sabotage → 3 of 4 redact tests correctly went red; reverted clean).

**D. Desktop UI gate** — owner default 2026-09-05 confirmed via the EncoderKeyPanel component
itself: under `window.__TAURI__`, both `go-live-card.tsx` and the unified controller's encoder
section now render one of the paste field / hosted-channel connect button instead of reveal+copy —
this also deduplicated two byte-for-byte-identical copies of the old reveal/copy JSX into one shared
component.

**Durable mitigation** — `lib/panood-youtube.ts` gained `deleteYoutubeStream` (liveStreams.delete);
`endPanoodBroadcast` now calls it best-effort right after transitioning the broadcast to `complete`,
so a Setnayan-held key stops working on YouTube's side within one API call of the couple pressing
"End broadcast", independent of whether the claim-nonce path was ever exercised for that broadcast.
`completePanoodBroadcast`'s return type grew `streamId` (additive; its one caller updated).

**Ugat**: `live_studio_encoder_claims` + its `broadcast_id → panood_broadcasts` FK added to J39's
existing claims list (control room → cameras · moments · the channel pool) — not a new joint, since
this is one more artifact of that same relationship, not a new subsystem.

COORDINATION NOTE: `git grep redact_url origin/main` and `git grep -e rtmp -e RTMP origin/main --
src-tauri` both came back empty of any actual Rust/RTMP code (only S6.md's and S8.md's own spec
text) — S6 (the RTMP/FLV session S8's prompt names as `redact_url`'s owner) had not landed on
origin/main when this session started building. `stream_key.rs`'s `redact_url` is a LOCAL STAND-IN
with the same behavior S6.md documents; its docblock says so explicitly so a later session can
delete it and depend on S6's once that lands, without any call site needing to change.

UPDATE (same PR, after a merge from origin/main): S6 landed on `main` while this PR was open
(`src-tauri/src/encoder/{rtmp,sender}.rs`), resolving as a `Redactor` VALUE + `.redacted_url()`
METHOD, not a standalone `redact_url` FUNCTION as S6.md's own text implied. That shape mismatch
means swapping `stream_key.rs` over is not the one-line delete the note above expected — flagged
for a dedicated follow-up session rather than done as a drive-by inside this merge.

OWNER QUESTIONS LEFT OPEN:
  - S5's IPC transport is still an open owner decision (S0-FINDING.md) — this session's own key/nonce
    handoff is a single small JSON `invoke()` either way, so it isn't blocked on that decision, but
    S5 landing will determine where `stream_key_forget` actually gets called from (`encoder_stop`).
  - `rtmps_backup_url` is always `null` today: YouTube returns a backup ingestion address but nothing
    upstream of this session (`lib/panood-youtube.ts`'s `createYoutubeStream`) persists it. Real,
    separate gap — flagged, not silently invented a value for.

SPEC IMPACT: None (build-sessions/encoder/S8.md is a build-session prompt, not the design doc; no
locked decision changed).
