-- seed_groom_muslim_attire_leaves
-- Muslim wedding track — close the groom-side attire gap (2026-06-11 taxonomy
-- audit G1). The bride side already has four leaves (muslim_modest_bridal,
-- maranao_wedding_attire, tausug_wedding_attire, yakan_wedding_attire — seeded
-- in 20260521040000) but the groom side had ZERO Muslim/ethno-cultural options,
-- leaving a Muslim groom with only barong/suit. This seeds the four mirror
-- leaves into public.canonical_service_schemas.
--
-- NOTE — DUAL SOURCE OF TRUTH: the mega-menu column/tile/phase/faith metadata
-- for these keys lives in the TS map apps/web/lib/taxonomy.ts (TAXONOMY_MAP).
-- muslim_groom_attire + maranao_groom_attire already exist there; this migration
-- brings the DB table into parity AND the companion code change adds the two
-- missing TS entries (tausug_groom_attire, yakan_groom_attire). Keep the two in
-- sync — see the v11-seed header note in 20260521040000.
--
-- Attire leaves use the 'univ' shared-attribute set (geo + pricing + creds);
-- faith_compatibility is reserved for food/bev leaves, so it is intentionally
-- NOT attached here (mirrors the bride attire leaves exactly).
--
-- Idempotent: ON CONFLICT (canonical_service) DO UPDATE keeps display + group
-- inheritance in sync on re-run, without clobbering richer per-row attributes.

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
  ('muslim_groom_attire',  1, 'Modest Muslim Groom Attire',            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('maranao_groom_attire', 1, 'Maranao Groom Attire (malong/okir)',    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('tausug_groom_attire',  1, 'Tausug Groom Attire (beadwork)',        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('yakan_groom_attire',   1, 'Yakan Textile Groom Attire',            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)

ON CONFLICT (canonical_service) DO UPDATE
  SET display_name_en         = EXCLUDED.display_name_en,
      display_name_tl         = EXCLUDED.display_name_tl,
      display_name_ceb        = EXCLUDED.display_name_ceb,
      shared_attribute_groups = EXCLUDED.shared_attribute_groups,
      updated_at              = NOW();

COMMIT;
