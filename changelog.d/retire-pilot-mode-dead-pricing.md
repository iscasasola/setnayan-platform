## 2026-07-27 · fix(pricing): retire pilot-mode + launch-promo dead pricing path

A site-wide banner could promise "every add-on and subscription is free" while
checkout charged full price. The banner and the charge path read different
sources, and the source the banner read had silently stopped meaning anything.

**The defect.** `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` is set in the production
Vercel env, and its docstring claimed setting it makes "EVERY paid SKU resolve
to ₱0". It did not. `isPilotFreeMode()` had exactly one live caller —
`app/_components/pilot-mode-banner.tsx`, a banner. The live V2 charge path
(`lib/order-charge-math.ts` · `resolveRetailChargeCentavos` in
`lib/v2-catalog.ts`) never consulted it. Latent, not active: the banner was not
rendering on www.setnayan.com, so the env value is a past date or falsy. Setting
it to any future date would have shipped the contradiction to every visitor.

`LAUNCH_PROMO_SKU_CODES` (16 SKUs "free through 2027-01-30") was dead for a
second, independent reason: it keys on **legacy lowercase** codes
(`vendor_pro_weekly`, `panood_daily_broadcast`) while the live catalog
`platform_retail_catalog_v2` keys on **uppercase** service_codes (`SEATING_3D`,
`COUPLE_WEBSITE_PRO`). The two sets never intersected, so nothing was ever
discounted by it. `getEffectivePriceCentavos()` had zero callers.

**Fix — option (b), one free-pricing mechanism.** Deleted the banner (both the
server component and its client route-gate) and the dead helpers
`LAUNCH_PROMO_UNTIL` · `LAUNCH_PROMO_SKU_CODES` · `getPilotFreeUntil` ·
`isPilotFreeMode` · `isFreeNow` · `getEffectivePriceCentavos` ·
`getPromoEndDate` · `formatPromoEndDateShort`. Un-exported `priceCentavosToPeso`
(no external callers; still used internally by `formatCentavosPhp`).

Free pricing now has exactly one home: `public.promo_free_windows` — admin CRUD
at `/admin/pricing?tab=free-windows`, read by `lib/promo-free-windows.ts`, ORed
into the real entitlement gate in `lib/entitlements.ts` (`eventSkuActive`)
alongside comp_grants and founder_seats, and surfaced by
`promo-free-window-banner.tsx`. Banner and gate read the same source, so they
cannot disagree. Replaced the misleading docstring with a pointer to it and a
"do not reintroduce a pricing override here" note.

**Kept:** `formatCentavosPhp` (11 live callers), `SKU_CATALOG` + `findSku`
(`lib/upcoming-items.ts`), `RETIRED_SKU_CODES` and
`BIR_MARKETPLACE_WITHHOLDING_PCT` (0 callers each, but historical records
outside this change's scope — flagged, not touched).

**Test guard.** `global-banner-capture-gate.test.ts` asserted `mounted.length >= 3`
against the root layout's banners; deleting one made that floor unsatisfiable.
Lowered to `>= 2` with a comment explaining that the floor exists to stop the
loop going vacuous, and removed the now-meaningless pilot-specific test. The
general sweep — every mounted banner must reach `capture-safe-routes` — is
unchanged and still passing.

Verified: typecheck clean for every touched file · eslint clean · banner-gate
test passes · `lint:entitlement-gates` clean (3116 files) · `lint:retired` clean.

SPEC IMPACT: `DECISION_LOG.md` row added (2026-07-27) recording that
`promo_free_windows` is the single free-pricing mechanism and that the
pilot-mode / launch-promo path is retired. No iteration spec edit — pilot mode
was never in the corpus as a product behaviour.
