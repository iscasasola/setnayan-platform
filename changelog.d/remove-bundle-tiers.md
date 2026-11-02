## 2026-06-29 · feat(pricing): remove Essentials/Complete bundle tiers from customer surfaces

Owner directive "no more essentials and complete." The pricing model is now
**Free ₱0 → Setnayan AI ₱3,999 → à-la-carte SKUs (no bundles)**. The two
bundles (`GUIDED_PACK` "Setnayan Essentials" ₱12,999 · `MEDIA_PACK` "Setnayan
Complete" ₱27,999) were already deactivated (`is_active=false`) in
`platform_package_catalog`; the UI was still rendering and selling them. This
removes them from every customer-facing surface and adds defense-in-depth so a
deactivated bundle can never be priced or purchased.

- **`apps/web/lib/v2-catalog.ts`** — `fetchV2BundleCatalog()` now filters
  `.eq('is_active', true)`, so deactivated bundles surface on NO consumer
  (returns `[]`). Mirrors the existing `is_active` semantics on
  `fetchV2CustomerCatalog` + `resolveBundleChargeCentavos`.
- **`apps/web/app/pricing/page.tsx`** — dropped the bundle fetch + the
  Essentials/Complete tier cards (the "How couples pay" section is now
  Free + Setnayan AI), removed the bundle prose, and removed the bundle
  entities from the JSON-LD `@graph`. Stale docstrings updated.
- **`apps/web/app/_components/marketing/_sections.tsx`** — homepage pricing
  grid cut from 4 tier cards to 2 (Free + Setnayan AI); bundle fetch + the
  Essentials/Complete cards removed; grid is now `sm:grid-cols-2`.
- **Onboarding** (`onboarding-shell.tsx`) — the `bundle` offer screen is
  dropped from the reachable flow in `buildSequence()` (one filter line), so
  the paid choice during onboarding is just Setnayan AI over Free. The screen
  JSX + `selectedBundle` purchase branch stay inert (never become active).
- **`apps/web/app/dashboard/[eventId]/studio/bundle/page.tsx`** — the bundle
  checkout landing now hard-404s (`notFound()`); the body that mounted the
  checkout drawer is removed. Route kept so stale/hand-typed links degrade
  cleanly and the build doesn't break.
- **`apps/web/app/dashboard/[eventId]/checkout/actions.ts`** — `submitOrderAction`
  hard-rejects `serviceKey ∈ {GUIDED_PACK, MEDIA_PACK}` (it previously did NOT
  require serviceKey to map to an active catalog row, and a deactivated bundle
  re-prices to `null` → would have kept the tamperable client price).
- **`apps/web/app/api/v1/billing/initialize-maya/route.ts`** — `readBundlePrice()`
  now filters `is_active=true`, so a deactivated bundle yields no price and the
  function FAILS CLOSED (its own doctrine) instead of billing the retired price.

**Deliberately LEFT (consistent + inert):** the bundle ENTITLEMENT mappings —
`BUNDLE_CHILD_SKUS` (entitlements.ts) + the `bundles_granting_sku()` SQL function
— still reference GUIDED_PACK/MEDIA_PACK and are UNCHANGED, so the `lint
entitlement gates` GUARD-2 code↔SQL mirror check stays green (it verified clean:
Essentials 7 · Complete 16). They are harmless now that the bundles are
unbuyable. The admin discount-code picker pages also call `fetchV2BundleCatalog()`
but simply list nothing now (correct, admin-only).

Verified: `pnpm typecheck` clean · `pnpm build` passes (319 pages) · `pnpm lint`
no errors · `node scripts/lint-entitlement-gates.mjs` GREEN · repo grep confirms
no customer surface renders "Setnayan Essentials"/"Setnayan Complete"/₱12,999/₱27,999.

SPEC IMPACT: None. The catalog rows already carried `is_active=false`; this is a
UI/guard alignment to the already-deactivated state. Pricing model (Free →
Setnayan AI → à-la-carte) already matches memory `project_setnayan_pricing_tiers`
and `Pricing.md`; the bundle tiers in those docs were the pre-removal model and
the owner has now retired them on the customer surfaces.
