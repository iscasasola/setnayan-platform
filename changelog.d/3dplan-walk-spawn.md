## 2026-07-08 · fix(plan3d): walk-around spawn clamped into the room

- `walkSpawnPoint` now guarantees an in-room spawn even when the disc expulsion fights a wall: if the radial push out of a table/dance-floor/buffet disc would eject the spawn through a wall (disc overlapping the doorway or a wall-adjacent table), the containing discs are re-expelled toward the room centre and the result is clamped into the rectangle — the walker can no longer drop into the black void the spawn logic exists to prevent.
- Cameras strictly inside the room but within the 0.4 m near-wall band no longer cross-room teleport to the entrance: the doorway spawn is reserved for cameras genuinely outside the rectangle; near-wall insiders keep their spot, nudged ≤ 0.8 m off the wall.
- Four new unit tests pin the doorway-disc, wall-adjacent-disc (both clamp and inside branches), and near-wall-keep-your-spot cases.

SPEC IMPACT: None (behavior fix within 0008 3D lab; no spec claim changes)
