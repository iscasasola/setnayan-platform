## 2026-10-20 · fix(guests): a removed +1 takes its seat; a "+N" without its rows says so; the card on a +1 names its guest

Follow-up to #6697, from the live cale-ice List (read-only): Juanita's and Maxima's "+1 · TBA" rows did not appear
under them because they no longer EXIST — both were soft-deleted on 2026-10-14 with the List's Remove (when they still
sat as bare rows under GUESTS), and Remove left the guests' "+1" standing. Not a section key (#6684's rename changes
labels, never keys), not a fold or filter, not desktop-only. So:

- Remove of a +1 without their guest lowers the guest's "+N" by it, and Undo gives it back (`seatNumbersAfter`,
  lib/extra-seats.ts; applied in `bulkSoftDeleteGuestsForUndo` / `restoreDeletedGuests`). A guest removed with their
  +1s is untouched.
- A guest whose "+N" has fewer seat rows on the List says "· +N not added yet" on their row (`seatRowsByGuest`).
- The guest card on a +1: title "Rose Marie Buanhug’s +1 · TBA" (wraps, never cut), eyebrow "+1 of Rose Marie Buanhug ·
  Bride's side" — the panel over the List and the card's own page; one wording, `lib/plus-one-of.ts`. The remove
  warning names the seat the same way.

Guard: `guests/_components/a-plus-one-sits-with-their-guest.test.ts` tests 7–9 (4 new sabotages seen red).

SPEC IMPACT: None — keeps an existing number true to its rows; no ruling changed. Owner question in the PR (the 4 live
guests whose "+1" has no seat row).
