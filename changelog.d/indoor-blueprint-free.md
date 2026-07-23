## 2026-07-23 · fix(indoor-blueprint): Indoor Blueprint is FREE via the 2D Plan — remove the paywall + stranded buy funnel

Owner directive (2026-07-23): *"indoor blueprint is free and uses the 2D Plan for free."* Indoor Blueprint (the entrance→table wayfinding) rides on the already-free 2D seat plan, so it is no longer a paid SKU.

**The stranded state this fixes.** The paid ₱1,499 `INDOOR_BLUEPRINT` SKU is `is_active=false` in prod, but it was retired-not-removed and left mid-sale:
- The couple-side Studio card + `/studio/indoor-blueprint` showed a **live ₱1,499 buy drawer** — `formatV2Sku('INDOOR_BLUEPRINT')` does NOT filter `is_active`, so it returned the stale ₱1,499 row and rendered the `InlineCheckoutDrawer`. The couple could walk the entire BDO/GCash payment-instructions funnel, only to have the final `submitOrderAction` POST **rejected** by the generic retirement guard (`resolveServiceSellability` → `'retired'`, shipped 2026-07-21). A dead-end funnel that reads as "this costs ₱1,499."
- Meanwhile the guest half (`/[slug]/find-my-table` + the inline "your seat" map on `/[slug]`) gated on owning a paid `INDOOR_BLUEPRINT` order — which could no longer be bought — so the wayfinding was **unreachable at any price**. Mis-sold and unusable at once.

**The fix — free everywhere, no ownership gate:**
- `lib/add-ons-catalog.ts` — the `indoor-blueprint` entry drops `serviceKey` and gains `tier:'free'` + `opensDirect:true` (mirrors the mood-board / seat-plan free-tool pattern). Studio hub + Suite now show a **Free** pill and open the studio directly — never a price/buy pill.
- `studio/indoor-blueprint/page.tsx` — removed the owns/active gate, the `InlineCheckoutDrawer` buy CTA, the price read, and the marketing "Unowned" surface. Every couple opens the entrance-editor studio; empty seating chart degrades to "build your seat plan first."
- `[slug]/find-my-table/page.tsx` — removed the paid-order gate + its now-unused import. Free for every seated guest; the existing empty-tables branch is the graceful fallback.
- `[slug]/page.tsx` — removed the `eventSkuActive('INDOOR_BLUEPRINT')` gate on the inline "your seat" map; it now shows for any seated guest (`eventSkuActive` retained for LIVE_WALL).
- `lib/indoor-blueprint.ts` — removed the now-orphaned paid-gate exports (`eventOwnsIndoorBlueprint`, `INDOOR_BLUEPRINT_SERVICE_KEY`, `INDOOR_BLUEPRINT_PRICE_PHP` — no remaining importers) + their `entitlements` imports; kept the wayfinding geometry helpers. Refreshed the header.
- The retired catalog row stays `is_active=false` and the generic `resolveServiceSellability` guard still hard-rejects any `INDOOR_BLUEPRINT` order — belt-and-suspenders now that all buy surfaces are gone.
- `lib/suite-doorway-guardrails.test.ts` — added `indoor-blueprint` to the reviewed Suite free-layer set (the intended conscious diff).

SPEC IMPACT: Applied in the corpus (owner directive). `Pricing.md` § 0.A + § 00.C, `AS_BUILT_GROUND_TRUTH_2026-06-07.md` (retired/tombstoned lists), and `DECISION_LOG.md` (2026-07-23) reclassify Indoor Blueprint from RETIRED → FREE-via-2D-Plan; paid upgrade remains the 3D Plan.
