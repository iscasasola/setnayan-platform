## 2026-07-01 · feat(vendor/pricing): Ladder B prices + bounded Enterprise caps (Phase 3a)

Owner-confirmed 2026-07-01. Locks the vendor subscription ladder and makes
Enterprise a bounded tier (a negotiated "Custom" tier + the 13-cycle billing /
upgrade proration follow in 3b/3c).

- **Prices → Ladder B** (the pre-reset ₱2,000/6,000/10,000 "Ladder A" is dead):
  Solo ₱999 · Pro ₱2,499 · Enterprise ₱7,499 / 28-day cycle; annual = 10× the
  28-day fee (₱9,999 / ₱24,999 / ₱74,999). Enterprise repriced ₱4,999→₱7,499.
  - Migration `20270403295886` — idempotent `UPDATE`s on `vendor_billing_catalog`
    (authoritative; read via getVendorPrices). Safe regardless of current live
    value. Only PRICE touched — cap columns aren't the enforcement SSOT.
  - `lib/vendor-tier-caps.ts` `TIER_PRICE_PHP` fallback → Ladder B.
- **Enterprise caps bounded** (`TIER_CAPS.enterprise`, was all `Infinity`):
  team seats **10** · events/day **8** · portfolio **300** · radius **100km**
  (nationwide-marketed). Left unbounded: parentCategories ("all" — taxonomy-
  bounded) + servicesPerLeaf + in-app volume. The truly-unlimited case is the
  forthcoming Custom tier.
- Stale hardcoded Ladder A copy fixed: subscription web-nudge banner + its JSDoc
  example → Ladder B.

Per the marketing session's handoff (VENDOR_TIERS_AND_BENEFITS §5) which assigned
the DB reprice to this session. Verified: typecheck · ESLint · migration
timestamp guard · no test couples to the old caps/prices.

SPEC IMPACT: None — captured in `03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md`
§0.6 + memory `project_setnayan_pricing_tiers` / `project_setnayan_vendor_tier_ladder`.
