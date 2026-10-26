-- event_hub_pro_parts_are_retired_from_sale
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner ruling 2026-10-26 (corpus DECISION_LOG "EVENT HUB PRO IS SOLD WHOLE AGAIN"): *"just have the upgrade event
-- hub pro"* → *"i mean no more by part as well on the website."* Event Hub Pro is ONE upgrade (`COUPLE_WEBSITE_PRO`),
-- on the web and in the iPhone app. The eleven parts (`COUPLE_HUB_PART_*`, migration 20271282742262) come off sale.
--
--   · is_active = FALSE is the switch every part seller already reads (`hubPartPrices().onSale` in
--     apps/web/lib/couple-website-pro.ts): the ✓ Apply sheet falls back to "Unlock Pro and Apply", the parts page,
--     the Maker's quiet line, the Studio cards, onboarding and /pricing stop offering parts, and the server refuses a
--     part order (`resolveHubProCharge` — "a part asked for is not on sale").
--   · NOT deleted: a part's price still COUNTS toward the cap for anyone who paid for one (measured 2026-10-26: zero
--     part orders and zero part lines in production — the rows stay so a past order would keep resolving).
--   · No price is written or read here.
--
-- ⚠ IN PRODUCTION THIS IS A REAL CHANGE. It reaches prod only through `deploy-prod`'s `supabase db push --include-all`.

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE,
       updated_at = now()
 WHERE service_code LIKE 'COUPLE\_HUB\_PART\_%'
   AND is_active = TRUE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.platform_retail_catalog_v2 WHERE service_code LIKE 'COUPLE\_HUB\_PART\_%' AND is_active) THEN
    RAISE EXCEPTION 'an Event Hub Pro part is still on sale — Event Hub Pro is sold whole';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO' AND is_active) THEN
    RAISE EXCEPTION 'Event Hub Pro (COUPLE_WEBSITE_PRO) is not on sale — retiring the parts would leave nothing to buy';
  END IF;
END $$;
