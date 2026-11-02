# 2026-07-08 · feat(seating-3d): promote SeatPose with faceY + approachPoint

Seat FACING is now first-class in the pure geometry engine (`lib/seating-3d.ts`)
instead of a renderer-side afterthought:

- New `SeatPose { x, z, faceY }` — `faceY` is the seated guest's GAZE (radians,
  walkVector heading convention: yaw θ ↔ (sinθ, cosθ), toward the table), the π
  flip of the chair-mesh yaw the instanced renderer composes.
- `chairLocalPositions` returns `SeatPose[]` (structural superset of the old
  `Vec2[]` — every `{ x, z }` consumer untouched). Per shape: round gazes at
  the table centre (`atan2(−x, −z)`); serpentine bridges the untouched
  reference `SerpSeat.faceY` (+π, backrest → gaze); sweetheart fronts the room
  (+z); banquet/family rows gaze straight across by row sign.
- New `worldSeatPose` composes facing through the unchanged
  `rotateLocal`/`seatWorld` pipeline (world faceY = local faceY + table yaw);
  `seatWorld` now returns the full pose.
- New `approachPoint(seat, distM = 0.55)` — the spot a walker stands behind the
  chair before sitting (out along −faceY).
- 7 new unit tests: per-shape gaze parity, 90° rotation composition,
  serpentine reference regression (values pinned), approach geometry.

Pure math only — no render, server, DB, or PII changes. Groundwork for the
sit-down choreography slice.

SPEC IMPACT: None
