## 2026-09-05 · fix(seating): a published 3D Plan can be taken back down

`event_floor_plan.published_at IS NOT NULL` is the only condition
`public_venue_scene` checks before it serves the room, the tables, the booths and
which seats are taken to `/[slug]/venue`. `publishSeating` stamped it and
**nothing in the tree ever cleared it** — the only other writers of that table
are three geometry upserts that do not carry the column. Publishing was a one-way
door on the couple's own reception; the sole escape was flipping the whole
celebration to private, which also takes down their landing page.

The quieter half, and why it went unnoticed: `page.tsx` had always computed
`published: floorPlan.published_at != null` and shipped it on `Lab3DFloor`, and
the lab panel read it nowhere. Both ends built, no wire — so "nobody can see
this" and "anyone with the address can walk it" rendered identically, under one
button labelled "Publish" whose confirmation counted print sheets.

- `unpublishSeating` (`app/dashboard/[eventId]/seating/actions.ts`) clears
  `published_at` under the couple's RLS. UPDATE, not upsert: no row means nothing
  was published, and writing one to say so is a row nobody asked for.
- It deliberately does **not** touch `event_tables.qr_published_at`. Those sign
  sheets are already standing at the venue and their tokens are never re-rolled;
  un-stamping them would assert something untrue about the print pack to undo
  something it does not gate. A guest scanning a printed sign still finds their
  seat — what stops is the public 3D walk.
- The lab panel now reads `floor.published`: a Live/Draft status line that says
  what each state means, one button that swaps to "Take it down" when live, and a
  publish confirmation that names the walk it just opened rather than only the
  print pack.
- `lib/a-published-plan-can-be-taken-down.test.ts` pins all of it, including the
  asymmetry (publish stamps both surfaces, take-down clears only the gate).

SPEC IMPACT: None — this ships the missing half of an existing decision
(published-gated public walk), it does not change what publishing means.
