## 2026-06-28 · fix(entitlements): Patiktok buy gate auto-surfaces-when-owned via per-tier SKU aliases

Triage gap: the Patiktok buy/feature surface gated on the canonical
`PATIKTOK_COMPILER` SKU (matching the Studio grid, the add-on catalog and the
Media Pack bundle), but the page's buy CTAs create per-DAY *tier* orders keyed
`patiktok_setnayan_tiktok` / `patiktok_personal_tiktok` (lib/patiktok.ts
`PATIKTOK_TIERS`). With no bridge between the purchase key and the gate key, a
couple who paid for a Patiktok day never read as owning it — the buy tiers
re-showed forever and the Studio card never flipped to Active. (pakanta / sde /
pabati were audited and are already correctly wired to the bundle-aware readers
— `eventSkuActive` / `eventPabatiActive`; no change needed there.)

- **`lib/entitlements.ts`** — new `SKU_OWNERSHIP_ALIASES` map (canonical SKU →
  alternate purchase keys it grants) + `ownershipKeysFor()`. `checkOrderOwnership`
  and `checkOrderActive` now filter `service_key` via `.in([canonical, ...aliases])`
  so an order under a per-tier key confers the canonical SKU. `eventActiveSkus`
  (the Studio-grid batch reader) collapses an alias order's key to its canonical
  SKU too, so the grid card flips to Active/Pending. Read one extra way — no
  migration, no price change (ownership still IS `orders.status`); mirrors the
  existing bundle-aware read.
- **`app/dashboard/[eventId]/studio/patiktok/page.tsx`** — updated the gate
  comment to document that `eventSkuActive('PATIKTOK_COMPILER')` now also covers
  the per-day tier purchases (additional days / overage are bought from the
  booth, so hiding the buy tiers on first ownership is correct).
- **`lib/entitlements.test.ts`** — stubs updated for the `.eq → .in` service_key
  shape; +9 cases pinning the alias behavior end-to-end (`eventOwnsSku` /
  `eventSkuActive` / `eventActiveSkus`, paid vs submitted).

Verify: `pnpm test:unit` (592 pass) · `lint:entitlement-gates` clean · typecheck
· lint · production build all green.

SPEC IMPACT: None. Behaviour-only entitlement-read fix — no SKU, price, schema or
bundle-membership change. Patiktok dual-tier per-day pricing (lib/patiktok.ts)
is unchanged; prices remain admin-catalog managed.
