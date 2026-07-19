## 2026-06-26 · feat(seating-3d): 2D→3D parity — the custom auto-seat rules (keep-apart + priority)

The "auto-seat custom rules we used to have," now in the 3D lab. A collapsible
**Seating rules** panel + a per-guest priority chip in the roster — all feeding
the same server solver auto-seat already uses:

- **Keep apart** — pick two guests → auto-seat never seats them together
  (`addSeatingConstraint` / `removeSeatingConstraint`). Undirected; graceful list.
- **Seat in this order** — reorder the role-tier fill priority with up/down
  (`savePriorityOrder`).
- **Per-guest priority chip** — tap a roster guest's chip to cycle ·→P1→…→P4→·,
  overriding their tier (`setGuestSeatingPriority`).

Threading: the lab page now also fetches `fetchSeatingConstraints` + passes
`priority_order` and per-guest `seating_priority`; `Lab3DGuest` gains
`seatingPriority`. Rules are DB-only (no seat sync) — optimistic local state +
persist; the chip repaints from the refreshed guest rows.

SPEC IMPACT: 0008 Seating — 3D lab keep-apart + priority parity.
