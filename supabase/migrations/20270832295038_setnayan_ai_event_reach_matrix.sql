-- setnayan ai event reach matrix (category isolation)
-- ============================================================================
-- Writes the TRUE per-event-type category reach into service_categories,
-- replacing the "56/73 leaves = NULL (universal)" flood that made every event
-- type cover 89-100% of the wedding set. Owner-designed 2026-07-22 (study:
-- Setnayan_AI_Event_Reach_Matrix_Study_2026-07-22.md; DECISION_LOG 2026-07-22).
--
-- WHY THIS ENFORCES ISOLATION
--   Vendor-coverages resolves a category's event types as: the canonical's own
--   override, ELSE its tile's applicable_event_types (lib/vendor-coverages.ts).
--   The 72 rows below are the coarse service_categories TILES, so every fine
--   canonical under them inherits the scope — no need to touch all 270+
--   canonicals. Result (reach as % of Wedding): Wedding 100 · Debut 83 ·
--   Corporate 76 · Anniversary 68 · Birthday/Celebration 67 · Graduation 65 ·
--   Reunion 63 · Christening 62 · Gender-reveal 44 · Tournament 25 · Travel 16 ·
--   Dinner-Date 8. Guarantees (machine-checked): a wedding can't be completed
--   elsewhere (6 wedding-only leaves + 4 rite leaves shared only with
--   christening); a debut can't be done as a birthday (12 exclusive leaves).
--
-- OWNER EDITS folded in: booths reach christening + gender-reveal; christening
-- carries no band-heavy program; dinner date += cake; livestream removed from
-- the marketplace (it's the in-app Live Studio — "we won't sell services
-- similar to our in-app services"); accommodation scoped to Travel + Wedding.
--
-- Idempotent: UPDATE-by-id + a marketplace_hidden flip + one canonical override.
-- ============================================================================

-- ---- 1. per-tile reach (72 leaves, grouped by identical event-type set) -----
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','travel','tournament','anniversary','graduation','reunion','gender_reveal']::text[], updated_at=now()
  WHERE id IN ('digital_services','photo_video');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','tournament','anniversary','graduation','reunion','gender_reveal','dinner_date']::text[], updated_at=now()
  WHERE id IN ('souvenir_giveaways');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','tournament','anniversary','graduation','reunion','gender_reveal']::text[], updated_at=now()
  WHERE id IN ('reception','host_mc','catering');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','anniversary','graduation','reunion','gender_reveal','dinner_date']::text[], updated_at=now()
  WHERE id IN ('cake','florist');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','anniversary','graduation','reunion','gender_reveal']::text[], updated_at=now()
  WHERE id IN ('stylist_decorator','printing','mobile_bar','coffee_espresso','mocktail','food_truck','dessert','massage_chair','food_cart','photo_booth','perfume_bar','arcade_games','henna_tattoo','mini_nail_bar','tarot_astrology_palmistry','caricature_calligraphy_painting','engraving_embroidery');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','birthday','celebration','tournament','anniversary','graduation','reunion','gender_reveal']::text[], updated_at=now()
  WHERE id IN ('lights_sound');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','tournament','anniversary','graduation','reunion']::text[], updated_at=now()
  WHERE id IN ('guest_shuttle','coordinator');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','christening','birthday','celebration','anniversary','graduation','reunion']::text[], updated_at=now()
  WHERE id IN ('grooming','stations');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','christening','birthday','celebration','anniversary','graduation','reunion']::text[], updated_at=now()
  WHERE id IN ('womens_attire','mens_attire','hmua');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','birthday','celebration','anniversary','graduation','reunion']::text[], updated_at=now()
  WHERE id IN ('live_band','dj','performers','outdoor');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','christening','celebration','anniversary','graduation','reunion']::text[], updated_at=now()
  WHERE id IN ('filipiniana_barongs');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','birthday','celebration','anniversary','reunion']::text[], updated_at=now()
  WHERE id IN ('dance_floor');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','birthday','celebration','travel','tournament']::text[], updated_at=now()
  WHERE id IN ('event_insurance');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','anniversary','graduation']::text[], updated_at=now()
  WHERE id IN ('jewelleries_accessories');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate','tournament']::text[], updated_at=now()
  WHERE id IN ('crew_meals');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','celebration','anniversary']::text[], updated_at=now()
  WHERE id IN ('fireworks');
UPDATE public.service_categories SET applicable_event_types = ARRAY['corporate','birthday','travel','tournament']::text[], updated_at=now()
  WHERE id IN ('personal_accident_insurance');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','anniversary']::text[], updated_at=now()
  WHERE id IN ('wellness_fitness');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut','corporate']::text[], updated_at=now()
  WHERE id IN ('orchestra','av_production','led_wall','editorial','escort','date_specialist');
UPDATE public.service_categories SET applicable_event_types = ARRAY['corporate','tournament','graduation']::text[], updated_at=now()
  WHERE id IN ('trophies_awards');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','corporate','tournament']::text[], updated_at=now()
  WHERE id IN ('event_medic');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','christening']::text[], updated_at=now()
  WHERE id IN ('ceremony_venue','officiants','counseling_seminars','choir');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding','debut']::text[], updated_at=now()
  WHERE id IN ('choreographer');
UPDATE public.service_categories SET applicable_event_types = ARRAY['christening','birthday']::text[], updated_at=now()
  WHERE id IN ('kids_entertainer');
UPDATE public.service_categories SET applicable_event_types = ARRAY['travel','dinner_date']::text[], updated_at=now()
  WHERE id IN ('restaurant_reservation');
UPDATE public.service_categories SET applicable_event_types = ARRAY['wedding']::text[], updated_at=now()
  WHERE id IN ('wedding_paperwork','brides_attire','grooms_attire','wedding_singer','bridal_car','travel_honeymoon');
UPDATE public.service_categories SET applicable_event_types = ARRAY['corporate']::text[], updated_at=now()
  WHERE id IN ('speaker_talent');
UPDATE public.service_categories SET applicable_event_types = ARRAY['travel']::text[], updated_at=now()
  WHERE id IN ('tour_activity','tour_guide','travel_insurance');
UPDATE public.service_categories SET applicable_event_types = ARRAY['tournament']::text[], updated_at=now()
  WHERE id IN ('referee_official');
UPDATE public.service_categories SET applicable_event_types = ARRAY['gender_reveal']::text[], updated_at=now()
  WHERE id IN ('reveal_element');

-- ---- 2. livestream = the in-app Live Studio → off the vendor marketplace -----
-- "We won't sell services similar to our in-app services." Live Studio (Panood)
-- covers livestreaming for every event in-app, so the vendor category is hidden
-- (same mechanism as officiants/paperwork). Row kept for lineage / any existing
-- links; simply not surfaced for booking.
UPDATE public.service_categories SET marketplace_hidden = true, updated_at = now()
  WHERE id = 'livestream';

-- ---- 3. accommodation → Travel + Wedding (canonical override) ----------------
-- `accommodation` exists in canonical_service_taxonomy (tile 'reception') + the
-- VendorCategory enum, but had no scope. Its OWN override wins over the reception
-- tile, so this makes it bookable for Travel (lodging) + Wedding (guest room
-- blocks) without inheriting reception's (travel-excluded) scope.
UPDATE public.canonical_service_taxonomy SET applicable_event_types = ARRAY['travel','wedding']::text[], updated_at = now()
  WHERE canonical_service = 'accommodation';
