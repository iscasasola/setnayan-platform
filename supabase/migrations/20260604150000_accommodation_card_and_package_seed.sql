-- ============================================================================
-- 20260604150000_accommodation_card_and_package_seed.sql
--
-- Add Accommodation as the 23rd vendor planning card (owner directive
-- 2026-05-22, verbatim):
--   "also add accommodation. sometime this will be dedicated to places
--    where people need to rest for their wedding. sometimes hotel includes
--    this on their package."
--
-- Lands three things in one idempotent migration:
--   1. `accommodation` value on the public.vendor_category enum (so
--      event_vendors rows can carry the category). Mirrors the pattern in
--      20260514120000_add_religious_venue_category.sql.
--   2. `accommodation` row in canonical_service_schemas (so vendors can
--      advertise the service under the iteration-0044 v11 taxonomy, and
--      vendor_package_items.canonical_service rows referencing
--      'accommodation' have a matching taxonomy entry). Sits inside the
--      planning_logistics_travel folder per apps/web/lib/taxonomy.ts.
--   3. Adds an accommodation line item to all 6 existing hotel wedding
--      packages seeded in 20260604110000_vendor_packages.sql:
--        • Sofitel Philippine Plaza        (Platinum Wedding Package)
--        • Shangri-La at the Fort BGC      (Grand Ballroom Wedding Package)
--        • Manila Marriott                 (Marriott Grand Ballroom Wedding)
--        • Conrad Manila                   (Forbes Ballroom Wedding Package)
--        • Discovery Primea                (Bel-Air Wedding Suite Package)
--        • Manila Hotel                    (Fiesta Pavilion Heritage Package)
--      Each gets display_order = 7 (after the existing 6 items) + a
--      hotel-appropriate replacement_value_centavos (₱150k-₱350k bridal
--      suite range typical for these properties). is_default_included = TRUE.
--
-- IDEMPOTENT:
--   • The vendor_category ALTER uses ADD VALUE IF NOT EXISTS.
--   • The canonical_service_schemas INSERT uses ON CONFLICT DO UPDATE.
--   • The vendor_package_items INSERT uses NOT EXISTS guards keyed on
--     (package_id, canonical_service='accommodation') so re-running won't
--     create duplicate line items. The ILIKE-anchored vendor_profiles
--     lookups gracefully no-op when no matching vendor exists (same pattern
--     as 20260604110000) — real hotel onboarding is post-pilot per
--     CLAUDE.md 2026-05-18 row 8.
--
-- NO CHECK constraint extension needed on vendor_package_items —
-- canonical_service is plain TEXT NOT NULL in 20260604110000 (verified
-- against the migration source); no enum, no CHECK, no FK to extend.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. vendor_category enum — add 'accommodation'
-- ----------------------------------------------------------------------------

ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'accommodation';

-- ----------------------------------------------------------------------------
-- 2. canonical_service_schemas — seed 'accommodation' row
-- ----------------------------------------------------------------------------

INSERT INTO public.canonical_service_schemas (
  canonical_service,
  v11_taxonomy_version,
  display_name_en,
  display_name_tl,
  display_name_ceb,
  shared_attribute_groups,
  category_specific_attributes,
  filter_facets,
  required_for_visibility,
  ranking_signal_weights
) VALUES (
  'accommodation',
  1,
  'Accommodation',
  NULL,
  NULL,
  ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'],
  '{}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (canonical_service) DO UPDATE
  SET display_name_en         = EXCLUDED.display_name_en,
      display_name_tl         = EXCLUDED.display_name_tl,
      display_name_ceb        = EXCLUDED.display_name_ceb,
      shared_attribute_groups = EXCLUDED.shared_attribute_groups;
      -- Intentionally do NOT overwrite category_specific_attributes /
      -- filter_facets / required_for_visibility / ranking_signal_weights —
      -- mirror the convention in 20260521040000.

-- ----------------------------------------------------------------------------
-- 3. vendor_package_items — add accommodation line item to all 6 hotel
--    wedding packages (idempotent via NOT EXISTS guard)
-- ----------------------------------------------------------------------------

BEGIN;

-- Sofitel Philippine Plaza · Platinum Wedding Package
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT
  vp_pkg.package_id,
  'accommodation',
  'Bridal suite — night before + wedding night, breakfast for two',
  TRUE,
  25000000, -- ₱250,000
  7
FROM public.vendor_packages vp_pkg
INNER JOIN public.vendor_profiles vp ON vp_pkg.vendor_profile_id = vp.vendor_profile_id
WHERE vp.business_name ILIKE '%sofitel%'
  AND vp_pkg.package_name = 'Platinum Wedding Package'
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_package_items existing
    WHERE existing.package_id = vp_pkg.package_id
      AND existing.canonical_service = 'accommodation'
  );

-- Shangri-La at the Fort BGC · Grand Ballroom Wedding Package
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT
  vp_pkg.package_id,
  'accommodation',
  'Premier bridal suite — 2 nights with breakfast + late checkout',
  TRUE,
  35000000, -- ₱350,000
  7
FROM public.vendor_packages vp_pkg
INNER JOIN public.vendor_profiles vp ON vp_pkg.vendor_profile_id = vp.vendor_profile_id
WHERE vp.business_name ILIKE '%shangri%la%'
  AND vp_pkg.package_name = 'Grand Ballroom Wedding Package'
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_package_items existing
    WHERE existing.package_id = vp_pkg.package_id
      AND existing.canonical_service = 'accommodation'
  );

-- Manila Marriott · Marriott Grand Ballroom Wedding
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT
  vp_pkg.package_id,
  'accommodation',
  'Executive bridal suite — wedding night + breakfast',
  TRUE,
  18000000, -- ₱180,000
  7
FROM public.vendor_packages vp_pkg
INNER JOIN public.vendor_profiles vp ON vp_pkg.vendor_profile_id = vp.vendor_profile_id
WHERE vp.business_name ILIKE '%marriott%'
  AND vp_pkg.package_name = 'Marriott Grand Ballroom Wedding'
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_package_items existing
    WHERE existing.package_id = vp_pkg.package_id
      AND existing.canonical_service = 'accommodation'
  );

-- Conrad Manila · Forbes Ballroom Wedding Package
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT
  vp_pkg.package_id,
  'accommodation',
  'Bayfront bridal suite — 2 nights with breakfast and welcome amenities',
  TRUE,
  28000000, -- ₱280,000
  7
FROM public.vendor_packages vp_pkg
INNER JOIN public.vendor_profiles vp ON vp_pkg.vendor_profile_id = vp.vendor_profile_id
WHERE vp.business_name ILIKE '%conrad%'
  AND vp_pkg.package_name = 'Forbes Ballroom Wedding Package'
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_package_items existing
    WHERE existing.package_id = vp_pkg.package_id
      AND existing.canonical_service = 'accommodation'
  );

-- Discovery Primea · Bel-Air Wedding Suite Package
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT
  vp_pkg.package_id,
  'accommodation',
  'Bel-Air bridal suite — wedding night + breakfast for two',
  TRUE,
  15000000, -- ₱150,000
  7
FROM public.vendor_packages vp_pkg
INNER JOIN public.vendor_profiles vp ON vp_pkg.vendor_profile_id = vp.vendor_profile_id
WHERE vp.business_name ILIKE '%discovery primea%'
  AND vp_pkg.package_name = 'Bel-Air Wedding Suite Package'
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_package_items existing
    WHERE existing.package_id = vp_pkg.package_id
      AND existing.canonical_service = 'accommodation'
  );

-- Manila Hotel · Fiesta Pavilion Heritage Package
INSERT INTO public.vendor_package_items (
  package_id, canonical_service, service_description,
  is_default_included, replacement_value_centavos, display_order
)
SELECT
  vp_pkg.package_id,
  'accommodation',
  'Heritage bridal suite — wedding night with breakfast at the Champagne Room',
  TRUE,
  20000000, -- ₱200,000
  7
FROM public.vendor_packages vp_pkg
INNER JOIN public.vendor_profiles vp ON vp_pkg.vendor_profile_id = vp.vendor_profile_id
WHERE vp.business_name ILIKE '%manila hotel%'
  AND vp_pkg.package_name = 'Fiesta Pavilion Heritage Package'
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_package_items existing
    WHERE existing.package_id = vp_pkg.package_id
      AND existing.canonical_service = 'accommodation'
  );

COMMIT;
