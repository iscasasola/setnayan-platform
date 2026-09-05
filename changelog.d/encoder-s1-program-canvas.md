## 2026-09-05 · feat(encoder): S1 — the program output composited on an OffscreenCanvas in a worker

Encoder program S1 (`build-sessions/encoder/README.md`). New `apps/web/lib/encoder/`:

- `program-strings.ts` — the pop-out's card copy (no-signal label, the withheld card, the
  pinned-channel notice) exported once; `app/panood/program/[eventId]/program-surface.tsx`
  now reads the same constants, so the canvas and the DOM surface cannot drift apart.
- `program-plan.ts` — the PURE composition planner: `ProgramFrame` (wire form) → draw ops.
  Mirrors the shipped surface branch for branch: refused source → withheld card; primary +
  secondary → split at `clampSplitRatio`; primary → full frame (object-contain); no stream →
  the no-signal card with `frame.label` (`EMPTY_FRAME` → "Nothing on program yet").
  `requestedSource ≠ source` → the pinned-channel notice over the picture. `frame.overlay` is
  never read: there is no overlay/watermark op kind at all (rule 18 — the legacy paywall is
  retired on this path). Overlays are S2's; a named hook is left, not drawn.
- `program-compositor.ts` — holds the latest decoded `VideoFrame` per slot, runs the plan
  against an injected painter on every tick, and REPEATS THE LAST COMPOSITE when no new frame
  arrived (never a gap, never a frozen tick). A null stream or a track swap drops the held
  frame, so the previous camera can never leak through the placeholder.
- `program-clock.ts` — the 33.3 ms worker tick with drift correction and gap accounting.
  `// S3 replaces this tick with the AudioContext-derived clock`.
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

SPEC IMPACT: None (implements `Live_Studio_Encoder_Scope_2026-09-03.md` § Corrections
2026-09-05 / S-series README; no decision changed).
