## 2026-09-21 · feat(guests): extra seats lock with the guest list, and every seat can be named

Owner, asked two questions after the +1…+4 / chairs build: *"1. yes 2. yes"*.

**1 · Extra seats lock when the guest list is finalized.**
- `checkExtraSeats` refuses any change of a guest's number once the list is closed —
  `guestListIsClosed` (the stamp OR the deadline, the same answer the RSVP and the finalized banner
  use) — with the RSVP lock's own sentence, BEFORE anything is saved. An unreadable event is refused,
  never assumed open.
- Keep on Unlisted guests writes with the admin client, which the database lock exempts, so it asks
  explicitly before saving a +N.
- The roster's + control shows the number with a lock reason on tap (`GuestListFinalizedContext`,
  provided from `finalize.locked`) instead of offering the picker.

**2 · One optional name box per seat on the invitation.**
- The reply shows a first/last pair per seat (up to 4), prefilled with the name on that seat; the
  loader reads the seat rows. A blank box leaves its seat TBA. No seats read → the old single box.
- `planSeatNames` (pure) decides which seat each name fills: a box's seat id is honoured only if it is
  THIS guest's seat; otherwise the oldest open placeholder; a new seat only while the guest has fewer
  than the couple gave — so a posted form (anyone with the link can post it) can never mint seats or
  name someone else's. Writes are scoped `.eq('plus_one_of_guest_id', guestId)`.
- The primary's `plus_one_name` mirrors the first name given, as before.
- Guards repointed honestly: `a-guest-can-name-who-they-bring` (blank box / host-list mirror) and
  `extra-seats-are-chairs` (the cap; sabotage of the cap caught; the lock; sabotage caught).
  `lib/extra-seats.test.ts` +4 (reading boxes, filling seats, the forged-id and over-cap refusals, the
  box count).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 🔒 row (owner rulings 1 and 2).
