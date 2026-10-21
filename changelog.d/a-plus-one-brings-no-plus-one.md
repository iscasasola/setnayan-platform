## 2026-10-21 · fix(guests): a +1 can't bring their own +1 — the card, the reply, every writer and the database

Owner, verbatim: *"a +1 of a guest cannot have their own +1."* (desktop Guests, the card of "Ms. pamela mitra labriaga ·
+1 of Pam" open, its RSVP showing "Extra seats ▾ None").

- **One predicate, named once:** `isAPlusOne` (lib/guests.ts) — the `plus_one_of_guest_id` test every surface already
  used inline. `plusOneSeats` reads 0 for a +1 whatever the row says, so the List's "+N" chip, the head counts and the
  reply's "and N guests" never count one.
- **The guest card:** a +1's "Extra seats" pick is gone; one quiet line in its place — *"A +1 can't bring their own
  +1."* — and 0 is posted. A normal guest's card is unchanged.
- **The +1's own reply:** never draws the plus-ones block (even from a stale row).
- **Every writer refuses:** `checkExtraSeats` (the card's save incl. an old form's on-box, the List's inline number, the
  quick add's +N, a claim), `syncExtraSeats` (never mints a seat under a +1), the import (a +1 row asking for extra
  seats waits for a look), and the reply's `nameTheSeats` (before any mint).
- **The database:** migration `20271281624693_a_plus_one_brings_no_plus_one.sql` — CHECK `a_plus_one_brings_no_one`
  (a +1's count 0 / allowed off), trigger `a_plus_one_has_no_plus_one` (a bringer is never a +1; a guest with +1 rows
  cannot become one), and `guest_plus_one_seat_mint` answers `bringer_is_plus_one`. Prod measured read-only first:
  38 +1 rows, 0 carrying extra seats, 0 with a +1 of their own — nothing changes, the CHECK is validated (it falls
  back to NOT VALID, leaving rows alone, if a violator appears before it applies).
- **Ugat:** J3 now claims the CHECK and says the self-reference is one level deep.
- **Guards:** `lib/a-plus-one-brings-no-plus-one.test.ts` (screens, writers, a scan that every seat writer asks the
  gate) and `tests/db/a-plus-one-brings-no-plus-one.db.test.ts` (CHECK, trigger, mint), each sabotaged.

SPEC IMPACT: DECISION_LOG.md — one 2026-10-21 row "A +1 CAN'T BRING THEIR OWN +1" (the owner's ruling as built; corpus commit a19f63b4, made locally — its push was not permitted from this session, the controller pushes it).
