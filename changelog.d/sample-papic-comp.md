## 2026-06-20 · chore(sample): comp Papic crew for the Maria & Jose sample event

Enables a real owner-driven Papic shoot to land in the public tour gallery, replacing the 8 placeholder tiles. The `papic-shoot-wiring` investigation found a real capture only reaches the tour wall (`wall_feed`, read by `getWallSnapshot`) when TWO gates pass: the seat is non-sampler ("paid") so `recordSeatCapture`'s `after()` chain runs `ingestToWall`, AND the event has a `LIVE_WALL` row in `event_software_activations_v2` (the `wall_ingest` G0 gate).

- **`scripts/comp-sample-papic-seats.sql`** (idempotent; applied to prod via `db query`): mints a comp `PAPIC_SEATS` order (status `paid`, ₱0 — honors the "iscasasolaii@gmail.com gets free services" rule), inserts the `LIVE_WALL` activation (vendor_id = stable founder vendor, since the column is NOT NULL), and provisions **5 paid (non-sampler) seats** with fresh base64url claim tokens. Sample event verified to have 0 faceblock guests (no fail-closed wall withholding).

Owner runs the shoot via a seat claim link (`/papic/claim/{token}`); captures auto-flow capture → R2 → `papic_photos` → NSFW screen → `ingestToWall` → `wall_feed` → tour gallery (refresh-to-update). **Placeholder supersede is a deferred step**: only AFTER the owner confirms real tiles on `/tour/gallery`, delete the 8 placeholder `papic_photos` (`r2_object_key LIKE 'sample/papic/maria-jose/%'`) — the wall reader re-checks source existence at read time, so their Unsplash tiles vanish with zero empty window.

SPEC IMPACT: None (sample/demo data + ops comp; no SKU/schema/pricing change).
