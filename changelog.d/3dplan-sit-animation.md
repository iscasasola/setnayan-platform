## 2026-07-08 · feat(plan3d): slice 2 — chair pull-back sit animation at every walk seam

The Fable program's owner-locked mechanic (b): a walker arriving at their seat no longer teleports onto the chair — the chair slides back, the figure steps in, turns, sits, and chair + guest tuck in together.

- `lib/seating-3d.ts`: seat FACING promoted into the pure engine — `SeatPose {x, z, faceY}` for every shape (round converges on centre, banquet rows square to the linen, sweetheart fronts the room, serpentine keeps its reference implementation), composed through table rotation via `worldSeatPose`, plus `approachPoint()` (7 new unit tests, 1071 total).
- `instanced-chairs.tsx`: detach-one-chair API — zero-scales the instance, hands back its world transform, restores on cleanup; chair yaw now derives from the promoted SeatPose (+π backrest bridge) so drawn chairs and sit choreography can never diverge (review fix — banquet end chairs no longer splay, sweethearts no longer cross inward).
- `kit/active-chair.tsx` + `kit/sit-controller.tsx`: the owner-locked sequence — chair back 0.35 m (350 ms) → step in + shortest-arc turn + stand→sit blend (450 ms) → chair + figure tuck 0.3 m (400 ms) — plus the reverse stand-up clip for future swaps; reduced motion snaps to seated and still fires completion.
- Lab: single walk-ins and "Walk everyone in" both end in sits (staggered, ≤8 simultaneous detached chairs, FIFO queue); queued agents pin at their approach point (review fix); a reduced-motion flip mid-walk still completes the crowd (review fix).
- Phone demo walk: retargets to the approach point, runs the sit, and only then shows "You're at <table>"; guests who completed their sit STAY seated after retarget/roam (review fix); consecutive walks ease the chase cam instead of hard-cutting (review fix); occupied-chair tinting matches the drawn instance exactly, incl. clamped/null seat numbers (review fix).

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (slice 2 shipped)
