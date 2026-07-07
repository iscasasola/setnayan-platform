# feat(plan3d): slice 3 — crowd avoidance v2 (chairs, people, true footprints, spatial hash)

## 2026-07-08 · feat(plan3d): walkers avoid chairs, seated guests, true table footprints — predictively, phone-cheap

Slice 3 of the 3D Plan build: every walking figure — the couple lab's
populate-Play crowd and first-person roam, and the demo/phone surface's
scripted "Where am I seated?" walk and free roam — now dynamically avoids
PEOPLE (including moving ones), CHAIRS (occupied or not — a seated guest is
covered by their chair's disc), and TRUE table footprints. Engine in
`lib/seating-3d.ts` (pure, unit-tested); consumers are
`app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx` and
`app/_components/plan3d/plan3d-scene.tsx`.

- **True multi-disc table footprints** (`tableFootprintDiscs`): a banquet /
  family-head is a 3–4-disc capsule (end caps wrap the corners the old single
  bounding disc left clipped), a serpentine strings 5 discs along its band
  (the concave pocket is finally walkable), round / sweetheart keep one disc.
  Composed through the same `rotateLocal` the meshes use — spun tables stay
  covered.
- **Chair + person discs** (`chairObstacles` / `chairObstaclesForWalk`): one
  0.30 m disc per chair; a seat-destined walk excludes its own destination
  chair + its approach corridor (`inSeatApproachCorridor`), shared by the lab
  and the demo so the two surfaces can never disagree.
- **Predictive pass-on-the-right** (`separateAgents` v2): agents carry the
  realised velocity of their last committed frame; approaching pairs are
  compared 0.4 s ahead and sidestep early with a right-hand bias (breaks the
  head-on mirror deadlock). The v1 reactive overlap push stays verbatim as
  the hard no-overlap guarantee.
- **Spatial hash** (`buildObstacleGrid` / `obstaclesNear`, ~1.5 m cells):
  per-frame clamps and path steers query only nearby discs, bit-identical to
  the brute-force walk (parity-tested) — a ~200–400-disc room stays
  phone-cheap.

Post-review hardening (same slice, this commit):

- **Hand-off shove fix**: on cramped back-to-back layouts a NEIGHBOURING
  table's footprint disc could still contain the sit approach point and the
  per-frame clamp shoved the walker 0.4–0.9 m off the hand-off every frame
  (visible snap when the sit clip mounted). New `dropDiscsContaining` filters
  exactly those discs out of the clamp sets (demo scripted walk + roam seat
  tap + lab crowd); the neighbour's chairs stay solid.
- **Corridor width**: `inSeatApproachCorridor` half-width 0.55 → 0.5 m — under
  the tightest banquet chair pitch (0.531 m at cap 16), so 14+-seat banquets
  keep BOTH flanking chairs solid instead of dropping them with the dest.
- **Grid reach de-poisoned**: stage/dance-class discs (r > `BIG_DISC_R`
  1.75 m) stay out of the buckets and are always-checked directly, so one
  3–4 m stage disc no longer drags every per-frame query up to a ~15 m scan
  square (slower than the brute loop the grid replaced).
- **Crowd frame loop**: `separateAgents` culls candidate pairs through its own
  uniform grid past 32 agents (a 150-guest room where ≤24 move drops from
  ~11k pair hypots/frame to local neighbourhoods); the lab Crowd loop reuses
  persistent scratch buffers instead of minting 4–5 O(n) arrays per frame;
  the predictive push is delta-scaled to a per-second rate (same sidestep at
  30 Hz and 120 Hz).
- **Walk-slot starvation**: a walker held off its waypoint by a pinned
  neighbour's push could hold one of the 24 walk slots forever and deadlock
  the entrance queue — arrivals now accept within 0.3 m of the approach point
  and a 2.5 s no-progress stall force-advances one waypoint (the clamp still
  keeps every skipped chord out of the obstacles).
- **Latent phantom-velocity fix (demo Walker)**: velocity history now resets
  inside the frame loop on walk-identity change (not a passive effect), so a
  rAF frame landing between commit and effect flush can never read a
  cross-walk teleport as tens of m/s for the slice-8 predictive pass.
- **`walkEveryone`** hoists the shared footprint bases out of the per-guest
  loop (was ~300 rebuilt near-identical sets per populate tap), and the two
  no-destination roam grids emit chair discs for serpentine tables only (the
  other shapes' chair discs sit strictly inside their footprint clearance
  disc and could never bind — pure query overhead removed).

Gates: typecheck clean · 1115/1115 unit tests green (incl. new big-disc grid
parity, corridor-pitch, separateAgents grid-vs-sweep parity, and delta-scaling
pins) · `lint:vendor-layout` clean.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (slice 3 shipped)
