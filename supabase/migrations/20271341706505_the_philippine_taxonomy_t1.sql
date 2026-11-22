-- the_philippine_taxonomy_t1
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
-- ============================================================================
-- T1 · THE PHILIPPINE TAXONOMY — groups, categories and services in the words
-- Filipino couples and suppliers actually say.
-- ============================================================================
--
-- SPEC: TAXONOMY_PH_FULL_2026-11-07.md (owner-approved 7 Nov — "add all that we
-- can" · "yes we can add them"); DECISION_LOG 2026-11-07 "TAXONOMY NAMES USE
-- PHILIPPINE TERMS" and "ALL ✚ TAXONOMY AND EVENT ADDITIONS APPROVED". Where the
-- spec and TAXONOMY_FILIPINO_CLEANUP_DRAFT disagree, the spec wins (its own rule).
-- Ceremony essentials already shipped (20271321738256) and is not redone here.
--
-- ── WHAT EXISTED (RULE 0) ───────────────────────────────────────────────────
-- service_categories (16 groups · 81 categories incl. 5 hidden) +
-- canonical_service_taxonomy (300 services, 26 hidden, 0 merged) +
-- canonical_service_schemas.display_name_en — measured on the replay. The two
-- switches the spec asks for already exist: `merged_into` (20271176753752, via
-- merge_canonical_service) and `marketplace_hidden`. No new table, column,
-- function, view, policy or grant.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────
--   1  group names in Philippine terms (labels only — ids/slugs unchanged)
--   2  ✚ group 9b "Gifts, giveaways & souvenirs" (id `gifts_giveaways`); the souvenirs category moves in
--   3  category names in Philippine terms (labels only — ids/slugs unchanged)
--   4  ✚ 2 categories: Shoes (look, id `footwear`) · Staff, Security & Registration (logistics, id `event_staffing`)
--   5  ⛔ Tarot / palmistry category hidden
--   6  ✚ 73 services (2 of them hidden: house blessing, mass/novena — see below)
--   7  acoustic performer → Live Band & Singers; dessert station cross-listed on Cakes
--   8  ⛔ 15 services hidden
--   9  ⇢ 36 services folded via merge_canonical_service (tombstones, never deleted)
--  10  display names in Philippine terms
--  11  inspiration board parts keep covering their categories (links follow; no part is deleted)
--
-- ── WHAT THIS DOES NOT DO (deliberately — see the PR's owner questions) ─────
--   · It does NOT merge whole categories (e.g. Live band + Wedding singer, Mobile
--     bar + Mocktail, Women's + Men's entourage). Merging a category needs the
--     category-merge mechanism of the CLOSED #7348; T1 keeps every category id
--     live and names the siblings so they read as the spec's one shelf.
--   · Officiants stay admin-only (owner ruling 2026-08-27, "SHUT"). The spec's
--     "House blessing · Mass / novena — made visible for these" is filed there
--     HIDDEN until the owner confirms un-shutting that branch.
--   · Inspiration parts (✚ ~12) and the Tags (filter-facet renames, US trims)
--     are not in this migration.
--   · Event scope (EVENTS_PH_REFINED) is untouched: new services inherit their
--     category's scope unless the row narrows it (graduation / christening /
--     birthday / debut / grand-opening items under unscoped-guard tiles say so).
--     Under catering and photo & video a service may NOT carry its own list
--     (thin-event-types-are-scoped), so christening package, fast-food party,
--     wake catering and toga photos inherit for now — their event rules are T2.
--
-- ── REUSED FROM THE CLOSED v2 SEED (#7355, origin/claude/taxonomy-merge-2026-11-06) ──
-- Where T1 adds a thing v2 already named, it takes v2's KEY so the two never compete:
-- event_staffing ("Staff, Security & Registration") · ushers_event_staff · security_marshals ·
-- ticketing_registration · toga_rental · exhibit_booth_fabrication · videoke_rental ·
-- team_building_facilitator. v2's TREE (39 categories / 84 services, 216 trade merges) is NOT
-- applied: TAXONOMY_PH_FULL (7 Nov) keeps the live ~270 services and folds only 36.
--
-- RLS / GRANTS: unchanged — rows in tables that already have RLS (public read,
-- admin write). merge_canonical_service is SECURITY DEFINER, service_role only;
-- a migration runs as the owner.
-- ============================================================================

BEGIN;

-- 0 ── INSPIRATION PARTS FOLLOW THEIR CATEGORIES. A part whose links cover EVERY visible service of a
--      category (the ③a backfill rule, inspiration_category_service_pairs) must still cover it afterwards:
--      it gains the category's new services and loses the ones hidden or folded here (step 11). Taken
--      BEFORE any change. k = the part's place for that category, kept so no part's category order moves.
CREATE TEMP TABLE t1_part_covers ON COMMIT DROP AS
  WITH pairs AS (SELECT * FROM public.inspiration_category_service_pairs()),
       size  AS (SELECT category_id, count(*) AS n FROM pairs GROUP BY category_id)
  SELECT ps.slot_key, x.category_id, max(ps.sort_order) AS k
    FROM public.inspiration_part_services ps
    JOIN public.inspiration_parts p ON p.slot_key = ps.slot_key AND p.kind = 'part'
    JOIN pairs x ON x.canonical_service = ps.canonical_service
    JOIN size  z ON z.category_id = x.category_id
   GROUP BY ps.slot_key, x.category_id, z.n
  HAVING count(*) = z.n;

-- 1 ── GROUP NAMES in Philippine terms (label only; ids and slugs unchanged, so every ?folder= link resolves).
UPDATE public.service_categories SET label_en = 'Venues & simbahan', label_short = 'Venues', updated_at = now()
 WHERE id = 'venue' AND tier = 1 AND (label_en IS DISTINCT FROM 'Venues & simbahan' OR label_short IS DISTINCT FROM 'Venues');
UPDATE public.service_categories SET label_en = 'Coordinators', label_short = 'Coordinators', updated_at = now()
 WHERE id = 'planning' AND tier = 1 AND (label_en IS DISTINCT FROM 'Coordinators' OR label_short IS DISTINCT FROM 'Coordinators');
UPDATE public.service_categories SET label_en = 'Catering & cakes', label_short = 'Catering', updated_at = now()
 WHERE id = 'feast' AND tier = 1 AND (label_en IS DISTINCT FROM 'Catering & cakes' OR label_short IS DISTINCT FROM 'Catering');
UPDATE public.service_categories SET label_en = 'Gowns, barong & HMUA', label_short = 'Gowns & HMUA', updated_at = now()
 WHERE id = 'look' AND tier = 1 AND (label_en IS DISTINCT FROM 'Gowns, barong & HMUA' OR label_short IS DISTINCT FROM 'Gowns & HMUA');
UPDATE public.service_categories SET label_en = 'Booths, food carts & bars', label_short = 'Booths & carts', updated_at = now()
 WHERE id = 'booths' AND tier = 1 AND (label_en IS DISTINCT FROM 'Booths, food carts & bars' OR label_short IS DISTINCT FROM 'Booths & carts');
UPDATE public.service_categories SET label_en = 'Invitations & prints', label_short = 'Invites & prints', updated_at = now()
 WHERE id = 'prints' AND tier = 1 AND (label_en IS DISTINCT FROM 'Invitations & prints' OR label_short IS DISTINCT FROM 'Invites & prints');
UPDATE public.service_categories SET label_en = 'Bridal cars & transport', label_short = 'Cars', updated_at = now()
 WHERE id = 'transport' AND tier = 1 AND (label_en IS DISTINCT FROM 'Bridal cars & transport' OR label_short IS DISTINCT FROM 'Cars');

-- 2 ── THE NEW GROUP 9b · Gifts, giveaways & souvenirs (owner 7 Nov: "its own group").
--      It slots in after Invitations & prints; the groups after it move down one place.
UPDATE public.service_categories SET sort_order = 10, updated_at = now() WHERE id = 'transport' AND tier = 1 AND sort_order IS DISTINCT FROM 10;
UPDATE public.service_categories SET sort_order = 11, updated_at = now() WHERE id = 'experience' AND tier = 1 AND sort_order IS DISTINCT FROM 11;
UPDATE public.service_categories SET sort_order = 12, updated_at = now() WHERE id = 'dining' AND tier = 1 AND sort_order IS DISTINCT FROM 12;
UPDATE public.service_categories SET sort_order = 13, updated_at = now() WHERE id = 'logistics_safety' AND tier = 1 AND sort_order IS DISTINCT FROM 13;
UPDATE public.service_categories SET sort_order = 14, updated_at = now() WHERE id = 'insurance' AND tier = 1 AND sort_order IS DISTINCT FROM 14;
UPDATE public.service_categories SET sort_order = 15, updated_at = now() WHERE id = 'specialty' AND tier = 1 AND sort_order IS DISTINCT FROM 15;
UPDATE public.service_categories SET sort_order = 16, updated_at = now() WHERE id = 'farewell' AND tier = 1 AND sort_order IS DISTINCT FROM 16;
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, status, service_nature, marketplace_hidden, icon_name)
VALUES
  ('gifts_giveaways', NULL, 1, 'branch', 'Gifts, giveaways & souvenirs', 'Gifts', 'gifts', 9, 'global', 'active', 'service', FALSE, 'Gift')
ON CONFLICT (id) DO NOTHING;

--      The souvenirs category moves into it, with every service under it.
UPDATE public.service_categories SET parent_id = 'gifts_giveaways', updated_at = now() WHERE id = 'souvenir_giveaways' AND parent_id IS DISTINCT FROM 'gifts_giveaways';
UPDATE public.canonical_service_taxonomy SET folder_id = 'gifts_giveaways', updated_at = now() WHERE tile_id = 'souvenir_giveaways' AND folder_id IS DISTINCT FROM 'gifts_giveaways';

-- 3 ── CATEGORY NAMES in Philippine terms (label only; ids and slugs unchanged).
UPDATE public.service_categories SET label_en = 'Reception Venues', updated_at = now() WHERE id = 'reception' AND tier = 2 AND label_en IS DISTINCT FROM 'Reception Venues';
UPDATE public.service_categories SET label_en = 'Ceremony Venues', updated_at = now() WHERE id = 'ceremony_venue' AND tier = 2 AND label_en IS DISTINCT FROM 'Ceremony Venues';
UPDATE public.service_categories SET label_en = 'Hotels & Resorts', updated_at = now() WHERE id = 'accommodation' AND tier = 2 AND label_en IS DISTINCT FROM 'Hotels & Resorts';
UPDATE public.service_categories SET label_en = 'Coordinators & Planners', updated_at = now() WHERE id = 'coordinator' AND tier = 2 AND label_en IS DISTINCT FROM 'Coordinators & Planners';
UPDATE public.service_categories SET label_en = 'Date & Feng Shui', updated_at = now() WHERE id = 'date_specialist' AND tier = 2 AND label_en IS DISTINCT FROM 'Date & Feng Shui';
UPDATE public.service_categories SET label_en = 'Documents', updated_at = now() WHERE id = 'wedding_paperwork' AND tier = 2 AND label_en IS DISTINCT FROM 'Documents';
UPDATE public.service_categories SET label_en = 'Cakes & Desserts', updated_at = now() WHERE id = 'cake' AND tier = 2 AND label_en IS DISTINCT FROM 'Cakes & Desserts';
UPDATE public.service_categories SET label_en = 'Live Stations', updated_at = now() WHERE id = 'stations' AND tier = 2 AND label_en IS DISTINCT FROM 'Live Stations';
UPDATE public.service_categories SET label_en = 'Gowns & Couturiers', updated_at = now() WHERE id = 'brides_attire' AND tier = 2 AND label_en IS DISTINCT FROM 'Gowns & Couturiers';
UPDATE public.service_categories SET label_en = 'Barong & Suits', updated_at = now() WHERE id = 'grooms_attire' AND tier = 2 AND label_en IS DISTINCT FROM 'Barong & Suits';
UPDATE public.service_categories SET label_en = 'Entourage & Sponsors (Women)', updated_at = now() WHERE id = 'womens_attire' AND tier = 2 AND label_en IS DISTINCT FROM 'Entourage & Sponsors (Women)';
UPDATE public.service_categories SET label_en = 'Entourage & Sponsors (Men)', updated_at = now() WHERE id = 'mens_attire' AND tier = 2 AND label_en IS DISTINCT FROM 'Entourage & Sponsors (Men)';
UPDATE public.service_categories SET label_en = 'Hair & Make-up (HMUA)', updated_at = now() WHERE id = 'hmua' AND tier = 2 AND label_en IS DISTINCT FROM 'Hair & Make-up (HMUA)';
UPDATE public.service_categories SET label_en = 'Groom Grooming', updated_at = now() WHERE id = 'grooming' AND tier = 2 AND label_en IS DISTINCT FROM 'Groom Grooming';
UPDATE public.service_categories SET label_en = 'Bridal Spa', updated_at = now() WHERE id = 'wellness_fitness' AND tier = 2 AND label_en IS DISTINCT FROM 'Bridal Spa';
UPDATE public.service_categories SET label_en = 'Jewellers & Accessories', updated_at = now() WHERE id = 'jewelleries_accessories' AND tier = 2 AND label_en IS DISTINCT FROM 'Jewellers & Accessories';
UPDATE public.service_categories SET label_en = 'Lights & Sounds', updated_at = now() WHERE id = 'lights_sound' AND tier = 2 AND label_en IS DISTINCT FROM 'Lights & Sounds';
UPDATE public.service_categories SET label_en = 'Rentals & Special Effects', updated_at = now() WHERE id = 'outdoor' AND tier = 2 AND label_en IS DISTINCT FROM 'Rentals & Special Effects';
UPDATE public.service_categories SET label_en = 'LED Dance Floor', updated_at = now() WHERE id = 'dance_floor' AND tier = 2 AND label_en IS DISTINCT FROM 'LED Dance Floor';
UPDATE public.service_categories SET label_en = 'Fireworks & Cold Sparks', updated_at = now() WHERE id = 'fireworks' AND tier = 2 AND label_en IS DISTINCT FROM 'Fireworks & Cold Sparks';
UPDATE public.service_categories SET label_en = 'Host', updated_at = now() WHERE id = 'host_mc' AND tier = 2 AND label_en IS DISTINCT FROM 'Host';
UPDATE public.service_categories SET label_en = 'Live Band & Singers', updated_at = now() WHERE id = 'live_band' AND tier = 2 AND label_en IS DISTINCT FROM 'Live Band & Singers';
UPDATE public.service_categories SET label_en = 'Choir & Strings', updated_at = now() WHERE id = 'choir' AND tier = 2 AND label_en IS DISTINCT FROM 'Choir & Strings';
UPDATE public.service_categories SET label_en = 'Cultural Performers', updated_at = now() WHERE id = 'performers' AND tier = 2 AND label_en IS DISTINCT FROM 'Cultural Performers';
UPDATE public.service_categories SET label_en = 'Dance Instructors & Choreographers', updated_at = now() WHERE id = 'choreographer' AND tier = 2 AND label_en IS DISTINCT FROM 'Dance Instructors & Choreographers';
UPDATE public.service_categories SET label_en = 'Kids'' Party Entertainers', updated_at = now() WHERE id = 'kids_entertainer' AND tier = 2 AND label_en IS DISTINCT FROM 'Kids'' Party Entertainers';
UPDATE public.service_categories SET label_en = 'AV Production', updated_at = now() WHERE id = 'av_production' AND tier = 2 AND label_en IS DISTINCT FROM 'AV Production';
UPDATE public.service_categories SET label_en = 'Speakers & Talent', updated_at = now() WHERE id = 'speaker_talent' AND tier = 2 AND label_en IS DISTINCT FROM 'Speakers & Talent';
UPDATE public.service_categories SET label_en = 'Photobooths', updated_at = now() WHERE id = 'photo_booth' AND tier = 2 AND label_en IS DISTINCT FROM 'Photobooths';
UPDATE public.service_categories SET label_en = 'Mocktail Bar', updated_at = now() WHERE id = 'mocktail' AND tier = 2 AND label_en IS DISTINCT FROM 'Mocktail Bar';
UPDATE public.service_categories SET label_en = 'Coffee Cart', updated_at = now() WHERE id = 'coffee_espresso' AND tier = 2 AND label_en IS DISTINCT FROM 'Coffee Cart';
UPDATE public.service_categories SET label_en = 'Food Carts', updated_at = now() WHERE id = 'food_cart' AND tier = 2 AND label_en IS DISTINCT FROM 'Food Carts';
UPDATE public.service_categories SET label_en = 'Dessert Stations', updated_at = now() WHERE id = 'dessert' AND tier = 2 AND label_en IS DISTINCT FROM 'Dessert Stations';
UPDATE public.service_categories SET label_en = 'Pampering', updated_at = now() WHERE id = 'massage_chair' AND tier = 2 AND label_en IS DISTINCT FROM 'Pampering';
UPDATE public.service_categories SET label_en = 'Henna / Mehndi', updated_at = now() WHERE id = 'henna_tattoo' AND tier = 2 AND label_en IS DISTINCT FROM 'Henna / Mehndi';
UPDATE public.service_categories SET label_en = 'Live Art', updated_at = now() WHERE id = 'caricature_calligraphy_painting' AND tier = 2 AND label_en IS DISTINCT FROM 'Live Art';
UPDATE public.service_categories SET label_en = 'Games', updated_at = now() WHERE id = 'arcade_games' AND tier = 2 AND label_en IS DISTINCT FROM 'Games';
UPDATE public.service_categories SET label_en = 'Make & Take', updated_at = now() WHERE id = 'engraving_embroidery' AND tier = 2 AND label_en IS DISTINCT FROM 'Make & Take';
UPDATE public.service_categories SET label_en = 'Invitations & Signage', updated_at = now() WHERE id = 'printing' AND tier = 2 AND label_en IS DISTINCT FROM 'Invitations & Signage';
UPDATE public.service_categories SET label_en = 'Gifts, Giveaways & Souvenirs', updated_at = now() WHERE id = 'souvenir_giveaways' AND tier = 2 AND label_en IS DISTINCT FROM 'Gifts, Giveaways & Souvenirs';
UPDATE public.service_categories SET label_en = 'Trophies & Medals', updated_at = now() WHERE id = 'trophies_awards' AND tier = 2 AND label_en IS DISTINCT FROM 'Trophies & Medals';
UPDATE public.service_categories SET label_en = 'Van / Coaster Rental', updated_at = now() WHERE id = 'guest_shuttle' AND tier = 2 AND label_en IS DISTINCT FROM 'Van / Coaster Rental';

-- 4 ── TWO NEW CATEGORIES. Event scope is copied from the nearest live sibling, named per row,
--      so neither reaches an event its neighbour does not (the EVENTS_PH_REFINED rules are T2).
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, status, service_nature, marketplace_hidden,
   applicable_event_types, coarse_category, icon_name, hint_en)
SELECT 'footwear', 'look', 2, 'leaf', 'Shoes', NULL, 'shoes', 38, 'global', 'active', 'service', FALSE,
       src.applicable_event_types, 'gown_designer'::public.vendor_category, 'Footprints', 'Custom-made bridal and entourage shoes, shoe rental and shoe repair.'
  FROM public.service_categories src WHERE src.id = 'womens_attire'  -- scope from womens_attire
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, status, service_nature, marketplace_hidden,
   applicable_event_types, coarse_category, icon_name, hint_en)
SELECT 'event_staffing', 'logistics_safety', 2, 'leaf', 'Staff, Security & Registration', NULL, 'event-staffing', 64, 'global', 'active', 'service', FALSE,
       src.applicable_event_types, 'security'::public.vendor_category, 'ShieldCheck', 'Ushers, usherettes, event marshals and security guards for the day.'
  FROM public.service_categories src WHERE src.id = 'event_medic'  -- scope from event_medic
ON CONFLICT (id) DO NOTHING;

-- 5 ── ⛔ HIDDEN CATEGORY: Tarot / palmistry (row kept; both its services are hidden in step 8).
UPDATE public.service_categories SET marketplace_hidden = TRUE, updated_at = now() WHERE id = 'tarot_astrology_palmistry' AND marketplace_hidden IS DISTINCT FROM TRUE;

-- 6 ── ✚ NEW SERVICES. NULL applicable_event_types = inherit the category (so Admin edits reach them);
--      a row scoped narrower than its category says so.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental, dietary,
   is_tradition, marketplace_hidden, secondary_tiles, sort_order, applicable_event_types)
VALUES
  ('other_worship_venue', 'venue', 'ceremony_venue', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('blessing_rite_officiant', 'venue', 'officiants', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[], 0, NULL),
  ('mass_novena_scheduling', 'venue', 'officiants', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, TRUE, '{}'::TEXT[], 0, NULL),
  ('christening_package', 'feast', 'catering', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('fast_food_party_package', 'feast', 'catering', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('packed_meals', 'feast', 'catering', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('wake_catering', 'feast', 'catering', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('psa_cenomar_runner', 'planning', 'wedding_paperwork', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('toga_class_photos', 'documentary', 'photo_video', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('baptismal_attire', 'look', 'womens_attire', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, ARRAY['christening']::text[]),
  ('toga_rental', 'look', 'womens_attire', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, ARRAY['graduation']::text[]),
  ('costume_rental', 'look', 'womens_attire', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('custom_shoes', 'look', 'footwear', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('shoe_rental', 'look', 'footwear', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('shoe_repair', 'look', 'footwear', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('proposal_setup', 'design', 'stylist_decorator', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('balloon_decor', 'design', 'stylist_decorator', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('cold_sparks', 'design', 'fireworks', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('lounge_set_rental', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('stage_truss_rental', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('ribbon_cutting_set', 'design', 'outdoor', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, ARRAY['grand_opening', 'open_house', 'corporate']::text[]),
  ('kids_party_host', 'program', 'host_mc', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, ARRAY['birthday', 'christening']::text[]),
  ('videoke_rental', 'program', 'dj', 'V1.2', NULL, TRUE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('fire_dancers', 'program', 'performers', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('cotillion_18_roses', 'program', 'choreographer', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, ARRAY['debut']::text[]),
  ('family_dance_instructor', 'program', 'choreographer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('clown_entertainer', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('magician', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('mascot_appearance', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('inflatables_rental', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('face_painting', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('balloon_twisting', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('bubble_show', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('puppet_show', 'program', 'kids_entertainer', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('exhibit_booth_fabrication', 'program', 'av_production', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('team_building_facilitator', 'program', 'speaker_talent', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('juice_bar', 'booths', 'coffee_espresso', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('taho_cart', 'booths', 'food_cart', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, NULL),
  ('kakanin_station', 'booths', 'food_cart', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, NULL),
  ('sari_sari_store_booth', 'booths', 'food_cart', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, NULL),
  ('grazing_table', 'booths', 'food_cart', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('franchise_food_cart', 'booths', 'food_cart', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('popcorn_cart', 'booths', 'food_cart', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('fishball_kwekkwek_cart', 'booths', 'food_cart', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, NULL),
  ('ice_scramble_cart', 'booths', 'food_cart', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0, NULL),
  ('churros_cart', 'booths', 'food_cart', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('shawarma_cart', 'booths', 'food_cart', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('leather_imprinting', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('laser_engraving', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('bracelet_making', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('brooch_pin_making', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('brick_build_booth', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('custom_toys', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('button_badge_making', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('tote_bag_painting', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('terrarium_making', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('scented_candle_making', 'booths', 'engraving_embroidery', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('tarpaulin_standee', 'prints', 'printing', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('memorial_prayer_cards', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, ARRAY['wake']::text[]),
  ('diploma_certificate_printing', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, ARRAY['graduation']::text[]),
  ('ticketing_registration', 'prints', 'printing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('personalised_items', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('food_gifts_hampers', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('apparel_shirts', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('gift_shoes', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('home_appliance_gifts', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('gadget_gifts', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('plant_gifts', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('custom_tissue_napkins', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('raffle_prizes', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('loot_bags', 'gifts_giveaways', 'souvenir_giveaways', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('ushers_event_staff', 'logistics_safety', 'event_staffing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL),
  ('security_marshals', 'logistics_safety', 'event_staffing', 'V1.2', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0, NULL)
ON CONFLICT (canonical_service) DO NOTHING;

INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
VALUES
  ('other_worship_venue', 'Other place of worship'),
  ('blessing_rite_officiant', 'House blessing'),
  ('mass_novena_scheduling', 'Mass / novena scheduling'),
  ('christening_package', 'Christening package'),
  ('fast_food_party_package', 'Fast-food party package'),
  ('packed_meals', 'Packed meals'),
  ('wake_catering', 'Wake catering'),
  ('psa_cenomar_runner', 'PSA / CENOMAR document runner'),
  ('toga_class_photos', 'Toga & class photos'),
  ('baptismal_attire', 'Baptismal gown / baby barong'),
  ('toga_rental', 'Toga & cap rental'),
  ('costume_rental', 'Costumes'),
  ('custom_shoes', 'Custom-made shoes'),
  ('shoe_rental', 'Shoe rental'),
  ('shoe_repair', 'Shoe repair'),
  ('proposal_setup', 'Proposal setup'),
  ('balloon_decor', 'Balloon decor'),
  ('cold_sparks', 'Cold sparks'),
  ('lounge_set_rental', 'Lounge set rental'),
  ('stage_truss_rental', 'Stage & truss'),
  ('ribbon_cutting_set', 'Ribbon-cutting set'),
  ('kids_party_host', 'Kids'' party host'),
  ('videoke_rental', 'Videoke rental'),
  ('fire_dancers', 'Fire dancers'),
  ('cotillion_18_roses', 'Cotillion & 18 roses (debut)'),
  ('family_dance_instructor', 'Father-daughter / family dance'),
  ('clown_entertainer', 'Clown'),
  ('magician', 'Magician'),
  ('mascot_appearance', 'Mascot'),
  ('inflatables_rental', 'Inflatables'),
  ('face_painting', 'Face painting'),
  ('balloon_twisting', 'Balloon twisting'),
  ('bubble_show', 'Bubble show'),
  ('puppet_show', 'Puppet show'),
  ('exhibit_booth_fabrication', 'Booth builder (expos)'),
  ('team_building_facilitator', 'Team-building facilitator'),
  ('juice_bar', 'Juice bar'),
  ('taho_cart', 'Taho'),
  ('kakanin_station', 'Kakanin'),
  ('sari_sari_store_booth', 'Sari-sari store booth'),
  ('grazing_table', 'Grazing table'),
  ('franchise_food_cart', 'Franchise food carts (Potato Corner, Dunkin’, etc.)'),
  ('popcorn_cart', 'Popcorn'),
  ('fishball_kwekkwek_cart', 'Fishball / kwek-kwek'),
  ('ice_scramble_cart', 'Ice scramble'),
  ('churros_cart', 'Churros'),
  ('shawarma_cart', 'Shawarma'),
  ('leather_imprinting', 'Leather imprinting (wallets, card holders, keychains)'),
  ('laser_engraving', 'Laser engraving'),
  ('bracelet_making', 'Build-your-own bracelet'),
  ('brooch_pin_making', 'Brooch / pin making'),
  ('brick_build_booth', 'Lego-style brick building'),
  ('custom_toys', 'Custom toys (figurines, plush)'),
  ('button_badge_making', 'Button badges'),
  ('tote_bag_painting', 'Tote painting'),
  ('terrarium_making', 'Terrarium'),
  ('scented_candle_making', 'Candle making'),
  ('tarpaulin_standee', 'Tarpaulin & standee'),
  ('memorial_prayer_cards', 'Memorial prints / prayer cards'),
  ('diploma_certificate_printing', 'Diploma & certificate printing'),
  ('ticketing_registration', 'Tickets & registration'),
  ('personalised_items', 'Personalised items'),
  ('food_gifts_hampers', 'Food gifts & hampers'),
  ('apparel_shirts', 'Apparel & shirts'),
  ('gift_shoes', 'Shoes (as gifts)'),
  ('home_appliance_gifts', 'Home & appliances'),
  ('gadget_gifts', 'Gadgets'),
  ('plant_gifts', 'Plants'),
  ('custom_tissue_napkins', 'Custom tissue & napkins'),
  ('raffle_prizes', 'Raffle prizes'),
  ('loot_bags', 'Loot bags (kids)'),
  ('ushers_event_staff', 'Event staff & ushers'),
  ('security_marshals', 'Security guards')
ON CONFLICT (canonical_service) DO NOTHING;

-- 7 ── ONE MOVE AND ONE CROSS-LISTING the spec names.
UPDATE public.canonical_service_taxonomy SET tile_id = 'live_band', folder_id = 'program', updated_at = now()
 WHERE canonical_service = 'acoustic_performer' AND tile_id IS DISTINCT FROM 'live_band';
UPDATE public.canonical_service_taxonomy SET secondary_tiles = array_append(secondary_tiles, 'cake'), updated_at = now()
 WHERE canonical_service = 'dessert_station' AND NOT ('cake' = ANY (secondary_tiles));

-- 8 ── ⛔ HIDDEN SERVICES. marketplace_hidden only — the row stays, no forward, a shop holding the key keeps working.
UPDATE public.canonical_service_taxonomy SET marketplace_hidden = TRUE, updated_at = now()
 WHERE canonical_service IN ('boudoir_photographer', 'wedding_garter', 'chuppah_rental', 'bridal_dental', 'bridal_nutritionist', 'bridal_fitness', 'bridal_dermatology', 'bug_repellent_station', 'parasol_hat_rental', 'wedding_day_weather_forecaster', 'tarot_astrology', 'palmistry_reader', 'silhouette_artist', 'poetry_typewriter', 'visa_wedding_logistics')
   AND marketplace_hidden IS DISTINCT FROM TRUE;

-- 9 ── ⇢ FOLDS, through the house mechanism merge_canonical_service() (20271176753752): it moves every
--      stored holder of the key in one transaction and leaves the source row as a tombstone carrying
--      merged_into + marketplace_hidden. NOTHING IS DELETED from the taxonomy. A row already merged is
--      skipped, so a replay is a no-op.
--      inspiration_part_services is not one of the function's holders (it postdates it); step 11 settles it.
DO $fold$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('born_again_church_venue', 'christian_church_venue'),
    ('orthodox_church_venue', 'other_worship_venue'),
    ('buddhist_temple_venue', 'other_worship_venue'),
    ('hindu_temple_venue', 'other_worship_venue'),
    ('gurdwara_venue', 'other_worship_venue'),
    ('synagogue_venue', 'other_worship_venue'),
    ('lds_temple_venue', 'other_worship_venue'),
    ('kingdom_hall_venue', 'other_worship_venue'),
    ('sda_church_venue', 'other_worship_venue'),
    ('cultural_ceremony_site', 'other_worship_venue'),
    ('accommodation', 'hotel_stay'),
    ('engagement_photographer', 'pre_nup_photographer'),
    ('highlight_reel_specialist', 'same_day_edit'),
    ('drone_videographer', 'drone'),
    ('bridal_hair_stylist', 'bridal_hmua'),
    ('maternity_bride_mua', 'bridal_hmua'),
    ('mature_bride_mua', 'bridal_hmua'),
    ('decorator_general', 'stylist_decorator'),
    ('event_lights_rental', 'lights_sound'),
    ('outdoor_lighting_specialist', 'lights_sound'),
    ('outdoor_sound_system', 'lights_sound'),
    ('tent_rental', 'tent_canopy_rental'),
    ('band_live_music', 'live_band'),
    ('pre_cana_dance_trainer', 'first_dance_choreographer'),
    ('whiskey_cigar_bar', 'mobile_bar'),
    ('mocktail_booth_mini', 'mocktail_bar'),
    ('mocktail_only_caterer', 'mocktail_bar'),
    ('charcuterie_board', 'grazing_table'),
    ('keychain_engraving', 'laser_engraving'),
    ('aromatherapy_station', 'massage_chair_station'),
    ('mehndi_artist', 'henna_tattoo_booth'),
    ('muslim_henna_artist', 'henna_tattoo_booth'),
    ('wedding_cards_designer', 'invitation_print'),
    ('save_the_date_digital', 'invitation_digital'),
    ('van_rental', 'transportation_guest_shuttle'),
    ('private_car_charter', 'transportation_guest_shuttle')
  ) AS f(src, dst)
  LOOP
    IF EXISTS (SELECT 1 FROM public.canonical_service_taxonomy
                WHERE canonical_service = r.src AND merged_into IS NULL) THEN
      PERFORM public.merge_canonical_service(r.src, r.dst, NULL);
    END IF;
  END LOOP;
END;
$fold$;

-- 9b ── The folded `accommodation` was the ONLY stay that served a wedding (the guest-room block,
--        scope ['travel','wedding']). Its destination, hotel stay, takes the wedding with it, or the
--        Hotels & Resorts category would claim a wedding no service can fill (tile-event-type-fillable).
UPDATE public.canonical_service_taxonomy SET applicable_event_types = array_append(applicable_event_types, 'wedding'), updated_at = now()
  WHERE canonical_service = 'hotel_stay' AND applicable_event_types IS NOT NULL AND NOT ('wedding' = ANY (applicable_event_types));

-- 10 ── SERVICE NAMES in Philippine terms (canonical_service_schemas.display_name_en; EN only — TL/CEB untouched).
--       Three rows had no schema row at all (they rendered a title-cased key), so this is an upsert.
INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
VALUES
  ('events_place', 'Events place'),
  ('function_hall', 'Function hall'),
  ('garden_reception_venue', 'Garden reception'),
  ('hotel_ballroom', 'Hotel ballroom'),
  ('reception_venue', 'Reception venue (other)'),
  ('resort_reception_venue', 'Resort / beach reception'),
  ('catholic_church_venue', 'Catholic church'),
  ('inc_kapilya_venue', 'INC kapilya'),
  ('christian_church_venue', 'Christian / Born Again church'),
  ('aglipayan_church_venue', 'Aglipayan church'),
  ('mosque_venue', 'Mosque'),
  ('civil_ceremony_venue', 'Civil (judge / mayor)'),
  ('ceremony_venue_booking', 'Garden / beach ceremony'),
  ('hotel_stay', 'Hotel stay'),
  ('resort_stay', 'Resort stay'),
  ('vacation_rental', 'Villa / vacation house'),
  ('catering', 'Catering'),
  ('chinese_lauriat_caterer', 'Chinese lauriat'),
  ('halal_catering', 'Halal catering'),
  ('lechonero', 'Lechon'),
  ('wedding_cake', 'Wedding cake'),
  ('live_cooking_station', 'Live cooking station'),
  ('crew_meal_supply', 'Crew meal packs'),
  ('wedding_coordination', 'Full coordination'),
  ('wedding_planner_partial', 'Partial coordination'),
  ('day_of_coordinator', 'On-the-day coordinator'),
  ('destination_wedding_specialist', 'Destination wedding coordinator'),
  ('pamamanhikan_coordinator', 'Pamamanhikan coordinator'),
  ('despedida_planner', 'Despedida coordinator'),
  ('sponsor_coordinator', 'Sponsor (ninong/ninang) coordinator'),
  ('inc_wedding_coordinator', 'INC wedding coordinator'),
  ('gender_separated_reception_coordinator', 'Muslim wedding coordinator (separated reception)'),
  ('mahr_coordination', 'Muslim wedding — mahr coordination'),
  ('religious_venue_coordinator', 'Religious venue coordinator'),
  ('date_fengshui_consultant', 'Date / feng shui consultant'),
  ('marriage_license_expediting', 'Marriage license help'),
  ('apostille_dfa_authentication', 'Apostille / DFA'),
  ('honeymoon_planner', 'Honeymoon planner'),
  ('destination_wedding_travel_coordinator', 'Destination travel coordinator'),
  ('pre_nup_photographer', 'Prenup shoot'),
  ('same_day_edit', 'SDE (same-day edit)'),
  ('drone', 'Drone'),
  ('family_day2_photographer', 'Family / Day-2 photos'),
  ('studio_portrait_photographer', 'Studio portraits'),
  ('pre_nup_shoot_locations', 'Prenup locations'),
  ('bridal_gown_custom', 'Bridal gown (made-to-measure)'),
  ('bridal_gown_rental', 'Bridal gown (rental)'),
  ('filipiniana_terno', 'Filipiniana — Terno'),
  ('filipiniana_maria_clara', 'Filipiniana — Maria Clara'),
  ('filipiniana_balintawak', 'Filipiniana — Balintawak'),
  ('inc_modest_bridal', 'Modest bridal (INC)'),
  ('muslim_modest_bridal', 'Modest bridal (Muslim)'),
  ('maranao_wedding_attire', 'Maranao bridal'),
  ('tausug_wedding_attire', 'Tausug bridal'),
  ('yakan_wedding_attire', 'Yakan bridal'),
  ('qipao_cheongsam_attire', 'Qipao / Cheongsam'),
  ('sari_lehenga_bridal', 'Sari / Lehenga'),
  ('barong_tagalog_custom', 'Barong (custom)'),
  ('barong_tagalog_rental', 'Barong (rental)'),
  ('groom_suit_custom', 'Suit (custom)'),
  ('groom_suit_rental', 'Suit (rental)'),
  ('maranao_groom_attire', 'Maranao groom attire'),
  ('tausug_groom_attire', 'Tausug groom attire'),
  ('yakan_groom_attire', 'Yakan groom attire'),
  ('muslim_groom_attire', 'Muslim groom attire'),
  ('sherwani_groom', 'Sherwani'),
  ('ninang_attire', 'Ninang Filipiniana'),
  ('ninong_attire', 'Ninong barong'),
  ('bridesmaid_dress', 'Bridesmaid dress'),
  ('groomsman_set', 'Groomsman set'),
  ('mother_of_bride_gown', 'Mother of the bride'),
  ('flower_girl_dress', 'Flower girl'),
  ('ring_bearer_suit', 'Ring bearer'),
  ('junior_bridesmaid_dress', 'Junior bridesmaid'),
  ('junior_groomsman', 'Junior groomsman'),
  ('eighteen_roses_attire', '18 roses attire'),
  ('debutante_gown', 'Debut gown'),
  ('bridal_hmua', 'Bridal HMUA'),
  ('family_mua', 'Entourage & family HMUA'),
  ('touchup_mua', 'Touch-up artist'),
  ('groom_grooming', 'Groom grooming'),
  ('wedding_ring', 'Wedding rings'),
  ('engagement_ring', 'Engagement ring'),
  ('bridal_jewellery', 'Bridal jewellery (buy)'),
  ('bridal_jewellery_rental', 'Bridal jewellery (rent)'),
  ('bridal_headpiece', 'Headpiece / tiara'),
  ('wedding_veil', 'Veil'),
  ('floral_jewellery', 'Floral jewellery'),
  ('sponsor_corsage', 'Sponsor corsage'),
  ('flower_girl_tiara', 'Flower girl tiara'),
  ('bridal_spa', 'Bridal spa'),
  ('stylist_decorator', 'Stylist / Decorator'),
  ('capiz_native_decor', 'Capiz / native'),
  ('hacienda_heritage_decor', 'Hacienda / heritage'),
  ('maranao_okir_decor', 'Maranao okir'),
  ('double_happiness_decor', 'Chinese (double happiness)'),
  ('tea_set_styling', 'Tea set styling'),
  ('mandap_decor', 'Mandap'),
  ('florals', 'Florist'),
  ('bridal_bouquet_specialty', 'Bridal bouquet'),
  ('garden_wedding_florist', 'Garden wedding florist'),
  ('beach_wedding_florist', 'Beach wedding florist'),
  ('lights_sound', 'Lights & Sounds'),
  ('led_video_wall', 'LED video wall'),
  ('tent_canopy_rental', 'Tent & canopy'),
  ('chair_table_rental', 'Chairs & tables'),
  ('led_dance_floor', 'LED dance floor'),
  ('fireworks_pyro', 'Fireworks'),
  ('generator_rental', 'Generator'),
  ('mobile_restroom_rental', 'Mobile restroom'),
  ('cooling_fans_misters', 'Fans & misters'),
  ('host_emcee', 'Host (emcee)'),
  ('tea_ceremony_master', 'Tea ceremony master'),
  ('live_band', 'Live band'),
  ('wedding_singer', 'Wedding singer'),
  ('acoustic_performer', 'Acoustic performer'),
  ('choir_string_quartet', 'Choir & string quartet'),
  ('orchestra', 'Orchestra'),
  ('dj', 'DJ'),
  ('rondalla_ensemble', 'Rondalla'),
  ('kulintang_ensemble', 'Kulintang'),
  ('folk_performer', 'Folk dance'),
  ('lion_dance_troupe', 'Lion dance'),
  ('wedding_entertainment', 'Wedding entertainment (general)'),
  ('first_dance_choreographer', 'First dance instructor'),
  ('entourage_choreographer', 'Entourage dance choreographer'),
  ('kids_entertainer', 'Kids entertainer'),
  ('speaker_talent', 'Speaker / talent'),
  ('av_production', 'AV production'),
  ('photo_booth', 'Photobooth'),
  ('booth_360', '360 booth'),
  ('selfie_magic_mirror', 'Mirror photobooth'),
  ('gif_booth', 'GIF booth'),
  ('polaroid_booth', 'Polaroid'),
  ('photoman', 'Photoman (roving, instant prints)'),
  ('mobile_bar', 'Mobile bar'),
  ('mocktail_bar', 'Mocktail bar'),
  ('coffee_booth', 'Coffee cart'),
  ('tea_bar', 'Tea bar'),
  ('food_cart_generic', 'Food cart'),
  ('sorbetes_cart', 'Sorbetes'),
  ('halo_halo_station', 'Halo-halo'),
  ('mini_lechon_station', 'Mini lechon'),
  ('crepe_pancake_station', 'Crepes'),
  ('cotton_candy_cart', 'Cotton candy'),
  ('ice_cream_cart', 'Ice cream'),
  ('dessert_station', 'Dessert station'),
  ('donut_wall_display', 'Donut booth'),
  ('food_truck', 'Food truck'),
  ('live_embroidery', 'Live embroidery'),
  ('caricature_artist', 'Caricature'),
  ('live_calligraphy', 'Live calligraphy'),
  ('wedding_portrait_painter', 'Live portrait painter'),
  ('arcade_retro_games', 'Arcade / retro games'),
  ('vr_ar_station', 'VR station'),
  ('massage_chair_station', 'Massage station'),
  ('mini_nail_bar', 'Mini nail bar'),
  ('hair_touchup_station', 'Hair touch-up'),
  ('perfume_bar', 'Perfume bar'),
  ('henna_tattoo_booth', 'Henna / Mehndi'),
  ('invitation_print', 'Printed invitation'),
  ('invitation_digital', 'E-invite'),
  ('ceremony_program', 'Missalette / program'),
  ('stationery_signage', 'Signage & stationery'),
  ('menu_card', 'Menu cards'),
  ('place_card', 'Place cards'),
  ('trophy_supplier', 'Trophies'),
  ('medals_plaques', 'Medals & plaques'),
  ('souvenirs_giveaways', 'Souvenirs (small keepsakes)'),
  ('pasalubong_box', 'Pasalubong box'),
  ('angpao_betrothal_supplier', 'Angpao / betrothal'),
  ('sponsor_token', 'Ninong & Ninang gifts'),
  ('godchild_token', 'Inaanak gifts'),
  ('transportation_bridal_car', 'Bridal car'),
  ('vintage_classic_vehicle', 'Vintage car'),
  ('horse_drawn_carriage', 'Horse carriage (kalesa)'),
  ('bridal_boat_yacht', 'Bridal boat / yacht'),
  ('transportation_guest_shuttle', 'Van / coaster (guest shuttle)'),
  ('airport_transfer', 'Airport transfer'),
  ('boat_ferry_charter', 'Boat / ferry charter'),
  ('motorcycle_scooter_rental', 'Motorcycle / scooter'),
  ('motorcycle_escort', 'Motorcycle escort')
ON CONFLICT (canonical_service) DO UPDATE
   SET display_name_en = EXCLUDED.display_name_en, updated_at = now()
 WHERE public.canonical_service_schemas.display_name_en IS DISTINCT FROM EXCLUDED.display_name_en;

-- 11 ── INSPIRATION PARTS, settled (see step 0). A link to a service this migration hid or folded is
--       dropped — the LINK row, never the service; a folded key's shops now hold the destination, which
--       the covering part links. Then every category a part covered gets its current visible services.
--       Only the couple's board parts (MOODBOARD_SLOT_KEYS): the 272 starter looks (20271296836679) are a
--       seed of their own, held link-for-link by the-starter-inspiration-parts-seed-once, and keep theirs.
DELETE FROM public.inspiration_part_services
 WHERE slot_key = ANY (ARRAY['venue', 'reception_venue', 'backdrop', 'tunnel', 'stage', 'table', 'ceiling', 'flowers', 'cocktail', 'cake', 'bridal_bouquet', 'centrepieces', 'chairs', 'ribbons_candles', 'lights', 'entourage_bouquets', 'flower_accents', 'overall', 'palette', 'groom', 'bride', 'principal_sponsor', 'entourage', 'bridesmaids', 'groomsmen', 'flower_girl', 'ring_bearer', 'parents', 'guests']::text[])
   AND canonical_service IN ('boudoir_photographer', 'wedding_garter', 'chuppah_rental', 'bridal_dental', 'bridal_nutritionist', 'bridal_fitness', 'bridal_dermatology', 'bug_repellent_station', 'parasol_hat_rental', 'wedding_day_weather_forecaster', 'tarot_astrology', 'palmistry_reader', 'silhouette_artist', 'poetry_typewriter', 'visa_wedding_logistics', 'born_again_church_venue', 'orthodox_church_venue', 'buddhist_temple_venue', 'hindu_temple_venue', 'gurdwara_venue', 'synagogue_venue', 'lds_temple_venue', 'kingdom_hall_venue', 'sda_church_venue', 'cultural_ceremony_site', 'accommodation', 'engagement_photographer', 'highlight_reel_specialist', 'drone_videographer', 'bridal_hair_stylist', 'maternity_bride_mua', 'mature_bride_mua', 'decorator_general', 'event_lights_rental', 'outdoor_lighting_specialist', 'outdoor_sound_system', 'tent_rental', 'band_live_music', 'pre_cana_dance_trainer', 'whiskey_cigar_bar', 'mocktail_booth_mini', 'mocktail_only_caterer', 'charcuterie_board', 'keychain_engraving', 'aromatherapy_station', 'mehndi_artist', 'muslim_henna_artist', 'wedding_cards_designer', 'save_the_date_digital', 'van_rental', 'private_car_charter');
INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order)
SELECT c.slot_key, x.canonical_service, c.k
  FROM t1_part_covers c
  JOIN public.inspiration_category_service_pairs() x ON x.category_id = c.category_id
 WHERE c.slot_key = ANY (ARRAY['venue', 'reception_venue', 'backdrop', 'tunnel', 'stage', 'table', 'ceiling', 'flowers', 'cocktail', 'cake', 'bridal_bouquet', 'centrepieces', 'chairs', 'ribbons_candles', 'lights', 'entourage_bouquets', 'flower_accents', 'overall', 'palette', 'groom', 'bride', 'principal_sponsor', 'entourage', 'bridesmaids', 'groomsmen', 'flower_girl', 'ring_bearer', 'parents', 'guests']::text[])
ON CONFLICT (slot_key, canonical_service) DO NOTHING;
--       A service that changed category (acoustic performer, the hidden and folded ones) moves the
--       categories a part DERIVES, and the link-table trigger does not see a taxonomy edit — so every
--       part's stored copy is re-derived once (the ③a double write, inspiration_part_categories_resync).
DO $resync$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT slot_key FROM public.inspiration_parts LOOP
    PERFORM public.inspiration_part_categories_resync(r.slot_key);
  END LOOP;
END;
$resync$;

-- ── post-conditions ─────────────────────────────────────────────────────────
DO $guard$
DECLARE
  v_n INTEGER;
  v_bad TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id = 'gifts_giveaways' AND tier = 1 AND status = 'active' AND marketplace_hidden IS FALSE) THEN
    RAISE EXCEPTION 'refusing to apply: the Gifts group is not an active, visible tier-1 group';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id = 'souvenir_giveaways' AND parent_id = 'gifts_giveaways') THEN
    RAISE EXCEPTION 'refusing to apply: souvenirs did not move into the Gifts group';
  END IF;
  -- every service sits in the group its category sits in
  SELECT string_agg(c.canonical_service, ', ') INTO v_bad
    FROM public.canonical_service_taxonomy c JOIN public.service_categories t ON t.id = c.tile_id
   WHERE c.folder_id IS DISTINCT FROM t.parent_id;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: services filed under a group their category is not in — %', v_bad;
  END IF;
  -- every fold landed: a tombstone, hidden, pointing at a LIVE destination
  SELECT string_agg(f.src, ', ') INTO v_bad
    FROM (VALUES
      ('born_again_church_venue', 'christian_church_venue'),
      ('orthodox_church_venue', 'other_worship_venue'),
      ('buddhist_temple_venue', 'other_worship_venue'),
      ('hindu_temple_venue', 'other_worship_venue'),
      ('gurdwara_venue', 'other_worship_venue'),
      ('synagogue_venue', 'other_worship_venue'),
      ('lds_temple_venue', 'other_worship_venue'),
      ('kingdom_hall_venue', 'other_worship_venue'),
      ('sda_church_venue', 'other_worship_venue'),
      ('cultural_ceremony_site', 'other_worship_venue'),
      ('accommodation', 'hotel_stay'),
      ('engagement_photographer', 'pre_nup_photographer'),
      ('highlight_reel_specialist', 'same_day_edit'),
      ('drone_videographer', 'drone'),
      ('bridal_hair_stylist', 'bridal_hmua'),
      ('maternity_bride_mua', 'bridal_hmua'),
      ('mature_bride_mua', 'bridal_hmua'),
      ('decorator_general', 'stylist_decorator'),
      ('event_lights_rental', 'lights_sound'),
      ('outdoor_lighting_specialist', 'lights_sound'),
      ('outdoor_sound_system', 'lights_sound'),
      ('tent_rental', 'tent_canopy_rental'),
      ('band_live_music', 'live_band'),
      ('pre_cana_dance_trainer', 'first_dance_choreographer'),
      ('whiskey_cigar_bar', 'mobile_bar'),
      ('mocktail_booth_mini', 'mocktail_bar'),
      ('mocktail_only_caterer', 'mocktail_bar'),
      ('charcuterie_board', 'grazing_table'),
      ('keychain_engraving', 'laser_engraving'),
      ('aromatherapy_station', 'massage_chair_station'),
      ('mehndi_artist', 'henna_tattoo_booth'),
      ('muslim_henna_artist', 'henna_tattoo_booth'),
      ('wedding_cards_designer', 'invitation_print'),
      ('save_the_date_digital', 'invitation_digital'),
      ('van_rental', 'transportation_guest_shuttle'),
      ('private_car_charter', 'transportation_guest_shuttle')
    ) AS f(src, dst)
   WHERE NOT EXISTS (SELECT 1 FROM public.canonical_service_taxonomy s
                      JOIN public.canonical_service_taxonomy d ON d.canonical_service = s.merged_into
                     WHERE s.canonical_service = f.src AND s.merged_into = f.dst
                       AND s.marketplace_hidden IS TRUE AND d.merged_into IS NULL AND d.marketplace_hidden IS FALSE);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: fold(s) did not land — %', v_bad;
  END IF;
  -- every new service is named and filed
  SELECT count(*) INTO v_n FROM public.canonical_service_taxonomy c JOIN public.canonical_service_schemas s USING (canonical_service)
   WHERE c.canonical_service IN ('other_worship_venue', 'blessing_rite_officiant', 'mass_novena_scheduling', 'christening_package', 'fast_food_party_package', 'packed_meals', 'wake_catering', 'psa_cenomar_runner', 'toga_class_photos', 'baptismal_attire', 'toga_rental', 'costume_rental', 'custom_shoes', 'shoe_rental', 'shoe_repair', 'proposal_setup', 'balloon_decor', 'cold_sparks', 'lounge_set_rental', 'stage_truss_rental', 'ribbon_cutting_set', 'kids_party_host', 'videoke_rental', 'fire_dancers', 'cotillion_18_roses', 'family_dance_instructor', 'clown_entertainer', 'magician', 'mascot_appearance', 'inflatables_rental', 'face_painting', 'balloon_twisting', 'bubble_show', 'puppet_show', 'exhibit_booth_fabrication', 'team_building_facilitator', 'juice_bar', 'taho_cart', 'kakanin_station', 'sari_sari_store_booth', 'grazing_table', 'franchise_food_cart', 'popcorn_cart', 'fishball_kwekkwek_cart', 'ice_scramble_cart', 'churros_cart', 'shawarma_cart', 'leather_imprinting', 'laser_engraving', 'bracelet_making', 'brooch_pin_making', 'brick_build_booth', 'custom_toys', 'button_badge_making', 'tote_bag_painting', 'terrarium_making', 'scented_candle_making', 'tarpaulin_standee', 'memorial_prayer_cards', 'diploma_certificate_printing', 'ticketing_registration', 'personalised_items', 'food_gifts_hampers', 'apparel_shirts', 'gift_shoes', 'home_appliance_gifts', 'gadget_gifts', 'plant_gifts', 'custom_tissue_napkins', 'raffle_prizes', 'loot_bags', 'ushers_event_staff', 'security_marshals')
     AND c.tile_id IS NOT NULL;
  IF v_n <> 73 THEN
    RAISE EXCEPTION 'refusing to apply: expected 73 named, filed new services, found %', v_n;
  END IF;
  -- no VISIBLE category is left with no visible service (a dead shelf: search short-circuits, the picker prunes it)
  SELECT string_agg(t.id, ', ') INTO v_bad
    FROM public.service_categories t
   WHERE t.tier = 2 AND t.status = 'active' AND t.marketplace_hidden IS FALSE
     AND t.id NOT IN ('editorial', 'filipiniana_barongs')  -- cross-views, filled by secondary_tiles
     AND NOT EXISTS (SELECT 1 FROM public.canonical_service_taxonomy c
                      WHERE c.tile_id = t.id AND c.marketplace_hidden IS FALSE);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: visible categories with no visible service — %', v_bad;
  END IF;
  -- FILLABILITY (tests/db/tile-event-type-fillable): every event type a category claims has a service for it.
  SELECT string_agg(t.id || ':' || e.event_type, ', ') INTO v_bad
    FROM public.service_categories t
    CROSS JOIN LATERAL unnest(t.applicable_event_types) AS e(event_type)
   WHERE t.tier = 2 AND t.id IN ('footwear', 'event_staffing', 'ceremony_venue', 'officiants', 'catering', 'wedding_paperwork', 'photo_video', 'womens_attire', 'footwear', 'stylist_decorator', 'fireworks', 'outdoor', 'host_mc', 'dj', 'performers', 'choreographer', 'kids_entertainer', 'av_production', 'speaker_talent', 'coffee_espresso', 'food_cart', 'engraving_embroidery', 'printing', 'souvenir_giveaways', 'event_staffing')
     AND t.marketplace_hidden IS FALSE
     AND NOT EXISTS (
       SELECT 1 FROM public.canonical_service_taxonomy c
        WHERE c.tile_id = t.id AND c.marketplace_hidden IS FALSE
          AND (COALESCE(NULLIF(c.applicable_event_types, '{}'), t.applicable_event_types) IS NULL
               OR e.event_type = ANY (COALESCE(NULLIF(c.applicable_event_types, '{}'), t.applicable_event_types))));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: category event type(s) no service can fill — %', v_bad;
  END IF;
END;
$guard$;

COMMIT;
