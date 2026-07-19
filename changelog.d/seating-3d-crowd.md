## 2026-06-25 · feat(seating-3d): "Walk everyone in" — the whole room populates, making way

Owner directive ("when play is initiated … render the actual 3D like sims" ·
"make way for each other"). Play mode gains a **Walk everyone in** button: every
seated guest walks from the entrance to their chair at once, yielding to each
other and clearing every object — the populate-Play heart of build #1.

- **`lib/seating-3d.ts`** — two pure, unit-tested primitives the crowd runs on:
  `separateAgents(positions, minDist)` (mutual "make way" — too-close pairs split
  their overlap) and `pushOutOfDiscs(point, discs, perp?)` (object clearance).
  `steerPath`'s hard-clearance now reuses `pushOutOfDiscs` so a precomputed path
  and a live-walking avatar mean the same thing by "don't cross objects".
- **`seating-lab-3d.tsx`** — a new `Crowd` component animates N agents: each
  steps toward its next waypoint, then the set is resolved with `separateAgents`
  + per-agent `pushOutOfDiscs` every frame. Agents stagger out of the entrance
  (so they don't spawn stacked) and each carries its OWN obstacle set (every
  object except its destination table, so it can reach the chair). `walkEveryone`
  builds the agents (cleared path + motif colour per seated guest); a single
  guest tap supersedes the crowd and vice-versa. Reduced-motion snaps everyone
  to their seat.
- **`lib/seating-3d.test.ts`** — +4 cases (8 total): `pushOutOfDiscs`
  edge/outside/dead-centre, `separateAgents` push-apart / leave-far / coincident.

O(n²) separation is fine for a wedding's headcount; a spatial grid is the noted
v2. Next in #1 is done after this; #2 = vendor booths (generic booth, vendor-
skinnable logo/theme for promotions — owner 2026-06-25).

SPEC IMPACT: 0008 Seating — Play mode populates the room with collision-aware avatars.
