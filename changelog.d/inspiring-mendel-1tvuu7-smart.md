## 2026-11-28 · feat(seating): the smart layer's engine: a dry run for card suggestions and the seat check; new RSVPs seated behind the switch (seat plan S)

Plan: specs `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.4 (smart layer S). It is stacked on the table-kinds PR (E). It is engine only; the strips, the Seat check `Sheet` and the ⋯ switches are the UI lane's.

- **The dry run** is `lib/seat-plan-dry-run.ts` › `seatPlanDryRun`. It runs the seater auto arrange uses (`computeAutoSeat`, fill-only, so nobody already seated moves). It writes nothing; a source assert holds that.
  - **Card suggestions:**
    - Per table, it gives who the seater would seat there, grouped as parties (a guest with their +1s and kids), with the rows a "Seat N" would write.
    - The reason comes from the seater's own terms: the group holding more than half, the number of parties, and the side when everyone shares one (for example "Santos family · 2 parties · groom's side").
    - It is off when the host turns "Suggest seats on the cards" off (`seat_suggestions`).
  - **Seat check:**
    - It finds a +1 apart, a party split, an elder near the speakers, a table over its seats, and a new "yes" seated among strangers.
    - Each problem carries one fix: the exact moves (a party moves together, to a table with room) or "review" when no move is safe (a full or locked table, a pinned seat).
    - `fixAllMoves` gathers every move without overfilling a table or half-moving a party.
    - Under the host's "nearest" rule, a principal sponsor's +1 seated away is not a problem.
  - **Honest failure:** a run that throws is `{ ok: false }`, and `seatCheckLine` says "Couldn't check seats · Try again", never "All good".
  - **Privacy:** no guest name leaves the file and no outside AI is called; a source assert holds that.
- **Seat new RSVPs:**
  - The shipped hook after a guest's yes (`applyReconcileForEvent`) now passes `trigger: 'rsvp'`, and runs only while `event_floor_plan.auto_seat_rsvps` is on.
  - Every live re-seat now goes through the independent check (`checkAutoSeatPlan`) before writing. A refused plan writes nothing, so the guest stays in Not seated and the fault is recorded.
  - A re-seat never takes a guest off a locked, Spare or Sweetheart table.
- **Tests:** `lib/seat-plan-dry-run.test.ts` (15). One sabotage was seen red: the closed-table re-seat rule removed. No migration and no new server action. Taking a suggestion or a fix writes through the preview's Accept (D).

SPEC IMPACT: None (builds § 4.4 as planned).
