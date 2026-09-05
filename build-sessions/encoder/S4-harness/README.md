# S4 evidence harness

`harness.html` runs the LITERAL compiled output of `apps/web/lib/encoder/video-encode.ts`
(zero runtime imports in that file, so this is a byte-for-byte copy, not a reimplementation)
against a real `VideoEncoder` + `OffscreenCanvas` in a real browser. It feeds synthetic
animated frames on the exact `33333µs`-per-tick grid `audio-clock.ts` uses, and simulates the
real pipeline's "video PTS and audio PTS come off one counter" invariant by handing
`createDriftGuardedRing` each chunk's own timestamp as the "last audio timestamp" too.

Serve it with any static server and open it — no build step, no Tauri, no camera/mic:

    python3 -m http.server 8945 --bind 127.0.0.1 --directory build-sessions/encoder/S4-harness
    open http://127.0.0.1:8945/harness.html

It runs to `TOTAL_TICKS_ONE_HOUR` (108,000 ticks = 1 hour of MEDIA time — not wall time; frames
are fed as fast as `VideoEncoder` will drain them, gated by `encodeQueueSize`) unless the tab is
closed first. Poll progress with `window.__s4` in the page's console — `tick`, `totalBytes`,
`keyframeSeqs.length`, `driftEvents.length` — or wait for the `DONE …` line the page logs (also
written into `#log`).

**Re-run this at `uptime` load ≤5** (the S0-FINDING.md § 4.2 gate) to get a clean average-bitrate
figure — see `changelog.d/encoder-s4-video-encode.md` for why the S4 session's own run, taken at
load 50–67, could not close that question.
