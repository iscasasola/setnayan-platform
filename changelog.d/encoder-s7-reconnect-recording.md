## 2026-09-06 · feat(encoder): survive a dropped connection, and keep the bytes on disk

S7 of the S-series encoder plan (`build-sessions/encoder/README.md`). S6 made it stream;
this makes it survive a wedding.

**The clock moved out of the socket.** `RtmpClock` was a field of `RtmpSender`, and a
reconnect is a NEW `RtmpSender` — RTMP has no resume, so reconnecting is a fresh
connect/createStream/publish. A new sender meant a new clock at `base_us: None`, i.e.
the next frame stamped 0 after four hours of stream, which YouTube reads as a stream
that jumped four hours backwards. The clock and the FLV tagging now live in
`crates/encoder/src/tagger.rs`, above the thing that dies.

**One tagger, two sinks.** `Pipeline::ingest` tags a chunk once and gives the identical
`Vec<u8>` to the recording and to the socket — not two equal ones built twice.
`tests/recording.rs` asserts that the tags the ingest received appear inside the `.flv`
as a contiguous, byte-identical, gap-free run, reading the file back with a parser
independent of the writer.

**The wire and the file do not want the same frames.** After a reconnect the new ingest
cannot decode inter-frames it has no reference for, so `WireGate` withholds video until
the next keyframe. The recording holds every frame since the ceremony started, so those
same frames decode there — dropping them from the file too would punch a hole in the
couple's only copy to solve a problem the file does not have.

**The recording keeps growing while nothing is connected.** The webview never stops
encoding, so `reconnect.rs` races every connect and every backoff against the producer
and records through the outage. For a hosted-channel couple this `.flv` is the only copy
that will ever exist — they do not own the pool channel (spec § 4k).

⚠ **DEFECT FOUND AND FIXED IN THE SAME SESSION, by `tests/recording.rs`:** the supervisor
tags and records while the TCP handshake is still in flight, so on a first connection the
`Config` chunk is routinely consumed before a socket exists — and its sequence headers
went to the recording and to nothing else. Arming the resume only on RECONNECTS left the
FIRST session publishing pure media with no `avcC`/`asc` in front of it: an undecodable
stream, published without a single error, on every wedding whose config arrived before
the handshake finished. `supervise` now re-announces on every session, including the
first. Guard: `the_very_first_publish_still_gets_both_sequence_headers`.

New files, all under `src-tauri/crates/encoder/`:
- `src/tagger.rs` — `Tagger`, `TaggedFrame`, `TagSink`, `WireGate`, `Pipeline`
- `src/reconnect.rs` — `supervise`, backoff (1/2/4/5 s, capped), primary/backup
  alternation after 3 primary failures, the grace window, `HealthEvent`
- `src/file_sink.rs` — `FlvFileWriter`, the 20 GB warn / 2 GB refuse disk policy,
  `~/Movies/Setnayan/<event-public-id>-<YYYY-MM-DD>.flv` (Windows `Videos\`)
- `tests/reconnect_session.rs`, `tests/recording.rs`, `tests/common/mod.rs`

`sender.rs` no longer owns the clock or builds tags; `run` takes a `&mut Pipeline`.
`examples/publish_probe.rs` gained `--realtime`, `--backup-url` and `--record` and now
runs through `supervise` — it is the tool for the acceptance run.

Encoder tests: **42 → 77**, all green, ~39 s locally. They ride the required
`typecheck + lint` job via the existing `cargo test -p setnayan-encoder` step.

⚠ **`DEFAULT_GRACE` (120 s) IS A GUESS, NOT A MEASUREMENT.** YouTube documents "a minute
or two" and gives no number. **S13 measures it.** Labelled as a guess in the module
header and in a test, so whoever changes it changes the prose too.

**LEFT UNDONE — the 20-minute real YouTube publish with the network cut three times.**
It needs a live stream key, which this session does not have. The tool is ready:
`cargo run --example publish_probe -- --url … --key … --backup-url … --realtime
--seconds 1200 --record /tmp/s7-evidence.flv`, then toggle the wifi three times; the
health log it prints is the evidence, and the `.flv` should play end to end in VLC with
`ffprobe` showing one continuous stream. This is the same live-key gap S6 recorded.

SPEC IMPACT: None. No product decision changed. The recording path and the disk
thresholds are implementation choices inside the already-locked native-encoder scope
(`Live_Studio_Encoder_Scope_2026-09-03.md`); the grace window is explicitly deferred
to S13 rather than being asserted anywhere as fact.
