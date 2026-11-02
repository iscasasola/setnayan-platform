## 2026-09-05 · feat(encoder): S6 — speak RTMPS and FLV to YouTube from Rust

The desktop app can now do the one thing the browser cannot: open a socket to
`rtmps://a.rtmps.youtube.com:443` and publish a live stream on it. Everything left of
this ships already or is being built in S1–S5; this is where the pipeline stops being
web and starts being a protocol.

- **`src-tauri/src/encoder/contract.rs`** — the 16-byte wire header (kind · flags ·
  seq · `ts_us`) and, deliberately, **no opinion about the envelope that carried it**.
  S0 measured that the raw-binary IPC S5 was written against cannot work from the
  remote https origin on macOS (1797/1797 chunks arrive as JSON arrays, zero as `Raw`),
  so the envelope is an open owner decision; `EncodedChunk::parse` and
  `::from_json_array` funnel into one decoder and nothing downstream can tell which ran.
- **`flv.rs`** — FLV tag bodies, hand-rolled: AVC/AAC sequence headers, NALU and raw
  AAC tags, `onMetaData`, plus the file framing S7's recording will reuse. Checked
  byte-for-byte against ffmpeg's own muxer output, not against a reading of the spec.
- **`rtmp.rs`** — destination parsing (both the API's address+key pair and the
  pasted-in-one-line form), the µs→ms clock that rebases and refuses to go backwards,
  and a `Redactor` bound to the stream key that every emitted string passes through.
- **`sender.rs`** — TLS (rustls/ring, pinned webpki roots), RTMP handshake, connect,
  publish, sequence headers before any media, audio never marked droppable. Reconnect
  and the backup ingest are **S7's**; `SenderOutcome` is the seam it wraps.
- **`vendor/rml_rtmp/`** — `rml_rtmp` 0.8.0 vendored verbatim (MIT), with
  `NOTICE.md` recording why and what was changed (nothing). Its chunk serializer is
  what encodes RTMP's extended timestamps past 16,777,215 ms — 4 h 39 m 37 s, which is
  inside a wedding, not after it.
- **`apps/web/lib/panood-youtube.ts`** — additive: carry YouTube's RTMPS primary and
  backup ingestion addresses alongside the plain-RTMP one it already stored.

**Three defects the evidence found, all fixed here** — each one was invisible to
reading and visible only to running something:

- **The clock clamped video and audio against one another.** RTMP keeps the two on
  separate chunk streams with separate deltas, so an audio frame at 90 ms legitimately
  follows a video frame at 100 ms. One shared monotonic guard dragged it forward.
  Replaying a real fixture for ten minutes clamped 295 timestamps — audio walking
  steadily out of sync with picture on a recording that cannot be re-shot. The clock
  is per-track now; the same replay clamps zero.
- **A refused publish was reported as a timeout.** An ingest rejecting a stream key
  answers `_error` on a transaction the session no longer holds, so the operator was
  told "the ingest did not answer in time" — network language — for a wrong key.
- **RTMPS and RTMP disagreed about what a hang-up was.** Measured against YouTube's
  real ingest: the same bad key gives "the ingest closed the connection (publish)"
  over `rtmp://` and a rustls documentation URL over `rtmps://` — and `rtmps://` is
  what ships. Both now say the same actionable sentence.

Evidence: 4 h 40 m 01 s published over a real socket to an ffmpeg RTMP listener —
494,640 video and 783,180 audio packets, every one received, **zero** backwards
timestamps, 707 packets past the 24-bit ceiling. TLS, the RTMP handshake and `connect`
all accepted by YouTube's own ingest (`rtmps://a.rtmps.youtube.com/live2`); the publish
is refused there because the key used was deliberately invalid. **A real 20-minute
publish to the owner's channel is LEFT UNDONE** — it needs a live stream key, which
this session had no business holding. `cargo run --example publish_probe` is the tool
to do it with.

SPEC IMPACT: None — `Live_Studio_Encoder_Scope_2026-09-03.md` § "Corrections
2026-09-05" already specifies this session; nothing here changes a decision.
