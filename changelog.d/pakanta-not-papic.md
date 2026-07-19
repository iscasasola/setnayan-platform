## 2026-07-10 · fix(pricing): Pakanta is not a Papic add-on

Pakanta (the custom wedding song, iteration 0036) was mislabeled as a Papic
add-on on `/pricing`. It appeared both inside the "Papic & its add-ons" group
and as a tickable add-on in the per-camera Papic estimator. It is a standalone
branding/digital-services SKU, not something you buy per Papic build.

- Removed `PAKANTA` from the `ADDON_GROUPS` "Papic & its add-ons" group and
  moved it into "Personal touches" (next to the Animated Monogram), so it stays
  visible on the pricing page but is correctly categorized.
- Removed `PAKANTA` from `estimatorAddonDefs` — it no longer shows as a Papic
  estimator ticklist option.

Everywhere else in the app Pakanta was already correctly its own service
(`/studio/pakanta`, `/admin/pakanta`, `add-ons-catalog.ts` studioGroup
`branding`) — only `apps/web/app/pricing/page.tsx` was wrong.

SPEC IMPACT: None — the SKU corpus already treats Pakanta as a standalone
custom-song service (0036), never a Papic add-on. This only fixes UI grouping.
