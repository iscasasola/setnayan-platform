## 2026-06-26 · refactor(papic): reframe the sampler-expiry nudge to the per-camera buy (PR6, follows #2261)

The free-sampler retention card (`SamplerRetentionCard` on Studio
`papic/page.tsx`) was the LAST surviving flat ₱2,999 `PAPIC_SEATS` surface after
#2261 (PR5) retired the others — its "Upgrade to full Papic · ₱2,999"
`InlineCheckoutDrawer` only appears when a couple's free-sampler photos are about
to expire. #2261 flagged it as a deliberate follow-up so the sampler-upgrade
redesign wouldn't ship half-done. This is that follow-up.

- The card's two co-equal CTAs are kept, but the paid one is reframed from the
  ₱2,999 drawer to **"Add a camera"**, anchoring up to the on-page per-camera
  buy picker (`#papic-add-cameras`). Papic is per-camera now (Roll ₱30/cam/day ·
  Unlimited ₱100/cam/day · first 5 free), so there is no flat-price checkout
  drawer here any more.
- Copy is honest under the new model: the **Google Drive** CTA keeps the
  *existing* expiring photos (the Drive-connect path calls `makeSamplerPermanent`
  — guarded by `lint:papic-keep`); **"Add a camera"** is framed forward-looking
  ("go beyond the free sampler, where every shot is archived to your Drive and
  never expires"), so it does not over-promise that buying a camera retroactively
  un-expires the already-shot sampler photos.
- Removing the drawer frees up now-unused symbols, cleaned up:
  `InlineCheckoutDrawer`, `PAPIC_SEATS_SERVICE_KEY`, `PAPIC_SEATS_PRICE_PHP`,
  `papicSeatsPricePhp`/`papicSeatsSku`, `platformSettings`/`fetchPlatformSettings`,
  `formatV2Sku`, and `ComponentProps` — plus the unused `events.display_name`
  over-fetch and two stale comments (#2261 left the hero-card comment still
  describing a checkout drawer).

Verified: `pnpm -F web typecheck` + `lint` + `lint:papic-keep` +
`lint:entitlement-gates` + `lint:retired` all clean.

OWNER FLAG (per-camera ↔ sampler permanence): `eventOwnsPapicSeats` and the
`lint:papic-keep` "keep = permanent" chain key off the `PAPIC_SEATS`/`MEDIA_PACK`
SKU, **not** the per-camera `PAPIC_CAMERAS` order. So a couple who buys a paid
camera (the new upgrade path) does not currently get their existing sampler
photos made permanent the way a `PAPIC_SEATS` upgrade or a Drive-connect does.
This nudge's copy is written to not over-promise that, but if the intended
product rule is "any paid camera = permanence," the per-camera activation hook
should also call `makeSamplerPermanent` (a backend wiring change, out of scope
for this copy/CTA reframe). Surfaced for a decision.

SPEC IMPACT: None new — the per-camera model is corpus canon
(`0012_papic/Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md` + DECISION_LOG
2026-06-26). The ₱2,999 `PAPIC_SEATS` SKU stays in the catalog; it is simply no
longer surfaced as a couple buy path on any Papic surface.
