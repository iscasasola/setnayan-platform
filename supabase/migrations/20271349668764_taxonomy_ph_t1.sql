-- T1 · THE PHILIPPINE TAXONOMY GOES LIVE (owner, 16 Nov 2026: "make the taxonomy go live now").
-- Source: the owner-approved TAXONOMY_PH_FULL_2026-11-07.md (spec corpus), "the ONE spec for build T1".
-- Every step uses the operations Admin › Categories already performs (rename, hide, add, move a
-- category, move a service, and merge_canonical_service for each ⇢ fold). Nothing is deleted:
-- a category the tree no longer has is emptied and HIDDEN; a folded service stays as a tombstone
-- carrying merged_into, so an old key on a printed QR still resolves.
-- Data only. Idempotent: every write is guarded, so a re-run changes nothing.
BEGIN;

-- 0 · Inspiration parts: remember, BEFORE anything moves, which categories each part links WHOLE
--     (every live service of the category). Step 11c re-expands exactly those after the tree changes,
--     so a part that was "everyone in Stylist / Decorator" stays that — new services in, folded and
--     hidden ones out — and the shops that may add a photo stay the category expansion
--     (tests/db/part-eligibility-is-unchanged-by-the-move.db.test.ts). Hand-picked links are only
--     re-pointed (a fold) or dropped (a hidden service); nothing else about them changes.
CREATE TEMP TABLE t1_part_whole_categories AS
SELECT p.slot_key, pr.category_id
  FROM public.inspiration_parts p
  JOIN (SELECT category_id, array_agg(canonical_service) AS svcs
          FROM public.inspiration_category_service_pairs() GROUP BY category_id) pr ON TRUE
 WHERE p.kind = 'part'
   AND NOT EXISTS (SELECT 1 FROM unnest(pr.svcs) AS u(s)
                    WHERE NOT EXISTS (SELECT 1 FROM public.inspiration_part_services l
                                       WHERE l.slot_key = p.slot_key AND l.canonical_service = u.s));

-- 1 · Group names
UPDATE public.service_categories SET label_en = 'Venues & Simbahan', label_short = 'Venues', updated_at = now() WHERE id = 'venue' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Venues & Simbahan', 'Venues');
UPDATE public.service_categories SET label_en = 'Catering & Cakes', label_short = 'Catering', updated_at = now() WHERE id = 'feast' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Catering & Cakes', 'Catering');
UPDATE public.service_categories SET label_en = 'Coordinators', label_short = 'Coordinators', updated_at = now() WHERE id = 'planning' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Coordinators', 'Coordinators');
UPDATE public.service_categories SET label_en = 'Photo & Video', label_short = 'Photo & Video', updated_at = now() WHERE id = 'documentary' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Photo & Video', 'Photo & Video');
UPDATE public.service_categories SET label_en = 'Gowns, Barong & HMUA', label_short = 'Gowns & HMUA', updated_at = now() WHERE id = 'look' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Gowns, Barong & HMUA', 'Gowns & HMUA');
UPDATE public.service_categories SET label_en = 'Styling, Flowers & Lights', label_short = 'Styling', updated_at = now() WHERE id = 'design' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Styling, Flowers & Lights', 'Styling');
UPDATE public.service_categories SET label_en = 'Hosts, Music & Program', label_short = 'Hosts & music', updated_at = now() WHERE id = 'program' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Hosts, Music & Program', 'Hosts & music');
UPDATE public.service_categories SET label_en = 'Booths, Food Carts & Bars', label_short = 'Booths & carts', updated_at = now() WHERE id = 'booths' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Booths, Food Carts & Bars', 'Booths & carts');
UPDATE public.service_categories SET label_en = 'Invitations & Prints', label_short = 'Invitations', updated_at = now() WHERE id = 'prints' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Invitations & Prints', 'Invitations');
UPDATE public.service_categories SET label_en = 'Bridal Cars & Transport', label_short = 'Bridal cars', updated_at = now() WHERE id = 'transport' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Bridal Cars & Transport', 'Bridal cars');
UPDATE public.service_categories SET label_en = 'Funeral & Memorial', label_short = 'Funeral', updated_at = now() WHERE id = 'farewell' AND tier = 1 AND (label_en, label_short) IS DISTINCT FROM ('Funeral & Memorial', 'Funeral');

-- 2 · The new group (owner, 7 Nov: Gifts, Giveaways & Souvenirs is its own group), placed after Invitations & Prints
UPDATE public.service_categories SET sort_order = sort_order + 1, updated_at = now() WHERE tier = 1 AND sort_order >= 9 AND NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id = 'gifts_giveaways');
INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, status, service_nature, marketplace_hidden, icon_name)
VALUES ('gifts_giveaways', NULL, 1, 'branch', 'Gifts, Giveaways & Souvenirs', 'Gifts', 'gifts-giveaways', 9, 'global', 'active', 'service', FALSE, 'Gift')
ON CONFLICT (id) DO NOTHING;

-- 3 · New categories

-- 4 · A category moves group (what moveTileToFolder does: the category and its services' folder)
UPDATE public.service_categories SET parent_id = 'gifts_giveaways', updated_at = now() WHERE id = 'souvenir_giveaways' AND parent_id IS DISTINCT FROM 'gifts_giveaways';
UPDATE public.canonical_service_taxonomy SET folder_id = 'gifts_giveaways', updated_at = now() WHERE tile_id = 'souvenir_giveaways' AND folder_id IS DISTINCT FROM 'gifts_giveaways';

-- 5 · Category names
UPDATE public.service_categories SET label_en = 'Reception Venues', updated_at = now() WHERE id = 'reception' AND tier = 2 AND label_en IS DISTINCT FROM 'Reception Venues';
UPDATE public.service_categories SET label_en = 'Ceremony Venues', updated_at = now() WHERE id = 'ceremony_venue' AND tier = 2 AND label_en IS DISTINCT FROM 'Ceremony Venues';
UPDATE public.service_categories SET label_en = 'Hotels & Resorts', updated_at = now() WHERE id = 'accommodation' AND tier = 2 AND label_en IS DISTINCT FROM 'Hotels & Resorts';
UPDATE public.service_categories SET label_en = 'Cakes & Desserts', updated_at = now() WHERE id = 'cake' AND tier = 2 AND label_en IS DISTINCT FROM 'Cakes & Desserts';
UPDATE public.service_categories SET label_en = 'Live Stations', updated_at = now() WHERE id = 'stations' AND tier = 2 AND label_en IS DISTINCT FROM 'Live Stations';
UPDATE public.service_categories SET label_en = 'Crew Meals', updated_at = now() WHERE id = 'crew_meals' AND tier = 2 AND label_en IS DISTINCT FROM 'Crew Meals';
UPDATE public.service_categories SET label_en = 'Coordinators & Planners', updated_at = now() WHERE id = 'coordinator' AND tier = 2 AND label_en IS DISTINCT FROM 'Coordinators & Planners';
UPDATE public.service_categories SET label_en = 'Date & Feng Shui', updated_at = now() WHERE id = 'date_specialist' AND tier = 2 AND label_en IS DISTINCT FROM 'Date & Feng Shui';
UPDATE public.service_categories SET label_en = 'Documents', updated_at = now() WHERE id = 'wedding_paperwork' AND tier = 2 AND label_en IS DISTINCT FROM 'Documents';
UPDATE public.service_categories SET label_en = 'Travel & Honeymoon', updated_at = now() WHERE id = 'travel_honeymoon' AND tier = 2 AND label_en IS DISTINCT FROM 'Travel & Honeymoon';
UPDATE public.service_categories SET label_en = 'Photo & Video', updated_at = now() WHERE id = 'photo_video' AND tier = 2 AND label_en IS DISTINCT FROM 'Photo & Video';
UPDATE public.service_categories SET label_en = 'Gowns & Couturiers', updated_at = now() WHERE id = 'brides_attire' AND tier = 2 AND label_en IS DISTINCT FROM 'Gowns & Couturiers';
UPDATE public.service_categories SET label_en = 'Barong & Suits', updated_at = now() WHERE id = 'grooms_attire' AND tier = 2 AND label_en IS DISTINCT FROM 'Barong & Suits';
UPDATE public.service_categories SET label_en = 'Hair & Make-up (HMUA)', updated_at = now() WHERE id = 'hmua' AND tier = 2 AND label_en IS DISTINCT FROM 'Hair & Make-up (HMUA)';
UPDATE public.service_categories SET label_en = 'Jewellers & Accessories', updated_at = now() WHERE id = 'jewelleries_accessories' AND tier = 2 AND label_en IS DISTINCT FROM 'Jewellers & Accessories';
UPDATE public.service_categories SET label_en = 'Ceremony Essentials', updated_at = now() WHERE id = 'ceremony_essentials' AND tier = 2 AND label_en IS DISTINCT FROM 'Ceremony Essentials';
UPDATE public.service_categories SET label_en = 'Shoes', updated_at = now() WHERE id = 'shoes_footwear' AND tier = 2 AND label_en IS DISTINCT FROM 'Shoes';
UPDATE public.service_categories SET label_en = 'Bridal Spa', updated_at = now() WHERE id = 'wellness_fitness' AND tier = 2 AND label_en IS DISTINCT FROM 'Bridal Spa';
UPDATE public.service_categories SET label_en = 'Stylist / Decorator', updated_at = now() WHERE id = 'stylist_decorator' AND tier = 2 AND label_en IS DISTINCT FROM 'Stylist / Decorator';
UPDATE public.service_categories SET label_en = 'Florist', updated_at = now() WHERE id = 'florist' AND tier = 2 AND label_en IS DISTINCT FROM 'Florist';
UPDATE public.service_categories SET label_en = 'Lights & Sounds', updated_at = now() WHERE id = 'lights_sound' AND tier = 2 AND label_en IS DISTINCT FROM 'Lights & Sounds';
UPDATE public.service_categories SET label_en = 'LED Wall', updated_at = now() WHERE id = 'led_wall' AND tier = 2 AND label_en IS DISTINCT FROM 'LED Wall';
UPDATE public.service_categories SET label_en = 'Rentals & Special Effects', updated_at = now() WHERE id = 'chairs_tents' AND tier = 2 AND label_en IS DISTINCT FROM 'Rentals & Special Effects';
UPDATE public.service_categories SET label_en = 'Host', updated_at = now() WHERE id = 'host_mc' AND tier = 2 AND label_en IS DISTINCT FROM 'Host';
UPDATE public.service_categories SET label_en = 'Choir & Strings', updated_at = now() WHERE id = 'choir' AND tier = 2 AND label_en IS DISTINCT FROM 'Choir & Strings';
UPDATE public.service_categories SET label_en = 'DJ', updated_at = now() WHERE id = 'dj' AND tier = 2 AND label_en IS DISTINCT FROM 'DJ';
UPDATE public.service_categories SET label_en = 'Cultural Performers', updated_at = now() WHERE id = 'performers' AND tier = 2 AND label_en IS DISTINCT FROM 'Cultural Performers';
UPDATE public.service_categories SET label_en = 'Dance Instructors & Choreographers', updated_at = now() WHERE id = 'choreographer' AND tier = 2 AND label_en IS DISTINCT FROM 'Dance Instructors & Choreographers';
UPDATE public.service_categories SET label_en = 'Kids'' Party Entertainers', updated_at = now() WHERE id = 'kids_entertainer' AND tier = 2 AND label_en IS DISTINCT FROM 'Kids'' Party Entertainers';
UPDATE public.service_categories SET label_en = 'Photobooths', updated_at = now() WHERE id = 'photo_booth' AND tier = 2 AND label_en IS DISTINCT FROM 'Photobooths';
UPDATE public.service_categories SET label_en = 'Mobile Bar', updated_at = now() WHERE id = 'mobile_bar' AND tier = 2 AND label_en IS DISTINCT FROM 'Mobile Bar';
UPDATE public.service_categories SET label_en = 'Coffee Cart', updated_at = now() WHERE id = 'coffee_espresso' AND tier = 2 AND label_en IS DISTINCT FROM 'Coffee Cart';
UPDATE public.service_categories SET label_en = 'Food Carts', updated_at = now() WHERE id = 'food_cart' AND tier = 2 AND label_en IS DISTINCT FROM 'Food Carts';
UPDATE public.service_categories SET label_en = 'Make & Take', updated_at = now() WHERE id = 'engraving_embroidery' AND tier = 2 AND label_en IS DISTINCT FROM 'Make & Take';
UPDATE public.service_categories SET label_en = 'Live Art', updated_at = now() WHERE id = 'caricature_calligraphy_painting' AND tier = 2 AND label_en IS DISTINCT FROM 'Live Art';
UPDATE public.service_categories SET label_en = 'Games', updated_at = now() WHERE id = 'arcade_games' AND tier = 2 AND label_en IS DISTINCT FROM 'Games';
UPDATE public.service_categories SET label_en = 'Pampering', updated_at = now() WHERE id = 'massage_chair' AND tier = 2 AND label_en IS DISTINCT FROM 'Pampering';
UPDATE public.service_categories SET label_en = 'Invitations & Signage', updated_at = now() WHERE id = 'printing' AND tier = 2 AND label_en IS DISTINCT FROM 'Invitations & Signage';
UPDATE public.service_categories SET label_en = 'Trophies & Medals', updated_at = now() WHERE id = 'trophies_awards' AND tier = 2 AND label_en IS DISTINCT FROM 'Trophies & Medals';
UPDATE public.service_categories SET label_en = 'Gifts, Giveaways & Souvenirs', updated_at = now() WHERE id = 'souvenir_giveaways' AND tier = 2 AND label_en IS DISTINCT FROM 'Gifts, Giveaways & Souvenirs';
UPDATE public.service_categories SET label_en = 'Medic, Staff & Security', updated_at = now() WHERE id = 'event_medic' AND tier = 2 AND label_en IS DISTINCT FROM 'Medic, Staff & Security';
UPDATE public.service_categories SET label_en = 'Bridal Car', updated_at = now() WHERE id = 'bridal_car' AND tier = 2 AND label_en IS DISTINCT FROM 'Bridal Car';
UPDATE public.service_categories SET label_en = 'Van / Coaster Rental', updated_at = now() WHERE id = 'guest_shuttle' AND tier = 2 AND label_en IS DISTINCT FROM 'Van / Coaster Rental';
UPDATE public.service_categories SET label_en = 'Escort', updated_at = now() WHERE id = 'escort' AND tier = 2 AND label_en IS DISTINCT FROM 'Escort';

-- 6 · New services (two-table leaf write, as Admin › ＋ Add a service); folder = the category's group
INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase, is_ph, is_setnayan, is_rental, is_tradition, marketplace_hidden, secondary_tiles, sort_order)
SELECT v.k, c.parent_id, v.t, 'V1.2', TRUE, FALSE, FALSE, FALSE, FALSE, '{}'::text[], 100 + v.n
  FROM (VALUES
    ('other_place_of_worship', 'ceremony_venue', 0),
    ('christening_package', 'catering', 1),
    ('fastfood_party_package', 'catering', 2),
    ('packed_meals', 'catering', 3),
    ('wake_catering', 'catering', 4),
    ('dessert_table', 'cake', 5),
    ('psa_cenomar_runner', 'wedding_paperwork', 6),
    ('toga_class_photos', 'photo_video', 7),
    ('baptismal_gown_baby_barong', 'womens_attire', 8),
    ('toga_cap_rental', 'womens_attire', 9),
    ('costumes', 'womens_attire', 10),
    ('proposal_setup', 'stylist_decorator', 11),
    ('balloon_decor', 'stylist_decorator', 12),
    ('cold_sparks', 'chairs_tents', 13),
    ('lounge_set_rental', 'chairs_tents', 14),
    ('stage_truss', 'chairs_tents', 15),
    ('ribbon_cutting_set', 'chairs_tents', 16),
    ('kids_party_host', 'host_mc', 17),
    ('videoke_rental', 'dj', 18),
    ('fire_dancers', 'performers', 19),
    ('cotillion_18_roses', 'choreographer', 20),
    ('family_dance', 'choreographer', 21),
    ('clown', 'kids_entertainer', 22),
    ('magician', 'kids_entertainer', 23),
    ('mascot', 'kids_entertainer', 24),
    ('inflatables', 'kids_entertainer', 25),
    ('face_painting', 'kids_entertainer', 26),
    ('balloon_twisting', 'kids_entertainer', 27),
    ('bubble_show', 'kids_entertainer', 28),
    ('puppet_show', 'kids_entertainer', 29),
    ('booth_builder', 'speaker_talent', 30),
    ('team_building_facilitator', 'speaker_talent', 31),
    ('juice_bar', 'coffee_espresso', 32),
    ('taho_cart', 'food_cart', 33),
    ('kakanin_station', 'food_cart', 34),
    ('sari_sari_booth', 'food_cart', 35),
    ('franchise_food_carts', 'food_cart', 36),
    ('popcorn_cart', 'food_cart', 37),
    ('fishball_kwekkwek_cart', 'food_cart', 38),
    ('ice_scramble_cart', 'food_cart', 39),
    ('churros_cart', 'food_cart', 40),
    ('shawarma_cart', 'food_cart', 41),
    ('leather_imprinting', 'engraving_embroidery', 42),
    ('build_your_own_bracelet', 'engraving_embroidery', 43),
    ('brooch_pin_making', 'engraving_embroidery', 44),
    ('lego_brick_building', 'engraving_embroidery', 45),
    ('custom_toys', 'engraving_embroidery', 46),
    ('button_badges', 'engraving_embroidery', 47),
    ('tote_painting', 'engraving_embroidery', 48),
    ('terrarium_making', 'engraving_embroidery', 49),
    ('candle_making', 'engraving_embroidery', 50),
    ('tarpaulin_standee', 'printing', 51),
    ('memorial_prints', 'printing', 52),
    ('diploma_certificate_printing', 'printing', 53),
    ('tickets_registration', 'printing', 54),
    ('personalised_items', 'souvenir_giveaways', 55),
    ('food_gifts_hampers', 'souvenir_giveaways', 56),
    ('gift_apparel_shirts', 'souvenir_giveaways', 57),
    ('gift_shoes', 'souvenir_giveaways', 58),
    ('gift_home_appliances', 'souvenir_giveaways', 59),
    ('gift_gadgets', 'souvenir_giveaways', 60),
    ('gift_plants', 'souvenir_giveaways', 61),
    ('custom_tissue_napkins', 'souvenir_giveaways', 62),
    ('raffle_prizes', 'souvenir_giveaways', 63),
    ('loot_bags', 'souvenir_giveaways', 64),
    ('event_staff_ushers', 'event_medic', 65),
    ('security_guards', 'event_medic', 66)
  ) AS v(k, t, n)
  JOIN public.service_categories c ON c.id = v.t
ON CONFLICT (canonical_service) DO NOTHING;
INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en) VALUES
  ('other_place_of_worship', 'Other place of worship'),
  ('christening_package', 'Christening package'),
  ('fastfood_party_package', 'Fast-food party package'),
  ('packed_meals', 'Packed meals'),
  ('wake_catering', 'Wake catering'),
  ('dessert_table', 'Dessert table'),
  ('psa_cenomar_runner', 'PSA / CENOMAR document runner'),
  ('toga_class_photos', 'Toga & class photos'),
  ('baptismal_gown_baby_barong', 'Baptismal gown / baby barong'),
  ('toga_cap_rental', 'Toga & cap rental'),
  ('costumes', 'Costumes'),
  ('proposal_setup', 'Proposal setup'),
  ('balloon_decor', 'Balloon decor'),
  ('cold_sparks', 'Cold sparks'),
  ('lounge_set_rental', 'Lounge set rental'),
  ('stage_truss', 'Stage & truss'),
  ('ribbon_cutting_set', 'Ribbon-cutting set'),
  ('kids_party_host', 'Kids'' party host'),
  ('videoke_rental', 'Videoke rental'),
  ('fire_dancers', 'Fire dancers'),
  ('cotillion_18_roses', 'Cotillion & 18 roses'),
  ('family_dance', 'Father-daughter / family dance'),
  ('clown', 'Clown'),
  ('magician', 'Magician'),
  ('mascot', 'Mascot'),
  ('inflatables', 'Inflatables'),
  ('face_painting', 'Face painting'),
  ('balloon_twisting', 'Balloon twisting'),
  ('bubble_show', 'Bubble show'),
  ('puppet_show', 'Puppet show'),
  ('booth_builder', 'Booth builder (expos)'),
  ('team_building_facilitator', 'Team-building facilitator'),
  ('juice_bar', 'Juice bar'),
  ('taho_cart', 'Taho'),
  ('kakanin_station', 'Kakanin'),
  ('sari_sari_booth', 'Sari-sari store booth'),
  ('franchise_food_carts', 'Franchise food carts'),
  ('popcorn_cart', 'Popcorn'),
  ('fishball_kwekkwek_cart', 'Fishball / kwek-kwek'),
  ('ice_scramble_cart', 'Ice scramble'),
  ('churros_cart', 'Churros'),
  ('shawarma_cart', 'Shawarma'),
  ('leather_imprinting', 'Leather imprinting'),
  ('build_your_own_bracelet', 'Build-your-own bracelet'),
  ('brooch_pin_making', 'Brooch / pin making'),
  ('lego_brick_building', 'Lego-style brick building'),
  ('custom_toys', 'Custom toys'),
  ('button_badges', 'Button badges'),
  ('tote_painting', 'Tote painting'),
  ('terrarium_making', 'Terrarium'),
  ('candle_making', 'Candle making'),
  ('tarpaulin_standee', 'Tarpaulin & standee'),
  ('memorial_prints', 'Memorial prints / prayer cards'),
  ('diploma_certificate_printing', 'Diploma & certificate printing'),
  ('tickets_registration', 'Tickets & registration'),
  ('personalised_items', 'Personalised items'),
  ('food_gifts_hampers', 'Food gifts & hampers'),
  ('gift_apparel_shirts', 'Apparel & shirts'),
  ('gift_shoes', 'Shoes'),
  ('gift_home_appliances', 'Home & appliances'),
  ('gift_gadgets', 'Gadgets'),
  ('gift_plants', 'Plants'),
  ('custom_tissue_napkins', 'Custom tissue & napkins'),
  ('raffle_prizes', 'Raffle prizes'),
  ('loot_bags', 'Loot bags'),
  ('event_staff_ushers', 'Event staff & ushers'),
  ('security_guards', 'Security guards')
ON CONFLICT (canonical_service) DO NOTHING;

-- 7 · Services move category (tile) — folder follows the destination's group

-- 8 · ⇢ folds — merge_canonical_service moves every holder of the key in one transaction and
--     leaves the source as a hidden tombstone carrying merged_into. Skipped if already merged.
SELECT public.merge_canonical_service('born_again_church_venue', 'christian_church_venue', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'born_again_church_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('accommodation', 'hotel_stay', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'accommodation' AND merged_into IS NULL);
SELECT public.merge_canonical_service('gender_separated_reception_coordinator', 'mahr_coordination', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'gender_separated_reception_coordinator' AND merged_into IS NULL);
SELECT public.merge_canonical_service('engagement_photographer', 'pre_nup_photographer', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'engagement_photographer' AND merged_into IS NULL);
SELECT public.merge_canonical_service('highlight_reel_specialist', 'same_day_edit', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'highlight_reel_specialist' AND merged_into IS NULL);
SELECT public.merge_canonical_service('drone', 'drone_videographer', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'drone' AND merged_into IS NULL);
SELECT public.merge_canonical_service('inc_modest_bridal', 'muslim_modest_bridal', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'inc_modest_bridal' AND merged_into IS NULL);
SELECT public.merge_canonical_service('junior_groomsman', 'junior_bridesmaid_dress', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'junior_groomsman' AND merged_into IS NULL);
SELECT public.merge_canonical_service('bridal_hair_stylist', 'bridal_hmua', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'bridal_hair_stylist' AND merged_into IS NULL);
SELECT public.merge_canonical_service('maternity_bride_mua', 'bridal_hmua', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'maternity_bride_mua' AND merged_into IS NULL);
SELECT public.merge_canonical_service('mature_bride_mua', 'bridal_hmua', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'mature_bride_mua' AND merged_into IS NULL);
SELECT public.merge_canonical_service('bridal_jewellery_rental', 'bridal_jewellery', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'bridal_jewellery_rental' AND merged_into IS NULL);
SELECT public.merge_canonical_service('decorator_general', 'stylist_decorator', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'decorator_general' AND merged_into IS NULL);
SELECT public.merge_canonical_service('event_lights_rental', 'lights_sound', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'event_lights_rental' AND merged_into IS NULL);
SELECT public.merge_canonical_service('outdoor_lighting_specialist', 'lights_sound', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'outdoor_lighting_specialist' AND merged_into IS NULL);
SELECT public.merge_canonical_service('outdoor_sound_system', 'lights_sound', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'outdoor_sound_system' AND merged_into IS NULL);
SELECT public.merge_canonical_service('tent_rental', 'tent_canopy_rental', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'tent_rental' AND merged_into IS NULL);
SELECT public.merge_canonical_service('band_live_music', 'live_band', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'band_live_music' AND merged_into IS NULL);
SELECT public.merge_canonical_service('pre_cana_dance_trainer', 'first_dance_choreographer', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'pre_cana_dance_trainer' AND merged_into IS NULL);
SELECT public.merge_canonical_service('whiskey_cigar_bar', 'mobile_bar', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'whiskey_cigar_bar' AND merged_into IS NULL);
SELECT public.merge_canonical_service('mocktail_booth_mini', 'mocktail_bar', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'mocktail_booth_mini' AND merged_into IS NULL);
SELECT public.merge_canonical_service('mocktail_only_caterer', 'mocktail_bar', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'mocktail_only_caterer' AND merged_into IS NULL);
SELECT public.merge_canonical_service('massage_therapist', 'massage_chair_station', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'massage_therapist' AND merged_into IS NULL);
SELECT public.merge_canonical_service('foot_reflexology', 'massage_chair_station', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'foot_reflexology' AND merged_into IS NULL);
SELECT public.merge_canonical_service('aromatherapy_station', 'massage_chair_station', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'aromatherapy_station' AND merged_into IS NULL);
SELECT public.merge_canonical_service('mehndi_artist', 'henna_tattoo_booth', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'mehndi_artist' AND merged_into IS NULL);
SELECT public.merge_canonical_service('muslim_henna_artist', 'henna_tattoo_booth', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'muslim_henna_artist' AND merged_into IS NULL);
SELECT public.merge_canonical_service('wedding_cards_designer', 'invitation_print', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'wedding_cards_designer' AND merged_into IS NULL);
SELECT public.merge_canonical_service('save_the_date_digital', 'invitation_digital', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'save_the_date_digital' AND merged_into IS NULL);
SELECT public.merge_canonical_service('place_card', 'menu_card', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'place_card' AND merged_into IS NULL);
SELECT public.merge_canonical_service('van_rental', 'transportation_guest_shuttle', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'van_rental' AND merged_into IS NULL);
SELECT public.merge_canonical_service('private_car_charter', 'transportation_guest_shuttle', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'private_car_charter' AND merged_into IS NULL);
SELECT public.merge_canonical_service('orthodox_church_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'orthodox_church_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('buddhist_temple_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'buddhist_temple_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('hindu_temple_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'hindu_temple_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('gurdwara_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'gurdwara_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('synagogue_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'synagogue_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('lds_temple_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'lds_temple_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('kingdom_hall_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'kingdom_hall_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('sda_church_venue', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'sda_church_venue' AND merged_into IS NULL);
SELECT public.merge_canonical_service('cultural_ceremony_site', 'other_place_of_worship', NULL) WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = 'cultural_ceremony_site' AND merged_into IS NULL);

-- 8b · A fold keeps the reach of what it absorbed: `accommodation` served weddings and Hotel stay did not, so after
--      the fold no supplier could serve "Hotels & Resorts" at a wedding (tile-event-type-fillable.db.test.ts).
UPDATE public.canonical_service_taxonomy d
   SET applicable_event_types = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(d.applicable_event_types || s.applicable_event_types) AS u(x)),
       updated_at = now()
  FROM public.canonical_service_taxonomy s
 WHERE s.merged_into = d.canonical_service
   AND s.canonical_service IN ('born_again_church_venue', 'accommodation', 'gender_separated_reception_coordinator', 'engagement_photographer', 'highlight_reel_specialist', 'drone', 'inc_modest_bridal', 'junior_groomsman', 'bridal_hair_stylist', 'maternity_bride_mua', 'mature_bride_mua', 'bridal_jewellery_rental', 'decorator_general', 'event_lights_rental', 'outdoor_lighting_specialist', 'outdoor_sound_system', 'tent_rental', 'band_live_music', 'pre_cana_dance_trainer', 'whiskey_cigar_bar', 'mocktail_booth_mini', 'mocktail_only_caterer', 'massage_therapist', 'foot_reflexology', 'aromatherapy_station', 'mehndi_artist', 'muslim_henna_artist', 'wedding_cards_designer', 'save_the_date_digital', 'place_card', 'van_rental', 'private_car_charter', 'orthodox_church_venue', 'buddhist_temple_venue', 'hindu_temple_venue', 'gurdwara_venue', 'synagogue_venue', 'lds_temple_venue', 'kingdom_hall_venue', 'sda_church_venue', 'cultural_ceremony_site')
   AND d.applicable_event_types IS NOT NULL AND s.applicable_event_types IS NOT NULL
   AND NOT (d.applicable_event_types @> s.applicable_event_types);

-- 9 · Service names
UPDATE public.canonical_service_schemas SET display_name_en = 'Hotel ballroom', updated_at = now() WHERE canonical_service = 'hotel_ballroom' AND display_name_en IS DISTINCT FROM 'Hotel ballroom';
UPDATE public.canonical_service_schemas SET display_name_en = 'Events place', updated_at = now() WHERE canonical_service = 'events_place' AND display_name_en IS DISTINCT FROM 'Events place';
UPDATE public.canonical_service_schemas SET display_name_en = 'Function hall', updated_at = now() WHERE canonical_service = 'function_hall' AND display_name_en IS DISTINCT FROM 'Function hall';
UPDATE public.canonical_service_schemas SET display_name_en = 'Garden reception', updated_at = now() WHERE canonical_service = 'garden_reception_venue' AND display_name_en IS DISTINCT FROM 'Garden reception';
UPDATE public.canonical_service_schemas SET display_name_en = 'Resort / beach reception', updated_at = now() WHERE canonical_service = 'resort_reception_venue' AND display_name_en IS DISTINCT FROM 'Resort / beach reception';
UPDATE public.canonical_service_schemas SET display_name_en = 'Reception venue (other)', updated_at = now() WHERE canonical_service = 'reception_venue' AND display_name_en IS DISTINCT FROM 'Reception venue (other)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Catholic church', updated_at = now() WHERE canonical_service = 'catholic_church_venue' AND display_name_en IS DISTINCT FROM 'Catholic church';
UPDATE public.canonical_service_schemas SET display_name_en = 'INC kapilya', updated_at = now() WHERE canonical_service = 'inc_kapilya_venue' AND display_name_en IS DISTINCT FROM 'INC kapilya';
UPDATE public.canonical_service_schemas SET display_name_en = 'Christian / Born Again church', updated_at = now() WHERE canonical_service = 'christian_church_venue' AND display_name_en IS DISTINCT FROM 'Christian / Born Again church';
UPDATE public.canonical_service_schemas SET display_name_en = 'Aglipayan', updated_at = now() WHERE canonical_service = 'aglipayan_church_venue' AND display_name_en IS DISTINCT FROM 'Aglipayan';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mosque', updated_at = now() WHERE canonical_service = 'mosque_venue' AND display_name_en IS DISTINCT FROM 'Mosque';
UPDATE public.canonical_service_schemas SET display_name_en = 'Civil (judge / mayor)', updated_at = now() WHERE canonical_service = 'civil_ceremony_venue' AND display_name_en IS DISTINCT FROM 'Civil (judge / mayor)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Garden / Beach ceremony', updated_at = now() WHERE canonical_service = 'ceremony_venue_booking' AND display_name_en IS DISTINCT FROM 'Garden / Beach ceremony';
UPDATE public.canonical_service_schemas SET display_name_en = 'Hotel stay', updated_at = now() WHERE canonical_service = 'hotel_stay' AND display_name_en IS DISTINCT FROM 'Hotel stay';
UPDATE public.canonical_service_schemas SET display_name_en = 'Resort stay', updated_at = now() WHERE canonical_service = 'resort_stay' AND display_name_en IS DISTINCT FROM 'Resort stay';
UPDATE public.canonical_service_schemas SET display_name_en = 'Villa / vacation house', updated_at = now() WHERE canonical_service = 'vacation_rental' AND display_name_en IS DISTINCT FROM 'Villa / vacation house';
UPDATE public.canonical_service_schemas SET display_name_en = 'Guesthouse / homestay', updated_at = now() WHERE canonical_service = 'guesthouse_homestay' AND display_name_en IS DISTINCT FROM 'Guesthouse / homestay';
UPDATE public.canonical_service_schemas SET display_name_en = 'Catering', updated_at = now() WHERE canonical_service = 'catering' AND display_name_en IS DISTINCT FROM 'Catering';
UPDATE public.canonical_service_schemas SET display_name_en = 'Chinese lauriat', updated_at = now() WHERE canonical_service = 'chinese_lauriat_caterer' AND display_name_en IS DISTINCT FROM 'Chinese lauriat';
UPDATE public.canonical_service_schemas SET display_name_en = 'Halal catering', updated_at = now() WHERE canonical_service = 'halal_catering' AND display_name_en IS DISTINCT FROM 'Halal catering';
UPDATE public.canonical_service_schemas SET display_name_en = 'Lechon', updated_at = now() WHERE canonical_service = 'lechonero' AND display_name_en IS DISTINCT FROM 'Lechon';
UPDATE public.canonical_service_schemas SET display_name_en = 'Wedding cake', updated_at = now() WHERE canonical_service = 'wedding_cake' AND display_name_en IS DISTINCT FROM 'Wedding cake';
UPDATE public.canonical_service_schemas SET display_name_en = 'Live cooking station', updated_at = now() WHERE canonical_service = 'live_cooking_station' AND display_name_en IS DISTINCT FROM 'Live cooking station';
UPDATE public.canonical_service_schemas SET display_name_en = 'Crew meal packs', updated_at = now() WHERE canonical_service = 'crew_meal_supply' AND display_name_en IS DISTINCT FROM 'Crew meal packs';
UPDATE public.canonical_service_schemas SET display_name_en = 'Full coordination', updated_at = now() WHERE canonical_service = 'wedding_coordination' AND display_name_en IS DISTINCT FROM 'Full coordination';
UPDATE public.canonical_service_schemas SET display_name_en = 'Partial coordination', updated_at = now() WHERE canonical_service = 'wedding_planner_partial' AND display_name_en IS DISTINCT FROM 'Partial coordination';
UPDATE public.canonical_service_schemas SET display_name_en = 'On-the-day coordinator', updated_at = now() WHERE canonical_service = 'day_of_coordinator' AND display_name_en IS DISTINCT FROM 'On-the-day coordinator';
UPDATE public.canonical_service_schemas SET display_name_en = 'Destination wedding', updated_at = now() WHERE canonical_service = 'destination_wedding_specialist' AND display_name_en IS DISTINCT FROM 'Destination wedding';
UPDATE public.canonical_service_schemas SET display_name_en = 'Pamamanhikan', updated_at = now() WHERE canonical_service = 'pamamanhikan_coordinator' AND display_name_en IS DISTINCT FROM 'Pamamanhikan';
UPDATE public.canonical_service_schemas SET display_name_en = 'Despedida', updated_at = now() WHERE canonical_service = 'despedida_planner' AND display_name_en IS DISTINCT FROM 'Despedida';
UPDATE public.canonical_service_schemas SET display_name_en = 'Sponsor (ninong/ninang) coordinator', updated_at = now() WHERE canonical_service = 'sponsor_coordinator' AND display_name_en IS DISTINCT FROM 'Sponsor (ninong/ninang) coordinator';
UPDATE public.canonical_service_schemas SET display_name_en = 'INC wedding', updated_at = now() WHERE canonical_service = 'inc_wedding_coordinator' AND display_name_en IS DISTINCT FROM 'INC wedding';
UPDATE public.canonical_service_schemas SET display_name_en = 'Muslim wedding (mahr, separated reception)', updated_at = now() WHERE canonical_service = 'mahr_coordination' AND display_name_en IS DISTINCT FROM 'Muslim wedding (mahr, separated reception)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Religious venue coordinator', updated_at = now() WHERE canonical_service = 'religious_venue_coordinator' AND display_name_en IS DISTINCT FROM 'Religious venue coordinator';
UPDATE public.canonical_service_schemas SET display_name_en = 'Date / feng shui consultant', updated_at = now() WHERE canonical_service = 'date_fengshui_consultant' AND display_name_en IS DISTINCT FROM 'Date / feng shui consultant';
UPDATE public.canonical_service_schemas SET display_name_en = 'Marriage license help', updated_at = now() WHERE canonical_service = 'marriage_license_expediting' AND display_name_en IS DISTINCT FROM 'Marriage license help';
UPDATE public.canonical_service_schemas SET display_name_en = 'Apostille / DFA', updated_at = now() WHERE canonical_service = 'apostille_dfa_authentication' AND display_name_en IS DISTINCT FROM 'Apostille / DFA';
UPDATE public.canonical_service_schemas SET display_name_en = 'Honeymoon planner', updated_at = now() WHERE canonical_service = 'honeymoon_planner' AND display_name_en IS DISTINCT FROM 'Honeymoon planner';
UPDATE public.canonical_service_schemas SET display_name_en = 'Destination travel coordinator', updated_at = now() WHERE canonical_service = 'destination_wedding_travel_coordinator' AND display_name_en IS DISTINCT FROM 'Destination travel coordinator';
UPDATE public.canonical_service_schemas SET display_name_en = 'Prenup shoot', updated_at = now() WHERE canonical_service = 'pre_nup_photographer' AND display_name_en IS DISTINCT FROM 'Prenup shoot';
UPDATE public.canonical_service_schemas SET display_name_en = 'SDE', updated_at = now() WHERE canonical_service = 'same_day_edit' AND display_name_en IS DISTINCT FROM 'SDE';
UPDATE public.canonical_service_schemas SET display_name_en = 'Drone', updated_at = now() WHERE canonical_service = 'drone_videographer' AND display_name_en IS DISTINCT FROM 'Drone';
UPDATE public.canonical_service_schemas SET display_name_en = 'Family / Day-2', updated_at = now() WHERE canonical_service = 'family_day2_photographer' AND display_name_en IS DISTINCT FROM 'Family / Day-2';
UPDATE public.canonical_service_schemas SET display_name_en = 'Studio portraits', updated_at = now() WHERE canonical_service = 'studio_portrait_photographer' AND display_name_en IS DISTINCT FROM 'Studio portraits';
UPDATE public.canonical_service_schemas SET display_name_en = 'Prenup locations', updated_at = now() WHERE canonical_service = 'pre_nup_shoot_locations' AND display_name_en IS DISTINCT FROM 'Prenup locations';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal gown (made-to-measure)', updated_at = now() WHERE canonical_service = 'bridal_gown_custom' AND display_name_en IS DISTINCT FROM 'Bridal gown (made-to-measure)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal gown (rental)', updated_at = now() WHERE canonical_service = 'bridal_gown_rental' AND display_name_en IS DISTINCT FROM 'Bridal gown (rental)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Filipiniana: Terno', updated_at = now() WHERE canonical_service = 'filipiniana_terno' AND display_name_en IS DISTINCT FROM 'Filipiniana: Terno';
UPDATE public.canonical_service_schemas SET display_name_en = 'Filipiniana: Maria Clara', updated_at = now() WHERE canonical_service = 'filipiniana_maria_clara' AND display_name_en IS DISTINCT FROM 'Filipiniana: Maria Clara';
UPDATE public.canonical_service_schemas SET display_name_en = 'Filipiniana: Balintawak', updated_at = now() WHERE canonical_service = 'filipiniana_balintawak' AND display_name_en IS DISTINCT FROM 'Filipiniana: Balintawak';
UPDATE public.canonical_service_schemas SET display_name_en = 'Modest bridal (INC, Muslim)', updated_at = now() WHERE canonical_service = 'muslim_modest_bridal' AND display_name_en IS DISTINCT FROM 'Modest bridal (INC, Muslim)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Maranao', updated_at = now() WHERE canonical_service = 'maranao_wedding_attire' AND display_name_en IS DISTINCT FROM 'Maranao';
UPDATE public.canonical_service_schemas SET display_name_en = 'Tausug', updated_at = now() WHERE canonical_service = 'tausug_wedding_attire' AND display_name_en IS DISTINCT FROM 'Tausug';
UPDATE public.canonical_service_schemas SET display_name_en = 'Yakan', updated_at = now() WHERE canonical_service = 'yakan_wedding_attire' AND display_name_en IS DISTINCT FROM 'Yakan';
UPDATE public.canonical_service_schemas SET display_name_en = 'Qipao / Cheongsam', updated_at = now() WHERE canonical_service = 'qipao_cheongsam_attire' AND display_name_en IS DISTINCT FROM 'Qipao / Cheongsam';
UPDATE public.canonical_service_schemas SET display_name_en = 'Sari / Lehenga', updated_at = now() WHERE canonical_service = 'sari_lehenga_bridal' AND display_name_en IS DISTINCT FROM 'Sari / Lehenga';
UPDATE public.canonical_service_schemas SET display_name_en = 'Barong (custom)', updated_at = now() WHERE canonical_service = 'barong_tagalog_custom' AND display_name_en IS DISTINCT FROM 'Barong (custom)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Barong (rental)', updated_at = now() WHERE canonical_service = 'barong_tagalog_rental' AND display_name_en IS DISTINCT FROM 'Barong (rental)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Suit (custom)', updated_at = now() WHERE canonical_service = 'groom_suit_custom' AND display_name_en IS DISTINCT FROM 'Suit (custom)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Suit (rental)', updated_at = now() WHERE canonical_service = 'groom_suit_rental' AND display_name_en IS DISTINCT FROM 'Suit (rental)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Maranao', updated_at = now() WHERE canonical_service = 'maranao_groom_attire' AND display_name_en IS DISTINCT FROM 'Maranao';
UPDATE public.canonical_service_schemas SET display_name_en = 'Tausug', updated_at = now() WHERE canonical_service = 'tausug_groom_attire' AND display_name_en IS DISTINCT FROM 'Tausug';
UPDATE public.canonical_service_schemas SET display_name_en = 'Yakan', updated_at = now() WHERE canonical_service = 'yakan_groom_attire' AND display_name_en IS DISTINCT FROM 'Yakan';
UPDATE public.canonical_service_schemas SET display_name_en = 'Muslim groom', updated_at = now() WHERE canonical_service = 'muslim_groom_attire' AND display_name_en IS DISTINCT FROM 'Muslim groom';
UPDATE public.canonical_service_schemas SET display_name_en = 'Sherwani', updated_at = now() WHERE canonical_service = 'sherwani_groom' AND display_name_en IS DISTINCT FROM 'Sherwani';
UPDATE public.canonical_service_schemas SET display_name_en = 'Ninang Filipiniana', updated_at = now() WHERE canonical_service = 'ninang_attire' AND display_name_en IS DISTINCT FROM 'Ninang Filipiniana';
UPDATE public.canonical_service_schemas SET display_name_en = 'Ninong barong', updated_at = now() WHERE canonical_service = 'ninong_attire' AND display_name_en IS DISTINCT FROM 'Ninong barong';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridesmaid dress', updated_at = now() WHERE canonical_service = 'bridesmaid_dress' AND display_name_en IS DISTINCT FROM 'Bridesmaid dress';
UPDATE public.canonical_service_schemas SET display_name_en = 'Groomsman set', updated_at = now() WHERE canonical_service = 'groomsman_set' AND display_name_en IS DISTINCT FROM 'Groomsman set';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mother of the bride', updated_at = now() WHERE canonical_service = 'mother_of_bride_gown' AND display_name_en IS DISTINCT FROM 'Mother of the bride';
UPDATE public.canonical_service_schemas SET display_name_en = 'Flower girl', updated_at = now() WHERE canonical_service = 'flower_girl_dress' AND display_name_en IS DISTINCT FROM 'Flower girl';
UPDATE public.canonical_service_schemas SET display_name_en = 'Ring bearer', updated_at = now() WHERE canonical_service = 'ring_bearer_suit' AND display_name_en IS DISTINCT FROM 'Ring bearer';
UPDATE public.canonical_service_schemas SET display_name_en = 'Junior bridesmaid / groomsman', updated_at = now() WHERE canonical_service = 'junior_bridesmaid_dress' AND display_name_en IS DISTINCT FROM 'Junior bridesmaid / groomsman';
UPDATE public.canonical_service_schemas SET display_name_en = '18 roses attire', updated_at = now() WHERE canonical_service = 'eighteen_roses_attire' AND display_name_en IS DISTINCT FROM '18 roses attire';
UPDATE public.canonical_service_schemas SET display_name_en = 'Debut gown', updated_at = now() WHERE canonical_service = 'debutante_gown' AND display_name_en IS DISTINCT FROM 'Debut gown';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal HMUA', updated_at = now() WHERE canonical_service = 'bridal_hmua' AND display_name_en IS DISTINCT FROM 'Bridal HMUA';
UPDATE public.canonical_service_schemas SET display_name_en = 'Entourage & family HMUA', updated_at = now() WHERE canonical_service = 'family_mua' AND display_name_en IS DISTINCT FROM 'Entourage & family HMUA';
UPDATE public.canonical_service_schemas SET display_name_en = 'Touch-up artist', updated_at = now() WHERE canonical_service = 'touchup_mua' AND display_name_en IS DISTINCT FROM 'Touch-up artist';
UPDATE public.canonical_service_schemas SET display_name_en = 'Groom grooming', updated_at = now() WHERE canonical_service = 'groom_grooming' AND display_name_en IS DISTINCT FROM 'Groom grooming';
UPDATE public.canonical_service_schemas SET display_name_en = 'Wedding rings', updated_at = now() WHERE canonical_service = 'wedding_ring' AND display_name_en IS DISTINCT FROM 'Wedding rings';
UPDATE public.canonical_service_schemas SET display_name_en = 'Engagement ring', updated_at = now() WHERE canonical_service = 'engagement_ring' AND display_name_en IS DISTINCT FROM 'Engagement ring';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal jewellery (buy / rent)', updated_at = now() WHERE canonical_service = 'bridal_jewellery' AND display_name_en IS DISTINCT FROM 'Bridal jewellery (buy / rent)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Headpiece / tiara', updated_at = now() WHERE canonical_service = 'bridal_headpiece' AND display_name_en IS DISTINCT FROM 'Headpiece / tiara';
UPDATE public.canonical_service_schemas SET display_name_en = 'Veil', updated_at = now() WHERE canonical_service = 'wedding_veil' AND display_name_en IS DISTINCT FROM 'Veil';
UPDATE public.canonical_service_schemas SET display_name_en = 'Floral jewellery', updated_at = now() WHERE canonical_service = 'floral_jewellery' AND display_name_en IS DISTINCT FROM 'Floral jewellery';
UPDATE public.canonical_service_schemas SET display_name_en = 'Sponsor corsage', updated_at = now() WHERE canonical_service = 'sponsor_corsage' AND display_name_en IS DISTINCT FROM 'Sponsor corsage';
UPDATE public.canonical_service_schemas SET display_name_en = 'Flower girl tiara', updated_at = now() WHERE canonical_service = 'flower_girl_tiara' AND display_name_en IS DISTINCT FROM 'Flower girl tiara';
UPDATE public.canonical_service_schemas SET display_name_en = 'Complete set', updated_at = now() WHERE canonical_service = 'ceremony_essentials_set' AND display_name_en IS DISTINCT FROM 'Complete set';
UPDATE public.canonical_service_schemas SET display_name_en = 'Arrhae', updated_at = now() WHERE canonical_service = 'arrhae_arras' AND display_name_en IS DISTINCT FROM 'Arrhae';
UPDATE public.canonical_service_schemas SET display_name_en = 'Cord', updated_at = now() WHERE canonical_service = 'unity_cord' AND display_name_en IS DISTINCT FROM 'Cord';
UPDATE public.canonical_service_schemas SET display_name_en = 'Veil', updated_at = now() WHERE canonical_service = 'unity_veil' AND display_name_en IS DISTINCT FROM 'Veil';
UPDATE public.canonical_service_schemas SET display_name_en = 'Candles', updated_at = now() WHERE canonical_service = 'ceremony_candles' AND display_name_en IS DISTINCT FROM 'Candles';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bible', updated_at = now() WHERE canonical_service = 'wedding_bible' AND display_name_en IS DISTINCT FROM 'Bible';
UPDATE public.canonical_service_schemas SET display_name_en = 'Ring & coin pillows', updated_at = now() WHERE canonical_service = 'ring_coin_bearer_pillow' AND display_name_en IS DISTINCT FROM 'Ring & coin pillows';
UPDATE public.canonical_service_schemas SET display_name_en = 'Rosary', updated_at = now() WHERE canonical_service = 'wedding_rosary' AND display_name_en IS DISTINCT FROM 'Rosary';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal spa', updated_at = now() WHERE canonical_service = 'bridal_spa' AND display_name_en IS DISTINCT FROM 'Bridal spa';
UPDATE public.canonical_service_schemas SET display_name_en = 'Stylist / Decorator', updated_at = now() WHERE canonical_service = 'stylist_decorator' AND display_name_en IS DISTINCT FROM 'Stylist / Decorator';
UPDATE public.canonical_service_schemas SET display_name_en = 'Capiz / native', updated_at = now() WHERE canonical_service = 'capiz_native_decor' AND display_name_en IS DISTINCT FROM 'Capiz / native';
UPDATE public.canonical_service_schemas SET display_name_en = 'Hacienda / heritage', updated_at = now() WHERE canonical_service = 'hacienda_heritage_decor' AND display_name_en IS DISTINCT FROM 'Hacienda / heritage';
UPDATE public.canonical_service_schemas SET display_name_en = 'Maranao okir', updated_at = now() WHERE canonical_service = 'maranao_okir_decor' AND display_name_en IS DISTINCT FROM 'Maranao okir';
UPDATE public.canonical_service_schemas SET display_name_en = 'Chinese (double happiness)', updated_at = now() WHERE canonical_service = 'double_happiness_decor' AND display_name_en IS DISTINCT FROM 'Chinese (double happiness)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Tea set styling', updated_at = now() WHERE canonical_service = 'tea_set_styling' AND display_name_en IS DISTINCT FROM 'Tea set styling';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mandap', updated_at = now() WHERE canonical_service = 'mandap_decor' AND display_name_en IS DISTINCT FROM 'Mandap';
UPDATE public.canonical_service_schemas SET display_name_en = 'Florist', updated_at = now() WHERE canonical_service = 'florals' AND display_name_en IS DISTINCT FROM 'Florist';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal bouquet', updated_at = now() WHERE canonical_service = 'bridal_bouquet_specialty' AND display_name_en IS DISTINCT FROM 'Bridal bouquet';
UPDATE public.canonical_service_schemas SET display_name_en = 'Lights & Sounds', updated_at = now() WHERE canonical_service = 'lights_sound' AND display_name_en IS DISTINCT FROM 'Lights & Sounds';
UPDATE public.canonical_service_schemas SET display_name_en = 'LED video wall', updated_at = now() WHERE canonical_service = 'led_video_wall' AND display_name_en IS DISTINCT FROM 'LED video wall';
UPDATE public.canonical_service_schemas SET display_name_en = 'Tent & canopy', updated_at = now() WHERE canonical_service = 'tent_canopy_rental' AND display_name_en IS DISTINCT FROM 'Tent & canopy';
UPDATE public.canonical_service_schemas SET display_name_en = 'Chairs & tables', updated_at = now() WHERE canonical_service = 'chair_table_rental' AND display_name_en IS DISTINCT FROM 'Chairs & tables';
UPDATE public.canonical_service_schemas SET display_name_en = 'LED dance floor', updated_at = now() WHERE canonical_service = 'led_dance_floor' AND display_name_en IS DISTINCT FROM 'LED dance floor';
UPDATE public.canonical_service_schemas SET display_name_en = 'Fireworks', updated_at = now() WHERE canonical_service = 'fireworks_pyro' AND display_name_en IS DISTINCT FROM 'Fireworks';
UPDATE public.canonical_service_schemas SET display_name_en = 'Generator', updated_at = now() WHERE canonical_service = 'generator_rental' AND display_name_en IS DISTINCT FROM 'Generator';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mobile restroom', updated_at = now() WHERE canonical_service = 'mobile_restroom_rental' AND display_name_en IS DISTINCT FROM 'Mobile restroom';
UPDATE public.canonical_service_schemas SET display_name_en = 'Fans & misters', updated_at = now() WHERE canonical_service = 'cooling_fans_misters' AND display_name_en IS DISTINCT FROM 'Fans & misters';
UPDATE public.canonical_service_schemas SET display_name_en = 'Host (emcee)', updated_at = now() WHERE canonical_service = 'host_emcee' AND display_name_en IS DISTINCT FROM 'Host (emcee)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Tea ceremony master', updated_at = now() WHERE canonical_service = 'tea_ceremony_master' AND display_name_en IS DISTINCT FROM 'Tea ceremony master';
UPDATE public.canonical_service_schemas SET display_name_en = 'Live band', updated_at = now() WHERE canonical_service = 'live_band' AND display_name_en IS DISTINCT FROM 'Live band';
UPDATE public.canonical_service_schemas SET display_name_en = 'Wedding singer', updated_at = now() WHERE canonical_service = 'wedding_singer' AND display_name_en IS DISTINCT FROM 'Wedding singer';
UPDATE public.canonical_service_schemas SET display_name_en = 'Acoustic performer', updated_at = now() WHERE canonical_service = 'acoustic_performer' AND display_name_en IS DISTINCT FROM 'Acoustic performer';
UPDATE public.canonical_service_schemas SET display_name_en = 'Choir & string quartet', updated_at = now() WHERE canonical_service = 'choir_string_quartet' AND display_name_en IS DISTINCT FROM 'Choir & string quartet';
UPDATE public.canonical_service_schemas SET display_name_en = 'Orchestra', updated_at = now() WHERE canonical_service = 'orchestra' AND display_name_en IS DISTINCT FROM 'Orchestra';
UPDATE public.canonical_service_schemas SET display_name_en = 'DJ', updated_at = now() WHERE canonical_service = 'dj' AND display_name_en IS DISTINCT FROM 'DJ';
UPDATE public.canonical_service_schemas SET display_name_en = 'Rondalla', updated_at = now() WHERE canonical_service = 'rondalla_ensemble' AND display_name_en IS DISTINCT FROM 'Rondalla';
UPDATE public.canonical_service_schemas SET display_name_en = 'Kulintang', updated_at = now() WHERE canonical_service = 'kulintang_ensemble' AND display_name_en IS DISTINCT FROM 'Kulintang';
UPDATE public.canonical_service_schemas SET display_name_en = 'Folk dance', updated_at = now() WHERE canonical_service = 'folk_performer' AND display_name_en IS DISTINCT FROM 'Folk dance';
UPDATE public.canonical_service_schemas SET display_name_en = 'Lion dance', updated_at = now() WHERE canonical_service = 'lion_dance_troupe' AND display_name_en IS DISTINCT FROM 'Lion dance';
UPDATE public.canonical_service_schemas SET display_name_en = 'Wedding entertainment (general)', updated_at = now() WHERE canonical_service = 'wedding_entertainment' AND display_name_en IS DISTINCT FROM 'Wedding entertainment (general)';
UPDATE public.canonical_service_schemas SET display_name_en = 'First dance instructor', updated_at = now() WHERE canonical_service = 'first_dance_choreographer' AND display_name_en IS DISTINCT FROM 'First dance instructor';
UPDATE public.canonical_service_schemas SET display_name_en = 'Entourage dance choreographer', updated_at = now() WHERE canonical_service = 'entourage_choreographer' AND display_name_en IS DISTINCT FROM 'Entourage dance choreographer';
UPDATE public.canonical_service_schemas SET display_name_en = 'Kids entertainer', updated_at = now() WHERE canonical_service = 'kids_entertainer' AND display_name_en IS DISTINCT FROM 'Kids entertainer';
UPDATE public.canonical_service_schemas SET display_name_en = 'Speaker / talent', updated_at = now() WHERE canonical_service = 'speaker_talent' AND display_name_en IS DISTINCT FROM 'Speaker / talent';
UPDATE public.canonical_service_schemas SET display_name_en = 'AV production', updated_at = now() WHERE canonical_service = 'av_production' AND display_name_en IS DISTINCT FROM 'AV production';
UPDATE public.canonical_service_schemas SET display_name_en = 'Photobooth', updated_at = now() WHERE canonical_service = 'photo_booth' AND display_name_en IS DISTINCT FROM 'Photobooth';
UPDATE public.canonical_service_schemas SET display_name_en = '360 booth', updated_at = now() WHERE canonical_service = 'booth_360' AND display_name_en IS DISTINCT FROM '360 booth';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mirror photobooth', updated_at = now() WHERE canonical_service = 'selfie_magic_mirror' AND display_name_en IS DISTINCT FROM 'Mirror photobooth';
UPDATE public.canonical_service_schemas SET display_name_en = 'GIF booth', updated_at = now() WHERE canonical_service = 'gif_booth' AND display_name_en IS DISTINCT FROM 'GIF booth';
UPDATE public.canonical_service_schemas SET display_name_en = 'Polaroid', updated_at = now() WHERE canonical_service = 'polaroid_booth' AND display_name_en IS DISTINCT FROM 'Polaroid';
UPDATE public.canonical_service_schemas SET display_name_en = 'Photoman (roving, instant prints)', updated_at = now() WHERE canonical_service = 'photoman' AND display_name_en IS DISTINCT FROM 'Photoman (roving, instant prints)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mobile bar', updated_at = now() WHERE canonical_service = 'mobile_bar' AND display_name_en IS DISTINCT FROM 'Mobile bar';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mocktail bar', updated_at = now() WHERE canonical_service = 'mocktail_bar' AND display_name_en IS DISTINCT FROM 'Mocktail bar';
UPDATE public.canonical_service_schemas SET display_name_en = 'Coffee cart', updated_at = now() WHERE canonical_service = 'coffee_booth' AND display_name_en IS DISTINCT FROM 'Coffee cart';
UPDATE public.canonical_service_schemas SET display_name_en = 'Tea bar', updated_at = now() WHERE canonical_service = 'tea_bar' AND display_name_en IS DISTINCT FROM 'Tea bar';
UPDATE public.canonical_service_schemas SET display_name_en = 'Food cart', updated_at = now() WHERE canonical_service = 'food_cart_generic' AND display_name_en IS DISTINCT FROM 'Food cart';
UPDATE public.canonical_service_schemas SET display_name_en = 'Sorbetes', updated_at = now() WHERE canonical_service = 'sorbetes_cart' AND display_name_en IS DISTINCT FROM 'Sorbetes';
UPDATE public.canonical_service_schemas SET display_name_en = 'Halo-halo', updated_at = now() WHERE canonical_service = 'halo_halo_station' AND display_name_en IS DISTINCT FROM 'Halo-halo';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mini lechon', updated_at = now() WHERE canonical_service = 'mini_lechon_station' AND display_name_en IS DISTINCT FROM 'Mini lechon';
UPDATE public.canonical_service_schemas SET display_name_en = 'Crepes', updated_at = now() WHERE canonical_service = 'crepe_pancake_station' AND display_name_en IS DISTINCT FROM 'Crepes';
UPDATE public.canonical_service_schemas SET display_name_en = 'Cotton candy', updated_at = now() WHERE canonical_service = 'cotton_candy_cart' AND display_name_en IS DISTINCT FROM 'Cotton candy';
UPDATE public.canonical_service_schemas SET display_name_en = 'Ice cream', updated_at = now() WHERE canonical_service = 'ice_cream_cart' AND display_name_en IS DISTINCT FROM 'Ice cream';
UPDATE public.canonical_service_schemas SET display_name_en = 'Grazing table', updated_at = now() WHERE canonical_service = 'charcuterie_board' AND display_name_en IS DISTINCT FROM 'Grazing table';
UPDATE public.canonical_service_schemas SET display_name_en = 'Dessert station', updated_at = now() WHERE canonical_service = 'dessert_station' AND display_name_en IS DISTINCT FROM 'Dessert station';
UPDATE public.canonical_service_schemas SET display_name_en = 'Donut booth', updated_at = now() WHERE canonical_service = 'donut_wall_display' AND display_name_en IS DISTINCT FROM 'Donut booth';
UPDATE public.canonical_service_schemas SET display_name_en = 'Food truck', updated_at = now() WHERE canonical_service = 'food_truck' AND display_name_en IS DISTINCT FROM 'Food truck';
UPDATE public.canonical_service_schemas SET display_name_en = 'Laser engraving', updated_at = now() WHERE canonical_service = 'keychain_engraving' AND display_name_en IS DISTINCT FROM 'Laser engraving';
UPDATE public.canonical_service_schemas SET display_name_en = 'Live embroidery', updated_at = now() WHERE canonical_service = 'live_embroidery' AND display_name_en IS DISTINCT FROM 'Live embroidery';
UPDATE public.canonical_service_schemas SET display_name_en = 'Caricature', updated_at = now() WHERE canonical_service = 'caricature_artist' AND display_name_en IS DISTINCT FROM 'Caricature';
UPDATE public.canonical_service_schemas SET display_name_en = 'Live calligraphy', updated_at = now() WHERE canonical_service = 'live_calligraphy' AND display_name_en IS DISTINCT FROM 'Live calligraphy';
UPDATE public.canonical_service_schemas SET display_name_en = 'Live portrait painter', updated_at = now() WHERE canonical_service = 'wedding_portrait_painter' AND display_name_en IS DISTINCT FROM 'Live portrait painter';
UPDATE public.canonical_service_schemas SET display_name_en = 'Arcade / retro games', updated_at = now() WHERE canonical_service = 'arcade_retro_games' AND display_name_en IS DISTINCT FROM 'Arcade / retro games';
UPDATE public.canonical_service_schemas SET display_name_en = 'VR station', updated_at = now() WHERE canonical_service = 'vr_ar_station' AND display_name_en IS DISTINCT FROM 'VR station';
UPDATE public.canonical_service_schemas SET display_name_en = 'Massage station', updated_at = now() WHERE canonical_service = 'massage_chair_station' AND display_name_en IS DISTINCT FROM 'Massage station';
UPDATE public.canonical_service_schemas SET display_name_en = 'Mini nail bar', updated_at = now() WHERE canonical_service = 'mini_nail_bar' AND display_name_en IS DISTINCT FROM 'Mini nail bar';
UPDATE public.canonical_service_schemas SET display_name_en = 'Hair touch-up', updated_at = now() WHERE canonical_service = 'hair_touchup_station' AND display_name_en IS DISTINCT FROM 'Hair touch-up';
UPDATE public.canonical_service_schemas SET display_name_en = 'Perfume bar', updated_at = now() WHERE canonical_service = 'perfume_bar' AND display_name_en IS DISTINCT FROM 'Perfume bar';
UPDATE public.canonical_service_schemas SET display_name_en = 'Henna / Mehndi', updated_at = now() WHERE canonical_service = 'henna_tattoo_booth' AND display_name_en IS DISTINCT FROM 'Henna / Mehndi';
UPDATE public.canonical_service_schemas SET display_name_en = 'Printed invitation', updated_at = now() WHERE canonical_service = 'invitation_print' AND display_name_en IS DISTINCT FROM 'Printed invitation';
UPDATE public.canonical_service_schemas SET display_name_en = 'E-invite', updated_at = now() WHERE canonical_service = 'invitation_digital' AND display_name_en IS DISTINCT FROM 'E-invite';
UPDATE public.canonical_service_schemas SET display_name_en = 'Missalette / program', updated_at = now() WHERE canonical_service = 'ceremony_program' AND display_name_en IS DISTINCT FROM 'Missalette / program';
UPDATE public.canonical_service_schemas SET display_name_en = 'Signage & stationery', updated_at = now() WHERE canonical_service = 'stationery_signage' AND display_name_en IS DISTINCT FROM 'Signage & stationery';
UPDATE public.canonical_service_schemas SET display_name_en = 'Menu & place cards', updated_at = now() WHERE canonical_service = 'menu_card' AND display_name_en IS DISTINCT FROM 'Menu & place cards';
UPDATE public.canonical_service_schemas SET display_name_en = 'Trophies', updated_at = now() WHERE canonical_service = 'trophy_supplier' AND display_name_en IS DISTINCT FROM 'Trophies';
UPDATE public.canonical_service_schemas SET display_name_en = 'Medals & plaques', updated_at = now() WHERE canonical_service = 'medals_plaques' AND display_name_en IS DISTINCT FROM 'Medals & plaques';
UPDATE public.canonical_service_schemas SET display_name_en = 'Souvenirs', updated_at = now() WHERE canonical_service = 'souvenirs_giveaways' AND display_name_en IS DISTINCT FROM 'Souvenirs';
UPDATE public.canonical_service_schemas SET display_name_en = 'Pasalubong box', updated_at = now() WHERE canonical_service = 'pasalubong_box' AND display_name_en IS DISTINCT FROM 'Pasalubong box';
UPDATE public.canonical_service_schemas SET display_name_en = 'Angpao / betrothal', updated_at = now() WHERE canonical_service = 'angpao_betrothal_supplier' AND display_name_en IS DISTINCT FROM 'Angpao / betrothal';
UPDATE public.canonical_service_schemas SET display_name_en = 'Sponsor tokens', updated_at = now() WHERE canonical_service = 'sponsor_token' AND display_name_en IS DISTINCT FROM 'Sponsor tokens';
UPDATE public.canonical_service_schemas SET display_name_en = 'Inaanak tokens', updated_at = now() WHERE canonical_service = 'godchild_token' AND display_name_en IS DISTINCT FROM 'Inaanak tokens';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal car', updated_at = now() WHERE canonical_service = 'transportation_bridal_car' AND display_name_en IS DISTINCT FROM 'Bridal car';
UPDATE public.canonical_service_schemas SET display_name_en = 'Vintage car', updated_at = now() WHERE canonical_service = 'vintage_classic_vehicle' AND display_name_en IS DISTINCT FROM 'Vintage car';
UPDATE public.canonical_service_schemas SET display_name_en = 'Horse carriage (kalesa)', updated_at = now() WHERE canonical_service = 'horse_drawn_carriage' AND display_name_en IS DISTINCT FROM 'Horse carriage (kalesa)';
UPDATE public.canonical_service_schemas SET display_name_en = 'Bridal boat / yacht', updated_at = now() WHERE canonical_service = 'bridal_boat_yacht' AND display_name_en IS DISTINCT FROM 'Bridal boat / yacht';
UPDATE public.canonical_service_schemas SET display_name_en = 'Guest shuttle', updated_at = now() WHERE canonical_service = 'transportation_guest_shuttle' AND display_name_en IS DISTINCT FROM 'Guest shuttle';
UPDATE public.canonical_service_schemas SET display_name_en = 'Airport transfer', updated_at = now() WHERE canonical_service = 'airport_transfer' AND display_name_en IS DISTINCT FROM 'Airport transfer';
UPDATE public.canonical_service_schemas SET display_name_en = 'Boat / ferry charter', updated_at = now() WHERE canonical_service = 'boat_ferry_charter' AND display_name_en IS DISTINCT FROM 'Boat / ferry charter';
UPDATE public.canonical_service_schemas SET display_name_en = 'Motorcycle / scooter', updated_at = now() WHERE canonical_service = 'motorcycle_scooter_rental' AND display_name_en IS DISTINCT FROM 'Motorcycle / scooter';

-- 10 · ⛔ hidden services
UPDATE public.canonical_service_taxonomy SET marketplace_hidden = TRUE, updated_at = now() WHERE canonical_service IN ('boudoir_photographer', 'wedding_garter', 'bridal_dental', 'bridal_nutritionist', 'bridal_fitness', 'bridal_dermatology', 'chuppah_rental', 'bug_repellent_station', 'parasol_hat_rental', 'wedding_day_weather_forecaster', 'silhouette_artist', 'poetry_typewriter', 'visa_wedding_logistics', 'tarot_astrology', 'palmistry_reader') AND marketplace_hidden IS DISTINCT FROM TRUE;

-- 11 · Categories the approved tree no longer has — emptied above, now hidden (never deleted)
UPDATE public.service_categories SET marketplace_hidden = TRUE, updated_at = now() WHERE id IN ('tarot_astrology_palmistry') AND marketplace_hidden IS DISTINCT FROM TRUE;

-- 11b · The souvenir scanner reads one list: the services under the souvenirs category (lib/supplier-scan.ts
--       SOUVENIR_SERVICES mirrors it; lib/supplier-scan.test.ts holds the three together). Same body, new items.
CREATE OR REPLACE FUNCTION public.supplier_scan_is_souvenir(p_canonical_service TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_canonical_service IN (
    'souvenir_giveaways',
    'souvenirs_giveaways',
    'pasalubong_box',
    'sponsor_token',
    'godchild_token',
    'angpao_betrothal_supplier',
    'personalised_items',
    'food_gifts_hampers',
    'gift_apparel_shirts',
    'gift_shoes',
    'gift_home_appliances',
    'gift_gadgets',
    'gift_plants',
    'custom_tissue_napkins',
    'raffle_prizes',
    'loot_bags'
  );
$$;
REVOKE ALL ON FUNCTION public.supplier_scan_is_souvenir(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_is_souvenir(TEXT) TO authenticated;

-- 11b · The coordinator trade's SQL copy drops the folded key (its holders now carry mahr_coordination).
--      Mirror of COORDINATOR_TRADE_SERVICES (apps/web/lib/coordinator-trade.ts); a unit test holds them equal.
CREATE OR REPLACE FUNCTION public.services_make_a_coordinator(p_services text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT COALESCE(p_services, ARRAY[]::text[]) && ARRAY[
    'coordinator',
    'planner_coordinator',
    'wedding_coordination',
    'wedding_planner_partial',
    'day_of_coordinator',
    'destination_wedding_specialist',
    'pamamanhikan_coordinator',
    'despedida_planner',
    'sponsor_coordinator',
    'religious_venue_coordinator',
    'inc_wedding_coordinator',
    'mahr_coordination',
    'setnayan_concierge'
  ]::text[];
$$;
REVOKE ALL ON FUNCTION public.services_make_a_coordinator(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.services_make_a_coordinator(text[]) TO service_role;

-- 11c · Inspiration parts follow the tree (see step 0).
--   (a) a hand-picked link to a FOLDED service moves to the service it folded into — its shops moved there;
INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order)
SELECT DISTINCT ON (l.slot_key, t.merged_into) l.slot_key, t.merged_into, l.sort_order
  FROM public.inspiration_part_services l
  JOIN public.canonical_service_taxonomy t ON t.canonical_service = l.canonical_service AND t.merged_into IS NOT NULL
 WHERE NOT EXISTS (SELECT 1 FROM t1_part_whole_categories w
                    WHERE w.slot_key = l.slot_key AND (t.tile_id = w.category_id OR w.category_id = ANY (COALESCE(t.secondary_tiles, ARRAY[]::TEXT[]))))
ORDER BY l.slot_key, t.merged_into, l.sort_order
ON CONFLICT DO NOTHING;
--   (b) no part links a folded or hidden service (nobody can hold one any more);
DELETE FROM public.inspiration_part_services l
 USING public.canonical_service_taxonomy t
 WHERE t.canonical_service = l.canonical_service AND (t.merged_into IS NOT NULL OR COALESCE(t.marketplace_hidden, FALSE));
--   (c) a category a part linked whole is linked whole again — its new services join, after the part's last link.
INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order)
SELECT w.slot_key, pr.canonical_service,
       -- placed beside the category's own links (a covered category sits where its last service sits), so the
       -- part's also-categories keep their order; a category with no link left goes after the part's last link
       COALESCE(
         (SELECT max(x.sort_order) FROM public.inspiration_part_services x
            JOIN public.inspiration_category_service_pairs() p2 ON p2.canonical_service = x.canonical_service AND p2.category_id = w.category_id
           WHERE x.slot_key = w.slot_key),
         (SELECT COALESCE(max(x.sort_order), 0) FROM public.inspiration_part_services x WHERE x.slot_key = w.slot_key)
           + row_number() OVER (PARTITION BY w.slot_key ORDER BY pr.category_id, pr.canonical_service))
  FROM t1_part_whole_categories w
  JOIN public.inspiration_category_service_pairs() pr ON pr.category_id = w.category_id
 WHERE NOT EXISTS (SELECT 1 FROM public.inspiration_part_services l WHERE l.slot_key = w.slot_key AND l.canonical_service = pr.canonical_service)
ON CONFLICT DO NOTHING;
DROP TABLE t1_part_whole_categories;

-- 12 · Refuse to commit a tree that is not the approved one
DO $guard$
DECLARE v_n integer; v_bad text;
BEGIN
  SELECT count(*) INTO v_n FROM public.service_categories WHERE tier = 1 AND id = 'gifts_giveaways' AND status = 'active' AND marketplace_hidden IS FALSE;
  IF v_n <> 1 THEN RAISE EXCEPTION 'T1: the Gifts group is missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id = 'souvenir_giveaways' AND parent_id = 'gifts_giveaways') THEN
    RAISE EXCEPTION 'T1: Gifts, Giveaways & Souvenirs did not move to its group'; END IF;
  -- every new service is named and visible
  SELECT string_agg(v.k, ', ') INTO v_bad FROM (VALUES ('other_place_of_worship'), ('christening_package'), ('fastfood_party_package'), ('packed_meals'), ('wake_catering'), ('dessert_table'), ('psa_cenomar_runner'), ('toga_class_photos'), ('baptismal_gown_baby_barong'), ('toga_cap_rental'), ('costumes'), ('proposal_setup'), ('balloon_decor'), ('cold_sparks'), ('lounge_set_rental'), ('stage_truss'), ('ribbon_cutting_set'), ('kids_party_host'), ('videoke_rental'), ('fire_dancers'), ('cotillion_18_roses'), ('family_dance'), ('clown'), ('magician'), ('mascot'), ('inflatables'), ('face_painting'), ('balloon_twisting'), ('bubble_show'), ('puppet_show'), ('booth_builder'), ('team_building_facilitator'), ('juice_bar'), ('taho_cart'), ('kakanin_station'), ('sari_sari_booth'), ('franchise_food_carts'), ('popcorn_cart'), ('fishball_kwekkwek_cart'), ('ice_scramble_cart'), ('churros_cart'), ('shawarma_cart'), ('leather_imprinting'), ('build_your_own_bracelet'), ('brooch_pin_making'), ('lego_brick_building'), ('custom_toys'), ('button_badges'), ('tote_painting'), ('terrarium_making'), ('candle_making'), ('tarpaulin_standee'), ('memorial_prints'), ('diploma_certificate_printing'), ('tickets_registration'), ('personalised_items'), ('food_gifts_hampers'), ('gift_apparel_shirts'), ('gift_shoes'), ('gift_home_appliances'), ('gift_gadgets'), ('gift_plants'), ('custom_tissue_napkins'), ('raffle_prizes'), ('loot_bags'), ('event_staff_ushers'), ('security_guards')) v(k)
   WHERE NOT EXISTS (SELECT 1 FROM public.canonical_service_taxonomy t JOIN public.canonical_service_schemas s USING (canonical_service)
                      WHERE t.canonical_service = v.k AND t.marketplace_hidden IS FALSE AND t.merged_into IS NULL AND s.display_name_en IS NOT NULL);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1: new services not live: %', v_bad; END IF;
  -- every fold landed
  SELECT string_agg(v.s, ', ') INTO v_bad FROM (VALUES ('born_again_church_venue', 'christian_church_venue'), ('accommodation', 'hotel_stay'), ('gender_separated_reception_coordinator', 'mahr_coordination'), ('engagement_photographer', 'pre_nup_photographer'), ('highlight_reel_specialist', 'same_day_edit'), ('drone', 'drone_videographer'), ('inc_modest_bridal', 'muslim_modest_bridal'), ('junior_groomsman', 'junior_bridesmaid_dress'), ('bridal_hair_stylist', 'bridal_hmua'), ('maternity_bride_mua', 'bridal_hmua'), ('mature_bride_mua', 'bridal_hmua'), ('bridal_jewellery_rental', 'bridal_jewellery'), ('decorator_general', 'stylist_decorator'), ('event_lights_rental', 'lights_sound'), ('outdoor_lighting_specialist', 'lights_sound'), ('outdoor_sound_system', 'lights_sound'), ('tent_rental', 'tent_canopy_rental'), ('band_live_music', 'live_band'), ('pre_cana_dance_trainer', 'first_dance_choreographer'), ('whiskey_cigar_bar', 'mobile_bar'), ('mocktail_booth_mini', 'mocktail_bar'), ('mocktail_only_caterer', 'mocktail_bar'), ('massage_therapist', 'massage_chair_station'), ('foot_reflexology', 'massage_chair_station'), ('aromatherapy_station', 'massage_chair_station'), ('mehndi_artist', 'henna_tattoo_booth'), ('muslim_henna_artist', 'henna_tattoo_booth'), ('wedding_cards_designer', 'invitation_print'), ('save_the_date_digital', 'invitation_digital'), ('place_card', 'menu_card'), ('van_rental', 'transportation_guest_shuttle'), ('private_car_charter', 'transportation_guest_shuttle'), ('orthodox_church_venue', 'other_place_of_worship'), ('buddhist_temple_venue', 'other_place_of_worship'), ('hindu_temple_venue', 'other_place_of_worship'), ('gurdwara_venue', 'other_place_of_worship'), ('synagogue_venue', 'other_place_of_worship'), ('lds_temple_venue', 'other_place_of_worship'), ('kingdom_hall_venue', 'other_place_of_worship'), ('sda_church_venue', 'other_place_of_worship'), ('cultural_ceremony_site', 'other_place_of_worship')) v(s, d)
   WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy WHERE canonical_service = v.s AND merged_into IS DISTINCT FROM v.d);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1: folds not applied: %', v_bad; END IF;
  -- no hidden category still holds a visible service
  SELECT string_agg(DISTINCT t.tile_id, ', ') INTO v_bad FROM public.canonical_service_taxonomy t JOIN public.service_categories c ON c.id = t.tile_id
   WHERE c.id IN ('tarot_astrology_palmistry') AND t.marketplace_hidden IS FALSE AND t.merged_into IS NULL;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1: hidden categories still hold visible services: %', v_bad; END IF;
  -- every service's folder is its category's group
  SELECT string_agg(t.canonical_service, ', ') INTO v_bad FROM public.canonical_service_taxonomy t JOIN public.service_categories c ON c.id = t.tile_id
   WHERE t.folder_id IS DISTINCT FROM c.parent_id AND (t.canonical_service IN ('other_place_of_worship', 'christening_package', 'fastfood_party_package', 'packed_meals', 'wake_catering', 'dessert_table', 'psa_cenomar_runner', 'toga_class_photos', 'baptismal_gown_baby_barong', 'toga_cap_rental', 'costumes', 'proposal_setup', 'balloon_decor', 'cold_sparks', 'lounge_set_rental', 'stage_truss', 'ribbon_cutting_set', 'kids_party_host', 'videoke_rental', 'fire_dancers', 'cotillion_18_roses', 'family_dance', 'clown', 'magician', 'mascot', 'inflatables', 'face_painting', 'balloon_twisting', 'bubble_show', 'puppet_show', 'booth_builder', 'team_building_facilitator', 'juice_bar', 'taho_cart', 'kakanin_station', 'sari_sari_booth', 'franchise_food_carts', 'popcorn_cart', 'fishball_kwekkwek_cart', 'ice_scramble_cart', 'churros_cart', 'shawarma_cart', 'leather_imprinting', 'build_your_own_bracelet', 'brooch_pin_making', 'lego_brick_building', 'custom_toys', 'button_badges', 'tote_painting', 'terrarium_making', 'candle_making', 'tarpaulin_standee', 'memorial_prints', 'diploma_certificate_printing', 'tickets_registration', 'personalised_items', 'food_gifts_hampers', 'gift_apparel_shirts', 'gift_shoes', 'gift_home_appliances', 'gift_gadgets', 'gift_plants', 'custom_tissue_napkins', 'raffle_prizes', 'loot_bags', 'event_staff_ushers', 'security_guards') OR t.tile_id IN ('souvenir_giveaways'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1: services whose group disagrees with their category: %', v_bad; END IF;
END $guard$;

COMMIT;
