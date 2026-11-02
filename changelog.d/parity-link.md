## 2026-06-26 · feat(seating-3d): 2D→3D parity — link / unlink tables (move as one unit)

Link two tables into one unit (one name, one printed QR, moves together):

- **Link to another table** on the selected table arms link-mode; tapping a second
  table calls `linkTables`. Optimistic: a shared temp group id + combined label on
  both, reconciled to the server's real group on refresh.
- **Break apart** dissolves the unit (`unlinkTable`), optimistically nulling the
  group on every member.
- **Move as one** — dragging any linked table translates every member by the same
  delta (optimistic + per-member persist).
- **Grouping survives refresh** — the merge-snapshot effect was add-only (couldn't
  reflect link/unlink on existing rows); now it runs a new unit-tested
  `reconcileGrouping` helper that patches `linkGroupId`/`label` from server truth
  while leaving position/rotation optimism intact.

Deferred (noted): centroid-orbit rotation of a linked unit (rotate currently spins
the selected table only).

SPEC IMPACT: 0008 Seating — 3D lab link/unlink parity.
