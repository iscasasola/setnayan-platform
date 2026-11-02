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

**Occluded-run evidence — STATUS AT CLOSE (overseer decision, 2026-09-05): PROVISIONAL.** The
run this close is signed against: in a genuinely hidden tab in plain Chromium 148 the worker
tick throttled to ~6–13 ticks/s with a 9.5 s worst gap, measured while the unit suite was
loading the same machine — so CPU contention and occlusion are CONFOUNDED in that run and the
magnitude cannot be attributed to either alone. The direction is corroborated in a second
engine (an independent earlier run in hidden Safari: ~10 ticks/s, 51 long gaps in 10 s), so the
DIRECTION is corroborated even where the magnitude is confounded. This is a browser proxy, not
the Tauri app, and cannot settle the real question either way; a second run to separate load
from occlusion is deliberately NOT part of this PR — S13's 10-minute minimise test on both OSes
from the real installers is the measurement that decides it. The worker design is NOT proven
immune to background throttling and this PR does not claim it is; `program-clock.ts`'s
docblock now says exactly that. The run logs above were recorded by the earlier sessions of
this program and are kept as recorded, not re-verified at close. Independent S0 corroboration
of the worker placement (separate from throttling): in the real Tauri webview
`MediaStreamTrackProcessor` is undefined on the window but present in a worker.

**Occluded-run evidence — RESOLVED at close (second finisher, same day): the confound above
IS separated, and it is the visibility state.** Same harness (real `program-canvas.worker.ts` +
`createProgramCanvas`, esbuild-bundled), but Chromium 148.0.7778.96 launched BY HAND over
`--remote-debugging-pipe` with no automation switches — Playwright's own launcher passes
`--disable-background-timer-throttling` / `--disable-backgrounding-occluded-windows` /
`--disable-renderer-backgrounding`, and with those present the tab never reported `hidden`
(measured), so a Playwright-launched run proves nothing. Every number is the WORKER's own
(its `performance.now()`, tick counter and gap accounting), read after un-occluding so the
page — whose message handler is itself throttled while hidden, lagging the worker by up to
8.4 s — could drain the worker's queued stats. `longGaps` = inter-tick gaps > 2 ticks
(66.7 ms). S0's Tauri probes ran throughout (load avg 12–40 on 10 cores):

| run | occlusion | window (worker time) | ticks/s (ideal 30) | longGaps | worst gap |
|---|---|---|---|---|---|
| 4 · CONTROL | none — tab visible | 180 s | **30.0** (5400/5400) | **0** | 43 ms |
| 3 | tab `hidden`, window on screen | 180 s | 21.6 | 381 | 1.35 s |
| 2 | tab `hidden` + window minimised | 540 s | 26.0 | 635 | 8.4 s |
| 1 | as 2, under the full unit suite | 210 s (killed at a turn boundary) | ~9.7 | 394 | 9.5 s |

Run 2 per-second tick-rate histogram: 320 s at 29–30/s · 72 s at 25–29 · 104 s at 15–25 ·
32 s at 5–15 · 3 s below 5. The control, under the same load, is 180/180 s at 29–30/s. So the
worker tick is throttled by the page's visibility even when the process is scheduled and the
machine is busy either way; the earlier runs' App-Nap / hidden-tab-freeze suspensions sit on
top of that. Consequence unchanged in kind, stronger in force: the 33.3 ms worker `setTimeout`
is a scaffold; S3's audio-thread clock is required, not merely planned; S10's keep-awake and
S13's real-installer minimise test remain the shipped-app measurement. Harness and every stats
message: this session's scratchpad `harness/{page.ts,run-raw.cjs,cdp.cjs,analyze.cjs}` and
`run{2,3,4}.final.json`. The four guards are untouched by all of this — they decide what is
drawn, not when — and repeat-last-frame did its job on every tick that fired.

Proof recorded at close (S1 gate; not re-run):
- Typecheck scoped to `apps/web`: `TSC_EXIT=0 ERROR_LINES=0 elapsed=11s` (incremental, warm
  tsbuildinfo). Falsifiability probe — a deliberate error gave `TSC_EXIT=2 ERROR_LINES=1`, so
  the check CAN fail.
- Encoder tests: 37 passed, 37 total.
- Five mutations (occurrences before → after · encoder-suite result):
  - M1a planner `const hasPrimary = frame.hasStream;` 1→0 → 34/37, 3 red incl. "null stream →
    no-signal card, NO video op"
  - M1b compositor `if (!wire.hasStream) this.dropHeld('primary');` 1→0 → 36/37, red "previous
    camera's frame is CLOSED, not kept"
  - M2 `requestedSource !== source` → `===` 1→0 → 35/37, 2 red incl. "pinned-channel notice
    OVER the permitted picture"
  - M3 inserted `kind: 'watermark'` 0→1 → 34/37, 3 red incl. "EMPTY_FRAME → no
    overlay/watermark op"
  - M4 `if (hasPrimary && hasSecondary)` → `if (hasPrimary)` 1→0 → 29/37, 8 red incl.
    "secondaryStream null → splitRatio IGNORED"

Next concrete step (S2): install `setOverlayHook` on the compositor and draw `ResolvedOverlays`
from `airOverlays` into the painter after the program picture; nothing else in S1 changes.

SPEC IMPACT: None (implements `Live_Studio_Encoder_Scope_2026-09-03.md` § Corrections
2026-09-05 / S-series README; no decision changed).
