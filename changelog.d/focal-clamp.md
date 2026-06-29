## 2026-06-30 · fix(stories): clamp auto-reframe focal to the overscan-safe band (audit #3)

Prevents the dark-backdrop edge-reveal that Tier-2 auto-reframe could otherwise trigger. Before the `subject_center` producer/consumer (PR #2431), the focal was always centered, so the bug "couldn't fire." Now that a real, off-center `subjectCenter` flows to the render, a face near a photo's edge could pull the cover image's edge inside the frame on a pan/orbit, revealing the dark backdrop (the audit measured up to ~87px).

- `reel-render.ts`: new `safeFocal(move, subjectCenter)` wraps `resolveFocus` and clamps the focal into `[m, 1−m]` per axis, where `m` is derived from **this move's own envelope** (samples `cameraAt`): `m = maxPanFraction / (minScale − 1)`. Push/pull (no pan) keep **full** reframe; pans tighten exactly as much as their amplitude needs. Both render call sites now use it.
- Conservative: ignores beat-punch zoom (only adds headroom); does **not** yet account for the Tier-3 near-layer 1.6× pan amplification (depth is dormant — revisit when parallax ships).

**Tradeoff flagged for Vids AI:** stronger reframe on big pans needs more `BASE_OVERSCAN` (currently 1.16) — an aesthetic call. This PR only prevents the bug, it doesn't widen the look. Belongs with audit #9 (canvas/geometry unit tests) when that lands.

SPEC IMPACT: None — bug fix in the Stories render geometry. Context: `0012_papic/Papic_Walkup_Face_Identity_Plan_2026-06-29.md` § 10 (the focal-clamp folded into Tier-2 work).
