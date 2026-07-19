## 2026-07-01 · feat(vendor): My Performance · Capacity analytics (Phase B family 4)

Fourth (final buildable) Phase B own-business analytics family on
`/vendor-dashboard/performance` (Pro tier · `canSeePerformanceAdvanced`,
flag-dark). Own-business only. Migration compiled + executed against the prod
schema in a rolled-back psql transaction before merge.

**Migration** `20270424213000_vendor_capacity_analytics_rpcs.sql` — two SECURITY
DEFINER, STABLE, ownership-gated RPCs:
- `vendor_waitlist_depth` — unmet demand: upcoming dates a couple joined the
  waitlist on (`vendor_date_waitlist`, pending|notified, future-dated) + count.
- `vendor_upcoming_load` — distinct upcoming days with a live schedule-pool
  booking (`released_at IS NULL`) + totals, windowed to next 30 / 90 days. Raw
  counts, NOT a utilization ratio.

**Reader** `lib/vendor-capacity-analytics.ts` + **Card** `CapacityCard`
(days-booked-ahead / bookings-ahead / couples-waiting tiles + a "dates in
demand" list) + a new Pro-gated **Capacity** section.

**Deliberately deferred — needs an OWNER DEFINITION, not a guess:** a calendar
*utilization %* requires defining the "available-day" denominator (whole month
vs future-only vs excluding closed/locked) and "booked" (any-consumption vs
full-capacity). The `acquire_schedule_pools` derivation is understood; a guessed
ratio would drift from what couples see, so it's surfaced for owner sign-off
rather than shipped. "Fill pace vs peak season" also needs a cross-business
seasonality baseline (Enterprise-only market-intel territory).

SPEC IMPACT: design doc `03_Strategy/Vendor_My_Performance_Tiering_2026-07-01.md`
family-4 row → SHIPPED (waitlist + load); utilization flagged owner-decision.
DECISION_LOG row appended. **This closes every buildable Phase B family**
(Catalog remains blocked on capture).
