## 2026-07-08 · feat(seating): reconcileProvisionalSeats() — live provisional seating core (Smart Seat-Plan Phase 5)

Smart Seat-Plan guest-reactive program, **PR S2** (the engine for #3/#4/#9; not
wired into guest writes yet — that's S3). Pure + deterministic; reuses
`computeAutoSeat` / `solveSeatPlan` so Phase 2 priority, Phase 3 keep-apart, and
group/+1 clustering all carry through.

`reconcileProvisionalSeats(input)` returns a delta the caller applies:
- `assign` — seat rows to UPSERT (`UNIQUE(event,guest)` makes each a replace;
  covers newly-added guests AND re-placed ones).
- `release` — guest_ids whose stale row must be DELETED (only when a vacated seat
  got reused and the guest couldn't be re-placed — avoids a double-booking).
- `needsTable` — eligible guests left unseated (drives the "add a table" banner).

Invariants (unit-tested, `lib/seating.reconcile.test.ts`, 6 cases): a LOCKED
(Phase 4) seat is never vacated even when flagged for reseat; a newly-added guest
is gap-filled without a reseat flag; reseating a custom group re-clusters it onto
one table; a displaced guest never double-books a seat; the pass is idempotent.

No schema change, no behavior change yet (function is exported but uncalled).

SPEC IMPACT: Implements PR S2 of `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md` (Phase 5 core). Spec already in the corpus; no further corpus edit.
