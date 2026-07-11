## 2026-07-11 · feat(vendors): activate service-date availability via a scoped, privacy-preserving RPC

Lights up the "Booked your date" down-rank in the couple's category search (shipped dormant
in PR #3089) without exposing vendor calendars. Owner-picked privacy model (2026-07-11):
couples never read `vendor_calendar_blocks` (block labels + full schedules are private).

- New migration `20270721314905_vendors_blocked_on_date_rpc.sql` — a SECURITY DEFINER
  function `vendors_blocked_on_date(uuid[], date)` returning ONLY the subset of the passed
  vendor ids that have a block overlapping the couple's ONE event date (PH / Asia/Manila).
  No labels, no other dates, no schedule density leak. REVOKE PUBLIC/anon · GRANT authenticated.
- `category-search.ts` now calls the RPC (session client) instead of the RLS-scoped direct
  `getBatchVendorAvailableDays` read (which returned nothing under couple RLS → dormant).
  Still fail-open: RPC error / no locked date / no blocks → nobody flagged, search unchanged.
- Removed the now-unused `getBatchVendorAvailableDays` / `formatDayKey` imports from the search
  (both still used elsewhere for vendor/couple-owned availability under their own RLS).
- Validated in prod: a vendor is flagged on its actual block day and free on a neighbouring date.

SPEC IMPACT: Resolves the "availability dormant until a couple-readable vendor_calendar_blocks
policy" note (DECISION_LOG 2026-07-11, PR #3089). Chosen model = scoped RPC (not a blanket
SELECT) so no calendar/label data crosses to couples. Additive; no flag (soft down-rank,
fail-open). Logged in DECISION_LOG.md 2026-07-11.
