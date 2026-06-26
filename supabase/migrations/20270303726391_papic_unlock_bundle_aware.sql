-- 20270303726391_papic_unlock_bundle_aware.sql
--
-- WHY (owner-locked 2026-06-26 · companion to 20270303532523_papic_unlock_and_kwento_catalog): the new
-- PAPIC_UNLOCK ₱15,000 bundle grants six child SKUs (Kwento · Photo Wall ·
-- Thank You · Stories · Pabati · Camera Bridge). The DB-side bundle→child map
-- public.bundles_granting_sku() (introduced 20270103010000_papic_ownership_
-- bundle_aware.sql) must learn about this third bundle so it stays the SQL
-- mirror of BUNDLE_CHILD_SKUS (lib/entitlements.ts) + BUNDLE_MEMBERS
-- (onboarding-pricing.ts). scripts/lint-entitlement-gates.mjs enforces all
-- three agree — and now reads the NEWEST migration defining the function, i.e.
-- THIS one.
--
-- This is a CREATE OR REPLACE of bundles_granting_sku() carrying ALL THREE
-- bundles. The GUIDED_PACK / MEDIA_PACK rows are reproduced verbatim from
-- 20270103010000 (do not edit that applied migration); only the PAPIC_UNLOCK
-- rows are new. papic_event_owns_service() is unchanged — it already calls
-- bundles_granting_sku(), so it transparently picks up the new bundle (though in
-- practice PAPIC_UNLOCK's children are not queried through that RPC, which gates
-- only PAPIC_SEATS / PAPIC_GUEST).
--
-- Idempotent (CREATE OR REPLACE). Additive — no data change. NOT AUTO-APPLIED:
-- owner runs `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

CREATE OR REPLACE FUNCTION public.bundles_granting_sku(p_child TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(m.bundle_key ORDER BY m.bundle_key), ARRAY[]::text[])
  FROM (
    VALUES
      -- GUIDED_PACK · Essentials (BUNDLE_CHILD_SKUS.GUIDED_PACK · 7)
      ('GUIDED_PACK', 'SETNAYAN_AI'),
      ('GUIDED_PACK', 'ANIMATED_MONOGRAM'),
      ('GUIDED_PACK', 'CUSTOM_QR_GUEST'),
      ('GUIDED_PACK', 'PRO_RSVP'),
      ('GUIDED_PACK', 'PAPIC_GUEST'),
      ('GUIDED_PACK', 'EVENT_WEBSITE'),
      ('GUIDED_PACK', 'PRO_WEBSITE'),
      -- MEDIA_PACK · Complete (BUNDLE_CHILD_SKUS.MEDIA_PACK · 18)
      ('MEDIA_PACK', 'SETNAYAN_AI'),
      ('MEDIA_PACK', 'ANIMATED_MONOGRAM'),
      ('MEDIA_PACK', 'CUSTOM_QR_GUEST'),
      ('MEDIA_PACK', 'PRO_RSVP'),
      ('MEDIA_PACK', 'EVENT_WEBSITE'),
      ('MEDIA_PACK', 'PRO_WEBSITE'),
      ('MEDIA_PACK', 'PAPIC_GUEST'),
      ('MEDIA_PACK', 'PAPIC_ADDON_STORIES'),
      ('MEDIA_PACK', 'PAPIC_SEATS'),
      ('MEDIA_PACK', 'CAMERA_BRIDGE'),
      ('MEDIA_PACK', 'PABATI'),
      ('MEDIA_PACK', 'PATIKTOK_COMPILER'),
      ('MEDIA_PACK', 'PAPIC_ADDON_THANK_YOU'),
      ('MEDIA_PACK', 'SDE'),
      ('MEDIA_PACK', 'LIVE_WALL'),
      ('MEDIA_PACK', 'LIVE_BACKGROUND'),
      ('MEDIA_PACK', 'PANOOD_SYSTEM'),
      ('MEDIA_PACK', 'PAKANTA'),
      -- PAPIC_UNLOCK · Papic Unlock All (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK · 6)
      ('PAPIC_UNLOCK', 'KWENTO'),
      ('PAPIC_UNLOCK', 'LIVE_WALL'),
      ('PAPIC_UNLOCK', 'PAPIC_ADDON_THANK_YOU'),
      ('PAPIC_UNLOCK', 'PAPIC_ADDON_STORIES'),
      ('PAPIC_UNLOCK', 'PABATI'),
      ('PAPIC_UNLOCK', 'CAMERA_BRIDGE')
  ) AS m(bundle_key, child_key)
  WHERE m.child_key = p_child
$$;

COMMENT ON FUNCTION public.bundles_granting_sku(TEXT) IS
  'Bundle service_keys (GUIDED_PACK/MEDIA_PACK/PAPIC_UNLOCK) that grant the given child SKU. Mirrors BUNDLE_CHILD_SKUS in apps/web/lib/entitlements.ts — keep in sync.';

GRANT EXECUTE ON FUNCTION public.bundles_granting_sku(TEXT) TO authenticated, anon;

COMMIT;
