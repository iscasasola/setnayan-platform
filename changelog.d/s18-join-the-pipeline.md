## 2026-09-09 · feat(encoder): join the pipeline — composite → encode → send now runs

Fourteen encoder sessions merged, every stage tested, the Rust crate gating CI
with 87 tests — **and nothing called any of them.** The plan of record said "the
pipeline is complete end to end." The first half of that sentence was true.

Measured against `origin/main @ beccdf510` before a line was written:

- `grep -rn "invoke('encoder_start'" apps/web` → nothing. Only `encoder_probe`
  was ever invoked; every other mention of the four commands was a comment.
- Every module in `apps/web/lib/encoder/` had **zero** non-test importers. The
  one production import in the tree was `program-strings` (copy constants).
- The video ring's `drain()` had callers only in tests, so encoded H.264 filled
  a 180-entry buffer and then silently dropped its oldest frame forever.
- Encoded AAC was discarded at the `AudioEncoder` output callback, under a
  comment reading "S4/S5: hand `chunk` to the IPC sender here."
- `encoder_ipc.rs:188` still read `// STUB SINK`, and `reconnect::supervise` —
  the whole RTMPS/FLV path — had one caller in the repository, an example.
- `src-tauri/src/encoder_ipc.rs` cited `apps/web/lib/encoder/go-live-guard.ts`,
  which does not exist anywhere.

### What now runs

`DesktopEncoderHost` mounts on the controller beside `ProgramBridgeHost`,
composites through the existing worker, and pushes H.264 + AAC over the S5 IPC
commands into `reconnect::supervise`, which publishes to RTMPS and records the
local `.flv`. Health reaches the `IngestHealthStrip` that has accepted its shape
since S9 while always being handed `null`.

- The worker gained the media message its outbound contract never had, and audio
  gained its own ring so S5's "never drop audio" holds by construction.
- `encoder-session.ts` holds media until BOTH decoder-config halves exist —
  Rust cannot mux a keyframe without the `avcC`.
- `StreamKeyState::destinations()` builds the endpoint without handing the key
  out; `encoder_stop` forgets it, as `stream_key.rs`'s docblock asked.
- A full disk drops the recording, never the broadcast.

15 guards, each mutation-tested: breaking the guarded behaviour turns the suite
red in every case, occurrence counts printed before and after.

### Still owner-gated — built up to, deliberately not attempted

Publishing a desktop build (4 GitHub Actions secrets + `R2_PUBLIC_URL` in
Vercel), a real YouTube broadcast (needs a stream key), the visible-state
60-minute thermal run, and the entire Windows leg. **No end-to-end broadcast has
been observed.** What is proven is that every hop is now called by shipped code.

SPEC IMPACT: None — this builds the S-series plan as written. The plan's own
`README.md` "the pipeline is complete end to end" claim was false and is
corrected in `build-sessions/encoder/README.md` in this PR.
