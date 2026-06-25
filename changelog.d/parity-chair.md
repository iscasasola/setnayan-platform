## 2026-06-26 · feat(seating-3d): 2D→3D parity — remove / restore individual chairs

On the selected table (build mode), tap a chair to remove it; tap its faint ghost
to restore it. `setTableSeat` (optimistic `removedSeats` update). Removing an
occupied chair is guarded client-side ("unseat the guest first") to match the
server. Removed chairs render as low-opacity ghosts and drop their avatar.

SPEC IMPACT: 0008 Seating — 3D lab per-chair remove/restore parity.
