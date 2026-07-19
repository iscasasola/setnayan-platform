## 2026-06-26 · feat(seating-3d): 2D→3D parity phase 2/6 — rename · seat-a-tier · unseat · start-seating · fill-locked

Direct (no-drift) parity wins wired into the 3D lab, each calling the same server
action the 2D editor uses:

- **Rename table** — the selected table's name is now an inline-editable field
  (optimistic; server syncs the label across a linked unit). `updateTableLabel`.
- **Seat a tier here** — a per-table picker fills the next unseated guests of a
  chosen role tier; server picks them, lab resyncs from truth. `seatRoleAtTable`.
- **Unseat** — seated guests in the roster get an unseat control (optimistic seat
  delete). `unassignGuest`.
- **Start my seating** — on an empty floor, one tap lays out a starter table set
  AND seats the confirmed guests. `buildSeatingDraft`.
- **Fill around locked seats** — keep hand-placed seats, re-solve the rest honoring
  keep-apart rules. `lockAndFill`.

All bulk-seat ops use the established one-shot `seatResyncRef` (re-derive local
seats from refreshed server truth, no client solver, no drift).

SPEC IMPACT: 0008 Seating — 3D lab editing parity (rename/tier/unseat/draft/lock-fill).
