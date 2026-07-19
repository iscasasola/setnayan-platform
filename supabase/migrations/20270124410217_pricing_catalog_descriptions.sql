-- Pricing catalog · human-readable "what this is for" descriptions.
--
-- The /admin/pricing editor (ⓘ "What this is for" panel · owner 2026-06-18) lets
-- the team view + edit a plain description of every catalog line item so codes
-- like PANOOD or GUIDED_PACK are self-explanatory. Customer SKUs already carry
-- platform_retail_catalog_v2.description; this adds the same column to the
-- bundles + vendor catalogs so their descriptions are editable + persisted too.
--
-- Additive + idempotent — safe to re-run; no data migration, no RLS change
-- (the admin editor writes via the service-role client). Already applied to
-- prod 2026-06-18 (statement-by-statement via `db query`).

ALTER TABLE public.platform_package_catalog
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.vendor_billing_catalog
  ADD COLUMN IF NOT EXISTS description TEXT;
