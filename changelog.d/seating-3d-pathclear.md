## 2026-06-25 · feat(seating-3d): walkers clear the stage + dance floor, not just tables

Owner directive ("we do not want the guests … crossing across objects"). First
increment of the Populate-Play crowd work: the walk path now treats **every fixed
object** as an obstacle, and actually clears it.

- **`lib/seating-3d.ts`** — new `floorObstacles(floor, tables, room, skipIds)`:
  one avoidance disc per non-skipped table PLUS the stage and (when enabled) the
  dance floor. Centralised so the single walk path, the swap animation, and the
  coming crowd populate-Play share one obstacle source — and vendor booths drop
  in here later as just more discs.
- **`steerPath`** gained a **hard-clearance** pass: after the soft repulsion +
  smoothing, any interior waypoint still inside a disc is projected to its edge
  (with a perpendicular side-step for the degenerate "dead-centre" case a unit
  test surfaced). Soft repulsion alone under-corrected for big discs like the
  stage, so walkers grazed through them; now they bend around.
- **`seating-lab-3d.tsx`** — both path builders (walk-to-seat + swap) use
  `floorObstacles`; removed the now-dead inline table-only obstacle maps.
- **`lib/seating-3d.test.ts`** (new) — 4 node:test cases: obstacle composition
  (skip dest, always-stage, dance-only-when-enabled, multi-skip) + the
  hard-clearance invariant (no interior waypoint stays inside a disc).

Next increments of #1: populate-everyone Play (the whole list walks in at once)
+ inter-agent yielding ("make way for each other").

SPEC IMPACT: 0008 Seating — 3D walk paths clear all fixed objects.
