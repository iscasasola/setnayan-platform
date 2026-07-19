# feat(plan3d): couple-lab crowd + roam consume the avoidance engine v2

## 2026-07-08 · feat(plan3d): lab crowd + roam avoid chairs, people, true table footprints

Wires the avoidance engine v2 (`lib/seating-3d.ts` — true footprints, chair
discs, spatial hash, predictive separation) into the couple lab
(`app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx`), across
all three walking seams:

- **Crowd ("Walk everyone in")** — every agent's path AND per-frame obstacle
  set now include chair discs for every table (own destination chair + its
  approach corridor excluded via the new shared `chairObstaclesForWalk`) on
  top of the true multi-disc table footprints; both sets are pre-hashed into
  `ObstacleGrid`s so the per-frame re-clamp queries locally. The separation
  pass is upgraded to the predictive `{pos, vel}` form — each agent carries
  the velocity its last committed frame realised (divided by delta, so
  projection is frame-rate independent) and head-on pairs sidestep early,
  pass-on-the-right. Concurrent walkers capped at 24
  (`MAX_CONCURRENT_WALKERS`): later agents queue at the entrance and are
  released FIFO as walkers reach their approach point. The slice-2 sit-queue
  pinning, sit-slot budget (8 / 0.25 s), and reduced-motion completion
  contract are untouched.
- **Single walk-in** — `sendGuest`'s `seatApproachPath` obstacles gain the
  same chair discs + grid, so a picked guest weaves around seat backs and
  banquet corners on the way to their chair.
- **First-person roam (WalkController)** — the walk-mode clamp set becomes a
  spatial-hashed grid of true footprints + every chair + fixtures: the roaming
  couple cannot pass through chairs, seated guests, or table corners.

Engine addition: `chairObstaclesForWalk(tables, room, dest)` — the one shared
answer to "which chairs block this walk" (dest-table exclusions + neighbouring
corridor crowders dropped; unknown dest table degrades to all chairs),
unit-tested. Swap animations, selection/drag raycasts, single-editor lock, and
the sit choreography seams are preserved; the load-bearing chord-regression
test stays green (1110/1110 unit tests pass).

SPEC IMPACT: None (implements the already-logged crowd-avoidance mechanic; no
SKU/pricing/product-surface change).
