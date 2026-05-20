-- ============================================================================
-- 20260521040000_iteration_0044_v11_full_taxonomy_seeds.sql
--
-- Iteration 0044 — Per-Category Vendor Attribute Schemas (V1.1 full
-- taxonomy seeds). Spec corpus: 0044_per_category_schemas/0044_per_category_schemas.md
-- + 02_Specifications/Vendor_Taxonomy_V1_Master.md (192-entry master list).
--
-- V1.1 wave PR (extension of the top-15 seeds in 20260521030000). Adds the
-- remaining canonical_service rows so all 192 mega-menu entries have a
-- canonical_service_schemas row in the DB. Each new row carries:
--   • display_name_en (and display_name_tl where there's a natural Tagalog term)
--   • shared_attribute_groups inheritance based on category type
--   • EMPTY category_specific_attributes / filter_facets / required_for_visibility
--     for now — the per-category attribute work for V1.2+ rows lands later.
--
-- The 15 rows already seeded in 20260521030000 are NOT re-inserted here
-- (their richer schemas would be clobbered by ON CONFLICT DO UPDATE setting
-- category_specific_attributes back to '{}'). The 15 already seeded:
--   catering, photography, videography, bridal_gown_custom, band_live_music,
--   host_emcee, wedding_coordination, florals, stylist_decorator,
--   photo_booth, mobile_bar, coffee_booth, officiant_priest_minister,
--   transportation_bridal_car, wedding_cake.
--
-- shared_attribute_groups inheritance rules used below:
--   foodbev = faith_compatibility + dietary_accommodations + geographic_service_areas
--             + pricing_signal + vendor_credentials  (column 3 food & drink)
--   alcohol = faith_compatibility + geographic_service_areas + pricing_signal
--             + vendor_credentials  (bars / alcohol-adjacent stations)
--   univ    = geographic_service_areas + pricing_signal + vendor_credentials
--             (everything else — visual / attire / coordination / logistics /
--             stationery)
--
-- Mega-menu column + phase + faith-gate metadata is NOT stored in the table
-- (the table doesn't have those columns); the admin /taxonomy viewer maps
-- canonical_service → column / phase / faith via a static lookup constant
-- (apps/web/lib/taxonomy/v11-map.ts). Keep the two in sync when adding rows.
--
-- Idempotent. Every INSERT uses ON CONFLICT DO UPDATE keyed on
-- canonical_service so a re-run brings rows back in sync with this canonical
-- content rather than silently skipping.
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

  -- ============================================================
  -- Column 1 — Capture (Visual)
  -- ============================================================

  -- Photographers (sub-types of /vendors/photography/)
  ('pre_nup_photographer',                1, 'Pre-Nup Photographer',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('engagement_photographer',             1, 'Engagement Photographer',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('drone',                               1, 'Drone Operator',                             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('same_day_edit',                       1, 'Same-Day Edit Specialist',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('family_day2_photographer',            1, 'Family Day-2 / Brunch Photographer',         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('boudoir_photographer',                1, 'Boudoir Photographer',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('studio_portrait_photographer',        1, 'Studio Portrait Photographer',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_papic',                      1, 'Setnayan Papic',                             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Videographers
  ('drone_videographer',                  1, 'Drone Videographer',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('highlight_reel_specialist',           1, 'Highlight Reel Specialist',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_ai_edited_highlight',        1, 'Setnayan AI Edited Highlight',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Pre-Nup Locations (new top-level)
  ('pre_nup_shoot_locations',             1, 'Pre-Nup Shoot Locations',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- ============================================================
  -- Column 2 — Music & Entertainment
  -- ============================================================

  -- Bands & Live Music (sub-types — band_live_music is the unified schema, these are listing-level entries)
  ('live_band',                           1, 'Wedding Bands (full ensemble)',              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('acoustic_performer',                  1, 'Acoustic Performers (solo/duo)',             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('choir_string_quartet',                1, 'Choirs / String Quartets',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('kulintang_ensemble',                  1, 'Kulintang Ensembles',                        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('rondalla_ensemble',                   1, 'Rondalla Ensembles',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('folk_performer',                      1, 'Folk Performers',                            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_singer',                      1, 'Wedding Singers (solo vocalists)',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_pakanta',                    1, 'Setnayan Pakanta (Custom Song)',             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_panood',                     1, 'Setnayan Panood (Multi-Cam Livestream)',     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- DJs & Entertainment
  ('dj',                                  1, 'DJs',                                        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_entertainment',               1, 'Wedding Entertainment (magicians, fire dancers, etc.)', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Choreographers
  ('entourage_choreographer',             1, 'Entourage Choreographer',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('first_dance_choreographer',           1, 'First Dance Choreographer',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('pre_cana_dance_trainer',              1, 'Pre-Cana Dance Trainer',                     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- ============================================================
  -- Column 3 — Food & Beverage
  -- ============================================================

  -- Catering (food/bev shared groups)
  ('lechonero',                           1, 'Lechonero (whole-pig roast specialist)',     NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('live_cooking_station',                1, 'Live Cooking Stations',                      NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('halal_catering',                      1, 'Halal Catering Specialists',                 NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mocktail_only_caterer',               1, 'Mocktail-Only Caterers',                     NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('food_truck',                          1, 'Food Trucks',                                NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Cake & Desserts
  ('dessert_station',                     1, 'Dessert Stations',                           NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Beverage / Bar (alcohol-adjacent)
  ('mocktail_bar',                        1, 'Mocktail Bar (alcohol-free)',                NULL, NULL, ARRAY['faith_compatibility','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Stations & Booths — Food & Beverage stations (foodbev groups)
  ('halo_halo_station',                   1, 'Halo-Halo Station',                          NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('ice_cream_cart',                      1, 'Ice Cream Cart',                             NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('crepe_pancake_station',               1, 'Crepe / Pancake Station',                    NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('cotton_candy_cart',                   1, 'Cotton Candy Cart',                          NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('charcuterie_board',                   1, 'Cheese / Charcuterie Board',                 NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mini_lechon_station',                 1, 'Mini Lechon Station',                        NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('whiskey_cigar_bar',                   1, 'Wine / Whiskey / Cigar Bar',                 NULL, NULL, ARRAY['faith_compatibility','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mocktail_booth_mini',                 1, 'Mocktail Bar (booth-scale)',                 NULL, NULL, ARRAY['faith_compatibility','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('tea_bar',                             1, 'Tea Ceremony / Tea Bar',                     NULL, NULL, ARRAY['faith_compatibility','dietary_accommodations','geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Stations & Booths — Sensory & Beauty
  ('perfume_bar',                         1, 'Perfume Bar (custom blend)',                 NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('henna_tattoo_booth',                  1, 'Henna / Temporary Tattoo Booth',             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('massage_chair_station',               1, 'Massage Chair Station',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mini_nail_bar',                       1, 'Mini Nail Bar',                              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('hair_touchup_station',                1, 'Hair Touch-Up Station',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('aromatherapy_station',                1, 'Aromatherapy Station',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Stations & Booths — Visual & Keepsake
  ('booth_360',                           1, '360 Booth',                                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('gif_booth',                           1, 'GIF Booth',                                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('polaroid_booth',                      1, 'Polaroid / Instax Booth',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_portrait_painter',            1, 'Live Wedding-Portrait Painter',              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('caricature_artist',                   1, 'Caricature Artist',                          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('silhouette_artist',                   1, 'Silhouette / Profile Artist',                NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('selfie_magic_mirror',                 1, 'Selfie Magic Mirror',                        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Stations & Booths — Skill & Craft
  ('live_calligraphy',                    1, 'Live Calligraphy / Name Printing',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('keychain_engraving',                  1, 'Custom Keychain / Magnet Engraving',         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('live_embroidery',                     1, 'Live Embroidery (on handkerchiefs)',         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('poetry_typewriter',                   1, 'Live Poetry Typewriter',                     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('tarot_astrology',                     1, 'Tarot / Astrology Reading',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('palmistry_reader',                    1, 'Palmistry Reader',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Stations & Booths — Interactive
  ('vr_ar_station',                       1, 'VR / AR Experience Station',                 NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('arcade_retro_games',                  1, 'Arcade / Retro Games',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('led_dance_floor',                     1, 'LED Dance Floor',                            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_patiktok',                   1, 'Setnayan Patiktok (TikTok Booth)',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- ============================================================
  -- Column 4 — Look (Attire / Beauty / Jewelry / Decor)
  -- ============================================================

  -- Bridal Wear
  ('bridal_gown_rental',                  1, 'Bridal Gown (Rental)',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridesmaid_dress',                    1, 'Bridesmaid Dresses',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mother_of_bride_gown',                1, 'Mother-of-Bride Gowns',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('flower_girl_dress',                   1, 'Flower Girl Dresses',                        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('junior_bridesmaid_dress',             1, 'Junior Bridesmaid Dresses',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('filipiniana_terno',                   1, 'Filipiniana Terno',                          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('filipiniana_maria_clara',             1, 'Filipiniana Maria Clara',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('filipiniana_balintawak',              1, 'Filipiniana Balintawak',                     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('ninang_attire',                       1, 'Sponsor Attire — Ninang Sets',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('muslim_modest_bridal',                1, 'Modest Muslim Bridal Attire',                NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('inc_modest_bridal',                   1, 'Modest INC Bridal Attire',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('maranao_wedding_attire',              1, 'Maranao Wedding Attire (malong-inspired)',   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('tausug_wedding_attire',               1, 'Tausug Wedding Attire (beadwork-heavy)',     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('yakan_wedding_attire',                1, 'Yakan Textile Bridal',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Groom Wear
  ('groom_suit_custom',                   1, 'Wedding Suits / Tuxedos (Custom)',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('groom_suit_rental',                   1, 'Wedding Suits / Tuxedos (Rental)',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('barong_tagalog_custom',               1, 'Barong Tagalog (Custom)',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('barong_tagalog_rental',               1, 'Barong Tagalog (Rental)',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('groomsman_set',                       1, 'Groomsman Sets (matched)',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('junior_groomsman',                    1, 'Junior Groomsman',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('ring_bearer_suit',                    1, 'Ring Bearer Suits',                          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('ninong_attire',                       1, 'Sponsor Attire — Ninong Sets',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Beauty & Grooming
  ('bridal_hmua',                         1, 'Bridal Makeup Artists',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('family_mua',                          1, 'Family Makeup Artists',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_hair_stylist',                 1, 'Bridal Hair Stylists',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('touchup_mua',                         1, 'Touch-Up Artists (day-of)',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_spa',                          1, 'Bridal Spa & Wellness',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_fitness',                      1, 'Bridal Fitness Programs (pre-wedding)',      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_nutritionist',                 1, 'Bridal Nutritionist / Diet Coach',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_dermatology',                  1, 'Bridal Dermatology (skin prep)',             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_dental',                       1, 'Bridal Dental (whitening/alignment)',        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('groom_grooming',                      1, 'Groom Grooming (skincare, beard, hair)',     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('muslim_henna_artist',                 1, 'Muslim Henna Artist (cultural style)',       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('maternity_bride_mua',                 1, 'Maternity Bride MUA',                        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mature_bride_mua',                    1, 'Mature Bride MUA',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Jewelry & Accessories
  ('engagement_ring',                     1, 'Engagement Rings',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_ring',                        1, 'Wedding Bands',                              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_jewellery',                    1, 'Bridal Jewellery',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_jewellery_rental',             1, 'Bridal Jewellery (Rental)',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_veil',                        1, 'Wedding Veils & Trains',                     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_bouquet_specialty',            1, 'Bridal Bouquets (specialty separate from florals)', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_garter',                      1, 'Garters',                                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_headpiece',                    1, 'Bridal Headpieces',                          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('sponsor_corsage',                     1, 'Sponsor Corsages',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('flower_girl_tiara',                   1, 'Flower Girl Tiaras',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('floral_jewellery',                    1, 'Floral Jewellery',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Decor & Styling
  ('decorator_general',                   1, 'Decorators (general)',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('garden_wedding_florist',              1, 'Garden Wedding Florist',                     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('beach_wedding_florist',               1, 'Beach Wedding Florist',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('capiz_native_decor',                  1, 'Capiz / Native Décor Specialists',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('hacienda_heritage_decor',             1, 'Hacienda / Heritage Décor',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('maranao_okir_decor',                  1, 'Maranao Okir Décor Specialists',             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_pailaw',                     1, 'Setnayan Pailaw (LED Background)',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_custom_monogram',            1, 'Setnayan Custom Monogram',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- ============================================================
  -- Column 5 — Ceremony / Coordination / Logistics / Stationery / Travel
  -- ============================================================

  -- Ceremony Officiants
  ('catholic_priest',                     1, 'Catholic Priest',                            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('civil_judge',                         1, 'Civil Judge',                                NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('civil_mayor',                         1, 'Civil Mayor / Vice-Mayor',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('civil_justice_of_peace',              1, 'Civil Justice of the Peace',                 NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('inc_minister',                        1, 'INC Minister',                               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('born_again_pastor',                   1, 'Born Again / Evangelical Pastor',            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('charismatic_pastor',                  1, 'Charismatic Pastor (JIL, CCF, Victory)',     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mainline_protestant_pastor',          1, 'Mainline Protestant (Baptist, Methodist)',   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('muslim_imam',                         1, 'Muslim Imam (BMA-registered)',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('cultural_tribal_elder',               1, 'Cultural Tribal Elder',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Pre-Marriage Requirements
  ('pre_cana_seminar',                    1, 'Pre-Cana Seminar Facilitator',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('cfo_seminar',                         1, 'CFO Seminar Facilitator',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('inc_counseling',                      1, 'INC Counseling Center',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('muslim_pre_wedding_counseling',       1, 'Muslim Pre-Wedding Counseling',              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('marriage_license_expediting',         1, 'Marriage License Expediting Service',        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('apostille_dfa_authentication',        1, 'Apostille / DFA Authentication Services',    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Planning & Coordination
  ('wedding_planner_partial',             1, 'Wedding Planners (Partial / Month-of)',      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('day_of_coordinator',                  1, 'Day-Of Coordinators',                        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('destination_wedding_specialist',      1, 'Destination Wedding Specialists',            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('pamamanhikan_coordinator',            1, 'Pamamanhikan Coordinators',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('despedida_planner',                   1, 'Despedida Planners',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('sponsor_coordinator',                 1, 'Sponsor Coordinators (ninong/ninang)',       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('gender_separated_reception_coordinator', 1, 'Gender-Separated Reception Coordinators', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('religious_venue_coordinator',         1, 'Tabernakulo / Mosque Coordinators',          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('inc_wedding_coordinator',             1, 'INC-Compatible Wedding Coordinators',        NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mahr_coordination',                   1, 'Mahr Coordination Service',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_concierge',                  1, 'Setnayan Concierge',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Transportation
  ('vintage_classic_vehicle',             1, 'Vintage / Classic Vehicle Rental',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('transportation_guest_shuttle',        1, 'Guest Shuttle Service',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('motorcycle_escort',                   1, 'Motorcycle Escort',                          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('horse_drawn_carriage',                1, 'Horse-Drawn Carriage',                       NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bridal_boat_yacht',                   1, 'Bridal Boat / Yacht (destination weddings)', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Logistics & Infrastructure
  ('generator_rental',                    1, 'Generator Rental',                           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('tent_rental',                         1, 'Tent / Outdoor-Cover Rental',                NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mobile_restroom_rental',              1, 'Mobile Restroom Rental',                     NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('cooling_fans_misters',                1, 'Cooling Fans / Misters Rental',              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('outdoor_sound_system',                1, 'Outdoor Sound System Specialist',            NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('outdoor_lighting_specialist',         1, 'Outdoor Lighting Specialist (string / market lights)', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bug_repellent_station',               1, 'Bug / Mosquito Repellent Stations',          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_day_weather_forecaster',      1, 'Wedding-Day Weather Forecaster (Tagaytay-specialty)', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('parasol_hat_rental',                  1, 'Parasol / Hat Rental Stations',              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('lights_sound',                        1, 'Lights & Sound (banquet)',                   NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Stationery & Keepsakes
  ('invitation_print',                    1, 'Wedding Invitations (Print)',                NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('invitation_digital',                  1, 'Wedding Invitations (Digital)',              NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('wedding_cards_designer',              1, 'Wedding Cards Designer (specialty)',         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('save_the_date_digital',               1, 'Save-the-Date (Digital)',                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('setnayan_save_the_date_mp4',          1, 'Setnayan Save-the-Date Video MP4',           NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('ceremony_program',                    1, 'Ceremony Programs (printed books)',          NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('place_card',                          1, 'Place Cards',                                NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('menu_card',                           1, 'Menu Cards',                                 NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('stationery_signage',                  1, 'Signage',                                    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('souvenirs_giveaways',                 1, 'Souvenirs / Giveaways',                      NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('pasalubong_box',                      1, 'Trousseau / Pasalubong Boxes',               NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('sponsor_token',                       1, 'Sponsor Tokens',                             NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('godchild_token',                      1, 'Inaanak / Godchild Tokens',                  NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),

  -- Travel & Honeymoon
  ('honeymoon_planner',                   1, 'Honeymoon Planners',                         NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('destination_wedding_travel_coordinator', 1, 'Destination Wedding Travel Coordinators', NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('visa_wedding_logistics',              1, 'Visa-Wedding Logistics (Fil-Am couples)',    NULL, NULL, ARRAY['geographic_service_areas','pricing_signal','vendor_credentials'], '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)

ON CONFLICT (canonical_service) DO UPDATE
  SET display_name_en         = EXCLUDED.display_name_en,
      display_name_tl         = EXCLUDED.display_name_tl,
      display_name_ceb        = EXCLUDED.display_name_ceb,
      shared_attribute_groups = EXCLUDED.shared_attribute_groups,
      -- Intentionally do NOT overwrite category_specific_attributes /
      -- filter_facets / required_for_visibility / ranking_signal_weights
      -- here. Those are populated per-row by earlier or later migrations
      -- (e.g. the top-15 seeds in 20260521030000 set rich values; this
      -- bulk seed only fills display + inheritance metadata).
      updated_at              = NOW();

COMMIT;
