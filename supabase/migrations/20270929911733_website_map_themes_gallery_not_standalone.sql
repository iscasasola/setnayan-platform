-- Website Pro launch split (owner 2026-07-24 · Launch_Settings_Design_Spec §3-4).
--
-- WEBSITE_MAP_LINKING + WEBSITE_THEMES go FREE ("the rest deemed free"), and
-- WEBSITE_GALLERY_UPLOAD folds INTO the ₱3,500 Couple Website PRO umbrella. In
-- all three cases the SKU is no longer standalone-sellable, which the catalog
-- expresses as is_active=false (per the catalog is_active rule: is_active=false
-- means "retired OR not standalone-sellable" — reject before resolvers, NEVER
-- sweep the reader; anyone who already BOUGHT one keeps their entitlement, since
-- ownership reads the `orders` table, not this catalog).
--
-- These rows live in platform_retail_catalog_v2 (the live customer pricing
-- surface, keyed by service_code), NOT service_catalog — verified against
-- setnayan-prod. All three are ALREADY is_active=false in prod, so this migration
-- is idempotent and effectively a no-op there; it exists to codify the owner
-- decision in version control and to guard against any drift (an admin having
-- toggled one active) between now and deploy.
--
-- Guarded (table may not exist on a fresh bootstrap) and surgical (only touches
-- the three matching rows, and only when a row is not already inactive).

DO $$
BEGIN
  IF to_regclass('public.platform_retail_catalog_v2') IS NOT NULL THEN
    UPDATE public.platform_retail_catalog_v2
       SET is_active = false,
           updated_at = now()
     WHERE service_code IN (
             'WEBSITE_MAP_LINKING',
             'WEBSITE_THEMES',
             'WEBSITE_GALLERY_UPLOAD'
           )
       AND is_active IS DISTINCT FROM false;
  END IF;
END
$$;
