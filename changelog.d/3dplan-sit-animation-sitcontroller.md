# 2026-07-08 · feat(plan3d): sit-controller — chair pull-back, turn, sit, tuck

The owner-locked sit-down choreography machinery for the 3D seat plan (builds
on the SeatPose geometry stage in the same branch):

- `instanced-chairs.tsx` — new detach-one-chair API: `detachChair(tableId,
  seatIndex)` zero-scales that instance (the existing `removedSeats`
  treatment) and returns its LIVE world transform (`{ x, z, yaw }`, from the
  mesh's matrixWorld so drag slide-lag is honoured); `restoreChair` un-hides
  it. Tables opt in via a new optional `tableId` prop — the public component
  API is otherwise unchanged. The per-instance matrix write is factored into
  one function shared by the layout pass and the imperative handle. Chair
  geometry buffers are now exported (`CHAIR_SEAT_GEO` / `CHAIR_BACK_GEO` /
  `CHAIR_SEAT_Y` / `CHAIR_BACK_LOCAL`) for reuse.
- `kit/active-chair.tsx` — `<ActiveChair>`: the single real animatable chair
  that replaces a detached instance, pixel-identical (reuses the exported
  module-scope geometry, keyed cached materials, same local composition).
- `kit/sit-controller.tsx` — `useSitController` (headless core) +
  `<SitController>` (wrapper that mounts the ActiveChair + figure group).
  Sit clip: chair pulls back 0.35 m / 350 ms ease-out → figure steps into the
  gap, shortest-arc turns to the seat gaze, stand→sit blends over 450 ms →
  chair + figure tuck forward together 0.3 m / 400 ms → a short damp settle
  closes the 5 cm pull/tuck asymmetry so the handoff to the flush instanced
  chair can't pop → `onSeated()` fires once; unmount restores the instance.
  Reverse clip (`mode: 'stand'`, for future swaps): untuck → rise → chair
  returns → `onStood()`. Reduced motion snaps to the end-state, never
  detaches, and still fires every completion callback. All easing is
  frame-rate independent (accumulated-delta phase clocks + the shared
  `damp(base, delta)`); timings exported as `SIT_TIMING`.

Pure rendering + pure math — no server actions, no DB, no PII changes. No new
dependencies. Nothing is wired into scenes yet; the integration slice adopts
`<SitController>` at the walk-arrival call sites.

SPEC IMPACT: None
