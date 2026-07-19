## 2026-07-08 · fix(seating): close reconcile-coverage gaps (Smart Seat-Plan · S7)

Smart Seat-Plan guest-reactive program, **PR S7** — closes the reconcile-coverage
gaps found in the post-ship audit so the plan actually reacts everywhere.

- **G1 — adding a table now seats waiting guests.** `addTable` calls
  `applyReconcileForEvent` after the insert, so the "not enough seats — add tables"
  banner (S6) actually pays off: new capacity gap-fills the unseated. This was the
  most ironic gap.
- **G2 — guest-side RSVP seats the guest.** `submitRsvp` (`/[slug]`) gap-fills on any
  NON-declined reply (declined stays handled by the `free_seat_on_decline` trigger),
  via the admin client (the guest session can't write seat rows). Gap-fill only —
  a confirmed guest's existing chair never jumps.
- **G4 — turning auto-seating ON back-fills.** `setSeatingAutoplace(enabled=true)`
  reconciles immediately so guests who piled up while it was off get seated.
- **G3 — verified a non-issue:** the mind-map inline adds don't create seatable
  guests (`mapAddGroup` = a group; `mapAddPlusOne` = a flag on an existing row), so
  no wiring needed there.

Best-effort throughout (never blocks the underlying write); all no-op when
autoplace is off or the room is already seated/full. Typecheck + lint clean. No
schema change.

SPEC IMPACT: Post-ship gap cleanup for `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md`. Corpus already carries the spec.
