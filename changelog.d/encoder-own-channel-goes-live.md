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

SPEC IMPACT: None. The own-channel paste route, YouTube's primary ingest as its
default, and "do not fabricate a backup URL" are all already the recorded
decisions (DECISION_LOG.md row 3735 · encoder rule 20 · `destinations()`'s own
docblock). This makes the shipped code do what they say.
