## 2026-06-26 · feat(seating-3d): whole-venue designer — placeable venue objects (foundation)

Owner direction ("make full use of this so our edit is not just a seat plan").
Foundation for turning the 3D seat plan into a full venue designer: the couple
will place NON-seating objects — ceremony arch, buffet, bar, cake/gift/
registration tables, photo booth, lounge, LED wall, greenery — so seating is one
layer of the whole space.

- **Migration `20270224150000_event_scene_objects.sql`** — `event_scene_objects`
  (kind + label + x/y_pct + rotation; couple-scoped RLS `current_couple_event_ids`,
  RLS at create time). Applied to `setnayan-prod`.
- **`lib/seating-3d.ts`** — `VENUE_OBJECT_CATALOG` (10 canonical kinds + footprints,
  kept in sync with the DB CHECK) · `VenueObjectKind` / `Lab3DSceneObject` types ·
  `venueObjectDims()` · `sceneObjectObstacles()` — maps placed objects to crowd
  avoidance discs, so the walk-in crowd already steers around the buffet/arch the
  same way it does tables (free reuse of `floorObstacles`/`pushOutOfDiscs`).
- **`lib/seating-3d.test.ts`** — +2 cases (10 total): catalog invariants + dims
  fallback, and the obstacle-disc mapping.

Next increment: the 3D render (an object mesh per kind, palette-themed) + the
add/move/delete actions + an "Add object" palette in the build HUD (positioned
via the existing place/drag) — the visual layer to verify on preview.

SPEC IMPACT: 0008 Seating — the 3D lab becomes a whole-venue designer.
