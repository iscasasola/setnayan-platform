## 2026-06-29 · fix(pricing): repoint stale Solo vendor price to the catalog

The "For vendors" intro card on `/pricing` hardcoded the Solo 28-day price as
"₱2,000/28d" — a pre-reprice figure. The live Solo price in
`vendor_billing_catalog` is ₱999/28d, so the public page was showing a wrong,
2x-too-high Solo price. Repointed it to the catalog (same row the tier cards
render) so it can't drift again. Not hardcoded — reads `vendorSubs`.

- `apps/web/app/pricing/page.tsx` — new `soloMonthlyLabel` derived from
  `vendorSubs.find(s => s.sku_code === 'solo_vendor_monthly')` (₱999 fallback
  only if the row is missing); intro copy now interpolates it instead of the
  literal "₱2,000/28d".
- `apps/web/lib/v2-catalog.ts` — `getVendorPrices()` fallback strings + `num`
  defaults updated from the old pre-reprice ladder (Solo ₱2,000 · Pro ₱6,000 ·
  Enterprise ₱10,000 · Pro annual ₱60,000 · Enterprise annual ₱100,000) to the
  live ladder (Solo ₱999 · Pro ₱2,499 · Enterprise ₱4,999 · annual
  ₱24,999 / ₱49,999). These only ever render if the catalog read returns empty;
  the live read still wins. Prevents a stale price on `/for-vendors` +
  `/how-it-works` if the DB is briefly unreachable at build/render.
- `apps/web/lib/vendor-tier-caps.ts` — corrected two stale doc comments that
  still listed the pre-reprice ₱2,000/₱6,000/₱10,000 ladder.

Swept the repo for other "₱2,000" / "2000/28" vendor-price strings; the only
remaining ₱2,000 occurrences are unrelated (a voucher-cap example, a civil-
ceremony budget estimate) and were left untouched.

SPEC IMPACT: None — code-only fix; corpus already carries the live ladder
(Pricing.md § 0.C).
