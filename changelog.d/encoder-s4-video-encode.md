## 2026-09-06 · feat(encoder): H.264 from the canvas, on the audio clock, with the drift guard (S4)

`apps/web/lib/encoder/video-encode.ts` (new) — everything S4 needs is a pure, Node-tested module,
same split as S3's `audio-clock.ts`/`audio-packer.ts`: this file decides the config, the keyframe
cadence and the drift guard; `program-canvas.worker.ts` (still deliberately untested — the only
place `VideoEncoder`/`VideoFrame`/`OffscreenCanvas` are touched) just calls it, once per master-clock
tick, alongside S3's audio encode that already lived there.

**Config, filled from measurements already on `origin/main`, not chosen here:**
- `hardwareAcceleration: 'prefer-hardware'` — `build-sessions/encoder/S0-FINDING.md` § 2.2 measured
  `'require-hardware'` throwing `TypeError` inside the real Tauri webview, and the W3C WebCodecs
  draft confirms why: `require-hardware` is not a member of the `HardwareAcceleration` enum at all,
  so the throw is spec-conformant. `'prefer-hardware'` is the only floor-safe value.
- `avc: { format: 'avc' }` (AVCC, length-prefixed) — not merely what the prompt asked for:
  `src-tauri/crates/encoder/src/contract.rs`'s `ChunkKind::Video` doc says the wire format IS
  "avcC (length-prefixed) form", and only AVCC carries the decoder config out-of-band in
  `decoderConfig.description` — Annex B has no such side channel, so `S5`/`S6` need AVCC specifically.
- `bitrateMode: 'constant'`, `framerate` always paired with `bitrate` (Safari 17.4 silently drops
  frames otherwise) — both asserted directly against the exported config object.
- Codec `avc1.42E01F` (Constrained Baseline L3.1) — Windows' OpenH264 software fallback ceiling.

**The keyframe cadence** — every 60 ticks (2s at the locked 30fps), YouTube's live-ingest GOP.

**The drift guard, at the mux point** — `videoPTS` and the simulated `audioPTS` both derive from
the SAME master-clock counter (`audio-clock.ts`), so in steady state they cannot drift; the guard
exists for the one case that isn't steady state — a chunk arriving very late. `checkDrift` compares
`|videoTs − audioTs|` against a 100ms threshold; past it, the chunk is DROPPED, never re-timestamped
— re-stamping would fabricate a PTS that the whole master-clock design exists to avoid needing.

**The config capture** — `createVideoEncodeSink` guarantees `onConfig` (the AVCDecoderConfigurationRecord,
from the first chunk's `decoderConfig.description`) fires strictly before `onChunk` releases that
same chunk, so a consumer can never observe media before the config that decodes it. The worker posts
it once as `video-config`, alongside S3's `audio-config`, for S5 to ship before any media and reship
on reconnect.

**The ring** — a bounded, non-blocking store (`createChunkRing`); producer never awaits a consumer.
Drop-oldest-on-overflow is a placeholder, not a decision — S5 owns the real backpressure policy.

**Mutation-tested, occurrence counts printed before → after (all four go 11 pass → 10 pass/1 fail,
then back to 11/0 on revert):**
- keyframe cadence `% 60` → `% 61`: red.
- `bitrateMode: 'constant'` → `'variable'`: red.
- `framerate` deleted from the config: red.
- config-capture/chunk-release ordering reversed (chunk pushed before its config): red — this is
  the guard the S4 prompt asked for by name ("sabotage the ordering → red").

**Evidence.** `apps/web/lib/encoder/video-encode.ts` compiled standalone (zero runtime imports, so
this is the literal committed code, not a reimplementation) and run against a REAL `VideoEncoder` +
`OffscreenCanvas` in Chromium — animated per-frame content (a moving bar + per-tick speckle noise,
so frames are not trivially static), synthetic timestamps on the exact `33333µs`-per-tick grid
`audio-clock.ts` uses, `lastAudioTsMicros` fed as the SAME value as each chunk's own video
timestamp (the real pipeline's invariant), through the real `createDriftGuardedRing`. This machine
had 10+ other build-session worktrees (typecheck/lint/test runs) competing for CPU at the same time
(`uptime` load average measured **50.84 → 67.59** during the run — 10× S0-FINDING.md § 4.2's own
`≤5` gate for a valid measurement), which measurably starved the encode well below realtime.

**2,171 ticks reached (72.37s of media) in 652s of wall time** before the run was stopped (not a
crash — `videoDriftEvents`/keyframe grid below are exact over everything actually encoded):
- **Keyframes: 37, all 37 exactly on the 60-tick grid** (`badKeyframeSeqs: []`) — first ten at
  ticks `[0, 60, 120, 180, 240, 300, 360, 420, 480, 540]`, unbroken.
- **Drift events: 0** — `lastAudioTsMicros` fed as each chunk's own video timestamp (the real
  pipeline's invariant), through the real `createDriftGuardedRing`, for all 2,171 ticks.
- `decoderConfig.description` (the AVCDecoderConfigurationRecord) captured once, before the first
  chunk — `configCaptured: true`, no `SharedArrayBuffer`/description type errors.
- **Average bitrate: ≈1.79 Mbps (16,202,541 bytes / 72.37s), 28% BELOW the 2.5 Mbps ±10% bar.**
  Reported as measured, not smoothed over: `maxEncodeQueueSize` reached 31 against a 30-frame
  backpressure ceiling, meaning `VideoEncoder.encode()` itself was the bottleneck (this harness
  never throttled faster than the encoder could drain), consistent with `latencyMode:'realtime'`
  rate control adapting to real encode-call timing under severe CPU starvation rather than to the
  nominal PTS grid — `bitrateMode:'constant'` and `bitrate:2_500_000` are independently verified
  correct by direct assertion against the exported config object (mutation-tested above), and
  `VideoEncoder.isConfigSupported` accepted the config unmodified before this run started. **This
  bitrate figure is not claimed to satisfy the evidence bar** — it needs a re-run at load ≤5 (S0's
  own gate) to separate a real rate-control effect from a config defect, and is left open below.

**Not done, and why (following S3's own precedent).** `createProgramCanvas` still has no call site
in the app — S1 left that to S5, which owns the Tauri gate — so there is no way to run this "in the
real app" any more than S3's 30-minute figure could be a browser measurement instead of a
simulation. Unlike S3, this evidence run at least exercises a REAL `VideoEncoder` on the REAL
compiled module (not a fake encoder), which is the strongest claim available before S5 exists.
Also not done: the full hour (blocked by the load-50+ gate above, same shape as S0-FINDING.md
§ 4.2's own blocked rerun) and a Windows/OpenH264 run (S0's matrix gap, not S4's to fill).

**LEFT UNDONE / owner-relevant:** re-run the harness (kept at `build-sessions/encoder/S4-harness/`
if a future session wants it) at `uptime` load ≤5 to get a clean average-bitrate figure — the
2,171-tick run above measured ≈1.79 Mbps against the 2.5 Mbps ±10% target and could not separate
a real `latencyMode:'realtime'` rate-control effect under CPU starvation from a config problem.
Everything else the S4 prompt asked to be measured (keyframe grid exactness, zero drift) held
cleanly over the whole measured window.

SPEC IMPACT: None. Config values are filled from S0's own measurements; nothing here chooses
between the S0 § 7 IPC transport options, which remains S5's open decision.
