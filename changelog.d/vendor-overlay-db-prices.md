## 2026-07-01 · fix(home): vendor pop-up prices are DB-driven + unmistakably 28-day

The tier-organized "For vendors" pop-up (#2504) HARDCODED the Solo/Pro/Enterprise
prices (₱999/₱2,499/₱7,499 · "/ 28 days"), violating the never-hardcode-prices
lock (pricing-data.ts: "the live homepage must NOT hardcode prices — admin price
changes have to propagate"). The 28-day figures were correct, but frozen in code
and easy to misread as annual. Fixed:

- `pricing-data.ts` — `getHomePricingData()` now also resolves the vendor tier
  prices via `getVendorPrices()` (reuses the vendor-catalog read it already did)
  and exposes them on `PricingData.vendor`; the type gains a `vendor` field.
- `vendor-benefits.ts` — removed the hardcoded `price`/`unit` from every
  `VENDOR_TIER_SECTIONS` entry; the overlay resolves them from the live catalog.
- `HomeOverlays.tsx` — new `tierPriceBlock()` renders each tier's 28-day price
  from `pricing.vendor` PLUS an explicit annual secondary line ("or ₱X / yr"),
  matching /for-vendors so the 28-day cadence is unmistakable. `VendorsOverlay`
  now receives `pricing`.
- `home-reskin.css` — made the "/ 28 days" unit more legible (darker, heavier)
  and added the `.hr-vt-annual` secondary-line style.

Now a catalog reprice propagates to the pop-up automatically, and Solo/Pro/
Enterprise read e.g. "₱7,499 / 28 DAYS · or ₱74,999 / yr" — no longer mistakable
for annual pricing.

SPEC IMPACT: none — presentation + catalog-wiring; no schema/SKU/price change.
