-- editorial pro sku and couple website pro reprice (owner-locked 2026-07-04)
--
-- Two admin-managed catalog changes on public.platform_retail_catalog_v2 (the
-- couple retail catalog · prices stored as WHOLE PHP numeric, e.g. 1999.00 —
-- NOT centavos; this table's convention differs from the orders/centavos rule):
--
--   1. NEW à-la-carte SKU  EDITORIAL_PRO  @ ₱3,499 — "author your front page":
--      name the moments, tell each story, arrange the editorial layout. The
--      couple's editorial recap page ships free with the watermark; this is the
--      authoring/customization upgrade (its watermark drop is already covered by
--      the COUPLE_WEBSITE_PRO umbrella — see lib/couple-website-pro.ts).
--
--   2. Couple Website PRO repriced ₱1,999 → ₱4,999 and confirmed as the UMBRELLA
--      that unlocks ALL pro website-lifecycle features across the four phases:
--      Save the Date · RSVP · On the day · Editorial. Description refreshed to
--      name the four phases in benefits language.
--
-- Idempotent upsert (ON CONFLICT on service_code). Applied live to
-- platform_retail_catalog_v2 via the Supabase MCP (db push creds stale); this
-- file mirrors it for rebuild/push parity.

BEGIN;

-- 1. New Editorial PRO à-la-carte SKU ------------------------------------------
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, description)
VALUES
  ('EDITORIAL_PRO', 'Editorial PRO', 3499, 0, false, true,
   'Name the moments, tell each story, arrange your front page — your wedding editorial, authored by you.')
ON CONFLICT (service_code) DO UPDATE
  SET title            = EXCLUDED.title,
      retail_price_php = EXCLUDED.retail_price_php,
      is_active        = EXCLUDED.is_active,
      description      = EXCLUDED.description;

-- 2. Couple Website PRO reprice → ₱4,999, umbrella scope in the description -----
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, description)
VALUES
  ('COUPLE_WEBSITE_PRO', 'Couple Website PRO', 4999, 0, false, true,
   'One upgrade unlocks the pro touches across your whole site — the Save the Date, your RSVP, your on-the-day page, and your Editorial front page.')
ON CONFLICT (service_code) DO UPDATE
  SET title            = EXCLUDED.title,
      retail_price_php = EXCLUDED.retail_price_php,
      is_active        = EXCLUDED.is_active,
      description      = EXCLUDED.description;

COMMIT;
