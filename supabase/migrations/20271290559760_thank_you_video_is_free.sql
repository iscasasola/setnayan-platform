-- thank_you_video_is_free
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner ruling 2026-10-26 (corpus DECISION_LOG "THE THANK-YOU VIDEO IS FREE FOR EVERY EVENT"): *"let us remove thank
-- you from the inapp purchase"* → *"make it free for now"*. Measured first: zero PAPIC_ADDON_THANK_YOU orders and zero
-- order lines in production, ever — nobody paid, so nobody is owed anything.
--
-- 🔑 FREE AND RETIRED ARE THE SAME ROW AND OPPOSITE PRODUCTS (the LIVE_WALL row, 2026-08-11). This deactivation ONLY
-- stops anything quoting a price. What switches the film ON for every event is the OTHER half, in the same PR:
-- `FREE_FOR_ALL_SKUS` in apps/web/lib/entitlements.ts. Shipping this file without that entry would lock the film for
-- everyone; `thank-you-video-is-free.test.ts` holds the two together.
--
--   · `retail_price_php` is deliberately LEFT at its figure, so "for now" can be reversed with the number intact.
--
-- ⚠ IN PRODUCTION THIS IS A REAL CHANGE. It reaches prod only through `deploy-prod`'s `supabase db push --include-all`.

UPDATE public.platform_retail_catalog_v2
   SET is_active  = false,
       updated_at = now()
 WHERE service_code = 'PAPIC_ADDON_THANK_YOU'
   AND is_active IS DISTINCT FROM false;
