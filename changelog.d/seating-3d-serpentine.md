## 2026-06-25 · fix(seating-3d): render serpentine tables as the real curved band

Owner bug report ("the serpentine tables are not correct on the pro seatplan").
In the 3D lab a serpentine table rendered as a small flat **box** with chairs in
a full **circular ring** around it — because `tableDims` treated serpentine as a
rectangle while `chairLocalPositions` lumped it in with `round`. Neither matched
the canonical 2D serpentine, which is ONE 104° curved quarter-donut ribbon
(2026-05-09 lock).

- **`lib/seating-3d.ts`** — new `serpentineBand()` (cached, capacity-independent
  outline + curvature centre + bbox, in metres) and `serpentineChairs(capacity)`
  reproduce the canonical wedge: inner radius 0.95 m, outer 1.55 m, 104° sweep,
  outer-first fill (1→1+0 · 2→2+0 · 3→2+1 · 4→3+1 · 5→3+2). Chairs ride the convex
  OUTER arc (facing inward onto the band) and concave INNER arc (facing outward),
  each carrying an explicit `faceY` so inner/outer chairs orient opposite ways.
  `tableDims('serpentine')` now returns the band's real bbox; `chairLocalPositions`
  routes serpentine to the arc layout (so walk-to-seat targets land on the real
  chairs too, not a phantom ring).
- **`seating-lab-3d.tsx`** — `TableMesh` extrudes the band outline into a curved
  3D ribbon (laid flat, floor → 0.74 m) instead of a box; chairs use the per-chair
  `faceY` instead of `atan2`-to-origin; the single centre vase is skipped for
  serpentine (its visual centre falls in the concave gap off the ribbon).

No DB, no schema, no new SKU — pure client geometry. The 2D editor's serpentine
(the source of truth) is untouched.

SPEC IMPACT: 0008 Seating — 3D serpentine now matches the 2D canonical wedge.
