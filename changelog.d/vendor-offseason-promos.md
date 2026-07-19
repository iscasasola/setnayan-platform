## 2026-06-29 · feat(vendor,explore): Off-Season Promos (Wave 5 "Soon" vendor benefit)

End-to-end wiring of off-season promos on top of the EXISTING per-service
`off_peak` discount fields — no new pricing schema, no new table.

- **Vendor nudge** (`/vendor-dashboard/services`): derives the vendor's lean
  months from their own booking calendar (`vendor_schedule_pool_bookings` +
  `vendor_calendar_blocks`), falling back to `wedding_season_factors` troughs
  for their region, then a conservative PH off-season default. A one-line band
  ("Your <months> look light — launch an off-season offer") deep-links to a
  target service's editor (`?offpeak=<id>`) which opens its Discount section
  PRE-FILLED with an `off_peak` discount type, lean-window conditions, and a
  suggested expiry. The vendor still sets the discount amount (vendor-entered,
  admin-policy-safe). Suppressed once the vendor already runs a live off-peak
  offer. New helper `lib/vendor-lean-months.ts` (pure, testable).

- **Couple surface** (`/explore`): vendors with a LIVE off-peak offer
  (`vendor_services.discount_type='off_peak' AND discount_expires_at > now()`)
  get an "Off-season savings" badge + a savings band on their card. A new
  `?offseason=1` filter (toggle band above the grid, preserved across
  pagination via `buildHref`) narrows the marketplace to those vendors, with
  an off-season-aware empty state. The market_stats view doesn't carry the
  per-service discount columns, so the eligible vendor set is resolved from
  `vendor_services` and `.in()`-constrained (same shape as demo-vendor
  include/exclude).

Cron-free (expiry is read at request time). Reused the existing
`off_peak` per-service columns; SKIPPED the optional `vendor_promo_windows`
table — per-service discount fields are more granular and need no new schema.

SPEC IMPACT: None. Reuses existing `vendor_services` discount columns
(migration `20270108000200`) + `wedding_season_factors` (`20261001000000`).
No SKU/pricing change — discount values stay vendor-entered.
