## 2026-07-25 · feat(vendor-pricing): open 3D Plan Ads to every tier at the tiered price (flag-dark)

Third gate-open under the owner-locked 2026-07-25 vendor monetization model
(after the Papic Challenge pair, #3692/#3697). Booth branding stops being a
PRO/ENTERPRISE **tier perk** and becomes a paid **add-on any tier can buy** —
`resolveVendorAddonPricePhp('ads_3d_plan', tier)` → **₱2,000 Free/Solo · ₱1,500
Pro/Enterprise** — reusing the same `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING`
switch, so access and price can never flip apart.

No migration: unlike Papic (whose `papic_create_vendor_challenge` RPC carried a
SQL tier gate), the 3D booth has **no tier gate in the database** — every gate is
TypeScript. This PR is pure app code.

- `lib/seating-3d.ts` — `boothCanBrand(tier, allTiersAllowed?)` and
  `boothIsBranded(vendor, allTiersAllowed?)` gain the same optional switch
  `photoChallengeEligibility` uses. Default `false` → byte-identical. The module
  stays **PURE** (no env read) so it remains `tsx --test`-friendly.
- `lib/booth-branding-tier-gate.ts` (**new**) — the one place that feeds that
  switch from the build-time flag, exporting `boothTierCanBrand` /
  `boothRendersBranded`. Seven live call sites read it instead of the flag, so a
  missed site can't brand the logo but not the poster (or the crowd-avoidance
  disc).
- **Render (5 sites)** — `venue-objects.tsx` (logo backdrop · raw poster · Booth
  Studio poster), `kit/booth-template.tsx` (nameboard-vs-logo), and
  `kit/booth-templates.ts` (the poster-stand obstacle disc) now call
  `boothRendersBranded`.
- **Showcase gates (2 sites)** — `/v/[slug]/booth` (the vendor's own 3D booth
  preview) and the profile page's link to it now call `boothTierCanBrand`, so a
  Free/Solo vendor can preview what they'd be buying.
- `booth-addon-actions.ts` (buy action) — the `isTierAtLeast(tier, 'pro')`
  rejection is skipped when the flag is on, and the cycle price comes from the
  tier band instead of the flat catalog row. The tier is re-read server-side from
  `vendor_profiles.tier_state`, so a tampered client can't buy at the cheaper Pro
  price. Two messages that hardcoded "₱1,500" now print the vendor's own renewal
  price.
- `subscription/page.tsx` + `booth-addon-card.tsx` — the card's `eligible` and
  `pricePhp` mirror the action exactly, so it never offers what the server would
  reject. No new card branch was needed: every price it prints already came from
  the prop, and with the tier gate lifted the only remaining ineligible state is
  "not verified yet", which has its own copy.

**UNCHANGED, deliberately:** the verified-only rule; the one-time free first
28-day cycle and its atomic trial claim; apply-then-pay; the `is_active=false`
catalog kill-switch; and — most importantly — the **ACTIVE-add-on half of the
render gate**. Opening tiers gives nobody a free branded booth: no live
`booth_addon_expires_at` window, no branding, on every tier. Pinned by 4 new
tests (`booth-branding-gate.test.ts`), including one that asserts omitted and
explicit-`false` agree on every tier.

FLAG-DARK: `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` is the only switch; with it
off (default) all seven sites, the buy action, and the card are byte-identical to
today's Pro+ perk at the flat catalog price. Typecheck clean · 3246/3246 unit
tests pass · `lint:entitlement-gates` clean.

SPEC IMPACT: None (implements the already-locked
`Vendor_Monetization_Model_LOCKED_2026-07-25.md` + its build plan step 1).
