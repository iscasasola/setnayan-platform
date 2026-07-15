## 2026-07-15 · fix(vendor): token price ₱200 → ₱100 — align code constant to the live catalog

`TOKEN_PRICE_PHP` in `lib/v2/region-token-burn.ts` still said 200; the live `vendor_billing_catalog` (canonical per the 2026-07-10 pricing finalization) sells every active pack at exactly ₱100/token (verified against prod: ₱400/4 … ₱10,000/100). All peso-per-lead / token-spend surfaces reading the constant were overstating costs 2×. Also made the vendor-home copy interpolate the constant instead of hardcoding the peso figure (owner rule: no hardcoded dependent values).

SPEC IMPACT: None — corpus already records flat ₱100/token; this brings the code in line.
