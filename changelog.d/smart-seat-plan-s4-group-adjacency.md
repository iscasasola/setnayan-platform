## 2026-07-08 · feat(seating): group-overflow adjacency in auto-seat (Smart Seat-Plan Phase 6 · S4)

Smart Seat-Plan guest-reactive program, **PR S4** (point #8). When a custom group
overflows its table, `computeAutoSeat` now spills the rest onto the table nearest
**by floor coordinates** (`x_pos`/`y_pos`) to the group's anchor — not the next
stage-ranked table, which could be across the room.

- `lib/seating.ts` — the fill loop tracks a per-group anchor (the first table a
  member lands on) and places overflow at the nearest free table to it. The
  anchor itself is still chosen stage-nearest, so VIP-near-stage weighting is
  preserved. **Ungrouped guests keep the exact stage-ranked fill** — a strict
  superset, no behaviour change without custom groups. Deterministic (ties break
  on stage order); reused unchanged by `solveSeatPlan` and `reconcileProvisionalSeats`.
- `lib/seating.test.ts` — 2 cases: grouped overflow lands on the adjacent table
  (not the next stage-ranked one); ungrouped overflow is unchanged.

Every existing seating case (28) + the reconcile suite (6) still pass. Ships
adjacency ON by default (a strict improvement); a per-event opt-out toggle is a
noted follow-up, kept out of this PR to avoid threading a flag through
computeAutoSeat/solveSeatPlan/reconcile.

SPEC IMPACT: Implements PR S4 of `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md` (Phase 6). Spec noted a per-event toggle default-on; shipped on-by-default with the toggle deferred — flagged in the PR for owner sign-off. Corpus already carries the spec.
