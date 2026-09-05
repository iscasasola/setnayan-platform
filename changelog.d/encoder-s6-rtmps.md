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

SPEC IMPACT: None — `Live_Studio_Encoder_Scope_2026-09-03.md` § "Corrections
2026-09-05" already specifies this session; nothing here changes a decision.
