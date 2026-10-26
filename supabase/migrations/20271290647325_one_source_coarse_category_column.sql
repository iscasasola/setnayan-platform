-- one_source_coarse_category_column
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- ③0-c "one source" (corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 8.3,
-- owner 2026-10-26 "Build the taxonomy"): "the coarse category becomes a column on
-- service_categories read via getTaxonomy()".
--
-- WHAT. Every supplier on a couple's list is stored with a COARSE category
-- (`event_vendors.category`, the `vendor_category` enum) that budget, timelines and the day-of
-- tools read. Which coarse category a CATEGORY (tier-2 tile) files its shops under lived only in
-- code — `BRANCH_TO_VENDOR_CATEGORY` (apps/web/lib/vendor-branch-category.ts) — so a category an
-- admin created in /admin/categories had no answer and every shop under it was filed as
-- "Miscellaneous", silently.
--
-- This adds `service_categories.coarse_category` and writes the code map into it, row for row.
-- The resolver (`categoryForBranch`) now reads this column through `getTaxonomy()` and uses the
-- code map only as the fallback snapshot's copy, so the database is the answer and an edit to the
-- column is followed with no deploy.
--
-- BEHAVIOUR ON TODAY'S DATA: identical — every tile gets exactly the value the code map gives it;
-- `apps/web/tests/db/one-source-category-key.db.test.ts` asserts that, and that a category whose
-- column is set files its shops there instead of under misc.
--
-- RLS: unchanged. `service_categories` already has RLS (public SELECT, admin write); a new column
-- carries the table's policies and grants. The value is the public coarse vocabulary, not private.
--
-- Rows an admin has since deleted are simply not matched. A value is written only where the
-- column is still NULL, so a re-apply never overwrites an admin's later choice.

ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS coarse_category public.vendor_category;

COMMENT ON COLUMN public.service_categories.coarse_category IS
  'Tier-2 category: the coarse vendor_category a shop filed under it is stored with (event_vendors.category). NULL = not set; the app then files it as misc and the admin page must say so. Seeded from lib/vendor-branch-category.ts BRANCH_TO_VENDOR_CATEGORY (③0-c, 2026-10-26).';

UPDATE public.service_categories sc
   SET coarse_category = v.coarse::public.vendor_category
  FROM (VALUES
    ('reception', 'venue'),
    ('ceremony_venue', 'religious_venue'),
    ('accommodation', 'accommodation'),
    ('coordinator', 'planner_coordinator'),
    ('date_specialist', 'planner_coordinator'),
    ('cake', 'cake_maker'),
    ('catering', 'catering'),
    ('stations', 'catering'),
    ('crew_meals', 'crew_meals'),
    ('stylist_decorator', 'reception_decor'),
    ('florist', 'florist'),
    ('lights_sound', 'lights_and_sound'),
    ('dance_floor', 'reception_decor'),
    ('outdoor', 'reception_decor'),
    ('chairs_tents', 'reception_decor'),
    ('fireworks', 'reception_decor'),
    ('led_wall', 'led_screens'),
    ('digital_services', 'av_production'),
    ('live_band', 'band_dj'),
    ('choir', 'choir'),
    ('orchestra', 'string_quartet'),
    ('wedding_singer', 'performers'),
    ('dj', 'band_dj'),
    ('choreographer', 'choreographer'),
    ('performers', 'performers'),
    ('host_mc', 'host_emcee'),
    ('av_production', 'av_production'),
    ('speaker_talent', 'speaker_talent'),
    ('kids_entertainer', 'kids_entertainer'),
    ('photo_video', 'photographer'),
    ('editorial', 'photographer'),
    ('wedding_paperwork', 'wedding_paperwork'),
    ('travel_honeymoon', 'travel_honeymoon'),
    ('brides_attire', 'gown_designer'),
    ('grooms_attire', 'suit_designer'),
    ('womens_attire', 'gown_designer'),
    ('mens_attire', 'suit_designer'),
    ('filipiniana_barongs', 'suit_designer'),
    ('hmua', 'makeup_artist'),
    ('grooming', 'hair_stylist'),
    ('wellness_fitness', 'wellness_fitness'),
    ('jewelleries_accessories', 'rings'),
    ('mobile_bar', 'mobile_bar'),
    ('coffee_espresso', 'mobile_bar'),
    ('mocktail', 'mobile_bar'),
    ('food_truck', 'catering'),
    ('dessert', 'cake_maker'),
    ('food_cart', 'catering'),
    ('photo_booth', 'photobooth'),
    ('massage_chair', 'guest_booth'),
    ('perfume_bar', 'guest_booth'),
    ('arcade_games', 'guest_booth'),
    ('henna_tattoo', 'guest_booth'),
    ('mini_nail_bar', 'guest_booth'),
    ('tarot_astrology_palmistry', 'guest_booth'),
    ('caricature_calligraphy_painting', 'guest_booth'),
    ('engraving_embroidery', 'gifts_and_giveaways'),
    ('printing', 'invitations_stationery'),
    ('souvenir_giveaways', 'gifts_and_giveaways'),
    ('trophies_awards', 'gifts_and_giveaways'),
    ('bridal_car', 'transportation'),
    ('guest_shuttle', 'transportation'),
    ('transfers_rentals', 'transportation'),
    ('escort', 'security'),
    ('tour_activity', 'tour_activity'),
    ('tour_guide', 'tour_guide'),
    ('restaurant_reservation', 'restaurant_reservation'),
    ('referee_official', 'referee_official'),
    ('event_medic', 'event_medic'),
    ('event_insurance', 'event_insurance'),
    ('personal_accident_insurance', 'personal_accident_insurance'),
    ('travel_insurance', 'travel_insurance'),
    ('reveal_element', 'reveal_element'),
    ('funeral_home', 'funeral_home'),
    ('casket_urn', 'funeral_home'),
    ('embalming', 'funeral_home'),
    ('hearse', 'funeral_home'),
    ('cremation', 'cremation'),
    ('memorial_park', 'memorial_park')
  ) AS v(tile_id, coarse)
 WHERE sc.id = v.tile_id
   AND sc.tier = 2
   AND sc.coarse_category IS NULL;
