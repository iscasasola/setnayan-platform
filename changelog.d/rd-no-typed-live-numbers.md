## 2026-10-02 · fix(value-leaks): no typed number stands in for a live one

Closes every LEAK and PRICE IN COPY row of `PROTOTYPE_VALUE_LEAKS_2026-10-02.md`:

- **Admin "What you change" tiles** count `admin_audit_log` over the last 90 days
  (`lib/admin/what-you-change.ts`) instead of printing a frozen May–Aug snapshot.
  A count that cannot be read prints no number, never "0 changes".
- **Post a manpower gig**: the cash amount starts empty and is required; a blank is
  refused instead of being stored as ₱15,000. Neither manpower note types the amount.
- **Papic DSLR row** reads `CAMERA_BRIDGE` from `platform_retail_catalog_v2`; while
  the row is inactive (it is) no price is quoted and nothing is offered for sale.
- **Supplier team seat-limit message** reads the live seat fee.
- **Wedding onboarding promo**: one constant, the "−N% onboarding promo" label is
  rendered from it (the shell's second copy is gone).
- **Supplier tier prices** (`getVendorPrices`): the nine typed fallbacks are gone;
  an unreadable price is `null` and renders as "price unavailable" / is omitted from
  metadata and JSON-LD.
- **Guard**: `public-price-literals` now also scans `app/dashboard` and
  `app/vendor-dashboard`, with a small reasoned allowlist; `no-typed-live-numbers.test.ts`
  pins the shapes a peso scan cannot see.

Left for the owner / next pass (deliberately unchanged): the "Your Plan" ₱63.5K / 290
hours headline (owner-locked), the "Maria & Juan" / 150-guest fallbacks, the Patiktok
40-cap sentence, and the 20% onboarding promo figure itself (see PR body).

SPEC IMPACT: None.
