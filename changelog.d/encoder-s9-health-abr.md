## 2026-09-06 · feat(live-studio): S9 — encoder health states and the adaptive-bitrate decider

Part of the S-series encoder plan (`build-sessions/encoder/README.md`), extending LS4's ingest
health surface (PR #5122) with the desktop encoder's own reading, and adding the pure decider the
adaptive bitrate ladder rests on. Builds everything independently buildable and testable today;
does NOT complete the live Rust→JS wiring — see COORDINATION below for exactly why, with the
command to reproduce the finding.

**A. `apps/web/lib/live-studio-ingest-health.ts` (extended, not forked)** — `IngestHealthState`
gains `'reconnecting'` and `'encoder_down'`; a new optional `IngestHealthInput.encoder` field
(`EncoderRtmpState` + `reconnectingForMs` + `droppedFrames` + `bitrateRung` + `recording`) mirrors
`src-tauri/crates/encoder::reconnect::HealthEvent`. `decideIngestHealth` now applies three
precedence rules, each pinned by a mutation-tested guard test: (1) YouTube `no_data`/stale ALWAYS
wins — a locally "publishing" encoder, even one that would itself read `down`/`reconnecting` in
isolation, cannot make the strip greener than what YouTube reports; (2) local `down` pre-empts
immediately, local `reconnecting` pre-empts only once `reconnectingForMs >= LOCAL_PREEMPT_MS`
(1000ms) — a sub-second blip doesn't alarm; (3) a non-zero `bitrateRung` is a sub-state ("streaming
at reduced quality" appended to the sentence), never its own alarm color. Own-channel (`!live`) now
shows the encoder's own reading instead of the generic "not live yet" when one exists, with an
explicit "can't check YouTube on your own channel" note — the mount-rule gap S9.md called out.
11 new tests (26 total, up from 15); two guards mutation-tested (counts below).

**B. `apps/web/lib/live-studio-encoder-bitrate.ts` (new)** — the JS-side ladder decider,
independent of both S4 (no live `VideoEncoder` on `origin/main` yet) and S5. `BITRATE_LADDER` is
exactly S9.md's numbers (2.5 / 1.8 / 1.2 Mbps, 720p30 / 720p30 / 540p30). `stepBitrateRung` is a
pure, bounded (rung ∈ [0, 2]), hysteretic stepper: DOWN after `DOWN_AFTER_MS` (2000ms) continuously
above `DOWN_BUFFERED_THRESHOLD_MS` (1500ms) of buffered send, UP after `UP_AFTER_CLEAN_MS`
(30000ms) continuously clean — both counters reset to zero the instant a sample crosses back, so a
single spike/single good sample never flips the rung. 14 tests; both the bound and the hysteresis
guards mutation-tested (counts below).

**C. `src-tauri/crates/encoder/src/occupancy.rs` (new)** — the Rust-side raw sampler S9.md asked
for: `SendBufferProbe` trait, `SocketOccupancyProbe` (macOS, real `getsockopt(SO_NWRITE)` against a
live fd — `SO_NWRITE`'s value, `0x1024`, is not named by the `libc` crate so it's defined locally
from Apple's own `<sys/socket.h>`; verified against a REAL socket in-test, not just documented), and
`WriteLedger` (portable `submitted − completed` byte ledger for Windows, where no equivalent
syscall exists without an undocumented IOCTL — S9.md's own "bytes-written minus completed-write
bytes"). 5 new tests, including one guard (`saturating_sub`, not a plain `-`) mutation-tested — counts below.
Registered in `lib.rs`; full crate suite still green (83 tests total, up from 78 before this
change — several other S-series sessions have added to the crate since the "42 tests" figure in
various comments/CI docs was written; not corrected here, out of scope).

**D. `IngestHealthStrip` + the controller page mount rule** — `mode?: 'broadcast' | 'manual'`.
`'manual'` (own-channel/by-hand) skips the YouTube poll entirely (no `stream_id` to ask about) and
only renders once `isTauri()` resolves true post-mount — a plain-browser by-hand stream still shows
nothing, unchanged. New skins/icons for `reconnecting` (amber, spinning `RefreshCw`) and
`encoder_down` (red, `WifiOff`). `page.tsx`'s mount condition becomes `liveAir.source === 'broadcast'
|| liveAir.source === 'manual'` — the existing pinned test asserting the `'broadcast'` substring
appears before the mount site still passes untouched, since it's still literally present in the new
OR expression.

**⚠ NOT WIRED END TO END — this is the load-bearing finding, not an oversight:**

- `git grep HealthEvent origin/main -- src-tauri` and `git show origin/main:src-tauri/src/lib.rs`
  show ZERO Tauri commands registered for the encoder as of `origin/main @ 8cbd2d4db` — S5 (the
  Rust→JS IPC transport S9.md assumes as its own dependency) had not merged when this session
  started, and STILL had not merged as of writing this fragment: PR #5239
  (`claude/encoder-s5-ipc-transport`) is open, and its required `typecheck + lint` check just
  turned FAILURE (checked live via `gh pr view 5239`) — so it is neither landed nor imminently
  landing. Its own `encoder_ipc.rs` (fetched from that branch to check its shape before writing
  this module) runs `encoder_push`'s bytes into a STUB byte-counter sink regardless, by its own
  comment: "S6 replaces this with the real FLV-tag/RTMP writer". Nothing calls
  `reconnect::supervise()` from a live Tauri command today, and there is no `Channel<HealthEvent>`
  or `Channel<u64>` (occupancy) at all — S5, once its own CI is green, will ship the envelope/
  ACL/token machinery, not the glue between the received bytes and this crate's already-shipped
  (S6/S7) sender/reconnect path.
- S4 (the browser-side `VideoEncoder` from the canvas) had ALSO not landed when this session
  started — it merged mid-session as PR #5236, picked up here via a clean merge from
  `origin/main` (no conflicts; this PR's files are untouched by it). `apps/web/lib/encoder/
  program-canvas.worker.ts`'s `startVideoEncoder`/`videoEncoder.configure(VIDEO_ENCODER_CONFIG)`
  is the real call site a follow-up should call `stepBitrateRung`'s ladder entry into — but S4
  shipped a FIXED config (2.5 Mbps, no runtime reconfigure path, no message protocol from the
  main thread into the worker for "change rung now") and there is still no occupancy DATA to
  drive it with (see the S5 gap below). Wiring the call site without a real sender behind it
  would mean guessing at a postMessage protocol S5's actual shape should decide — not done here,
  flagged as the precise integration point instead.
- S5 (Rust→JS IPC): consequence unchanged from above — `IngestHealthStrip` passes `encoder: null`
  always (documented inline, at the exact line); the EVIDENCE section of S9.md (throttle the
  uplink, observe the rung step within 3s) could not be produced — there is no running desktop
  encoder end-to-end on `origin/main` to throttle, even with S4 now real, because nothing carries
  occupancy samples or `HealthEvent`s across the IPC boundary yet. This is a premise finding, not
  a skipped step: `decideIngestHealth`/`stepBitrateRung` are fully built, tested, and ready to
  receive real data the moment a follow-up session finishes the `encoder_ipc.rs` ↔
  `reconnect::supervise()`/`occupancy::SendBufferProbe` glue, adds the two Tauri channels, and
  wires `program-canvas.worker.ts`'s reconfigure call site. That follow-up is flagged as its own
  session below, per rule 15.

MUTATION COUNTS (rule 7 — before → after, all reverted):
  - `decideIngestHealth` PRECEDENCE 1 guard (`youtube.state === 'no_data' || !encoder`): 26 pass, 0
    fail → mutation (drop the `no_data` clause) → 25 pass, 1 fail.
  - `decideIngestHealth` PRECEDENCE 2 grace guard (`reconnectingForMs >= LOCAL_PREEMPT_MS`): 26
    pass → mutation (drop the grace clause) → 25 pass, 1 fail.
  - `stepBitrateRung` hysteresis-down guard (`aboveThresholdMs >= DOWN_AFTER_MS`): 14 pass →
    mutation (step on any bad sample) → 7 pass, 7 fail.
  - `stepBitrateRung` upper-bound guard (`state.rung < MAX_RUNG`): 14 pass → mutation (drop the cap)
    → 12 pass, 2 fail.
  - `occupancy::WriteLedger::unsent_bytes`'s `saturating_sub` guard: 5 pass → mutation (plain `-`)
    → 4 pass, 1 fail (panics on underflow rather than merely returning a wrong number).

TSC_EXIT=0 ERROR_LINES=0. `cargo test -p setnayan-encoder`: 83/83 passing (5 new). Web unit suite:
see PR test plan for the final count (full run was in progress at commit time under heavy shared-
machine load — see `build-sessions/encoder/S9.md`'s own rule 6 on non-zero test counts).

FOLLOW-UP SESSION NEEDED (rule 15 — flagged, not opened here): wire `encoder_ipc.rs`'s
`encoder_push` path into `reconnect::supervise()` + `occupancy::SendBufferProbe`, add the two Tauri
`Channel`s (`HealthEvent`, raw occupancy `u64`), define the main-thread → worker message that
carries a rung change into `program-canvas.worker.ts`, and call `videoEncoder.configure()` there
with `BITRATE_LADDER[newRung]`. S4 (real `VideoEncoder`) is now on `main`, so only the IPC/message
plumbing is left — `IngestHealthStrip`'s `encoder` value and `stepBitrateRung`'s output can go live
the moment that plumbing exists. Nothing in this PR needs to change for that to happen — both
deciders already accept the real shape.

SPEC IMPACT: None (build-sessions/encoder/S9.md is a build-session prompt, not the design doc; no
locked decision changed).
