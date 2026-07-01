## 2026-07-01 · feat(vendor): My Performance · Reputation analytics (Phase B family 3)

Third Phase B own-business analytics family on `/vendor-dashboard/performance`
(Pro tier · `canSeePerformanceAdvanced`, flag-dark). Own-business only. Migration
compiled + executed against the prod schema in a rolled-back psql transaction
before merge (8 reviews / 75% coverage / 4.50★ / 12-month trend returned,
nothing committed).

**Migration** `20270423213000_vendor_reputation_analytics_rpcs.sql` — two
SECURITY DEFINER, STABLE, ownership-gated RPCs:
- `vendor_review_coverage` — overall rating + count, reply-to-review coverage %
  (`vendor_reviews.vendor_reply`, one reply per row), avg reply time, and the
  5→1 star distribution.
- `vendor_review_monthly` — monthly review velocity + avg-rating trend
  (zero-filled via `generate_series`; avg NULL for empty months).

**Reader** `lib/vendor-reputation-analytics.ts` + **Card** `ReputationCard`
(rating / coverage / reply-time tiles + star-distribution bars + a 12-month
reviews-per-month strip) + a new Pro-gated **Reputation** section (RPCs only
fetched when the tier renders it).

Review themes/sentiment intentionally NOT built — the free-text
(`vendor_reviews.body`) exists but no derived sentiment/theme column does; that's
a needs_capture AI pass, deferred.

SPEC IMPACT: design doc `03_Strategy/Vendor_My_Performance_Tiering_2026-07-01.md`
family-3 row → SHIPPED. DECISION_LOG row appended.
