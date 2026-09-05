## 2026-09-05 · feat(encoder): S1 — the program output composited on an OffscreenCanvas in a worker

Encoder program S1 (`build-sessions/encoder/README.md`). New `apps/web/lib/encoder/`:

- `program-strings.ts` — the pop-out's card copy (no-signal label, the withheld card, the
  pinned-channel notice) exported once; `app/panood/program/[eventId]/program-surface.tsx`
  now reads the same constants, so the canvas and the DOM surface cannot drift apart.
- `program-plan.ts` — the PURE composition planner: `ProgramFrame` (wire form) → draw ops.
  Mirrors the shipped surface branch for branch: refused source → withheld card; primary +
  secondary → split at `clampSplitRatio`; primary → full frame (object-contain); no stream →
  the no-signal card with `frame.label` (`EMPTY_FRAME` → "Nothing on program yet").
  `requestedSource ≠ source` (with `air.enforced`, exactly the pop-out's `cutWithheld`
  clause — a null `air` draws no notice on either surface) → the pinned-channel notice over
  the picture. `frame.overlay` is
  never read: there is no overlay/watermark op kind at all (rule 18 — the legacy paywall is
  retired on this path). Overlays are S2's; a named hook is left, not drawn.
- `program-compositor.ts` — holds the latest decoded `VideoFrame` per slot, runs the plan
  against an injected painter on every tick, and REPEATS THE LAST COMPOSITE when no new frame
  arrived (never a gap, never a frozen tick). A null stream or a track swap drops the held
  frame, so the previous camera can never leak through the placeholder.
- `program-clock.ts` — the 33.3 ms worker tick, anchored to the grid `origin + n × interval`:
  a late callback shortens the next wait, a very late one SKIPS the missed slots (never a
  burst of same-instant ticks — S4 would encode them as duplicates). Stats carry the worst
  gap, when it ended, and `longGaps` (inter-tick gaps > 2 ticks, counted) — the evidence
  number. `// S3 replaces this tick with the AudioContext-derived clock` (also at the draw
  loop in the worker).
- `program-canvas.worker.ts` — owns a 1280×720 `OffscreenCanvas`; takes the on-air track as a
  transferred `MediaStreamTrackProcessor.readable` (Chrome) or a transferred cloned track it
  wraps itself (Safari: worker-only). Posts frame stats once a second.
- `program-canvas.ts` — main-thread controller: subscribes to the SAME-WINDOW bridge
  (new `resolveLocalProgramBridge` in `lib/panood-program-bridge.ts`), re-resolves on a timer
  exactly like the pop-out, forwards wire frames and track changes, exposes
  `start() / stop() / onFrameCount()`. No `window.__TAURI__` gating here — that is S5's call
  site.

Tests: draw-call-log assertions over synthetic frames (chosen over `@napi-rs/canvas` pixel
tests — the planner is pure and the painter is a seam, so the log IS the contract).

Resumed 2026-09-05 after the authoring session was killed before its first test run: four
tests failed on first run (float grid at 1000 ms, letterbox arithmetic, the Tauri-gate guard
matching its own comments, and the clock's catch-up burst, which was a real design fault),
plus the `air === null` divergence from the pop-out. All fixed above.

Occluded-run evidence — METHOD. Not the Tauri app (the desktop shell loads the remote prod URL
and the call site is S5's): a harness page bundles `lib/encoder/program-canvas.ts` + the worker
with esbuild, publishes a `canvas.captureStream(30)` track through `installProgramBridge`, and
runs in Playwright's bundled Chromium 148.0.7778.96 launched BY HAND over
`--remote-debugging-pipe` with no automation switches — Playwright's own launcher passes
`--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows` and
`--disable-renderer-backgrounding`, and with those present the tab never reported `hidden`
(measured), so such a run would prove nothing. Occlusion = a cover tab in front AND the window
minimised via `Browser.setWindowBounds`; `document.visibilityState === 'hidden'` confirmed at
the start and on every sample. Every number below is the WORKER's own (its `performance.now()`,
its tick counter, its gap accounting), read after un-occluding so the page — whose message
handler is itself throttled while hidden — could drain the worker's queued stats messages.
`repeated` is high by construction: the source canvas's page-side redraw timer is throttled
while hidden, so that is the repeat-last-frame path running, not a defect.

**The criterion — 10 minutes fully occluded, no gap > 2 ticks — was NOT met in any plain-browser
configuration on this macOS 26 machine, and the reason is the OS/browser suspending the process,
not the tick.** Harness: the real `program-canvas.worker.ts` + `createProgramCanvas`, bundled with
esbuild, `longGaps` counted per tick inside the worker.

- Run 1 · embedded Chromium 148 pane, tab `hidden` throughout (never occluded on screen), 627 s:
  0–300 s clean at 30 ticks/s (2 long gaps, both while this session ran CI lint scripts on the
  same box); from **301 s — five minutes hidden — gaps > 2 ticks every second, then a 37.5 s
  freeze (1125 ticks) at 536 s**; stats messages froze with it. Final: 17,254 ticks, 130 long
  gaps, max 1125.2 ticks. Chromium's hidden-tab freezing at the 5-minute mark suspends the
  worker with the page.
- Run 2 · real windows, apps hidden via System Events (`visibilityState: hidden`), 229 s until
  both windows were made visible and the tabs closed:
  · Safari 26.6.2 (WebKit — the macOS delivery engine; worker-side `MediaStreamTrackProcessor`
    path exercised, no errors): **0.4–4 ticks/s from 2 s in, one 210 s gap**, 71 long gaps.
  · Chrome 151: 30 ticks/s for 35 s, then degrading (1–25 ticks/s), a 21 s gap at 171 s,
    256 long gaps. Both are the App Nap / process-suppression profile of an app with no visible
    window.

What S1 proves: the tick and repeat-last-frame hold whenever the process is scheduled (30/s,
`lastDelta=30` in 506 of 589 one-second samples in run 1, 30.0/s the moment Safari's window
became visible). What it cannot: keep a suspended process running. That is S10's item —
"throttling · keep-awake" in the README (Tauri `background_throttling` policy for WKWebView,
`NSAppSleepDisabled` / a `ProcessInfo` activity assertion, WebView2's equivalent) — and until
S10 lands, the rehearsal script's "do not minimise, do not close the lid" is load-bearing.
The acceptance run (S13) must re-measure this inside the signed Tauri app, not a browser.

Next concrete step (S2): install `setOverlayHook` on the compositor and draw `ResolvedOverlays`
from `airOverlays` into the painter after the program picture; nothing else in S1 changes.

SPEC IMPACT: None (implements `Live_Studio_Encoder_Scope_2026-09-03.md` § Corrections
2026-09-05 / S-series README; no decision changed).
