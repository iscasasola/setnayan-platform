## 2026-07-01 · feat(vendor): My Performance · Conversion & deals analytics (Phase B family 2)

Second Phase B own-business analytics family on `/vendor-dashboard/performance`
(Pro tier · `canSeePerformanceAdvanced`, flag-dark). Own-business only — every
RPC filters to the caller's own vendor. Column set schema-discovery-mapped and
adversarially verified; the migration was then **compiled + executed against the
prod schema in a rolled-back psql transaction** before merge (all four RPCs
returned real results, nothing committed).

**Migration** `20270422213000_vendor_conversion_analytics_rpcs.sql` — four
SECURITY DEFINER, STABLE, ownership-gated RPCs:
- `vendor_quote_stats` — quote acceptance rate + avg time-to-quote (inquiry
  open → proposal sent, joined on the shared (event_id, vendor) pair).
- `vendor_deal_size` — avg accepted-quote value (`vendor_proposals.total_centavos`)
  + avg/total confirmed contract value (`event_vendors.total_cost_php`, partial
  by design).
- `vendor_lead_time` — booking lead time = `events.event_date` − booking-row
  `created_at` (Asia/Manila); avg + median days.
- `vendor_win_loss` — transparent counts (bookings won / inquiries declined /
  quotes lost) + win rate over DECIDED inquiries only.

**Reader** `lib/vendor-conversion-analytics.ts` (bundles the four RPCs) +
**Card** `ConversionDealsCard` (acceptance / avg deal / median lead tiles +
win-loss detail) + a new Pro-gated **Conversion** section on the page (RPCs only
fetched when the tier renders it).

**Honesty:** peso figures cover on-platform priced bookings only (off-platform
settlement); lead time / cycle use booking-row `created_at` as the booked-date
proxy (no `contracted_at` column exists); win rate is "of decided inquiries" —
the silent-loss class (accepted-but-never-booked, stale quotes) isn't a loss.
All surfaced in the card copy.

SPEC IMPACT: design doc `03_Strategy/Vendor_My_Performance_Tiering_2026-07-01.md`
family-2 row → SHIPPED. DECISION_LOG row appended.
