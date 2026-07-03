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

## 2026-07-03 · feat(seating-3d): destination beacon showing where the avatar is walking

Follow-up to the walk-around fix (owner: "maybe we want an indicator where the
avatar is going?"). During the "take me to my seat" walk the guest could see the
figure move but nothing marked its destination until it arrived. Added a
`SeatDestinationMarker` — a pulsing gold floor ring + a faint light column + a
bobbing downward pin — planted on the target chair while the avatar walks, then
retired on arrival (the figure now stands there; the static "your seat" ring
remains). Reuses the existing roam-seat gold-ring vocabulary, animated.

- `app/_components/plan3d/plan3d-scene.tsx` — beacon shown while the scripted
  walk runs (`walk && !arrived && !roam`); `arrived` flips in the walk's
  onComplete, resets on each new walk. Coloured by the guest's side.
- `app/[slug]/venue/_components/guest-venue-3d.tsx` — beacon at the guest's
  seat while walking to it; `GuestAvatar` gained an `onArrive` callback that
  fires when the path completes on a seat walk, hiding the beacon.

Couple lab left out on purpose — Populate-Play walks the whole crowd in at once,
so per-destination beacons would clutter. Render-only; no lib/schema change.

SPEC IMPACT: None.
