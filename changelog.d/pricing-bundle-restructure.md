## 2026-07-22 · feat(pricing): Website PRO / Monogram PRO bundle restructure (Editorial PRO · Reveal · Live Background → bundle-only)

The bundle half of the owner's 2026-07-22 pricing answers (DECISION_LOG 2026-07-22 · Pricing.md § 00.G #1–#3), following the safe cleanups + reprices in PR #3559. Enforcement is DB-driven: `resolveServiceSellability` reads `platform_retail_catalog_v2.is_active`, and checkout rejects a retired SKU — so deactivating a standalone row blocks its standalone sale, while ownership stays order-based so **no existing owner is stripped**.

**Migration `20270915000000`** (idempotent · reaches prod only on `supabase db push`):
- Website PRO (`COUPLE_WEBSITE_PRO`) — REACTIVATED + repriced ₱4,999 → **₱3,500**, description updated. Now the only path to Editorial PRO + the Cinematic Reveal.
- Monogram PRO (`ANIMATED_MONOGRAM`) — repriced ₱999 → **₱1,000**, description updated; now also confers the LED Live Background.
- Editorial PRO / Cinematic Reveal / Live Background — `is_active=false` (bundle-only).

**Entitlements**: added `LIVE_BACKGROUND ← ANIMATED_MONOGRAM` to `SKU_OWNERSHIP_ALIASES` (Editorial PRO + Reveal already alias to Website PRO) — a Monogram PRO order confers Live Background; one-directional. Updated `entitlements.test.ts`.

**No dead buy buttons** — all three standalone buy surfaces gate on `resolveServiceSellability(sku) === 'sellable'` (self-healing through the migration-push window) and upsell the bundle otherwise:
- Save-the-Date Reveal → upsells Website PRO.
- LED maker (`/studio/led`) → upsells Monogram PRO.
- Editorial PRO page → upsells Website PRO.

**Catalog cards**: retired the standalone `editorial-pro` card (bundle-only); strengthened the `website-pro` blurb; `led` now keys its serviceKey to `ANIMATED_MONOGRAM` (shows the live ₱1,000 Monogram-PRO price / "Active" for owners, never the stale ₱499); `animated-monogram` blurb notes the LED inclusion.

**No misleading prices**: `/pricing` now lists `COUPLE_WEBSITE_PRO` (the reactivated umbrella would otherwise be invisible) and the three standalones auto-drop; the home pricing overlay's `priceOf(..., fallback)` rows for Reveal / Editorial PRO / Live Background were replaced with a Website-PRO row (the fallback would have reprinted stale standalone prices); onboarding drops the `live_background` pick and remaps "Advanced Website" to `COUPLE_WEBSITE_PRO`; persona-packs fold `live_background` into `animated_monogram`.

Verified: `tsc --noEmit` clean · `next lint` clean (one pre-existing warning) · **all 2754 unit tests pass** · migration-timestamp guard · entitlement-gates guard.

SPEC IMPACT: Pricing.md § 00 / § 00.G #1–#3 — mirrored after merge (§ 00 rule: code lands first). Records Website PRO ₱3,500 · Monogram PRO ₱1,000 · Editorial PRO / Cinematic Reveal / Live Background bundle-only. ⚠ Reaches prod only after `supabase db push`. FOLLOW-UP (deferred, non-blocking): `public/llms.txt` marketing copy still lists the three as standalone + the umbrella as "retired" — a copy-sync pass (with `lib/llms-price-fixture.ts`) once this lands.
