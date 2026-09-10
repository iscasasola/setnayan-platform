## 2026-09-06 · fix(3d-plan): the control centre knows seats fill themselves — tables are the couple's

Owner, 2026-09-06: *"i thought seat plan auto generates as they fill up the guest
list?"* — it does. Smart Seat-Plan Phase 5 shipped 2026-07-08 (#2907–#2912):
`events.seating_autoplace_enabled` defaults ON, a new guest gets a provisional
seat, role/group changes re-seat them, a decline frees the seat
(`reconcileProvisionalSeats`, whose own output names the remainder:
`needsTable`). The control centre (#5216) did not carry that fact, so its next
step said **"4 guests have no seat — Seat them"** where the truth is **"not
enough tables — add one and the seats fill themselves."**

- `Plan3dPlanRead.autoplace` read from `events.seating_autoplace_enabled` with
  the seating editor's own `?? true` default — never a typed-in value.
- Next step, auto-seating ON: *"N guests have no seat yet — Add a table"*;
  OFF: *"N guests have no seat — Seat them"*. The *wait-for-finalize* rung now
  says new guests get a seat automatically.
- The seat-plan source row ends *"· auto-seating on/off"*, so the couple can see
  which world they are in from the room's own page.
- Guards extended: both branches of the rung, the row suffix, and the wiring
  (column selected, editor default, no literal).

- **And no *wait* step.** Owner, 2026-09-06: *"seating can always change in the
  last minute and even during the event."* The first draft told a couple to hold
  the room until the guest list settled — the opposite of the rule. Removed;
  Publish's own copy now says seats can change right up to and during the day.
  Measured, not promised: the guest walk fetches the scene per request, so a
  change shows when a guest next opens the room, not mid-walk — the page says
  "always opens the latest version", never "live". Pinned by the wiring guard.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 row — the finalize-gate call is closed
(no gate, ever); the live-update reality is recorded.
