## 2026-07-22 · fix(reel-render): Personal Reels use a guest's full 10s clip at 1×, not half of it

Clip capture moved to a 10s / 7-point currency (#3501), but the client reel
renderer (`apps/web/lib/reel-render.ts`) still capped every CLIP slot at 5s, so
a guest who paid 7 points got footage the reel only half-used: the
music/`MediaRecorder` path played only the first ~5s at 1× (hard truncation),
and the no-music `WebCodecs` path stretched the whole 10s source across a 5s
slot (~2× fast-motion). Both paths now play a clip at 1× real-time up to its
slot's budgeted share of the reel.

**The design constraint, respected — budget the whole reel, don't just bump a
constant.** Personal Reels are still 1–30s total (max 5 guest + 5 couple clips);
10 clips × 10s would be 100s. So `CLIP_SLOT_MAX_SEC` rises 5 → 10 as a per-slot
CEILING only, while `buildBeatSchedule` keeps budgeting the WHOLE reel to
`durationSec`: each clip gets `min(10s, its own footage length, its fair share
of the budget)`. Many clips compete → each gets a smaller even/beat share (a 6-
clip 30s reel is still 5s each, sum 30); few clips → each can stretch toward
10s (a 1-clip reel now runs its full 10s instead of a 5s half). An all-clips
reel with too little footage ends a touch short rather than fast-motioning.

- **WebCodecs (no-music) path:** the per-frame seek now maps output frame `f` to
  source time `f/FPS` (1× real-time) clamped to the footage end, replacing the
  `(f/n)·fullSpan` stretch that caused fast-motion.
- **MediaRecorder (music) path:** already plays the `<video>` at 1×; the slot
  ceiling lift lets it run up to the full 10s instead of truncating at 5s.
- New per-source `slotMaxSec` ceiling (`min(10s, footageSec)`, ∞ for photos)
  passed by both paths via a shared `clipSlotCeilingSec` helper — a short clip
  never wins a slot it can't fill at 1× (no frozen tail), and budget isn't
  wasted on it. `normalizeToTotal` now respects per-source ceilings, not a flat
  5s.
- New optional `minSlotSec` FLOOR in the pure scheduler (default 0 = off) so the
  budgeter can honor a template minimum-slot duration when one is supplied —
  proven by a unit test. NO template declares one today (no such field on
  `RenderTemplate`/`StoriesTemplate`/the external `/template_library/*.json`
  manifests), so it is dormant; wiring a real per-template floor needs an owner
  decision on the schema field + an under-run policy and was NOT faked.

Tests: `lib/reel-render.test.ts` — updated the two 5s-cap assertions to 10s and
added coverage that a 10s clip now occupies >5s when the budget allows, that an
8-clip reel stays ≤30s total, that `slotMaxSec` caps a 3s clip at 3s, and that
`minSlotSec` honors a floor / drops trailing slots / stays ≤ budget. Renderer-
only; no capture/metering/face/embed code touched.

Note (out of scope, flagged for follow-up): `lib/stories-templates.ts` carries a
duplicate, still-inert `CLIP_MAX_SEC = 5` scaffold constant (nothing imports it
for rendering yet). Left at 5 to keep this renderer-only; it should be
reconciled to 10s when the Stories beat-slot builder is wired to the renderer.

SPEC IMPACT: None (implementation-only renderer fix). Iteration 0012 Papic /
0017 Patiktok / Guest Stories all render through this shared engine; the 1–30s
reel + 5-guest/5-couple-clip constraints and the 10s clip currency are
unchanged — the renderer now merely USES the full 10s a clip already provides.
Logged as a DECISION_LOG note, no locked-decision change.
