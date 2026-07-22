## 2026-07-22 · fix(setnayan-ai): close the 3 gaps in the price/availability guards

Follow-up to the Phase 2–3 guards (#3518) — closes the three fixable gaps from the gap audit.

**#1 — the in-app watch rail now shows price + availability (was notify-only).** Extracted the vendor-history join into a shared `loadVendorChangeSignals(admin, watchedVendors, eventDate)` in `setnayan-ai-snapshot.ts`; `buildPlanningSnapshot` (notify) and `event-dashboard.tsx` (the Overview rail) now both call it, so GRD-03/GRD-09 surface in-app *and* by notification — consistent with the clash guard. The rail uses the admin client (the price-history table is RLS'd away from couples) and fail-softs to empty.

**#2 — the capture trigger is now proven by a test.** `tests/db/vendor-price-history-trigger.db.test.ts` replays the migrations into PGlite, INSERTs a vendor + service, UPDATEs the price, and asserts a `vendor_service_price_history` row appears (old → new); plus a no-op update logs nothing and a demo service is skipped. Wired into CI via a new `test:db:ci` step (runs the curated CI-safe db-tests, not the whole suite).

**#3 — demo/bulk noise removed.** Migration `20270911239524` re-defines the capture function to skip `is_demo` services (`AND NEW.is_demo IS NOT TRUE`), so seeded demo vendors no longer pollute the global history table.

**#4 — GRD-09 now fires both directions (freed-up follow-up).** A deleted calendar block leaves no `created_at` to read, so migration `20270911937450` adds a small `vendor_availability_freed` log fed by an AFTER DELETE trigger on `vendor_calendar_blocks` (RLS: vendor-owner + admin read; rows written only by the SECURITY DEFINER trigger). `availabilityChangesFromBlocks` gained a `status` param and `loadVendorChangeSignals` now concatenates "newly booked" (from `vendor_calendar_blocks`) + "available again" (from the freed log) into GRD-09 — so a shortlisted top pick freeing up on the couple's date surfaces as good news, in-app and by notification. Proven by a new db-test (INSERT → DELETE a block → assert one freed row carrying the old range).

Typecheck 0 · lint clean · build clean · full unit suite green (2710) · `test:db:ci` 4/4 (incl. the price + freed trigger tests) · migration-doctor + timestamp clean. Migrations auto-apply on merge.

SPEC IMPACT: None. Price history remains forward-only (starts empty / only future changes). GRD-09 now covers both "became busy" and "freed up", matching the `/setnayan-ai` "watches for availability" promise.
