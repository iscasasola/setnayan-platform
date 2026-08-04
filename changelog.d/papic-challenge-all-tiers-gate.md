## 2026-07-25 · feat(vendor-pricing): open Papic Challenge to all tiers — backend gate (flag-dark)

First consumer step of the LOCKED 2026-07-25 vendor monetization model: Papic
Challenge is priced for Free/Solo (₱500) AND Pro/Ent (₱400), i.e. every tier may
sponsor it (was Solo-and-up). This PR lands the **backend gate-open** flag-dark;
the buy-action + UI wiring (pass the flag, show the tiered price) is a follow-up.

- `migration 20271001130000` — adds `platform_settings.vendor_addon_tiered_pricing_enabled`
  (the DB mirror of `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING`; SQL can't read env)
  and makes the tier gate in `papic_create_vendor_challenge` conditional on it:
  ON → free/verified may also create; OFF (default) → the pre-2026-07-25 Solo+
  gate stands verbatim. RPC body otherwise identical to 20270906348207
  (CREATE OR REPLACE, signature unchanged → grants preserved).
- `lib/vendor-photo-challenge.ts` — `photoChallengeEligibility` gains an optional
  `allTiersAllowed` input: when true it lifts the Pro+ gate (every tier passes,
  other gates unchanged); default false → byte-identical. Kept a plain input so
  the module stays pure; the caller sets it from `isVendorAddonTieredPricingEnabled()`.
- `lib/vendor-photo-challenge.test.ts` — +3 cases (all-tiers lifts the gate, other
  gates still apply, default-off identical).

SHIP-DARK: the DB flag defaults FALSE and no caller passes `allTiersAllowed` yet,
so creation behaves exactly as today. Opening the RPC alone is user-inert until
the purchase surface also passes the flag (follow-up). Migrations auto-apply on
merge — verify the column + RPC landed.

SPEC IMPACT: None (implements the already-locked model + DECISION_LOG 2026-07-25).
