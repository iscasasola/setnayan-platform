-- ============================================================================
-- 20260624000000_add_3_booth_seeds_2026-05-24.sql
--
-- Adds 3 new booth sub-categories to canonical_service_schemas under the
-- Stations & Booths · Food & Beverage group:
--
--   • donut_wall_display  — Donut Wall / Display          (#50a in master taxonomy)
--   • sorbetes_cart       — Sorbetes Cart (PH-specific)   (#50b)
--   • food_cart_generic   — Food Cart (Generic catch-all) (#50c)
--
-- WHY · per CLAUDE.md 2026-05-24 rows "V1 wizard card refinement bundle"
-- + "Branch conflict coordination" + BRANCH_CONFLICTS_2026-05-24.md
-- recommendation #2 (Spec-vs-DB drift) + owner directive "add them" 2026-05-24.
--
-- Vendor_Taxonomy_V1_Master.md § Stations & Booths Food & Beverage Stations
-- lists these as #50a / #50b / #50c (Column 3 sub-category total 47).
-- This migration brings the DB canonical_service_schemas table in sync.
--
-- Branded-vendor note from the spec: Dunkin Donuts / J.Co / Selecta Sorbetes
-- and regional food carts (taco · fish ball · chicharon · kakanin · kebab ·
-- samosa · shawarma · takoyaki · banana cue / camote cue · etc.) surface as
-- vendor profiles UNDER these sub-categories, not as their own sub-categories.
-- The taxonomy stays generic; the marketplace surfaces specific branded
-- vendors via vendor_profiles rows tagged to the appropriate canonical_service.
--
-- Shared attribute groups: foodbev (faith_compatibility + dietary_accommodations
-- + geographic_service_areas + pricing_signal + vendor_credentials) — same
-- inheritance as the other Food & Beverage Stations (ice_cream_cart,
-- crepe_pancake_station, mini_lechon_station, halo_halo_station, etc.).
--
-- Mega-menu column + phase metadata mirrored into apps/web/lib/taxonomy.ts
-- (all 3 entries: folder='catering' · phase='V1.1.6' · sorbetes_cart adds ph=true).
--
-- Idempotent. Uses ON CONFLICT DO UPDATE keyed on canonical_service so a
-- re-run brings rows back in sync with this canonical content rather than
-- silently skipping. Matches the pattern established by 20260521040000
-- (V1.1 full taxonomy seeds).
-- ============================================================================

BEGIN;

INSERT INTO public.canonical_service_schemas (
  canonical_service,
  schema_version,
  display_name_en,
  display_name_tl,
  display_name_ceb,
  shared_attribute_groups,
  category_specific_attributes,
  filter_facets,
  required_for_visibility,
  ranking_signal_weights
)
VALUES
  ('donut_wall_display',  1, 'Donut Wall / Display', NULL, NULL,
   ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'],
   '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  ('sorbetes_cart',       1, 'Sorbetes Cart',        NULL, NULL,
   ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'],
   '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  ('food_cart_generic',   1, 'Food Cart (Generic)',  NULL, NULL,
   ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'],
   '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)

ON CONFLICT (canonical_service) DO UPDATE SET
  schema_version            = EXCLUDED.schema_version,
  display_name_en           = EXCLUDED.display_name_en,
  shared_attribute_groups   = EXCLUDED.shared_attribute_groups;

COMMIT;
