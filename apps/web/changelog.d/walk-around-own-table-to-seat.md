## 2026-07-03 · fix(seating-3d): walk AROUND the guest's own table to their seat, not across it

Owner report: in the "take me to my seat" 3D walk, the figure still walked
straight THROUGH its own table instead of around it. Root cause: every caller of
the walk pathing dropped the destination table from the obstacle set (`[you.table]`
/ `[walkTable.id]`) so the walker "could reach its chair" — which let the straight
line from the entrance cut clean across the tabletop whenever the seat sat on the
far side. The earlier STEPS 22→40 sampling bump couldn't help: the destination
table contributes zero obstacle discs, so there was nothing to steer around.

New pure helper `seatApproachPath(start, table, seatNumber, room, obstacles, skipR)`
in `lib/seating-3d.ts` keeps the destination table IN the obstacle set, routes
around it to an approach point just outside its avoidance ring on the chair's
bearing, then steps straight in — a person walks around their table and sits from
the outside. Rewired all three seat-walk consumers to the FULL obstacle set (no
skip) via the helper:

- `app/[slug]/venue/_components/guest-venue-3d.tsx` — the guest "take me to my
  seat" auto-walk (free-roam taps still skip the own table so a tap can land the
  guest right at their chair).
- `app/_components/plan3d/plan3d-scene.tsx` — the homepage 3D Plan demo's scripted
  entrance→seat walk.
- `app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx` — the couple
  lab's single walk-in and Populate-Play crowd. The crowd's PATH now routes around
  every table, but each agent's per-frame re-clamp obstacle set still SKIPS its own
  table so an arrived avatar isn't shoved off its chair.

New regression test in `lib/seating-3d.test.ts` (18 pass) pins: path ends exactly
on the chair, no waypoint ever enters the physical tabletop, and a counter-proof
that the naive straight line does breach it.

SPEC IMPACT: None (throwaway/flag-gated 3D spike + demo pathing; no schema, SKU, or
pricing change).
