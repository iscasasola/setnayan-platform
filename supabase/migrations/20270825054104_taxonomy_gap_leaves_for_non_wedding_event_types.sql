-- ============================================================================
-- 20270825054104_taxonomy_gap_leaves_for_non_wedding_event_types.sql
--
-- The 14 taxonomy GAP LEAVES for non-wedding event types (owner "build the
-- gaps" 2026-07-17 · Whats_Next_Suite_AI_Pricing_2026-07-18 §gap-leaves ·
-- Setnayan_AI_Gap_Leaves_Travel_Dinner_Date_2026-07-17 Part A). Head of the
-- taxonomy dependency chain — unblocks ai-applicable-event-types,
-- ai-travel-scheduling and ai-per-type-pricing.
--
--   referee_official · event_medic · tour_activity · tour_guide ·
--   travel_insurance · av_production · speaker_talent · performers ·
--   kids_entertainer · choreographer · reveal_element · event_insurance ·
--   personal_accident_insurance · restaurant_reservation
--
-- RECONCILED, NOT DUPLICATED: `performers` + `choreographer` already exist as
-- tier-2 tiles under PROGRAM (tree foundation 20260803001000) with canonicals
-- placed beneath them — this migration only adds their couple-side
-- vendor_category enum values. `reveal_element` existed ONLY as a checklist
-- category key (lib/checklist-event-type-defs.ts gender_reveal tier2Core) —
-- the new tile makes that key a real taxonomy node under the same id.
--
-- Structure (pattern mirrors 20270310764093_chinese_specialist_leaves.sql +
-- the 20270520996335 regenerated-seed discipline):
--   1. public.vendor_category enum — 14 new couple/vendor-side values.
--   2. canonical_service_schemas stubs — 12 NET-NEW canonicals (one per new
--      tile; the tile IS the leaf, mirroring mobile_bar / food_truck).
--   3. REGENERATED full taxonomy seed from apps/web/scripts/
--      gen-taxonomy-seed.ts (5 new tier-1 families: EXPERIENCE · DINING ·
--      LOGISTICS & SAFETY · INSURANCE & PROTECTION · SPECIALTY; 12 new tier-2
--      tiles; 12 new canonical mappings; sort_order re-numbered).
--   4. applicable_event_types (tile + canonical grain) for the NEW leaves
--      only, exactly where the leaf-by-type matrix is explicit. NULL stays
--      NULL everywhere else (= universal, today's semantics). The two
--      pre-existing tiles (performers, choreographer) are NOT narrowed here —
--      that belongs to the ai-applicable-event-types follow-up (matrix
--      sign-off gated). `restaurant_reservation` is scoped to travel only:
--      its anchor type `dinner_date` is NOT in event_type_vocab yet
--      (dinner-date-type is HOLD-OWNER; the validation trigger would reject
--      the key) — append 'dinner_date' when that type ships.
--   5. Fail-loud assertions.
--
-- Couple-facing inertness: /explore + shortlists filter tiles through
-- passesEventTypeFilter, so every scoped new tile is invisible to event types
-- outside its matrix column; the new folders surface in the strip only once
-- they hold a visible tile with vendors (count>0 filter). Suite zone table
-- classifies ai-gap-leaves as additive / non-prod-affecting (taxonomy zone).
-- ============================================================================

-- ── 1. vendor_category enum — 14 new couple/vendor-side values ──────────────
-- (ADD VALUE IF NOT EXISTS is txn-safe on PG12+ as long as the new values are
-- not USED later in this same migration — they are not.)
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'referee_official';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'event_medic';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'tour_activity';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'tour_guide';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'travel_insurance';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'av_production';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'speaker_talent';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'performers';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'kids_entertainer';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'choreographer';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'reveal_element';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'event_insurance';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'personal_accident_insurance';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'restaurant_reservation';

-- ── 2. Schema stubs — vendor "add a service" picker + admin tree presence ───
-- display_name_en is PUBLIC marketplace copy (culture-facing, never jargon).
INSERT INTO public.canonical_service_schemas
  (canonical_service, schema_version, display_name_en, shared_attribute_groups,
   category_specific_attributes, filter_facets, required_for_visibility, ranking_signal_weights)
VALUES
  ('tour_activity',               1, 'Tours & Activities',            '{}', '{}', '[]', '{}', '{}'),
  ('tour_guide',                  1, 'Tour Guide',                    '{}', '{}', '[]', '{}', '{}'),
  ('restaurant_reservation',      1, 'Restaurant (Reservation)',      '{}', '{}', '[]', '{}', '{}'),
  ('referee_official',            1, 'Referees / Officials',          '{}', '{}', '[]', '{}', '{}'),
  ('event_medic',                 1, 'Medic / First-aid',             '{}', '{}', '[]', '{}', '{}'),
  ('event_insurance',             1, 'Event Insurance',               '{}', '{}', '[]', '{}', '{}'),
  ('personal_accident_insurance', 1, 'Personal Accident Insurance',   '{}', '{}', '[]', '{}', '{}'),
  ('travel_insurance',            1, 'Travel Insurance',              '{}', '{}', '[]', '{}', '{}'),
  ('av_production',               1, 'AV / Production',               '{}', '{}', '[]', '{}', '{}'),
  ('speaker_talent',              1, 'Speakers / Talent',             '{}', '{}', '[]', '{}', '{}'),
  ('kids_entertainer',            1, 'Kids'' Entertainer',            '{}', '{}', '[]', '{}', '{}'),
  ('reveal_element',              1, 'Reveal Element',                '{}', '{}', '[]', '{}', '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- ── 3. Regenerated full taxonomy seed (DO NOT HAND-EDIT — re-run
--       `cd apps/web && npx tsx scripts/gen-taxonomy-seed.ts` after any
--       TAXONOMY_MAP change and replace this block) ──────────────────────────
-- ────────────────────────────────────────────────────────────────────────────
-- GENERATED by apps/web/scripts/gen-taxonomy-seed.ts FROM lib/taxonomy.ts.
-- DO NOT HAND-EDIT — re-run the generator after any TAXONOMY_MAP change.
-- 84 category nodes (15 parents + 69 tiles) · 244 canonical mappings.
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
  ('experience', NULL, 1, 'branch', 'Experience', 'Experience', 'experience', 10, 'global', FALSE),
  ('dining', NULL, 1, 'branch', 'Dining', 'Dining', 'dining', 11, 'global', FALSE),
  ('logistics_safety', NULL, 1, 'branch', 'Logistics & Safety', 'Logistics', 'logistics-safety', 12, 'global', FALSE),
  ('insurance', NULL, 1, 'branch', 'Insurance & Protection', 'Insurance', 'insurance', 13, 'global', FALSE),
  ('specialty', NULL, 1, 'branch', 'Specialty', 'Specialty', 'specialty', 14, 'global', FALSE),
  ('reception', 'venue', 2, 'leaf', 'Reception', NULL, 'reception', 0, 'global', FALSE),
  ('ceremony_venue', 'venue', 2, 'leaf', 'Ceremony', NULL, 'ceremony-venue', 1, 'global', FALSE),
  ('coordinator', 'planning', 2, 'leaf', 'Coordinator / Planner', NULL, 'coordinator', 2, 'global', FALSE),
  ('date_specialist', 'planning', 2, 'leaf', 'Date & Feng-shui Specialist', NULL, 'date-specialist', 3, 'global', FALSE),
  ('cake', 'feast', 2, 'leaf', 'Cake', NULL, 'cake', 4, 'global', FALSE),
  ('catering', 'feast', 2, 'leaf', 'Catering', NULL, 'catering', 5, 'global', FALSE),
  ('stations', 'feast', 2, 'leaf', 'Stations', NULL, 'stations', 6, 'global', FALSE),
  ('crew_meals', 'feast', 2, 'leaf', 'Crew Meals', NULL, 'crew-meals', 7, 'global', FALSE),
  ('stylist_decorator', 'design', 2, 'leaf', 'Stylist / Decorator', NULL, 'stylist-decorator', 8, 'global', FALSE),
  ('florist', 'design', 2, 'leaf', 'Florist', NULL, 'florist', 9, 'global', FALSE),
  ('lights_sound', 'design', 2, 'leaf', 'Lights & Sound', NULL, 'lights-sound', 10, 'global', FALSE),
  ('dance_floor', 'design', 2, 'leaf', 'Dance Floor', NULL, 'dance-floor', 11, 'global', FALSE),
  ('outdoor', 'design', 2, 'leaf', 'Outdoor', NULL, 'outdoor', 12, 'global', FALSE),
  ('fireworks', 'design', 2, 'leaf', 'Fireworks', NULL, 'fireworks', 13, 'global', FALSE),
  ('led_wall', 'design', 2, 'leaf', 'LED Wall', NULL, 'led-wall', 14, 'global', FALSE),
  ('digital_services', 'design', 2, 'leaf', 'Digital Services', NULL, 'digital-services', 15, 'global', FALSE),
  ('live_band', 'program', 2, 'leaf', 'Live Band', NULL, 'live-band', 16, 'global', FALSE),
  ('choir', 'program', 2, 'leaf', 'Choir', NULL, 'choir', 17, 'global', FALSE),
  ('orchestra', 'program', 2, 'leaf', 'Orchestra', NULL, 'orchestra', 18, 'global', FALSE),
  ('wedding_singer', 'program', 2, 'leaf', 'Wedding Singer', NULL, 'wedding-singer', 19, 'global', FALSE),
  ('dj', 'program', 2, 'leaf', 'DJ', NULL, 'dj', 20, 'global', FALSE),
  ('choreographer', 'program', 2, 'leaf', 'Choreographer', NULL, 'choreographer', 21, 'global', FALSE),
  ('performers', 'program', 2, 'leaf', 'Performers', NULL, 'performers', 22, 'global', FALSE),
  ('host_mc', 'program', 2, 'leaf', 'Host / MC', NULL, 'host-mc', 23, 'global', FALSE),
  ('av_production', 'program', 2, 'leaf', 'AV / Production', NULL, 'av-production', 24, 'global', FALSE),
  ('speaker_talent', 'program', 2, 'leaf', 'Speakers / Talent', NULL, 'speaker-talent', 25, 'global', FALSE),
  ('kids_entertainer', 'program', 2, 'leaf', 'Kids'' Entertainer', NULL, 'kids-entertainer', 26, 'global', FALSE),
  ('photo_video', 'documentary', 2, 'leaf', 'Photo & Video', NULL, 'photo-video', 27, 'global', FALSE),
  ('editorial', 'documentary', 2, 'leaf', 'Editorial', NULL, 'editorial', 28, 'global', FALSE),
  ('livestream', 'documentary', 2, 'leaf', 'Livestream', NULL, 'livestream', 29, 'global', FALSE),
  ('brides_attire', 'look', 2, 'leaf', 'Bride''s Attire', NULL, 'brides-attire', 30, 'global', FALSE),
  ('grooms_attire', 'look', 2, 'leaf', 'Groom''s Attire', NULL, 'grooms-attire', 31, 'global', FALSE),
  ('womens_attire', 'look', 2, 'leaf', 'Women''s Attire', NULL, 'womens-attire', 32, 'global', FALSE),
  ('mens_attire', 'look', 2, 'leaf', 'Men''s Attire', NULL, 'mens-attire', 33, 'global', FALSE),
  ('filipiniana_barongs', 'look', 2, 'leaf', 'Filipiniana & Barongs', NULL, 'filipiniana-barongs', 34, 'global', FALSE),
  ('hmua', 'look', 2, 'leaf', 'HMUA', NULL, 'hmua', 35, 'global', FALSE),
  ('grooming', 'look', 2, 'leaf', 'Grooming', NULL, 'grooming', 36, 'global', FALSE),
  ('wellness_fitness', 'look', 2, 'leaf', 'Wellness & Fitness', NULL, 'wellness-fitness', 37, 'global', FALSE),
  ('jewelleries_accessories', 'look', 2, 'leaf', 'Jewelleries & Accessories', NULL, 'jewelleries-accessories', 38, 'global', FALSE),
  ('mobile_bar', 'booths', 2, 'leaf', 'Mobile Bar', NULL, 'mobile-bar', 39, 'global', FALSE),
  ('coffee_espresso', 'booths', 2, 'leaf', 'Coffee / Espresso', NULL, 'coffee-espresso', 40, 'global', FALSE),
  ('mocktail', 'booths', 2, 'leaf', 'Mocktail', NULL, 'mocktail', 41, 'global', FALSE),
  ('food_truck', 'booths', 2, 'leaf', 'Food Truck', NULL, 'food-truck', 42, 'global', FALSE),
  ('dessert', 'booths', 2, 'leaf', 'Dessert', NULL, 'dessert', 43, 'global', FALSE),
  ('massage_chair', 'booths', 2, 'leaf', 'Massage Chair', NULL, 'massage-chair', 44, 'global', FALSE),
  ('food_cart', 'booths', 2, 'leaf', 'Food Cart', NULL, 'food-cart', 45, 'global', FALSE),
  ('photo_booth', 'booths', 2, 'leaf', 'Photo Booth', NULL, 'photo-booth', 46, 'global', FALSE),
  ('perfume_bar', 'booths', 2, 'leaf', 'Perfume Bar', NULL, 'perfume-bar', 47, 'global', FALSE),
  ('arcade_games', 'booths', 2, 'leaf', 'Arcade / Games', NULL, 'arcade-games', 48, 'global', FALSE),
  ('henna_tattoo', 'booths', 2, 'leaf', 'Henna / Tattoo', NULL, 'henna-tattoo', 49, 'global', FALSE),
  ('mini_nail_bar', 'booths', 2, 'leaf', 'Mini Nail Bar', NULL, 'mini-nail-bar', 50, 'global', FALSE),
  ('tarot_astrology_palmistry', 'booths', 2, 'leaf', 'Tarot / Astrology / Palmistry', NULL, 'tarot-astrology-palmistry', 51, 'global', FALSE),
  ('caricature_calligraphy_painting', 'booths', 2, 'leaf', 'Caricature / Calligraphy / Painting', NULL, 'caricature-calligraphy-painting', 52, 'global', FALSE),
  ('engraving_embroidery', 'booths', 2, 'leaf', 'Engraving / Embroidery', NULL, 'engraving-embroidery', 53, 'global', FALSE),
  ('printing', 'prints', 2, 'leaf', 'Printing', NULL, 'printing', 54, 'global', FALSE),
  ('souvenir_giveaways', 'prints', 2, 'leaf', 'Souvenir / Giveaways', NULL, 'souvenir-giveaways', 55, 'global', FALSE),
  ('trophies_awards', 'prints', 2, 'leaf', 'Trophies & Awards', NULL, 'trophies-awards', 56, 'global', FALSE),
  ('bridal_car', 'transport', 2, 'leaf', 'Bridal Car', NULL, 'bridal-car', 57, 'global', FALSE),
  ('guest_shuttle', 'transport', 2, 'leaf', 'Guest Shuttle', NULL, 'guest-shuttle', 58, 'global', FALSE),
  ('escort', 'transport', 2, 'leaf', 'Escort', NULL, 'escort', 59, 'global', FALSE),
  ('tour_activity', 'experience', 2, 'leaf', 'Tours & Activities', NULL, 'tour-activity', 60, 'global', FALSE),
  ('tour_guide', 'experience', 2, 'leaf', 'Tour Guide', NULL, 'tour-guide', 61, 'global', FALSE),
  ('restaurant_reservation', 'dining', 2, 'leaf', 'Restaurant (Reservation)', NULL, 'restaurant-reservation', 62, 'global', FALSE),
  ('referee_official', 'logistics_safety', 2, 'leaf', 'Referees / Officials', NULL, 'referee-official', 63, 'global', FALSE),
  ('event_medic', 'logistics_safety', 2, 'leaf', 'Medic / First-aid', NULL, 'event-medic', 64, 'global', FALSE),
  ('event_insurance', 'insurance', 2, 'leaf', 'Event Insurance', NULL, 'event-insurance', 65, 'global', FALSE),
  ('personal_accident_insurance', 'insurance', 2, 'leaf', 'Personal Accident', NULL, 'personal-accident-insurance', 66, 'global', FALSE),
  ('travel_insurance', 'insurance', 2, 'leaf', 'Travel Insurance', NULL, 'travel-insurance', 67, 'global', FALSE),
  ('reveal_element', 'specialty', 2, 'leaf', 'Reveal Element', NULL, 'reveal-element', 68, 'global', FALSE)
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
  ('born_again_pastor', 'venue', NULL, 'V1.2', 'Born Again', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('charismatic_pastor', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('mainline_protestant_pastor', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('muslim_imam', 'venue', NULL, 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('cultural_tribal_elder', 'venue', NULL, 'V1.5+', 'Cultural', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('jewish_rabbi', 'venue', NULL, 'V1.2', 'Jewish', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('aglipayan_priest', 'venue', NULL, 'V1.2', 'Aglipayan', TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('lds_officiant', 'venue', NULL, 'V1.2', 'LDS', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('sda_pastor', 'venue', NULL, 'V1.2', 'SDA', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('jw_elder', 'venue', NULL, 'V1.2', 'JW', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('hindu_pandit', 'venue', NULL, 'V1.2', 'Hindu', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('sikh_granthi', 'venue', NULL, 'V1.2', 'Sikh', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('buddhist_monk', 'venue', NULL, 'V1.2', 'Buddhist', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('orthodox_priest', 'venue', NULL, 'V1.2', 'Orthodox', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('christian_premarital_counseling', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
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
  ('date_fengshui_consultant', 'planning', 'date_specialist', 'V1.1.1', 'Chinese', TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('honeymoon_planner', 'planning', NULL, 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('destination_wedding_travel_coordinator', 'planning', NULL, 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('visa_wedding_logistics', 'planning', NULL, 'V1.5+', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[]),
  ('wedding_cake', 'feast', 'cake', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('catering', 'feast', 'catering', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('lechonero', 'feast', 'catering', 'V1.1 base', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('chinese_lauriat_caterer', 'feast', 'catering', 'V1.1.1', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('halal_catering', 'feast', 'catering', 'V1.1.1', NULL, FALSE, FALSE, FALSE, 'halal', FALSE, FALSE, '{}'::TEXT[]),
  ('live_cooking_station', 'feast', 'stations', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('crew_meal_supply', 'feast', 'crew_meals', 'V1.1 base', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('stylist_decorator', 'design', 'stylist_decorator', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('decorator_general', 'design', 'stylist_decorator', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('capiz_native_decor', 'design', 'stylist_decorator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('hacienda_heritage_decor', 'design', 'stylist_decorator', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('maranao_okir_decor', 'design', 'stylist_decorator', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('double_happiness_decor', 'design', 'stylist_decorator', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('tea_set_styling', 'design', 'stylist_decorator', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('chuppah_rental', 'design', 'stylist_decorator', 'V1.1.1', 'Jewish', FALSE, FALSE, TRUE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('mandap_decor', 'design', 'stylist_decorator', 'V1.1.1', 'Hindu', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
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
  ('lion_dance_troupe', 'program', 'performers', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('host_emcee', 'program', 'host_mc', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tea_ceremony_master', 'program', 'host_mc', 'V1.1.1', 'Chinese', TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
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
  ('qipao_cheongsam_attire', 'look', 'brides_attire', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('sari_lehenga_bridal', 'look', 'brides_attire', 'V1.1.1', 'Hindu', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('groom_suit_custom', 'look', 'grooms_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('groom_suit_rental', 'look', 'grooms_attire', 'V1.1.4', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('barong_tagalog_custom', 'look', 'grooms_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('barong_tagalog_rental', 'look', 'grooms_attire', 'V1.1.4', NULL, TRUE, FALSE, TRUE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('sherwani_groom', 'look', 'grooms_attire', 'V1.1.1', 'Hindu', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('muslim_groom_attire', 'look', 'grooms_attire', 'V1.1.1', 'Muslim', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('maranao_groom_attire', 'look', 'grooms_attire', 'V1.1.1', 'Muslim', TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('tausug_groom_attire', 'look', 'grooms_attire', 'V1.1.1', 'Muslim', TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('yakan_groom_attire', 'look', 'grooms_attire', 'V1.1.1', 'Muslim', TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('bridesmaid_dress', 'look', 'womens_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('junior_bridesmaid_dress', 'look', 'womens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mother_of_bride_gown', 'look', 'womens_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('flower_girl_dress', 'look', 'womens_attire', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ninang_attire', 'look', 'womens_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('debutante_gown', 'look', 'womens_attire', 'V1.1.1', NULL, TRUE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('groomsman_set', 'look', 'mens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('junior_groomsman', 'look', 'mens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ninong_attire', 'look', 'mens_attire', 'V1.1.4', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ring_bearer_suit', 'look', 'mens_attire', 'V1.1.4', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('eighteen_roses_attire', 'look', 'mens_attire', 'V1.1.1', NULL, TRUE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
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
  ('mocktail_bar', 'booths', 'mocktail', 'V1.1.1', NULL, FALSE, FALSE, FALSE, 'alcohol_free', FALSE, FALSE, '{}'::TEXT[]),
  ('mocktail_only_caterer', 'booths', 'mocktail', 'V1.1.1', NULL, FALSE, FALSE, FALSE, 'alcohol_free', FALSE, FALSE, '{}'::TEXT[]),
  ('mocktail_booth_mini', 'booths', 'mocktail', 'V1.1.6', NULL, FALSE, FALSE, FALSE, 'alcohol_free', FALSE, FALSE, '{}'::TEXT[]),
  ('food_truck', 'booths', 'food_truck', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('dessert_station', 'booths', 'dessert', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('halo_halo_station', 'booths', 'food_cart', 'V1.1.6', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('ice_cream_cart', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('crepe_pancake_station', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('cotton_candy_cart', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('charcuterie_board', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mini_lechon_station', 'booths', 'food_cart', 'V1.1.6', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('donut_wall_display', 'booths', 'dessert', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('sorbetes_cart', 'booths', 'food_cart', 'V1.1.6', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('food_cart_generic', 'booths', 'food_cart', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('photo_booth', 'booths', 'photo_booth', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('gif_booth', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('polaroid_booth', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('booth_360', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('selfie_magic_mirror', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('setnayan_patiktok', 'booths', 'photo_booth', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('pabati', 'booths', 'photo_booth', 'V1.1 base', NULL, FALSE, TRUE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('arcade_retro_games', 'booths', 'arcade_games', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('vr_ar_station', 'booths', 'arcade_games', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('perfume_bar', 'booths', 'perfume_bar', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('henna_tattoo_booth', 'booths', 'henna_tattoo', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('muslim_henna_artist', 'booths', 'henna_tattoo', 'V1.4', 'Muslim', FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('mehndi_artist', 'booths', 'henna_tattoo', 'V1.1.1', 'Hindu', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
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
  ('angpao_betrothal_supplier', 'prints', 'souvenir_giveaways', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[]),
  ('trophy_supplier', 'prints', 'trophies_awards', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('medals_plaques', 'prints', 'trophies_awards', 'V1.1.1', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('transportation_bridal_car', 'transport', 'bridal_car', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('vintage_classic_vehicle', 'transport', 'bridal_car', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('horse_drawn_carriage', 'transport', 'bridal_car', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('bridal_boat_yacht', 'transport', 'bridal_car', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('transportation_guest_shuttle', 'transport', 'guest_shuttle', 'V1.1 base', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('motorcycle_escort', 'transport', 'escort', 'V1.5+', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tour_activity', 'experience', 'tour_activity', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tour_guide', 'experience', 'tour_guide', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('restaurant_reservation', 'dining', 'restaurant_reservation', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('referee_official', 'logistics_safety', 'referee_official', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('event_medic', 'logistics_safety', 'event_medic', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('event_insurance', 'insurance', 'event_insurance', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('personal_accident_insurance', 'insurance', 'personal_accident_insurance', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('travel_insurance', 'insurance', 'travel_insurance', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('av_production', 'program', 'av_production', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('speaker_talent', 'program', 'speaker_talent', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('kids_entertainer', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('reveal_element', 'specialty', 'reveal_element', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[])
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

-- ── 4. Event-type scoping for the NEW leaves (tile grain = primary control;
--       canonical grain mirrored for leaf-suggestion consumers). Values are
--       core + optional unions straight from the Part A leaf-by-type matrix
--       ("Optionals kept — the AI's coverage set = core + optional").
--       Validation trigger checks each key against event_type_vocab. ────────
UPDATE public.service_categories SET applicable_event_types = ARRAY['tournament']
  WHERE id = 'referee_official';
UPDATE public.service_categories SET applicable_event_types = ARRAY['tournament','wedding','corporate']
  WHERE id = 'event_medic';
UPDATE public.service_categories SET applicable_event_types = ARRAY['travel']
  WHERE id = 'tour_activity';
UPDATE public.service_categories SET applicable_event_types = ARRAY['travel']
  WHERE id = 'tour_guide';
UPDATE public.service_categories SET applicable_event_types = ARRAY['travel']
  WHERE id = 'travel_insurance';
UPDATE public.service_categories SET applicable_event_types = ARRAY['corporate','wedding','debut']
  WHERE id = 'av_production';
UPDATE public.service_categories SET applicable_event_types = ARRAY['corporate']
  WHERE id = 'speaker_talent';
UPDATE public.service_categories SET applicable_event_types = ARRAY['birthday']
  WHERE id = 'kids_entertainer';
UPDATE public.service_categories SET applicable_event_types = ARRAY['gender_reveal']
  WHERE id = 'reveal_element';
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','corporate','debut','birthday','tournament','celebration','travel']
  WHERE id = 'event_insurance';
UPDATE public.service_categories SET applicable_event_types = ARRAY['tournament','corporate','birthday','travel']
  WHERE id = 'personal_accident_insurance';
-- dinner_date is not an event_type_vocab key yet (HOLD-OWNER) — travel is the
-- doc's only other explicit type; append 'dinner_date' when the type ships.
UPDATE public.service_categories SET applicable_event_types = ARRAY['travel']
  WHERE id = 'restaurant_reservation';

-- Canonical-grain mirror (same values — the per-service override column).
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['tournament']
  WHERE canonical_service = 'referee_official';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['tournament','wedding','corporate']
  WHERE canonical_service = 'event_medic';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['travel']
  WHERE canonical_service = 'tour_activity';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['travel']
  WHERE canonical_service = 'tour_guide';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['travel']
  WHERE canonical_service = 'travel_insurance';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['corporate','wedding','debut']
  WHERE canonical_service = 'av_production';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['corporate']
  WHERE canonical_service = 'speaker_talent';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['birthday']
  WHERE canonical_service = 'kids_entertainer';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['gender_reveal']
  WHERE canonical_service = 'reveal_element';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['wedding','corporate','debut','birthday','tournament','celebration','travel']
  WHERE canonical_service = 'event_insurance';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['tournament','corporate','birthday','travel']
  WHERE canonical_service = 'personal_accident_insurance';
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['travel']
  WHERE canonical_service = 'restaurant_reservation';

-- ── 5. Fail loud — the 12 new tiles must exist under the right parents with
--       scoping applied, and the 2 reconciled tiles must remain untouched
--       (still universal until the matrix-sign-off follow-up). ───────────────
DO $$
DECLARE
  bad TEXT;
  n INT;
BEGIN
  SELECT string_agg(x.id, ', ') INTO bad FROM (VALUES
    ('tour_activity','experience'), ('tour_guide','experience'),
    ('restaurant_reservation','dining'),
    ('referee_official','logistics_safety'), ('event_medic','logistics_safety'),
    ('event_insurance','insurance'), ('personal_accident_insurance','insurance'),
    ('travel_insurance','insurance'),
    ('av_production','program'), ('speaker_talent','program'),
    ('kids_entertainer','program'), ('reveal_element','specialty')
  ) AS x(id, parent)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.service_categories c
    WHERE c.id = x.id AND c.parent_id = x.parent AND c.tier = 2
      AND c.applicable_event_types IS NOT NULL
      AND cardinality(c.applicable_event_types) > 0
  );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'gap-leaf tiles missing/mis-parented/unscoped: %', bad;
  END IF;

  SELECT count(*) INTO n FROM public.canonical_service_taxonomy t
   WHERE t.canonical_service IN
     ('tour_activity','tour_guide','restaurant_reservation','referee_official',
      'event_medic','event_insurance','personal_accident_insurance',
      'travel_insurance','av_production','speaker_talent','kids_entertainer',
      'reveal_element')
     AND t.tile_id = t.canonical_service;
  IF n <> 12 THEN
    RAISE EXCEPTION 'expected 12 gap-leaf canonical placements, found %', n;
  END IF;

  -- Reconciled tiles keep today's universal scope (NULL) — narrowing them is
  -- the ai-applicable-event-types follow-up, not this migration.
  SELECT string_agg(c.id, ', ') INTO bad
    FROM public.service_categories c
   WHERE c.id IN ('performers','choreographer')
     AND c.applicable_event_types IS NOT NULL
     AND cardinality(c.applicable_event_types) > 0;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'pre-existing tiles must stay universal in this migration: %', bad;
  END IF;
END $$;
