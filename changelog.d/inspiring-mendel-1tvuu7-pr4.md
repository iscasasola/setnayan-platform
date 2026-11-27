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

- **Slice 2: the independent check** (§ 5 step 7), `lib/seat-plan-validator.ts` › `checkAutoSeatPlan`.
  - It imports nothing at all, so it shares no code with the solver.
  - Before auto arrange writes, it checks every new seat:
    - the table is in the plan;
    - nobody is seated twice;
    - the chair is real and free;
    - no table goes over capacity;
    - the table is not the Sweetheart, not locked and not Spare;
    - the guest has not declined.
  - On a break, nothing is written. The seats "Seat everyone again" took off go back, the tables the run added come off, and the host reads "Couldn't make a plan. Nothing changed."
  - Test: `lib/an-arranged-plan-is-checked-before-it-is-written.test.ts`, including 25 seeded rooms run through the shipped seater. One sabotage was seen red: the capacity rule loosened.

SPEC IMPACT: None (builds § 5 as planned).
