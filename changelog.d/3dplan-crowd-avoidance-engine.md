# feat(seating-3d): avoidance engine v2 — true footprints, chair discs, spatial hash, predictive separation

## 2026-07-08 · feat(seating-3d): true table footprints, chair discs, spatial hash, predictive separation

Owner-locked mechanic (a) for the 3D plan crowd: walkers must dynamically avoid
PEOPLE (including moving ones), TABLES (true footprints — corners were getting
clipped), and CHAIRS (with seated guests). Pure math in `lib/seating-3d.ts`,
fully unit-tested; consumers keep working unchanged on the shared `{ c, r }`
obstacle disc type.

- **True table footprints** — `tableFootprintDiscs(table, room)`: banquet /
  family-head tables become a 3–4-disc capsule along their axis (end caps wrap
  the corners the old single bounding disc left clipped, while the short axis
  stays tight enough to keep aisles walkable), serpentine strings 5 discs along
  its band centreline (the concave pocket is finally walkable), round /
  sweetheart keep one disc. Discs compose through table rotation via the same
  `rotateLocal` the mesh uses. `floorObstacles` now emits these per table;
  skipping a table id skips all of its discs.
- **Chair discs** — `chairObstacles(table, room, { destinationSeat })`: one
  0.30 m disc per non-removed chair (occupied or not — seated guests are
  covered by their chair's disc), excluding the walker's own destination chair
  and anything in its approach corridor (`inSeatApproachCorridor`, exported) so
  sit walks still reach their hand-off spot.
- **Spatial hash** — `buildObstacleGrid` / `obstaclesNear` (~1.5 m cells):
  `pushOutOfDiscs` and `steerPath` accept an `ObstacleGrid` in place of the
  array and only visit nearby discs, in insertion order — grid results are
  bit-identical to brute force (parity-tested). ~170 discs for a 15-table /
  150-guest room stay phone-cheap.
- **Predictive separation** — `separateAgents` v2: agents may carry a `vel`;
  nearby pairs are compared 0.4 s ahead and steered apart early with a
  right-hand bias (pass-on-the-right, breaks the mutual-mirror head-on
  deadlock). The v1 same-frame overlap push is retained verbatim as the hard
  fallback; the old `Vec2[]` signature still works (reactive-only).
- Tests: banquet corner-graze regression (steer + per-frame re-clamp never
  enters the rotated tabletop), chair-disc exclusions, head-on pass-right sim
  with a reactive-deadlock counter-proof, grid/brute-force parity on seeded
  random scenes. The existing chord-regression guarantee test is untouched and
  green (1109/1109 unit tests pass).

SPEC IMPACT: None (implements the already-logged crowd-avoidance mechanic; no
SKU/pricing/product-surface change).
