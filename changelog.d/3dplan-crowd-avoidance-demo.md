# feat(plan3d): demo/phone surface consumes the avoidance engine v2

## 2026-07-08 · feat(plan3d): demo walk + roam avoid chairs and true footprints

Wires the avoidance engine v2 (`lib/seating-3d.ts` — true footprints, chair
discs, spatial hash, predictive separation) into the shared read-only demo
renderer (`app/_components/plan3d/plan3d-scene.tsx` — the homepage 3D Plan
overlay + the phone guest walk), across its three walking seams:

- **Scripted "Where am I seated?" walk** — both the path steer AND the
  per-frame chord re-clamp now carry true multi-disc table footprints
  (banquet corners count) plus a disc per chair, with the destination chair +
  its approach corridor excluded via the shared `chairObstaclesForWalk` (the
  same filter the couple lab uses, so the two surfaces can never disagree).
  The clamp still drops the destination table's footprint (its avoidance ring
  contains the sit hand-off point) but keeps the chair discs — the final
  metre can no longer clip a neighbouring seat back. Both sets pre-hashed
  into `ObstacleGrid`s.
- **Free roam** — every floor tap, booth walk-to, and the mode's step-in
  steer + clamp against one spatial-hashed grid of footprints + EVERY chair
  (occupied or not — a seated guest is covered by their chair's disc) +
  fixtures, built once per scene (all inputs are static props on this
  surface, so there are no per-frame rebuilds for `quality` to gate). The
  gold own-seat tap builds dest-aware grids instead (own chair + corridor
  excluded; dest footprint dropped from the clamp) so arrival isn't shoved
  off the chair.
- **Predictive separation, slice-8 ready** — the single Walker now tracks its
  realised per-frame velocity (delta-divided, frame-rate independent) and
  enters `separateAgents` in the `{pos, vel}` form against a documented
  `REMOTE_MOVERS` hook (empty today, pass skipped; hard cap
  `MAX_ROOM_MOVERS = 8` for the phone budget), so shared-room remote players
  drop straight in. Velocity history resets per walk so reduced-motion
  teleports never read as a phantom dodge.

The load-bearing per-frame `pushOutOfDiscs` re-clamp stays LAST (after
sampling and separation) and gains grid + `inflateR` body-radius form — same
math as the old pre-inflated disc copy. QR guest-click targets, the chase cam
(incl. the slice-2 continuity fix), the sit hand-off at the approach point,
seated persistence, and reduced-motion completion are all preserved.
1110/1110 unit tests green incl. the chord-regression suite; typecheck +
`next lint` clean.

SPEC IMPACT: None (implements the already-logged crowd-avoidance mechanic on
the demo surface; no SKU/pricing/product-surface change).
