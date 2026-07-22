## 2026-07-22 · fix(setnayan-ai): close the 3 gaps in the price/availability guards

Follow-up to the Phase 2–3 guards (#3518) — closes the three fixable gaps from the gap audit.

**#1 — the in-app watch rail now shows price + availability (was notify-only).** Extracted the vendor-history join into a shared `loadVendorChangeSignals(admin, watchedVendors, eventDate)` in `setnayan-ai-snapshot.ts`; `buildPlanningSnapshot` (notify) and `event-dashboard.tsx` (the Overview rail) now both call it, so GRD-03/GRD-09 surface in-app *and* by notification — consistent with the clash guard. The rail uses the admin client (the price-history table is RLS'd away from couples) and fail-softs to empty.

**#2 — the capture trigger is now proven by a test.** `tests/db/vendor-price-history-trigger.db.test.ts` replays the migrations into PGlite, INSERTs a vendor + service, UPDATEs the price, and asserts a `vendor_service_price_history` row appears (old → new); plus a no-op update logs nothing and a demo service is skipped. Wired into CI via a new `test:db:ci` step (runs the curated CI-safe db-tests, not the whole suite).

**#3 — demo/bulk noise removed.** Migration `20270911239524` re-defines the capture function to skip `is_demo` services (`AND NEW.is_demo IS NOT TRUE`), so seeded demo vendors no longer pollute the global history table.

Typecheck 0 · lint clean · build clean · full unit suite green (2708) · `test:db:ci` 3/3 (incl. the new trigger test) · migration-doctor + timestamp clean. Migrations auto-apply on merge.

SPEC IMPACT: None. Leaves the two by-design scopes intact (price history starts empty / only future changes; GRD-09 flags "became busy", not "freed up").
