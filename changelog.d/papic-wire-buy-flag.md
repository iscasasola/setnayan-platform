## 2026-07-25 · feat(vendor-pricing): wire Papic Challenge buy-action + UI onto the tiered gate (flag-dark)

Completes the Papic Challenge gate-open started in the backend PR (migration
20271001130000 + `photoChallengeEligibility.allTiersAllowed`). Now the purchase
surface honors the 2026-07-25 tiered add-on model when `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING`
is on:

- `photo-challenge-actions.ts` (buy action) — passes `allTiersAllowed:
  isVendorAddonTieredPricingEnabled()` to the eligibility gate, and records the
  order at the **tier-based price** (`resolveVendorAddonPricePhp('papic_challenge',
  tier)` → Free/Solo ₱500, Pro/Ent ₱400) when the flag is on; today's flat catalog
  price otherwise.
- `vendor-challenge-section.tsx` (UI) — same `allTiersAllowed` flag on the mirror
  gate, and displays the tier-based price (CTA copy + `PhotoChallengeBuy`).

FLAG-DARK: when the flag is OFF (default) both paths are byte-identical to today —
the Pro+ gate stands and the flat catalog price is used. With the flag ON (and the
DB twin `platform_settings.vendor_addon_tiered_pricing_enabled`), Free/Solo can
sponsor at ₱500 and Pro/Ent at ₱400, end-to-end. Type-safe by construction (a
known optional field + two typed pure resolvers); no lib logic changed.

SPEC IMPACT: None (implements the already-locked model + DECISION_LOG 2026-07-25).
