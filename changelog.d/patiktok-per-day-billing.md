## 2026-07-01 · fix(pricing): Patiktok is billed PER EVENT-DAY (₱1,499 / day)

Owner clarified (2026-07-01) that Patiktok is ₱1,499 **per day**, not the flat
one-time the un-retire (#2464) restored. Price is unchanged (₱1,499, admin-
managed); only the billing UNIT becomes per-day — the same event-day model as
Panood ("covers one event-day; add a day wherever you want it").

- New migration `20270331500000_patiktok_per_day_billing.sql`: widens the
  `platform_retail_catalog_v2.billing_period` CHECK to allow `'per_day'`
  (robust DROP of the existing check via a name-agnostic DO block, then re-add)
  and flips `PATIKTOK_COMPILER` → `billing_period='per_day'`.
- `lib/v2-catalog.ts`: `BillingPeriod` type + `BILLING_PERIOD_SUFFIX` gain
  `per_day` → `' / day'`, so `formatBillingPeriodSuffix` / `formatV2Sku` render
  "₱1,499 / day" on the in-app buy surface.

billing_period is DISPLAY-ONLY in the charge path (the amount charged is always
retail_price_php; there is NO generic "recurring if billing_period <> one_time"
logic — the SETNAYAN_AI subscription is keyed on that specific SKU). So per_day
charges a flat ₱1,499 per purchase, activated per event-day like Panood.

SPEC IMPACT: Patiktok pricing model = ₱1,499/day (per event-day). Logged in
DECISION_LOG.md (2026-07-01) + memory project_setnayan_patiktok_retired.
