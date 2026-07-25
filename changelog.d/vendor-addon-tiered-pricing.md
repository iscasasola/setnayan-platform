## 2026-07-25 · feat(vendor-pricing): tiered add-on price SSOT (inert foundation, flag-dark)

First build step of the LOCKED 2026-07-25 vendor monetization model
(`Vendor_Monetization_Model_LOCKED_2026-07-25.md` + `..._BUILD_PLAN_2026-07-25.md`).
The model reprices every vendor add-on into two tier bands — Free/Solo pay the
standard price, Pro/Enterprise pay a cheaper "subscriber" price — and splits two
products into variants (AI Chatbot Basic/Advanced; Deep Search About-You / Market
Scan).

This PR lands only the **pure price source of truth**, so downstream wiring PRs
have one tested place to read from:

- `lib/vendor-addon-tier-pricing.ts` — the owner-locked PHP matrix
  (`VENDOR_ADDON_TIER_PRICES_PHP`) + `vendorAddonPriceBand()` (Pro-and-up =
  cheaper `growth` band, reusing `isTierAtLeast`) + `resolveVendorAddonPricePhp()`.
  PURE (no I/O / clock / env) so it unit-tests under `tsx --test`.
- `lib/vendor-addon-tiered-pricing-flag.ts` — `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING`
  (default OFF). The flag that later switches live checkout onto this matrix;
  kept separate so the pricing module stays I/O-free.
- `lib/vendor-addon-tier-pricing.test.ts` — 10 cases: band mapping (incl. the
  fail-safe null/unknown → entry, never the cheaper price), the full matrix, and
  a monotonicity guard (entry ≥ growth for every SKU).

INERT: no live checkout reads this yet, so today's flat add-on prices are
byte-unchanged. Consumer wiring (Papic Challenge, 3D Ads, the two variant splits)
lands in follow-up flag-dark PRs per the build plan.

SPEC IMPACT: None (spec already locked in `Vendor_Monetization_Model_LOCKED_2026-07-25.md`
+ DECISION_LOG 2026-07-25; this is code that implements it).
