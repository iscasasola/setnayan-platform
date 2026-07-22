## 2026-07-22 · feat(setnayan-ai): wire the price-change (GRD-03) + availability-change (GRD-09) guards — Phases 2–3

Finishes what the marketing-page reconciliation started: `/setnayan-ai` promises Setnayan AI watches shortlisted/booked vendors for **price changes** and **availability/double-bookings** — but neither guard had a data source (Phase 1 shipped only the schedule-clash guard). This wires both, on the **global vendor-side history** the owner chose.

**GRD-03 price-change (Phase 3):**
- Migration `20270906702060` — new `vendor_service_price_history` table + a `SECURITY DEFINER` trigger on `vendor_services` that logs every change to the couple-facing `starting_price_php` (global; reusable by Market Intel). RLS: vendor-owner + admin read only; writes only via the trigger.
- Snapshot: `priceChangesFromHistory` collapses recent history to one net change per (vendor, category) for the couple's shortlisted/booked marketplace vendors. The existing `priceRiseTrigger` fires when new > old.

**GRD-09 availability-change (Phase 2):**
- No new table — `vendor_calendar_blocks.created_at` is the global change signal. `availabilityChangesFromBlocks` flags a watched vendor with a recently-created block overlapping the couple's event day ("newly booked on your date").
- New `SnapshotAvailabilityChange` type + `availability` field on `PlanningSnapshot` + `availabilityChangeTrigger` (GRD-09, priority 80) registered in `runTriggers`, the digest count, and the "Next up" label.

**Plumbing:** `buildPlanningSnapshot` (the notify sweep's admin-client snapshot) loads the couple's watched vendors via `event_vendors.marketplace_vendor_id`, then reads price-history + calendar-blocks (45-day window). Both guards surface via the live notify sweep (email/in-app) with titles + deep-links to `/vendors`; the in-app watch rail leaves them `[]` (avoids a duplicate read). Fail-soft throughout.

Fires live for active events with no flag flip (the guard pipeline is already on). Now the `/setnayan-ai` "a price that moved" / "a date about to clash / availability" claims are all backed by real detection.

Tests — `availabilityChangeTrigger` (GRD-09) + `priceChangesFromHistory` / `availabilityChangesFromBlocks` pure helpers (net change, humanized category, day-overlap, dedup, unwatched-dropped). Full unit suite green (2578), typecheck + lint + migration-doctor + timestamp clean; the new migration replays cleanly in PGlite. Migration auto-applies on merge.

SPEC IMPACT: None — activates existing (template-only) guards against a new global price-history table + the existing calendar; no SKU/price/entitlement change. Resolves the `/setnayan-ai` marketing over-claim (the original task chip).
