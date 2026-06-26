-- 20270304577448_papic_unlock_bundle_aware.sql
--
-- WHY (owner-locked 2026-06-26 · completes the deferred mirror): the
-- "Unlock all of Papic" bundle (PAPIC_UNLOCK · migration
-- 20270303143041_papic_unlock_bundle.sql) grants six child SKUs (Kwento ·
-- Photo Wall · Thank You · Stories · Pabati · Camera Bridge). That bundle was
-- added to the APP-side map (lib/entitlements.ts BUNDLE_CHILD_SKUS.PAPIC_UNLOCK)
-- but the DB-side bundle→child map public.bundles_granting_sku() was left at the
-- original two bundles. This CREATE OR REPLACE brings the DB into sync so all
-- three mirrors agree (BUNDLE_CHILD_SKUS ↔ BUNDLE_MEMBERS ↔ bundles_granting_sku),
-- which scripts/lint-entitlement-gates.mjs now enforces for 3 bundles.
--
-- The GUIDED_PACK / MEDIA_PACK rows are reproduced verbatim from
-- 20270103010000_papic_ownership_bundle_aware.sql (do not edit that applied
-- migration); only the PAPIC_UNLOCK rows are new. papic_event_owns_service() is
-- unchanged — it already calls bundles_granting_sku() (in practice PAPIC_UNLOCK's
-- children aren't queried through that RPC, which gates only PAPIC_SEATS /
-- PAPIC_GUEST; this keeps the map honest + future-proof).
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
      -- PAPIC_UNLOCK · Unlock all of Papic (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK · 6)
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
