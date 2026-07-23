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

**Catalog cards**: retired the standalone `editorial-pro` card (bundle-only); strengthened the `website-pro` blurb; the `led` card keeps `serviceKey: LIVE_BACKGROUND` (the same canonical the LED maker + save route gate on, so the grid pill and the tool surface can never disagree — a Monogram-PRO owner reads "Active" via the alias), and the Suite/Studio price query now filters `is_active` so a retired SKU never prints a stale standalone pill (the bundle-only LED card shows a neutral pill, not ₱499); `animated-monogram` blurb notes the LED inclusion.

**No misleading prices**: `/pricing` now lists `COUPLE_WEBSITE_PRO` (the reactivated umbrella would otherwise be invisible) and the three standalones auto-drop; the home pricing overlay's `priceOf(..., fallback)` rows for Reveal / Editorial PRO / Live Background were replaced with a Website-PRO row (the fallback would have reprinted stale standalone prices); onboarding drops the `live_background` pick and remaps "Advanced Website" to `COUPLE_WEBSITE_PRO`; persona-packs fold `live_background` into `animated_monogram`.

Also synced `public/llms.txt` + `lib/llms-price-fixture.ts` (the AI-crawler pricing surface, which does NOT self-heal from the catalog): Website PRO ₱3,500 added, Monogram ₱1,000, and the three standalones reframed as bundle-only (₱499 dropped, ₱3,500 added — fixture kept in bidirectional sync).

A 4-lens adversarial review (dead-button · owner-access · price-display · onboarding) ran against the diff; its two confirmed findings are fixed in this same PR: (1) the `led` serviceKey was realigned to `LIVE_BACKGROUND` + the price query filtered so the grid pill can't disagree with the maker gate; (2) `experience-personas.ts` still injected the retired `live_background` pick (latent behind the dark experience-quiz flag) — dropped.

Verified: `tsc --noEmit` clean · `next lint` clean (one pre-existing warning) · **all 2754 unit tests pass** (incl. llms-price-drift, the buyable-declares-free-or-paid invariant, and the Suite doorway guardrails) · migration-timestamp guard · entitlement-gates guard.

SPEC IMPACT: Pricing.md § 00 / § 00.G #1–#3 — mirrored after merge (§ 00 rule: code lands first). Records Website PRO ₱3,500 · Monogram PRO ₱1,000 · Editorial PRO / Cinematic Reveal / Live Background bundle-only. ⚠ Reaches prod only after `supabase db push`.
