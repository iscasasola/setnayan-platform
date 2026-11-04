## 2026-11-02 · feat(seats): Auto arrange asks who moves; Clear all seats with Undo

Owner, live on his own event (Seats › List › ⋯): *"We want to be able to remove all seated. When we click auto seat. We
ask if we change all seated or just the unseated ones?"* Stacked on #7183 — ships after it.

- **Auto arrange asks first** (when anybody has a seat), in the house sheet: "Only the unseated (N)" (the default) or
  "Seat everyone again" — every unlocked seat comes off and is arranged again; a locked seat
  (`event_seat_assignments.locked`) never moves. Nobody seated → nothing to ask, it runs.
- **Clear all seats** in the same ⋯: asks to confirm; locked seats stay unless the host picks "Clear them too".
- **Undo puts back exactly what was there** — table, chair, lock, who placed it, when — never over a guest or a chair
  taken since (`lib/seat-plan-scope.ts › restorableSeats`).
- No new server action (the route ceiling is full): `scope` and `intent=clear` ride `autoArrange`, and the restore
  rides its existing `intent=undo`. `computeAutoSeat` and the Auto arrange Undo are reused as they are.

Guard: `apps/web/lib/auto-arrange-asks-who-moves.test.ts` (dummy 25-table / 230-guest room).

SPEC IMPACT: None — no schema change; the owner's request is the ruling (DECISION_LOG row left to the controller).
