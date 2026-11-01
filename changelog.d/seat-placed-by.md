## 2026-10-30 · feat(seating): a seat says who placed it — you, or Auto arrange [migration]

Owner 2026-10-29 (DECISION_LOG "GUESTS ANSWERS (owner ~14:40)", answer 4 — *"ok"* to "add who placed each seat (auto /
arrange vs the couple) to drive the swap sheet's 'why here'"; prototype `whyHere`: "You placed Ana here · yesterday").

- **Migration `20271297291493_seat_assignment_placed_by`** (via `pnpm migration:new`, additive + idempotent, inherits
  RLS): `event_seat_assignments.placed_by` ('couple' · 'auto' · NULL, CHECKed) + `placed_at`. Rule 0: `locked` means
  PINNED (the solver keeps it), not who placed it; `created_at` is the first write, not the last move. NULL = not
  recorded (every seat before this), and such a seat says nothing — never a guess.
- **Writers** (`lib/seat-why.ts` `placedByCouple` / `placedByAuto`): by hand → assignGuest · assignGroup ·
  seatRoleAtTable · createTable with its guests · the guest card's Table pick · a group seated at a table · both swaps
  (`swap_seat_assignments` / `swap_table_assignments` RPCs, then `stampPlacedByCouple` — which clears the seats to "not
  recorded" if the stamp cannot land, so a moved seat never keeps a stale "Auto arrange"). Solver → autoSeatGuests ·
  Fill around locked seats · autoArrange · buildSeatingDraft · the live reconcile. The undo restores re-place seats as
  "not recorded".
- **Shown**: the guest card's Seat Plan fold, under the Table pick — "You placed Ana here · yesterday" / "Auto arrange
  placed Ana here · today"; Seats › List — each face's spoken name and tooltip ("Ana Reyes, Table 3, seat 4, placed by
  you"). `fetchAssignments` and the card's seat read now ask for the two columns.
- Next (slice 6a): the swap/move confirm sheet's "why here" reads the same `seatWhyWords`.
- Guard `lib/a-seat-says-who-placed-it.test.ts`.
- **Reach (exposure baseline, read line by line):** the two new columns carry the table's existing table-level grants,
  exactly like its other nine; the rows stay behind the same policies (the couple, and seat-plan helpers by their level).
  `anon` holds no row policy on this table, so it still reads nothing.

SPEC IMPACT: None — schema addition for an approved ruling (DECISION_LOG 2026-10-29); no spec text changes.
