## 2026-06-26 · feat(seating-3d): 2D→3D parity phase 1 — change table type · publish · print pack

Owner chose FULL 2D/3D editing parity. Phase 1 brings over the reliable,
workflow-completing actions whose server logic already exists (no state-sync
trap) so you can finish + output a plan entirely from the 3D lab:

- **Change table type** — the selected table gets a type picker
  (TABLE_TYPE_CATALOG); `updateTableType` recomputes capacity server-side and the
  merge-snapshot effect re-renders the new shape (same path as Add-a-table).
- **Publish** — `publishSeating` stamps the table QR sheets; a notice reports the
  count.
- **Print pack** — opens the existing `/seating/print` pack in a new tab.

Phased plan for the rest (in priority order): auto-seat (needs the assignment
result synced back to the lab's local seat state) · keep-apart rules + priority
tiers (new pair/tier UI) · floor sizing (stage/dance/venue handles) · link tables.

SPEC IMPACT: 0008 Seating — 3D lab gains table-type/publish/print (parity phase 1).
