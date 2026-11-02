## 2026-07-08 · feat(seating): per-event group-adjacency opt-out toggle (Smart Seat-Plan · S9, gap G8)

Adds the per-event opt-out the S4 adjacency PR deferred. Adjacency (a group's
overflow spills to the nearest table by floor coordinates) still ships **ON**; a
couple can now revert to the classic stage-ranked fill.

- **Migration** `20270525431852` — `events.seating_group_adjacency BOOLEAN DEFAULT TRUE`.
- **`computeAutoSeat`** gains a 7th optional `groupAdjacency = true` param; when
  false the group-anchor lookup is skipped → classic fill. Threaded through
  `solveSeatPlan` (`SolveInput.groupAdjacency`) and `reconcileProvisionalSeats`
  (`ReconcileInput.groupAdjacency`). Existing callers (default true) are byte-identical.
- **`fetchGroupAdjacency(supabase, eventId)`** helper reads the flag (default ON),
  wired into the reactive path (`applyReconcileForEvent`) AND all four
  couple-triggered Auto-Arrange call sites so the opt-out is honored consistently.
- **UI** — a "Keep groups together On/Off" pill beside the S6 auto-seating toggle
  (server action `setSeatingGroupAdjacency`, no client JS).
- **Test** — `groupAdjacency=false` reverts a grouped overflow to the classic
  stage-order fill (31 seating cases pass).

Typecheck + lint clean.

SPEC IMPACT: Delivers the deferred per-event adjacency toggle noted in the S4 PR / `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md`. Corpus already carries the spec.
