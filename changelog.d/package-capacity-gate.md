## 2026-06-20 · fix(booking): close the package double-booking hole — packaged bookings now consume schedule-pool capacity

**Bug (found in the Named Calendars design audit):** a `vendor_packages` true-bundle booking could be confirmed on a date that's already full for the vendor's category — a double-booking hole on a money/booking path. The normal booking gate in `updateVendorStatus` acquires schedule-pool capacity on the white→`deposit_paid` transition, but it only fired when the row had **both** `marketplace_vendor_id` **and** `service_id`. `lockPackage` cascade-rows set `marketplace_vendor_id` but **never set `service_id`** (package items map to a *category*, not a `vendor_service`), so the gate silently skipped every packaged row → no capacity consumed, full dates overbookable.

- **`lib/schedule-pools.ts`** — new `resolvePoolIdsForCategory(supabase, vendorId, category)`: resolves a vendor category to its pool via the shared `resolve_schedule_pool` RPC. Flag-agnostic (named-calendar membership keys on `service_id`, which a package row lacks, so category resolution is correct in both modes). Returns `[]` for no category / junk-pool guard (degrade open, unchanged).
- **`vendors/actions.ts` → `updateVendorStatus`** — the white→BOOKED gate now resolves by **service when present, else by category**, and the guard admits rows with a vendor link + a category (not only `service_id`). So a packaged row marked `deposit_paid` now goes through `acquireSchedulePools` exactly like a normal booking — a full/closed date blocks it with the same messaging; the existing release-on-downgrade (status-flip, never DELETE) is unchanged.
- **`lib/schedule-pools.test.ts`** — regression suite: a category-only row resolves to its pool (the package path); no category → no pool + no RPC; junk-pool guard → `[]`.

Not flag-gated — it's a correctness fix that makes the gate strictly more complete (it never blocks a date that isn't actually at capacity; unpooled categories still degrade open). No migration.

**Residual (documented, not a regression):** a package item in a category the vendor doesn't *also* sell standalone won't resolve to a pool (`resolve_schedule_pool`'s junk-pool guard) and stays ungated — same behavior as any unpooled/off-platform booking; revisit if such package-only categories become common. tsc + unit clean.

SPEC IMPACT: booking schedule-pool model (0022) — `vendor_packages` brought under the capacity gate. Logged in `DECISION_LOG.md`.
