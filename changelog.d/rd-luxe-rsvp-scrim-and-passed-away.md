## 2026-09-27 · feat(guests): "Passed away" — listed on the guest list and the prints, never counted

Owner, 2026-09-25 (DECISION_LOG "PRINT CONTENT COMES FROM WHERE IT ALREADY LIVES"):
*"a button of passed can be placed there … If passed away already, then not counted on the
guestlist. but listed."* Until now the prints' parents' lines hard-coded `deceased: false` and no
guest column could say it.

- **The toggle.** Guest list → a guest's card → Party → **Passed away** (never offered for the
  bride and groom; `updateGuest` refuses it for them too). One column, `guests.passed_away BOOLEAN
  NOT NULL DEFAULT FALSE` (migration `20271249859363`). RULE 0.3 searched first: `people.in_memoriam`
  is the Life Story flag on the person spine, reachable from a guest only through `person_id`, which
  is resolved for email guests only; `entry_source` would move them into Requests (hidden, not
  listed); `rsvp_status` is the guest's own answer. `lib/print-guest-registry.ts` had already
  reserved the name. Table-level grants cover it (no column GRANT); only the couple and granted
  moderators can write it.
- **Listed.** The roster keeps them, with "In loving memory · not counted" under the name; the
  reception-desk registry lists them as "In loving memory" (party blank, out of the totals); the
  invitation's parents' lines print **"the late <name>"** (was a `†`, and was never reachable).
- **Never counted.** `countsTowardEvent` (the #6030 request rule's predicate) now also says no, so
  `computeGuestStats` leaves them out; `fetchGuestsByEventMeasured` reads the LIVING list by default
  (only the roster and the registry opt in with `includePassedAway: true`), so the seat plan, the
  caterer sheet, the invitation page, check-in, the dashboard and every other list reader never see
  them; every reader that leaves a request out of a count now leaves them out too (18 reads across
  13 files: pax, Papic Limited, passes/QR sheet, check-in, souvenirs, 3D plan, recap, after-summary,
  story counts, magazine, roadmap, checklist, the reach probe); and the four SQL readers — caterer
  metrics, supplier brief, supplier seat plan, Papic pool divisor — are re-copied verbatim from
  `20271249183421` with `AND NOT g.passed_away` beside each request rule (9 reads).
- **Never seated.** Ticking it gives their chair back (`event_seat_assignments` row removed);
  un-ticking hands them to the seat reconcile like any returning guest.
- **Never sent to.** The Save-the-Date and invitation email fan-outs skip them; the card's
  "Email a sign-in link" says "Not sent · passed away" and its action refuses.

Guards: `apps/web/lib/a-guest-who-passed-away-is-listed-not-counted.test.ts` (the rule, the stats,
the opt-in list, a PROPERTY sweep — every request-excluding reader must also exclude them — the
email fan-out, the card, the prints, the migration) and
`apps/web/tests/db/a-guest-who-passed-away-is-listed-not-counted.db.test.ts` (column shape,
the pool divisor behaviourally, both rules on every guest read as the DB holds the functions).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — a 2026-09-27 row recording
the "Passed away" build (column, where it is set, what "not counted" covers, "the late" wording).
