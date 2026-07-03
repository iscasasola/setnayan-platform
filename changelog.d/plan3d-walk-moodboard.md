## 2026-07-03 · fix(3d-plan): fluid walk that goes AROUND tables + "Apply mood board" theming

Owner report: the 3D Plan demo walk wasn't fluid, the guest walked *through* the
table instead of around it, and the room needed a mood-board toggle.

- **Walks around tables, not through them.** The walker followed the clamped
  path polyline but never re-clamped between waypoints, so the straight chord
  between two disc-edge waypoints dipped back inside the table. Now the sampled
  position is re-clamped out of every obstacle disc *every frame*
  (`pushOutOfDiscs`, the documented per-frame guarantee), carrying the avatar's
  body radius. New `seating-3d.test.ts` case proves it over the whole eased
  walk — and counter-proves the raw chords breach, so the re-clamp is
  load-bearing. `steerPath` also densified (22→40 samples) — a strict smoothness
  win shared by the couple lab + guest-venue walks too.
- **Fluid motion.** Speed-paced duration (constant ~1.45 m/s, not a fixed 5.2s
  regardless of distance), smootherstep ease at both ends, smoothed heading
  (shortest-arc lerp — no snap-turn at each waypoint), frame-rate-independent
  chase-camera damping, and a subtle walk bob.
- **Apply mood board toggle.** The scene now recolours from the couple's saved
  `role_palette` via `resolvePaletteFromRoles` — the SAME mapping the shipped
  couple-facing venue walk uses. Desktop overlay gets a default-on toggle
  (themed ↔ neutral); the phone walk arrives into the themed room.

SPEC IMPACT: None (demo polish; reuses shipped seating-3d + mood-board engines).
