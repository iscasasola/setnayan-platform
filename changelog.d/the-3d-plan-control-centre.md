## 2026-09-05 · feat(3d-plan): the 3D Plan control centre — the room as your guests see it, the one switch, and what feeds it

Owner 2026-09-05: *"3D controller/control center is the setup to create their 3D
Plan View … it only helps us adjust what is not available from the other
information gathered from the other places like guest list, mood board, seat
plan … also a confirmation button that the 3d plan will be using details from
their seat plan, guest list, mood board."* Designed by Fable the same day on the
shipped seven-slot control-room pattern (`SERVICE_CONTROL_CENTERS_DESIGN_
2026-08-28.md`; the Event Hub controller at `/launch` is the sibling).

New route `/dashboard/[eventId]/plan3d` (hosts and delegated coordinators, the
`isHostMemberType` gate), reached from the lab panel's "3D Plan control centre →"
and highlighted under Guests in the nav:

- **S1 · the stage** — a living top-down miniature of the room drawn from the
  seat plan (tables, stage, dance floor, entrance, supplier booths — gold when
  branded), the address `setnayan.com/{slug}/venue`, a status pill, one lede per
  state, "Open as a guest" / "Walk it yourself" / "Edit the room".
  Empty is a promise, not an apology: no tables draws the dashed room it will
  become.
- **S2 · four facts** fused to the stage: Status · Seated · **Made an avatar** (a
  real count of `guests.avatar_config IS NOT NULL`) · Days to go.
- **The switch** — Draft ↔ Live, the same `publishSeating` / `unpublishSeating`
  the lab posts (#5182), with the take-down sentence verbatim. One gate, two
  surfaces, one pair of writers.
- **S3 · one next step** — place the first table · seat the N with no seat ·
  wait for the guest list to finalize (date shown) · publish · print the signs ·
  nothing to do (after the day) · try again (read failed).
- **S4 · built from** — Guest list / Seat plan / Mood board as doors, never
  editors, each carrying its own state ("178 guests · finalizes 21 Nov",
  "22 tables · everyone seated · 3 supplier booths (1 branded)").
- **S5 · set once** — only what lives nowhere else: how guests appear (a fact
  row — Chibi, in production), guest photos in the walk (the shipped
  `venue_photo_visibility`, a door to the seating chart), who can open the
  address (a door to the celebration's own visibility).
- **S7 · the boundary.** No money card: the 3D Plan is free for couples (#5185).

**Unread is not empty.** `fetchFloorPlan` graceful-degrades to defaults and
cannot say it was refused, so `published_at` is read again with error awareness;
a refused read renders "We couldn't read your room just now" and em-dashes,
never "Draft".

**One rule deliberately NOT added — for the owner:** "the seat plan can be
activated once the guest list is finalized" is shown as a fact and a *wait* next
step, not enforced as a gate on Publish — the same `published_at` also opens the
free 2D table lookup and the print pack, and the owner also said "any changes …
will adapt real time". Say the word and it becomes a gate in `publishSeating`
(one writer), knowing it holds back the 2D lookup too.

Guards: `lib/plan3d-control.test.ts` (the resolvers, incl. measured:false →
null), `plan3d-stage-renders.test.ts` (the render at draft / live / unread /
empty), `the-control-centre-wires-what-it-measured.test.ts` (each `measured` is
the read's own verdict; the switch posts the shipped actions; booths read with
the admin `brandedReader`).

SPEC IMPACT: `DECISION_LOG.md` row — control centre shipped; the finalize gate
left as an owner call.
