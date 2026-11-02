## 2026-06-22 · feat(seating-3d): monogram on the stage backdrop (altar) too

PR3 of the 3D-monogram rollout (floor medallion #1998, Play-settle bloom #2065).
The couple's mark now also appears on a **stage backdrop** — a vertical plane just
behind the stage, facing the room/camera — so the 3D scene carries the mark on the
two iconic wedding spots: the dance-floor (the floor medallion) AND the altar (this
backdrop).

- Generalized `FloorMonogram` → `MonogramPlane` (added `position` + `rotation`
  props); the floor renders it with the existing floor transform, and a second
  instance renders the backdrop. The backdrop reuses the SAME `CanvasTexture`
  (one rasterize) and the SAME paid-ANIMATED_MONOGRAM bloom (both planes bloom in
  together on Play-settle). Backdrop size = `min(stageW, 2.2)`, sat above the
  stage, z-clamped to stay inside the back wall.
- Free events: both planes render static (unchanged). The floor render is
  behaviorally identical to #2065 (just explicit position/rotation now).

Flag-gated (`NEXT_PUBLIC_SEATING_3D`). No DB, no new SKU.

SPEC IMPACT: None (0008 seating + 0037 monogram). Rollout progress in
`DECISION_LOG.md`.
