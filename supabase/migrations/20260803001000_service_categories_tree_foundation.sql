-- ============================================================================
-- 20260803000000_service_categories_tree_foundation.sql
--
-- DB-backed marketplace taxonomy tree — PHASE 1 foundation for the
-- /admin/taxonomy visual editor (spec 0023 §3.15) and the owner lock
-- "Admin Finalize = permanent live publish" (DECISION_LOG 2026-06-03 ♾️).
--
-- Moves the taxonomy STRUCTURE out of the code constant lib/taxonomy.ts
-- (TAXONOMY_MAP) and into two tables, so a later phase can let admin edits go
-- live with no deploy. THIS MIGRATION IS NON-BREAKING: no consumer reads these
-- tables yet — lib/taxonomy.ts remains the authored source of truth. The seed
-- below is GENERATED from it (apps/web/scripts/gen-taxonomy-seed.ts), so the DB
-- is a perfect mirror of code at landing time.
--
-- Tables:
--   service_categories          the browse tree — 10 parents (tier 1) + ~53
--                                tiles (tier 2). Self-referential parent_id;
--                                carries scope / merged_into_category_id /
--                                sample_photo_r2_key for the editor (Phase 3)
--                                and the §3.2c request review (Phase 4).
--   canonical_service_taxonomy   ~200 canonical_service -> tile mappings + facet
--                                flags (faith / ph / setnayan / rental /
--                                dietary / tradition / marketplace_hidden).
--
-- RLS mirrors canonical_service_schemas (iteration 0044): public SELECT,
-- admin-only write via public.is_admin(). RLS enabled at CREATE TABLE time.
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. service_categories — the browse tree (parents + tiles + future grandchildren)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_categories (
  id                      TEXT PRIMARY KEY,
  parent_id               TEXT REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  tier                    SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  kind                    TEXT NOT NULL DEFAULT 'branch' CHECK (kind IN ('branch','leaf')),
  label_en                TEXT NOT NULL,
  label_short             TEXT,
  slug                    TEXT NOT NULL,
  sort_order              INT NOT NULL DEFAULT 0,
  scope                   TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','merged','private')),
  merged_into_category_id TEXT REFERENCES public.service_categories(id) ON DELETE SET NULL,
  sample_photo_r2_key     TEXT,
  marketplace_hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','retired')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_categories_parent_idx
  ON public.service_categories (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_tier_slug_key
  ON public.service_categories (tier, slug);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_read_all ON public.service_categories;
CREATE POLICY service_categories_read_all
  ON public.service_categories FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS service_categories_admin_write ON public.service_categories;
CREATE POLICY service_categories_admin_write
  ON public.service_categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. canonical_service_taxonomy — canonical_service -> tile mapping + facet flags
--    (lib/taxonomy.ts TAXONOMY_MAP projected into the DB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canonical_service_taxonomy (
  canonical_service   TEXT PRIMARY KEY,
  folder_id           TEXT NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  tile_id             TEXT REFERENCES public.service_categories(id) ON DELETE SET NULL,
  phase               TEXT NOT NULL,
  faith               TEXT CHECK (faith IN ('Catholic','Christian','INC','Muslim','Cultural')),
  is_ph               BOOLEAN NOT NULL DEFAULT FALSE,
  is_setnayan         BOOLEAN NOT NULL DEFAULT FALSE,
  is_rental           BOOLEAN NOT NULL DEFAULT FALSE,
  dietary             TEXT CHECK (dietary IN ('halal','alcohol_free')),
  is_tradition        BOOLEAN NOT NULL DEFAULT FALSE,
  marketplace_hidden  BOOLEAN NOT NULL DEFAULT FALSE,
  secondary_tiles     TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS canonical_service_taxonomy_tile_idx
  ON public.canonical_service_taxonomy (tile_id);
CREATE INDEX IF NOT EXISTS canonical_service_taxonomy_folder_idx
  ON public.canonical_service_taxonomy (folder_id);

ALTER TABLE public.canonical_service_taxonomy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_service_taxonomy_read_all ON public.canonical_service_taxonomy;
CREATE POLICY canonical_service_taxonomy_read_all
  ON public.canonical_service_taxonomy FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS canonical_service_taxonomy_admin_write ON public.canonical_service_taxonomy;
CREATE POLICY canonical_service_taxonomy_admin_write
  ON public.canonical_service_taxonomy FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- GENERATED by apps/web/scripts/gen-taxonomy-seed.ts FROM lib/taxonomy.ts.
-- DO NOT HAND-EDIT — re-run the generator after any TAXONOMY_MAP change.
-- 64 category nodes (10 parents + 54 tiles) · 199 canonical mappings.
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, marketplace_hidden)
VALUES
  ('venue', NULL, 1, 'branch', 'Venue', 'Venue', 'venue', 0, 'global', FALSE),
  ('planning', NULL, 1, 'branch', 'Planning', 'Planning', 'planning', 1, 'global', FALSE),
  ('feast', NULL, 1, 'branch', 'Feast', 'Feast', 'feast', 2, 'global', FALSE),
  ('design', NULL, 1, 'branch', 'Design', 'Design', 'design', 3, 'global', FALSE),
  ('program', NULL, 1, 'branch', 'Program', 'Program', 'program', 4, 'global', FALSE),
  ('documentary', NULL, 1, 'branch', 'Documentary', 'Documentary', 'documentary', 5, 'global', FALSE),
  ('look', NULL, 1, 'branch', 'Look', 'Look', 'look', 6, 'global', FALSE),
  ('booths', NULL, 1, 'branch', 'Booths', 'Booths', 'booths', 7, 'global', FALSE),
  ('prints', NULL, 1, 'branch', 'Prints', 'Prints', 'prints', 8, 'global', FALSE),
  ('transport', NULL, 1, 'branch', 'Transport', 'Transport', 'transport', 9, 'global', FALSE),
  ('reception', 'venue', 2, 'leaf', 'Reception', NULL, 'reception', 0, 'global', FALSE),
  ('ceremony_venue', 'venue', 2, 'leaf', 'Ceremony', NULL, 'ceremony-venue', 1, 'global', FALSE),
  ('coordinator', 'planning', 2, 'leaf', 'Coordinator / Planner', NULL, 'coordinator', 2, 'global', FALSE),
  ('cake', 'feast', 2, 'leaf', 'Cake', NULL, 'cake', 3, 'global', FALSE),
  ('catering', 'feast', 2, 'leaf', 'Catering', NULL, 'catering', 4, 'global', FALSE),
  ('stations', 'feast', 2, 'leaf', 'Stations', NULL, 'stations', 5, 'global', FALSE),
  ('stylist_decorator', 'design', 2, 'leaf', 'Stylist / Decorator', NULL, 'stylist-decorator', 6, 'global', FALSE),
  ('florist', 'design', 2, 'leaf', 'Florist', NULL, 'florist', 7, 'global', FALSE),
  ('lights_sound', 'design', 2, 'leaf', 'Lights & Sound', NULL, 'lights-sound', 8, 'global', FALSE),
  ('dance_floor', 'design', 2, 'leaf', 'Dance Floor', NULL, 'dance-floor', 9, 'global', FALSE),
  ('outdoor', 'design', 2, 'leaf', 'Outdoor', NULL, 'outdoor', 10, 'global', FALSE),
  ('fireworks', 'design', 2, 'leaf', 'Fireworks', NULL, 'fireworks', 11, 'global', FALSE),
  ('led_wall', 'design', 2, 'leaf', 'LED Wall', NULL, 'led-wall', 12, 'global', FALSE),
  ('digital_services', 'design', 2, 'leaf', 'Digital Services', NULL, 'digital-services', 13, 'global', FALSE),
  ('live_band', 'program', 2, 'leaf', 'Live Band', NULL, 'live-band', 14, 'global', FALSE),
  ('choir', 'program', 2, 'leaf', 'Choir', NULL, 'choir', 15, 'global', FALSE),
  ('orchestra', 'program', 2, 'leaf', 'Orchestra', NULL, 'orchestra', 16, 'global', FALSE),
  ('wedding_singer', 'program', 2, 'leaf', 'Wedding Singer', NULL, 'wedding-singer', 17, 'global', FALSE),
  ('dj', 'program', 2, 'leaf', 'DJ', NULL, 'dj', 18, 'global', FALSE),
  ('choreographer', 'program', 2, 'leaf', 'Choreographer', NULL, 'choreographer', 19, 'global', FALSE),
  ('performers', 'program', 2, 'leaf', 'Performers', NULL, 'performers', 20, 'global', FALSE),
  ('host_mc', 'program', 2, 'leaf', 'Host / MC', NULL, 'host-mc', 21, 'global', FALSE),
  ('photo_video', 'documentary', 2, 'leaf', 'Photo & Video', NULL, 'photo-video', 22, 'global', FALSE),
  ('editorial', 'documentary', 2, 'leaf', 'Editorial', NULL, 'editorial', 23, 'global', FALSE),
  ('livestream', 'documentary', 2, 'leaf', 'Livestream', NULL, 'livestream', 24, 'global', FALSE),
  ('brides_attire', 'look', 2, 'leaf', 'Bride''s Attire', NULL, 'brides-attire', 25, 'global', FALSE),
  ('grooms_attire', 'look', 2, 'leaf', 'Groom''s Attire', NULL, 'grooms-attire', 26, 'global', FALSE),
  ('womens_attire', 'look', 2, 'leaf', 'Women''s Attire', NULL, 'womens-attire', 27, 'global', FALSE),
  ('mens_attire', 'look', 2, 'leaf', 'Men''s Attire', NULL, 'mens-attire', 28, 'global', FALSE),
  ('filipiniana_barongs', 'look', 2, 'leaf', 'Filipiniana & Barongs', NULL, 'filipiniana-barongs', 29, 'global', FALSE),
  ('hmua', 'look', 2, 'leaf', 'HMUA', NULL, 'hmua', 30, 'global', FALSE),
  ('grooming', 'look', 2, 'leaf', 'Grooming', NULL, 'grooming', 31, 'global', FALSE),
  ('wellness_fitness', 'look', 2, 'leaf', 'Wellness & Fitness', NULL, 'wellness-fitness', 32, 'global', FALSE),
  ('jewelleries_accessories', 'look', 2, 'leaf', 'Jewelleries & Accessories', NULL, 'jewelleries-accessories', 33, 'global', FALSE),
  ('mobile_bar', 'booths', 2, 'leaf', 'Mobile Bar', NULL, 'mobile-bar', 34, 'global', FALSE),
  ('coffee_espresso', 'booths', 2, 'leaf', 'Coffee / Espresso', NULL, 'coffee-espresso', 35, 'global', FALSE),
  ('mocktail', 'booths', 2, 'leaf', 'Mocktail', NULL, 'mocktail', 36, 'global', FALSE),
  ('food_truck', 'booths', 2, 'leaf', 'Food Truck', NULL, 'food-truck', 37, 'global', FALSE),
  ('dessert', 'booths', 2, 'leaf', 'Dessert', NULL, 'dessert', 38, 'global', FALSE),
  ('massage_chair', 'booths', 2, 'leaf', 'Massage Chair', NULL, 'massage-chair', 39, 'global', FALSE),
  ('food_cart', 'booths', 2, 'leaf', 'Food Cart', NULL, 'food-cart', 40, 'global', FALSE),
  ('photo_booth', 'booths', 2, 'leaf', 'Photo Booth', NULL, 'photo-booth', 41, 'global', FALSE),
  ('perfume_bar', 'booths', 2, 'leaf', 'Perfume Bar', NULL, 'perfume-bar', 42, 'global', FALSE),
  ('arcade_games', 'booths', 2, 'leaf', 'Arcade / Games', NULL, 'arcade-games', 43, 'global', FALSE),
  ('henna_tattoo', 'booths', 2, 'leaf', 'Henna / Tattoo', NULL, 'henna-tattoo', 44, 'global', FALSE),
  ('mini_nail_bar', 'booths', 2, 'leaf', 'Mini Nail Bar', NULL, 'mini-nail-bar', 45, 'global', FALSE),
  ('tarot_astrology_palmistry', 'booths', 2, 'leaf', 'Tarot / Astrology / Palmistry', NULL, 'tarot-astrology-palmistry', 46, 'global', FALSE),
  ('caricature_calligraphy_painting', 'booths', 2, 'leaf', 'Caricature / Calligraphy / Painting', NULL, 'caricature-calligraphy-painting', 47, 'global', FALSE),
  ('engraving_embroidery', 'booths', 2, 'leaf', 'Engraving / Embroidery', NULL, 'engraving-embroidery', 48, 'global', FALSE),
  ('printing', 'prints', 2, 'leaf', 'Printing', NULL, 'printing', 49, 'global', FALSE),
  ('souvenir_giveaways', 'prints', 2, 'leaf', 'Souvenir / Giveaways', NULL, 'souvenir-giveaways', 50, 'global', FALSE),
  ('bridal_car', 'transport', 2, 'leaf', 'Bridal Car', NULL, 'bridal-car', 51, 'global', FALSE),
  ('guest_shuttle', 'transport', 2, 'leaf', 'Guest Shuttle', NULL, 'guest-shuttle', 52, 'global', FALSE),
  ('escort', 'transport', 2, 'leaf', 'Escort', NULL, 'escort', 53, 'global', FALSE)
ON CONFLICT (id) DO UPDATE SET
  parent_id   = EXCLUDED.parent_id,
  tier        = EXCLUDED.tier,
  kind        = EXCLUDED.kind,
  label_en    = EXCLUDED.label_en,
  label_short = EXCLUDED.label_short,
  slug        = EXCLUDED.slug,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();

INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental, dietary, is_tradition, marketplace_hidden, secondary_tiles)
VALUES
  ('catholic_priest', 'venue', NULL, 'V1.1 base', 'Catholic', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('civil_judge', 'venue', NULL, 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('civil_mayor', 'venue', NULL, 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('civil_justice_of_peace', 'venue', NULL, 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('inc_minister', 'venue', NULL, 'V1.3', 'INC', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('born_again_pastor', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('charismatic_pastor', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('mainline_protestant_pastor', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('muslim_imam', 'venue', NULL, 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('cultural_tribal_elder', 'venue', NULL, 'V1.5+', 'Cultural', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('officiant_priest_minister', 'venue', NULL, 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('pre_cana_seminar', 'venue', NULL, 'V1.2', 'Catholic', TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('cfo_seminar', 'venue', NULL, 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('inc_counseling', 'venue', NULL, 'V1.3', 'INC', TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('muslim_pre_wedding_counseling', 'venue', NULL, 'V1.4', 'Muslim', TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('marriage_license_expediting', 'venue', NULL, 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('apostille_dfa_authentication', 'venue', NULL, 'V1.3', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('accommodation', 'venue', 'reception', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, ARRAY['catering']::TEXT[]),
  ('wedding_coordination', 'planning', 'coordinator', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_planner_partial', 'planning', 'coordinator', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('day_of_coordinator', 'planning', 'coordinator', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('destination_wedding_specialist', 'planning', 'coordinator', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('pamamanhikan_coordinator', 'planning', 'coordinator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('despedida_planner', 'planning', 'coordinator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('sponsor_coordinator', 'planning', 'coordinator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('gender_separated_reception_coordinator', 'planning', 'coordinator', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('religious_venue_coordinator', 'planning', 'coordinator', 'V1.3', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('inc_wedding_coordinator', 'planning', 'coordinator', 'V1.3', 'INC', FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mahr_coordination', 'planning', 'coordinator', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_concierge', 'planning', 'coordinator', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('honeymoon_planner', 'planning', NULL, 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('destination_wedding_travel_coordinator', 'planning', NULL, 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('visa_wedding_logistics', 'planning', NULL, 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('wedding_cake', 'feast', 'cake', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('catering', 'feast', 'catering', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('lechonero', 'feast', 'catering', 'V1.1 base', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('halal_catering', 'feast', 'catering', 'V1.1.1', 'Muslim', FALSE, FALSE, FALSE, 'halal', FALSE, FALSE, '{}'::TEXT[]),
  ('live_cooking_station', 'feast', 'stations', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('stylist_decorator', 'design', 'stylist_decorator', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('decorator_general', 'design', 'stylist_decorator', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('capiz_native_decor', 'design', 'stylist_decorator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('hacienda_heritage_decor', 'design', 'stylist_decorator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('maranao_okir_decor', 'design', 'stylist_decorator', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('setnayan_custom_monogram', 'design', 'digital_services', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('florals', 'design', 'florist', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('garden_wedding_florist', 'design', 'florist', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('beach_wedding_florist', 'design', 'florist', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_bouquet_specialty', 'design', 'florist', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('lights_sound', 'design', 'lights_sound', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('led_dance_floor', 'design', 'dance_floor', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('generator_rental', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tent_rental', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mobile_restroom_rental', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('cooling_fans_misters', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bug_repellent_station', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_day_weather_forecaster', 'design', 'outdoor', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('parasol_hat_rental', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('outdoor_sound_system', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('outdoor_lighting_specialist', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('fireworks_pyro', 'design', 'fireworks', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('led_video_wall', 'design', 'led_wall', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_pailaw', 'design', 'digital_services', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('live_band', 'program', 'live_band', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('band_live_music', 'program', 'live_band', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('choir_string_quartet', 'program', 'choir', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('orchestra', 'program', 'orchestra', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_singer', 'program', 'wedding_singer', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_pakanta', 'design', 'digital_services', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('dj', 'program', 'dj', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('entourage_choreographer', 'program', 'choreographer', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('first_dance_choreographer', 'program', 'choreographer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('pre_cana_dance_trainer', 'program', 'choreographer', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('acoustic_performer', 'program', 'performers', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_entertainment', 'program', 'performers', 'V1.1.3', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('kulintang_ensemble', 'program', 'performers', 'V1.4', 'Muslim', TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('rondalla_ensemble', 'program', 'performers', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('folk_performer', 'program', 'performers', 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('host_emcee', 'program', 'host_mc', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('photography', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('videography', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('pre_nup_photographer', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('engagement_photographer', 'documentary', 'photo_video', 'V1.1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('drone', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('drone_videographer', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('same_day_edit', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('family_day2_photographer', 'documentary', 'photo_video', 'V1.1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('boudoir_photographer', 'documentary', 'photo_video', 'V1.1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('studio_portrait_photographer', 'documentary', 'photo_video', 'V1.1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('highlight_reel_specialist', 'documentary', 'photo_video', 'V1.1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('pre_nup_shoot_locations', 'documentary', 'photo_video', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_papic', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_ai_edited_highlight', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_save_the_date_mp4', 'documentary', 'photo_video', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_panood', 'documentary', 'livestream', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_gown_custom', 'look', 'brides_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_gown_rental', 'look', 'brides_attire', 'V1.1.4', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('filipiniana_terno', 'look', 'brides_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('filipiniana_maria_clara', 'look', 'brides_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('filipiniana_balintawak', 'look', 'brides_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('muslim_modest_bridal', 'look', 'brides_attire', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('inc_modest_bridal', 'look', 'brides_attire', 'V1.3', 'INC', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('maranao_wedding_attire', 'look', 'brides_attire', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('tausug_wedding_attire', 'look', 'brides_attire', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('yakan_wedding_attire', 'look', 'brides_attire', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('groom_suit_custom', 'look', 'grooms_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('groom_suit_rental', 'look', 'grooms_attire', 'V1.1.4', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('barong_tagalog_custom', 'look', 'grooms_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('barong_tagalog_rental', 'look', 'grooms_attire', 'V1.1.4', NULL, TRUE, FALSE, TRUE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('bridesmaid_dress', 'look', 'womens_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('junior_bridesmaid_dress', 'look', 'womens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mother_of_bride_gown', 'look', 'womens_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('flower_girl_dress', 'look', 'womens_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ninang_attire', 'look', 'womens_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('groomsman_set', 'look', 'mens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('junior_groomsman', 'look', 'mens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ninong_attire', 'look', 'mens_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ring_bearer_suit', 'look', 'mens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_hmua', 'look', 'hmua', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('family_mua', 'look', 'hmua', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_hair_stylist', 'look', 'hmua', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('touchup_mua', 'look', 'hmua', 'V1.1.5', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('maternity_bride_mua', 'look', 'hmua', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mature_bride_mua', 'look', 'hmua', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('groom_grooming', 'look', 'grooming', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_fitness', 'look', 'wellness_fitness', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_nutritionist', 'look', 'wellness_fitness', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_dental', 'look', 'wellness_fitness', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_spa', 'look', 'wellness_fitness', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_dermatology', 'look', 'wellness_fitness', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('engagement_ring', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_ring', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_jewellery', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_jewellery_rental', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('floral_jewellery', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_veil', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_garter', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_headpiece', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('flower_girl_tiara', 'look', 'jewelleries_accessories', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('sponsor_corsage', 'look', 'jewelleries_accessories', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mobile_bar', 'booths', 'mobile_bar', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('whiskey_cigar_bar', 'booths', 'mobile_bar', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('coffee_booth', 'booths', 'coffee_espresso', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tea_bar', 'booths', 'coffee_espresso', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mocktail_bar', 'booths', 'mocktail', 'V1.1.1', 'INC', FALSE, FALSE, FALSE, 'alcohol_free', FALSE, FALSE, '{}'::TEXT[]),
  ('mocktail_only_caterer', 'booths', 'mocktail', 'V1.1.1', 'INC', FALSE, FALSE, FALSE, 'alcohol_free', FALSE, FALSE, '{}'::TEXT[]),
  ('mocktail_booth_mini', 'booths', 'mocktail', 'V1.1.6', 'INC', FALSE, FALSE, FALSE, 'alcohol_free', FALSE, FALSE, '{}'::TEXT[]),
  ('food_truck', 'booths', 'food_truck', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('dessert_station', 'booths', 'dessert', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('halo_halo_station', 'booths', 'food_cart', 'V1.1.6', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ice_cream_cart', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('crepe_pancake_station', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('cotton_candy_cart', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('charcuterie_board', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mini_lechon_station', 'booths', 'food_cart', 'V1.1.6', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('donut_wall_display', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('sorbetes_cart', 'booths', 'food_cart', 'V1.1.6', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('food_cart_generic', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('photo_booth', 'booths', 'photo_booth', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('gif_booth', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('polaroid_booth', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('booth_360', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('selfie_magic_mirror', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_patiktok', 'booths', 'photo_booth', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('arcade_retro_games', 'booths', 'arcade_games', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('vr_ar_station', 'booths', 'arcade_games', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('perfume_bar', 'booths', 'perfume_bar', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('henna_tattoo_booth', 'booths', 'henna_tattoo', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('muslim_henna_artist', 'booths', 'henna_tattoo', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('massage_chair_station', 'booths', 'massage_chair', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('hair_touchup_station', 'booths', 'massage_chair', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('aromatherapy_station', 'booths', 'massage_chair', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mini_nail_bar', 'booths', 'mini_nail_bar', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tarot_astrology', 'booths', 'tarot_astrology_palmistry', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('palmistry_reader', 'booths', 'tarot_astrology_palmistry', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_portrait_painter', 'booths', 'caricature_calligraphy_painting', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('caricature_artist', 'booths', 'caricature_calligraphy_painting', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('silhouette_artist', 'booths', 'caricature_calligraphy_painting', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('live_calligraphy', 'booths', 'caricature_calligraphy_painting', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('poetry_typewriter', 'booths', 'caricature_calligraphy_painting', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('keychain_engraving', 'booths', 'engraving_embroidery', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('live_embroidery', 'booths', 'engraving_embroidery', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('invitation_print', 'prints', 'printing', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('invitation_digital', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('wedding_cards_designer', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('save_the_date_digital', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ceremony_program', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('place_card', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('menu_card', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('stationery_signage', 'prints', 'printing', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('souvenirs_giveaways', 'prints', 'souvenir_giveaways', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('pasalubong_box', 'prints', 'souvenir_giveaways', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('sponsor_token', 'prints', 'souvenir_giveaways', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('godchild_token', 'prints', 'souvenir_giveaways', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('transportation_bridal_car', 'transport', 'bridal_car', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('vintage_classic_vehicle', 'transport', 'bridal_car', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('horse_drawn_carriage', 'transport', 'bridal_car', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_boat_yacht', 'transport', 'bridal_car', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('transportation_guest_shuttle', 'transport', 'guest_shuttle', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('motorcycle_escort', 'transport', 'escort', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[])
ON CONFLICT (canonical_service) DO UPDATE SET
  folder_id          = EXCLUDED.folder_id,
  tile_id            = EXCLUDED.tile_id,
  phase              = EXCLUDED.phase,
  faith              = EXCLUDED.faith,
  is_ph              = EXCLUDED.is_ph,
  is_setnayan        = EXCLUDED.is_setnayan,
  is_rental          = EXCLUDED.is_rental,
  dietary            = EXCLUDED.dietary,
  is_tradition       = EXCLUDED.is_tradition,
  marketplace_hidden = EXCLUDED.marketplace_hidden,
  secondary_tiles    = EXCLUDED.secondary_tiles,
  updated_at         = now();

COMMIT;
