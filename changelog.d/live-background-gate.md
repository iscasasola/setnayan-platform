## 2026-06-22 · fix(led): gate the LED Background maker on the paid LIVE_BACKGROUND SKU

The 0005 LED Background Maker (Pailaw · 8K venue-wall loop generator) was rendering its full editor for **any** logged-in couple with no entitlement gate at all — the accidental "free" state. LIVE_BACKGROUND is a paid couple SKU, so this gave away a paid feature. The owner approved removing the free access; this PR puts the editor behind the standard couple-SKU paywall and auto-surfaces it once owned.

Changes:

- **Catalog** (`apps/web/lib/add-ons-catalog.ts`): added `serviceKey: 'LIVE_BACKGROUND'` to the `led` entry so its Studio card / About page can resolve a live order status + price (no `serviceKey` before → the card couldn't show an Active/price state, so an owner had no one-tap path back in).
- **Editor page** (`app/dashboard/[eventId]/studio/led/page.tsx`): resolve `eventSkuActive(createAdminClient(), eventId, 'LIVE_BACKGROUND')` — admin-approved, bundle-aware (the Complete / MEDIA_PACK bundle grants it), read with the admin client because ownership is an event-level fact while orders RLS is purchaser-scoped (a co-host who didn't place the order would otherwise be mis-gated). **Owned** → render the editor exactly as before (restoring the last saved draft). **Not owned** → a marketing/buy surface with the shared `InlineCheckoutDrawer` CTA (catalog-driven price via `formatV2Sku`), never the editor and never a hard error.
- **Save route** (`app/api/led-background/save/route.ts`): the same `eventSkuActive` gate after the couple-membership check, so an unowned couple can't persist a draft via a direct POST (defense-in-depth) — returns `403 not_entitled`.

Graceful degrade: `eventSkuActive` already returns not-owned on a missing/legacy orders table (42P01 / 42703) rather than throwing, so a pre-bootstrap DB surfaces the buy CTA instead of crashing.

Auto-surface: with the `serviceKey` resolved, the Studio card flips to its Active → Open state once a paid order lands, so an owner reaches the editor in one tap with no extra step.

SPEC IMPACT: 0005 LED Background — now correctly gated on the paid LIVE_BACKGROUND SKU; removes prior un-gated free access. Logged in `DECISION_LOG.md`.
