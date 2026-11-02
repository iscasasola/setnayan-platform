## 2026-06-29 · ux(pricing): vendor tiers display annual-first

Vendor subscription pricing now leads with the **annual** price as the hero
number and shows the **28-day/monthly** price as the secondary line, on both
vendor pricing surfaces (owner directive "vendor show annual then offer the
monthly"). Display order only — no price changes; all numbers are still read
live from `vendor_billing_catalog`.

- `apps/web/lib/v2-catalog.ts` — `getVendorPrices()` now also surfaces
  `soloAnnual` + `soloAnnualSave` (the `solo_vendor_annual` SKU was already in
  the catalog at ₱9,999/yr but was being dropped on the floor).
- `apps/web/app/for-vendors/_components/vendor-pricing-matrix.tsx` — Solo / Pro /
  Enterprise tier headers (desktop) + mobile banner now read the annual price as
  the hero (`₱X / yr`) with a `save ₱Y/yr` cue and an `or ₱Z / 28d` secondary
  line. `VendorMatrixPrices` gained `soloAnnual` + `soloAnnualSave`.
- `apps/web/app/for-vendors/_components/for-vendors-deep-dive.tsx` — Enterprise
  tier teaser leads with `₱X/yr`.
- `apps/web/app/pricing/page.tsx` — vendor subscription cards render the annual
  price as the `text-5xl` hero with a "Best value · save ₱Y (Z%)" badge and the
  28-day price as a secondary line.

SPEC IMPACT: Pricing.md § 0.C display note already added in corpus.
