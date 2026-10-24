## 2026-10-25 · perf(hub-veil): the lift and the falling petals run at 60 fps in WebKit — the cloth solver as two small typed functions

After #6870 the veil's LIFT still lagged. Measured with the same harness (390×844 · DPR 3; Chromium CPU ×4 and
Playwright WebKit, the iPhone engine), on live `/cale-ice` as a guest, swapping in the veil module under test:

- In WebKit the cloth step took ~2.5 ms a frame while the veil hung closed and ~25 ms a frame the moment it lifted —
  relaxation 2 → 18 ms, strain clamp 0.5 → 6.5 ms — for the same arithmetic. Chromium stayed flat. An isolated veil
  with no page at all showed the same 60 → 30 fps cliff, so the page was not the cause: removing every `:has()` rule,
  pausing every CSS animation, or pausing the cover video on the live page each left WebKit at ~31–38 fps.
- The solver now lives in `lib/veil-cloth.ts` as `relaxPass` · `clampPass` over flat typed constraints
  (`buildGridConstraints`), instead of inline in the sim's closure over ~9,700 `number[]` arrays. Bit-identical
  (`the-veil-lifts-at-full-speed.test.ts` keeps the old solver verbatim and compares every particle).

Before → after, live `/cale-ice`:

- WebKit, lift: 29.6 / 31.2 → 59.6 / 59.0 fps; dropped frames 121 / 126 → 2 / 6.
- WebKit, falling petals: 31.0 / 31.8 → 60 / 60 fps; dropped frames 187 / 191 → 0 / 0.
- Chromium ×4, lift: 45.7 / 54.2 → 54.9 / 55.3 fps; falling petals 55.7 / 62.3 → 65.3 / 66.3 fps.

Not changed (measured, not worth it): the page's un-wait restyle at the tap (~50–95 ms at CPU ×4) and the later
`:has()` re-match (~35 ms) — dropping all `:has()` rules or pausing all page animations did not move the lift's fps in
either engine. No worker / OffscreenCanvas needed.

SPEC IMPACT: None.
