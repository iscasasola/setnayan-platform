## 2026-06-26 · fix(seating-3d): placement rules + stage-size sync (4 walk-through items)

Owner walk-through feedback. All four are deterministic, so they ship with tests.

- **Stage-size bug** — `DEFAULT_ROOM` was `18×12`, but the 2D editor's free-board
  default venue is `20×30` (`venue_width_m ?? 20` / `venue_length_m ?? 30`). On a
  board with no venue size set, the 3D scaled the stage (esp. depth: 12 vs 30)
  off a different room → "the stage didn't follow the 2D size." Aligned to `20×30`.
- **Placement rules** — new pure `checkPlacement(cand, others, stage, dance)`
  (unit-tested): objects can't overlap each other · no tables on the dance floor ·
  only a SWEETHEART table may sit on the stage. Wired into the 3D lab's
  `commitDrag`: an illegal drop is reverted (the mesh eases back to its stored
  spot) and the reason is surfaced as a notice.
- **`lib/seating-3d.test.ts`** — +2 cases (12 total): DEFAULT_ROOM = 20×30, and
  the overlap / dance / stage-sweetheart rule matrix.

Scope: rules enforce on 3D-lab table DRAG (the main placement gesture). They reuse
one pure check, so the 2D editor + tap-to-place + venue-object drag can adopt it
next. The remaining walk-through item — game-pad walk feel — is PR #2230, awaiting
preview tuning.

SPEC IMPACT: 0008 Seating — placement legality + 2D/3D stage parity.
