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

- **Slice 3: a party never splits, held on 300 random events.**
  - `lib/auto-seat-holds-its-rules-on-random-events.test.ts` uses a seeded generator with no new dependency. It covers locked, Spare, VIP and Sweetheart tables, removed chairs, groups, +1s, pending and declined guests, and guests already seated. It holds:
    - the same input always gives the same plan;
    - every plan passes the independent check;
    - a +1 sits at their bringer's table.
  - It found a real split. When a full room left a guest and their +1 without one table that fit both, the seater put them on two tables, and only reported it as "split".
  - Now `seatChunk` gives a party of two or more the nearest table with room for all of them. When no table has room, none of them is seated and they are shown as "didn't fit" (§ 5: units stay whole). A guest on their own still takes any chair left.

- **Review fixes (the controller's review, 28 Nov): a locked table never changes, and a party never splits.**
  - Lock and fill keeps every seat at a locked table (`seatsToClear` / `seatsThatStay`), not only the pinned ones, and it checks the plan before anything comes off.
  - The live re-seat never takes a guest off a locked, Spare or Sweetheart table.
  - The keep-apart repair in `solveSeatPlan` moves a whole party (the guest who brought them plus everyone they brought), or nobody.
  - A +1 whose guest is already seated sits at that table, or is shown as not fitting; never somewhere else.
  - The independent check gained rule 7: a newly seated +1 sits at their guest's table or linked run, except a non-role +1 of a guest at a VIP table under the host's "nearest" pick.
  - "Seat them" now runs the check before writing.
  - Auto arrange writes the layout (positions, unplaced, booths) only after the check passes, so "Nothing changed" is true.
  - Test: `lib/a-locked-table-never-changes.test.ts` (5). Sabotages seen red: the party repair reduced to one guest; the +1 allowed to spill.

SPEC IMPACT: None (builds § 5 as planned).
