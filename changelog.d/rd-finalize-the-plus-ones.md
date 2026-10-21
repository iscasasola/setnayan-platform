## 2026-10-21 · feat(guests): finalizing the list — +1s named · no name yet, Release seat, tappable reply counts, Set reply, Marked by you

Owner, verbatim: *"when we finalize the guest list. how do I know which +1 has names and has no names? so we can alot the
seat to another person in case they said no or they will not add a +1 anymore"* → *"Yes, build it: count at the top, +1 ▾
Named / No name yet filter, Release seat with Undo and bulk Select, and auto-release when they decline or say no +1."*
And: *"so our guest list will have counts for those who accepted only? How do we double check those who did not answer
yet. so we can manually accept them in case they just forgot to say yes?"* → *"Yes, add all three: tappable counts that
filter, Select → Set reply ▾ Attending / Not coming, and "Marked by you" on replies I set."*

- **+1s: N named · M no name yet** in the counts line (hidden with no +1s); each half filters the list. The Sort
  dropdown gains **+1 ▾ Named · No name yet** (PickMenu group), on top of the search. One predicate,
  `plusOneHasNoName` (lib/extra-seats.ts) — the seat engine's `isPlaceholderSeat` AND #6727's `seatNameAsTyped`.
- **Release seat** on a +1 row with no name yet (in place of Remove) and in its card's ⋯: gone at once, one Undo, the
  guest's "+N" one lower — the SAME soft delete + Undo (`bulkSoftDeleteGuestsForUndo(…, { release: true })` /
  `restoreDeletedGuests`, +0 server actions), gated server-side by `seatReleaseRefusal` and by a write that takes only a
  seat still unnamed. Select: when every pick is such a seat, the red button reads **Release N seats**. A named +1 keeps
  the shipped Remove and its warning.
- **The counts are doors**: N attending · N not coming · N no reply each filter to exactly what they count
  (`replyFilterMatches` — the search words for the same replies read it too); × Clear; "to invite" keeps its door.
- **Select → Set… ▾ Reply → Attending / Not coming**: the ONE host reply write (`setGuestRsvp`, reshaped for N guests,
  no caller before), skipping the couple and the honoree. Not coming frees chairs and releases +1 seats with no name
  (named stay). One Undo (`restoreGuestRsvpAndSeat`) puts back every reply, date, mark, chair and seat.
- **Marked by you**: new `guests.rsvp_set_by` ('host' | 'guest' | NULL, migration `20271281744795_a_reply_says_who_set_it`,
  no backfill — old rows show nothing). Host writers mark 'host' (the card's Reply pick when the answer changes,
  Set reply); the guest's reply, a join request and a sponsor's acceptance mark 'guest'. Shown on the card's RSVP row,
  as a quiet "marked" on the row, and as Excel's "Reply set by" (You / Guest).
- **NOT built: auto-release from the GUEST's reply** (decline / "no +1") — it contradicts the 2026-09-29 rulings
  (#6145: "nothing is ever removed from the guest side"; #6151: the +0…+4 is "a host decision"), and the reply has no
  "no +1" answer (a blank name is "+2 · TBA", ruled). Waiting on the owner. A HOST's Not coming does release.
- **With #6728's trigger** (a guest's +N IS their +1 rows): Release soft-deletes the CHOSEN seat first, THEN lowers the
  number — the trigger then finds nothing more to take (no double delete); the Undo restores the row first, then the
  number — nothing is minted beside it. Held by `tests/db/a-released-seat-is-taken-once.db.test.ts` (the real trigger)
  and the unit harness's model of it.
- Guards: `a-seat-with-no-name-can-be-released.test.ts` (8) and `the-counts-filter-what-they-count.test.ts` (7), run over
  the real actions on an in-memory database (`guests-db.harness.ts`); 16 sabotages, all RED.

SPEC IMPACT: corpus `DECISION_LOG.md` — one 2026-10-21 row "FINALIZING THE LIST" (both owner quotes, what was built, the
guest-side auto-release held for the owner). Schema: `guests.rsvp_set_by` (exposure baseline +1 column, same grants as
`rsvp_status`).
