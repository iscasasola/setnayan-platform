## 2026-09-06 · feat(encoder): programme audio, and the audio thread becomes the master clock (S3)

There was no programme audio at all. `git grep -n "AudioContext" origin/main -- apps/web/lib
apps/web/app/panood` returned only `mesh-call-webrtc.ts`'s talker analyser and
`reel-render.ts`'s music decode; the pop-out's idea of sound is unmuting the on-air `<video>`
(and in split mode, both of them). This is the mixing point the controller comments call
"phase 2".

**The mixer** — `apps/web/lib/encoder/audio-mixer.ts`. One `AudioContext({ sampleRate: 48000 })`
built on the go-live gesture. Every camera that has an audio track keeps a live
`MediaStreamAudioSourceNode` → its own `GainNode` at 0; a cut is a 5 ms
`linearRampToValueAtTime` on gains, never a rewiring, so cutting cannot change the latency the
on-air audio arrives with. A `ConstantSourceNode` at offset 0 is summed forever: a phone whose
owner refused the mic contributes no node, and a graph with no inputs renders no quanta — the
tap would stop, the clock would stop, and the stream would die on a cut to a mic-less phone.
Split mode takes PRIMARY only. The laptop mic is not an input (no `getUserMedia` anywhere in
the encoder; the test asserts it against comment-stripped source). A
`MediaStreamAudioDestinationNode` sibling carries the same mix for the B-remux fork the
S-series README marks at S3 — one node, one connect, unused on Path A.

**The tap** — `audio-tap.worklet.ts` (typed source) and `public/encoder/audio-tap.worklet.js`
(what the browser actually runs; `addModule()` fetches a URL and evaluates it as a module
script, so nothing under `lib/` can be in that path). `audio-tap.worklet.test.ts` loads the
shipped `.js` with the worklet globals stubbed and fails on the first sample where the two
disagree — the same anti-drift argument `csp-embeds-are-allowed.test.ts` makes about the CSP
list. Mono is duplicated to both channels rather than left half-silent; a dead input is a full
quantum of silence, never a stall. It posts each 128-frame quantum down a `MessagePort` whose
other end is in the canvas worker, so quanta never touch the page's event loop.

**The master clock** — `audio-clock.ts`, replacing S1's `program-clock.ts` (deleted; nothing
else imported it, and leaving a timer clock in `lib/encoder` invites the failure S1 measured).
Its measured numbers are carried into the new file's docblock, because they are the reason it
exists: a worker `setTimeout` tick ran at 26.0 ticks/s with 635 gaps > 2 ticks in 540 s, worst
8.4 s, once the window was minimised. `program-canvas.worker.ts` now has no `setInterval`, no
`requestAnimationFrame` and no `setTimeout` at all — a guard asserts the count is zero against
comment-stripped source. Stats are posted every 30 ticks, i.e. one second of MEDIA time.

Both timelines descend from one integer, the count of audio frames rendered:
`slot = ⌊frames / 1600⌋`, `PTS = round(frames × 1e6 / 48000)`. Two corrections to the S3 brief
fell out of writing it, both pinned by assertions rather than prose:

- **the tick is every 12.5 quanta, not 12.8.** 128 × 12.8 = 1638.4 frames = 29.3 fps, and a
  fractional frame count. `48000 / 30 = 1600` divides by 128 exactly, so there is no fraction
  to accumulate if you count frames instead of quanta.
- **`AudioData.timestamp` deltas cannot be "=== 1024/48000 s".** That is 21333.3̄ µs and
  WebCodecs timestamps are integer microseconds. The guard asserts the true invariant instead:
  every delta within 1 µs of nominal AND every absolute stamp exactly on
  `round(n × 1024 × 1e6 / 48000)`. The per-packet `+= 21333` an "equal deltas" reading invites
  ends a six-hour wedding 337.5 ms behind.

**Audio encode** — the worker packs 1024 frames into `AudioData{ f32-planar, 48000, 2 }` and
feeds `AudioEncoder{ mp4a.40.2, 128 kbps }`, capturing `decoderConfig.description` (the
AudioSpecificConfig) from the first chunk and posting it once as `audio-config`. That is the
`asc` half of `ChunkKind::Config` in `src-tauri/crates/encoder/src/contract.rs`; S4/S5 ship it
to Rust.

**Evidence.** 30 minutes of media, 180 cuts (every 10 s) between two phones one of which has no
mic, driven through the real tap, real packer and real clock against a fake Web Audio engine
that models the one rule that makes the graph's shape load-bearing — a node is pulled only when
an active source reaches it AND it reaches the context destination. 84,375 AAC frames, 54,001
pictures, zero timestamp discontinuities across all 180 cuts, worst delta error 0.667 µs.
Video-against-audio skew is reported as two numbers because one hides which is which: STAMP
skew (newest video PTS vs the newest AAC frame's start) is pure quantisation of a 33.33 ms grid
against a 21.33 ms one and sits at exactly 40.000 ms — reached in the first seconds and
identical in minute 29, which is the actual no-drift claim; COVERAGE skew (newest video PTS vs
how far the audio timeline has been written) maxes at 18.667 ms, under the brief's 40 ms bar.

**Not done, and why:** the brief's "30-minute run in the real app" could not be run —
`createProgramCanvas` has no call site anywhere in the app (S1 deliberately left it to S5, which
owns the Tauri gate), so there is nothing to mount and no cuts to make. The 30-minute figure
above is a deterministic simulation of the arithmetic, not a browser measurement. The browser
run belongs to S5 when the encoder is first mounted, and to S13's acceptance.

**Open for S5:** `AUDIO_TAP_MODULE_URL` is `/encoder/audio-tap.worklet.js` and `workletUrl` is
an injectable dep, so a bundler-emitted asset can win later. And `audio-mixer.ts` deliberately
subscribes to nothing: `ProgramBridge` publishes only the streams that are already cut, and a
mixer fed from it would hold exactly the cameras that do not need pre-connecting. The call site
hands it the controller's full camera set via `setCamera`, then `cut()` on every bridge frame.

**Mutation-tested, occurrence counts printed before → after:** removing `constant.connect(node)`
(1 → 0) turns 3 tests red, including "every camera mic-less: AudioData still flows" · replacing
the absolute `framesToMicros(frameIndex)` stamp with an accumulating `packetIndex * 21333`
(1 → 0) turns 2 red · putting a `setInterval` back in the canvas worker (0 → 1) turns the
no-timer guard red · `plan[key] = key === onAir ? 1 : 0` → `plan[key] = 1` (1 → 0) turns the
one-camera-up guard red. Cutting the muted `Gain(0) → ctx.destination` leg is exercised inside
a test rather than by hand: rendering stops dead, which is the browser's actual behaviour and
the reason that line is not decoration.

The worker rebuilds its packer and clock on `start` (`resetAudio`). `createProgramCanvas`
terminates the worker on stop and builds a new one on start, so a second `start` on the same
worker cannot happen through its public API today — but both carry monotonic counters, and a
reused worker with a stale `lastSlot` would sit silent until the new context caught up to the
old one's frame count.

SPEC IMPACT: None. Path A is unchanged; the B-remux fork the S-series README marks at S3 stays
open at the cost of one `MediaStreamAudioDestinationNode`.
