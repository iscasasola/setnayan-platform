## 2026-11-27 · feat(seating): auto arrange never fills a locked or Spare table (seat plan L11 PR 4, slice 1)

Plan: specs `SEAT-PLAN-COMPLETE-2026-11-27.md` § 5 hard rules ("locked seats and locked tables", "Spare tables stay empty"). It is stacked on PR 3, whose migration adds `event_tables.locked` and `table_kind`.

- **One rule:** `lib/seating.ts` › `autoSeatTakesTable`. The automatic seater never uses:
  - the Sweetheart table;
  - a locked table;
  - a Spare table.
- **Who reads it:**
  - `computeAutoSeat`'s pool;
  - `autoSeatRoom`'s free-seat count, so auto arrange adds tables instead of counting closed chairs;
  - `solveSeatPlan`'s keep-apart repair, which never moves anyone into a closed table.
- **Seat everyone again and Clear all seats keep a locked table as it is** (`seatsToClear` / `seatsThatStay` take the locked tables). Choosing "Clear all, locked too" still clears it.
- **Unchanged:** a person can still seat someone at a Spare or locked table by hand. No migration. No server action.
- **Tests:** `lib/auto-seat-keeps-locked-and-spare-tables.test.ts`. One sabotage was seen red: the locked rule removed.

SPEC IMPACT: None (builds § 5 as planned).
