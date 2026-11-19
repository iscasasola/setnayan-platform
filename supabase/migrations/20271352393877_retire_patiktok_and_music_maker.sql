-- retire_patiktok_and_music_maker
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- Owner, 2026-11-20, verbatim: "Retire Patiktok and Music Maker ( we do not want to serve this anymore)".
--
-- Two couple products leave sale: PATIKTOK_COMPILER (Patiktok) and PAKANTA (Music Maker).
-- Measured in prod on 2026-11-20 before this was written: ZERO purchases of either
-- (event_software_activations_v2, onboarding_order_items and shop_gift_purchases are all empty for both
-- codes) — nobody loses anything.
--
-- The catalogue's own retirement shape (the admin "Retire" action, and 20271303683629 / 20271310256381):
--   is_active = FALSE · retired_at stamped · retirement_reason quoting the owner. Never DELETE — order rows and
--   plan grants reference the code. `resolveServiceSellability` reads is_active, so checkout refuses both from here.
--
-- ⚠ NOT TOUCHED HERE, deliberately (owner questions, not engineering): Event Ultra still grants
--   PATIKTOK_COMPILER (lib/event-ultra.ts EVENT_ULTRA_GRANTS, an app-side alias — no row here encodes it).

UPDATE public.platform_retail_catalog_v2
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         'Owner 2026-11-20: "Retire Patiktok and Music Maker ( we do not want to serve this anymore)". Zero purchases.'),
       updated_at        = NOW()
 WHERE service_code IN ('PATIKTOK_COMPILER', 'PAKANTA')
   AND (is_active OR retired_at IS NULL);
