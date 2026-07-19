-- ---------------------------------------------------------------------------
-- Remove SDE (Same-Day Edit) — full feature retirement.
-- ---------------------------------------------------------------------------
-- The crew-delivered Same-Day Edit add-on (service_code 'SDE' / v1 sku_code
-- 'same_day_edit') is retired. Its dedicated surfaces, catalog entries, and
-- entitlement plumbing were removed from the app. This forward migration brings
-- the database in line:
--   (a) drop the events.sde_* delivery columns (added by 20270213100000_sde_output);
--   (b) soft-deactivate the SDE catalog rows in BOTH catalogs (live V2 +
--       legacy v1) — is_active=false preserves any historical order rows;
--   (c) re-CREATE OR REPLACE bundles_granting_sku() WITHOUT the SDE child of
--       MEDIA_PACK, so the DB bundle-fan-out matches the app's
--       BUNDLE_CHILD_SKUS (entitlements.ts) — keeps lint:entitlement-gates Guard 2
--       in sync. GUIDED_PACK + PAPIC_UNLOCK pairs are byte-identical to the prior
--       definer (20270303150000_papic_unlock_bundle_granting_sku).
--
-- Stories (PAPIC_ADDON_STORIES) and Auto-Recap are intentionally untouched.
-- Migrations are immutable history: this is a forward migration; the older
-- SDE-referencing migrations are left as-is.
-- ---------------------------------------------------------------------------

BEGIN;

-- (a) Drop the Same-Day Edit delivery columns on events.
ALTER TABLE public.events
  DROP COLUMN IF EXISTS sde_video_r2_key,
  DROP COLUMN IF EXISTS sde_poster_r2_key,
  DROP COLUMN IF EXISTS sde_published_at;

-- (b) Soft-deactivate the SDE catalog rows (preserve rows for order history).
--     Live V2 customer catalog.
UPDATE public.platform_retail_catalog_v2
   SET is_active = false, updated_at = now()
 WHERE service_code = 'SDE';

--     Legacy v1 service catalog (sku_code 'same_day_edit').
UPDATE public.service_catalog
   SET is_active = false, updated_at = now()
 WHERE sku_code = 'same_day_edit';

-- (c) Re-declare bundles_granting_sku() WITHOUT the MEDIA_PACK SDE child.
--     Verbatim from 20270303150000 minus the single MEDIA_PACK SDE row.
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
      -- MEDIA_PACK · Complete (BUNDLE_CHILD_SKUS.MEDIA_PACK · 17 · SDE removed)
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
      ('MEDIA_PACK', 'LIVE_WALL'),
      ('MEDIA_PACK', 'LIVE_BACKGROUND'),
      ('MEDIA_PACK', 'PANOOD_SYSTEM'),
      ('MEDIA_PACK', 'PAKANTA'),
      -- PAPIC_UNLOCK · "Unlock all of Papic" umbrella (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK · 6)
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
  'Bundle service_keys (GUIDED_PACK/MEDIA_PACK/PAPIC_UNLOCK) that grant the given child SKU. Mirrors BUNDLE_CHILD_SKUS in apps/web/lib/entitlements.ts — keep in sync. SDE removed 2026-06-28.';

GRANT EXECUTE ON FUNCTION public.bundles_granting_sku(TEXT) TO authenticated, anon;

COMMIT;
