## 2026-09-13 · fix(encoder): a pasted own-channel key gets an ingest address, so the default tier can publish

DSK-1 (ENC-OWN). On the DEFAULT tier — a couple streaming to their own YouTube
channel — the desktop encoder refused every broadcast with `no_stream_key`,
while the panel that took the key said "Saved to your desktop encoder."

`set_pasted_inner` in `src-tauri/src/stream_key.rs` stored
`rtmps_url: String::new()`. The comment beside that empty string said "S5's
encoder takes the server URL as its own separate, non-secret argument" — and no
such argument was ever built: `encoder_start` takes only a token and resolves the
destination through `StreamKeyState::destinations()`, which calls
`RtmpEndpoint::parse` on that field. An empty string is neither `rtmp://` nor
`rtmps://`, so it failed `UnsupportedScheme`, `destinations()` returned `None`,
and `encoder_start` returned `no_stream_key` for every own-channel key ever
pasted.

- The pasted key now carries an ingest address: the couple's own when they give
  one, YouTube's documented primary (`rtmps://a.rtmps.youtube.com/live2`) when
  they do not. The backup is deliberately NOT defaulted — a backup host that was
  never provisioned is where a wedding goes to nowhere.
- The pair is parsed at PASTE time, so an unusable address is refused where the
  couple can still fix it instead of becoming a `no_stream_key` in front of the
  guests. After `Ok`, `destinations()` cannot be `None` for a pasted key.
- A whole `rtmps://…/live2/KEY` line pasted into the key box is named
  (`key_looks_like_ingest_address`) rather than published with the URL as the key.
- Seven new Rust tests, including the one that did not exist: pasted key →
  `destinations()` is `Some`. Every prior test asserted the key was HELD; none
  asserted it could be PUBLISHED. Mutation-proved — restoring
  `rtmps_url: String::new()` turns 4 of the 14 red.

### The by-hand route had nowhere to put a key

`EncoderKeyPanel` ships in exactly two places and BOTH sit inside a Setnayan-API
broadcast (`{activeBroadcast ? … }` on the controller, `active` in
`go-live-card.tsx`). The by-hand route — `resolveLiveAir` returning
`source: 'manual'` — has no `activeBroadcast`, and `shouldOfferManualAir`'s own
docblock records that until Setnayan's YouTube app review clears, **it is the
only route that works**. So on the default tier there was no place on screen to
hand the desktop encoder a key at all, while `DesktopEncoderHost` ran anyway
(`isLive` is true for manual air) and went straight to the refusal.

- `DesktopOwnChannelKeyCard` renders directly under the ingest health strip — the
  surface that says "not sending" is now followed by the thing that fixes it. It
  renders nothing outside the desktop shell (a browser there has no encoder to
  give a key to, and the existing panel's browser branch would have shown
  "— unavailable —" to a couple with nothing missing) and nothing for a
  hosted-channel couple, who reach air through the broadcast route. That is
  today's behaviour for them, unchanged — hosted transport is DSK-3.

### And nothing tried again after the key arrived

`DesktopEncoderHost`'s effect is keyed on `[shouldRun, eventId]`, neither of
which changes when a key is pasted, and its first attempt necessarily fails
because it starts before the key box exists. So the couple pasted a key, was
told "Saved to your desktop encoder", and the encoder stayed dead until a page
reload.

- `lib/encoder/encoder-key-bus.ts` carries "a key is now held" — a COUNT, never
  the key or the address; the key still crosses IPC exactly once, into Rust.
- The paste announces only after Rust confirms. Announcing on submit would wake
  the encoder for a key Rust went on to refuse, and the retry would fail for a
  reason nobody was shown.
- The probe still runs once (a key cannot fix a broken transport); only the
  publish attempt is re-runnable, and `shouldAttemptStart` is a pure, tested
  three-way guard — `started` stops a second RTMP publish of one wedding to one
  key, and `starting` catches the in-flight case a per-attempt boolean cannot see.

### Smaller, but the same disease

- An optional, non-secret **server box**, prefilled by PLACEHOLDER only, so Rust
  stays the single source of the default. A drift guard reads the Rust constant
  and fails if the address shown to the couple stops matching the one used.
- Refusals became four sentences a couple can act on. The panel said
  "Couldn't save it — check the key and try again." for every failure — wrong
  advice for three of the four, and a refusal nobody can act on is the same as
  no refusal.

### Proof

- `cargo test -p setnayan-desktop` 42 passed · `-p setnayan-encoder` 87 passed
  (the latter is what CI runs; CI never compiles the desktop crate, which is why
  the bug lived there).
- `pnpm test:unit` 15,411 tests, 0 failures, `UNIT_EXIT=0`. `TSC_EXIT=0`.
- All ~36 CI guard scripts run from their own working directories: pass.
- Every new guard mutation-proved; counts recorded in the PR.

SPEC IMPACT: None. The own-channel paste route, YouTube's primary ingest as its
default, and "do not fabricate a backup URL" are all already the recorded
decisions (DECISION_LOG.md row 3735 · encoder rule 20 · `destinations()`'s own
docblock). This makes the shipped code do what they say.
