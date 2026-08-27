## 2026-08-28 · fix(event hub): the seat rooms belong to the kinds that seat people

Owner ruling 2026-08-28, verbatim: **"only its own rooms"**. First slice of `hub3`.

A trip, a dinner date and a hangout were offered a wedding's four seat-shaped
rooms — the seat pass, find-my-seat, the table map and the 3D venue walk. None
of those kinds has a banquet floor, so every one of those rooms could only ever
show its "not posted yet" plate, forever. They are now absent for those three
kinds, and unchanged for the other fourteen.

**RULE 0 paid: the enforcement engine already shipped.** `surfaceEnabled()` has
gated per-kind surfaces since iteration 0053 and already hides the save-the-date
maker, the monogram maker and the budget. Nothing was rebuilt. What was missing
was that **the four seat rooms never asked the `seating` surface** — all four
gated on `website` only, so the answer the profile had been storing all along
was never read.

**BOTH HALVES SHIP IN ONE COMMIT, AND THAT IS THE POINT.** Narrowing the four
guest rooms alone would have re-created, exactly, the defect
`app/[slug]/seat/page.tsx` records having already been repaired once: nothing on
the host's side gated seating, so a host of one of these kinds could still build
a seat plan, publish it, and buy the ₱1,499 branded per-guest QR pass — whose
guests would then land on *"this page does not exist"*. So the same commit
closes the writers: the seating room redirects, the day-of **Seats** tab is
omitted, and `CUSTOM_QR_GUEST` carries `surface: 'seating'`.

**A trap the existing `hideKeys` mechanism hides.** The obvious way to drop the
Seats tab is `navHideKeys`. It would have compiled, read as correct, and hidden
nothing: `hideKeys` filters `planningMenus` at the very bottom of
`buildCustomerMenuTree`, and the day-of branch returns before that filter runs —
its own docblock says it only filters the planning tree. A separate
`seatingEnabled` prop is used instead, mirroring the shipped `websiteEnabled`,
and the guard pins that the day-of branch never mentions `hideKeys`.

**Safe by arithmetic, measured not assumed.** Every floor plan (2), every
published floor plan (2) and all 13 tables in production belong to a **wedding**
— the one kind whose grid row keeps every room. The only live `date` event and
the only live `simple_event` hold zero of each. Nothing anybody has made is
withdrawn.

**FAILS OPEN.** An unreadable profile degrades to `GENERIC_PROFILE`, which
enables `seating`, so a database hiccup can never delete a paid, published seat
plan — only a stored row that says "no seating" closes a door. The `?? 'wedding'`
fallback the first draft used was caught by the S13 wedding-word bill and is
gone: defaulting an unknown type to a wedding would have handed it a wedding's
rooms.

**Two existing guards fired on this change and both were right** —
`paid-for-every-event.test.ts` pins the seat page's gate line to the exact form
its siblings use (so the refactor was reverted rather than the guard widened),
and `s13-is-finished.test.ts` caught the `'wedding'` literal above.

`TRAVEL_PROFILE` drops `seating` too: that constant's documented job is to mirror
its seeded row. `date` and `hangout` have no named fallback and so degrade to
`GENERIC_PROFILE` — the asymmetry is deliberate and is the safe direction.

⚠ **The migration matches ZERO rows locally and in CI, silently.** These profile
rows were created by an admin, not by a migration, so the PGlite replay does not
contain them. It was dry-run against production inside `BEGIN…ROLLBACK` first:
all three rows moved 7 surfaces → 6, the wedding stayed at 9, and a re-query
after the rollback confirmed all three still carried `seating`.

⏭ **NOT in this slice, and not oversights** — the approved grid
(`EVENT_HUB_UNIVERSAL_DESIGN_2026-08-17.md` § A) has 28 "—" cells; this closes
12 of them. The rest need a mechanism this one does not: `gifts` (6 cells) has no
surface at all, the Live hub and photo wall (6) would need the stored-but-unread
`day_of` surface wired up, and `welcome` + `recap`/`print` (4) fit no existing
surface. The wake's whole row is unruled — it was created a week after the grid
was approved.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-28 (the "only its own rooms" ruling)
records the decision; `EVENT_HUB_UNIVERSAL_DESIGN_2026-08-17.md` § A is the grid
being implemented. No corpus edit needed — this slice implements an existing
approved design rather than changing one.
