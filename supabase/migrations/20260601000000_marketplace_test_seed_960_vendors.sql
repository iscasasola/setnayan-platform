-- ============================================================================
-- 20260601000000_marketplace_test_seed_960_vendors.sql
--
-- TEST DATA — populates the marketplace with 5 unclaimed vendor_profiles
-- per canonical_service across the 192-row v11 taxonomy (~960 rows total).
-- Sprinkled across 20 PH cities with small lat/lng jitter so distance
-- chips + PairedVenuePanel proximity recommendations have something to
-- exercise.
--
-- This is throwaway data. To wipe everything this migration created:
--
--   DELETE FROM public.vendor_profiles WHERE business_slug LIKE 'test-%';
--
-- All test rows share the `test-` business_slug prefix and the "TEST · "
-- business_name prefix so they're easy to spot in admin views and easy
-- to retire when the real marketplace comes online.
--
-- Why services = [canonical_service, coarse_category]:
--   • Marketplace browse filters by canonical_service (e.g.
--     `/vendors?category=catholic_priest`) check `services @> [category]`.
--   • saveVendorToPicks's coerceCategory picks the first known
--     VENDOR_CATEGORIES enum value out of `services[]` so the saved row
--     lands in the right 12-bucket planner group instead of the 'misc'
--     fallback. The CASE expression below derives that coarse value from
--     keyword patterns in the canonical_service slug.
--
-- Idempotency: WHERE NOT EXISTS guard on business_slug (the unique index
-- on LOWER(business_slug) is expression-based, so ON CONFLICT can't
-- target it).
-- ============================================================================

BEGIN;

WITH cities (rn, name, slug, lat, lng) AS (
  VALUES
    ( 1, 'Manila',         'manila',         14.5995, 120.9842),
    ( 2, 'Quezon City',    'quezon-city',    14.6760, 121.0437),
    ( 3, 'Makati',         'makati',         14.5547, 121.0244),
    ( 4, 'Taguig',         'taguig',         14.5176, 121.0509),
    ( 5, 'Pasig',          'pasig',          14.5764, 121.0851),
    ( 6, 'Mandaluyong',    'mandaluyong',    14.5794, 121.0359),
    ( 7, 'San Juan',       'san-juan',       14.6019, 121.0355),
    ( 8, 'Pasay',          'pasay',          14.5378, 121.0014),
    ( 9, 'Parañaque',      'paranaque',      14.4793, 121.0198),
    (10, 'Tagaytay',       'tagaytay',       14.0860, 120.9621),
    (11, 'Cavite City',    'cavite-city',    14.4791, 120.8970),
    (12, 'Batangas City',  'batangas-city',  13.7565, 121.0583),
    (13, 'Cebu City',      'cebu-city',      10.3157, 123.8854),
    (14, 'Mactan',         'mactan',         10.3128, 124.0167),
    (15, 'Boracay',        'boracay',        11.9669, 121.9251),
    (16, 'Panglao',        'panglao',         9.6253, 124.3614),
    (17, 'Davao City',     'davao-city',      7.1907, 125.4553),
    (18, 'Baguio',         'baguio',         16.4023, 120.5960),
    (19, 'Iloilo City',    'iloilo-city',    10.7202, 122.5621),
    (20, 'Cagayan de Oro', 'cagayan-de-oro',  8.4542, 124.6319)
),

-- 5 vendor slots per canonical_service (positions 0..4). The city offset
-- rotates per canonical_service so we don't stack all photographers in
-- Manila and all caterers in Cebu — distribution looks scattered.
positions AS (
  SELECT generate_series(0, 4) AS pos
),

candidates AS (
  SELECT
    cs.canonical_service,
    cs.display_name_en AS label,
    p.pos,
    c.name        AS city_name,
    c.slug        AS city_slug,
    -- ±0.012° (~1.3 km) of jitter so the 5 vendors per category don't
    -- pin to the exact same city centroid when distances are computed.
    (c.lat + (random() - 0.5) * 0.024)::NUMERIC(10,7) AS lat,
    (c.lng + (random() - 0.5) * 0.024)::NUMERIC(10,7) AS lng,
    -- Map canonical_service → coarse VENDOR_CATEGORIES enum so the save
    -- flow's coerceCategory picks the right planner bucket. Keyword
    -- heuristic — catches the common cases; anything that doesn't match
    -- falls through to 'misc' (which renders under Logistics).
    (CASE
       WHEN cs.canonical_service ~ 'priest|minister|pastor|imam|judge|officiant|reverend|rabbi' THEN 'officiant'
       WHEN cs.canonical_service ~ 'photographer|photography|pre_?nup_shoot|engagement_shoot' THEN 'photographer'
       WHEN cs.canonical_service ~ 'videographer|videography|cinematographer|highlight_video|ai_edited_highlight' THEN 'videographer'
       WHEN cs.canonical_service ~ 'photobooth|photo_booth|booth' THEN 'photobooth'
       WHEN cs.canonical_service ~ 'mobile_bar|bar_service|bartender|cocktail' THEN 'mobile_bar'
       WHEN cs.canonical_service ~ 'catering|food_truck|live_station|paella|pasta_station|carving_station|grazing|dessert_bar' THEN 'catering'
       WHEN cs.canonical_service ~ 'cake|pastry|dessert' THEN 'cake_maker'
       WHEN cs.canonical_service ~ 'string_quartet|string_ensemble|string_trio' THEN 'string_quartet'
       WHEN cs.canonical_service ~ 'choir|chorale' THEN 'choir'
       WHEN cs.canonical_service ~ 'band|dj|acoustic_duo|acoustic_trio|live_music|solo_musician' THEN 'band_dj'
       WHEN cs.canonical_service ~ 'host|emcee|mc_' THEN 'host_emcee'
       WHEN cs.canonical_service ~ 'florist|flower|floral|bouquet' THEN 'florist'
       WHEN cs.canonical_service ~ 'decor|styling|stylist|setup|backdrop|tablescape|prop' THEN 'reception_decor'
       WHEN cs.canonical_service ~ 'makeup' THEN 'makeup_artist'
       WHEN cs.canonical_service ~ 'hair|stylist' THEN 'hair_stylist'
       WHEN cs.canonical_service ~ 'gown|bridal_attire|bridal_modest|wedding_dress|entourage_gown' THEN 'gown_designer'
       WHEN cs.canonical_service ~ 'suit|barong|tuxedo|groom_attire|entourage_suit' THEN 'suit_designer'
       WHEN cs.canonical_service ~ 'ring|jewel' THEN 'rings'
       WHEN cs.canonical_service ~ 'invitation|stationery|save_the_date|monogram|signage|seating_chart' THEN 'invitations_stationery'
       WHEN cs.canonical_service ~ 'transport|car_|shuttle|coach|trolley|bridal_car' THEN 'transportation'
       WHEN cs.canonical_service ~ 'lights_and_sound|sound_system|lighting_design|av_' THEN 'lights_and_sound'
       WHEN cs.canonical_service ~ 'led_|projector|video_wall|screen' THEN 'led_screens'
       WHEN cs.canonical_service ~ 'security|usher|coordinator_assistant' THEN 'security'
       WHEN cs.canonical_service ~ 'giveaway|gift|favor|souvenir' THEN 'gifts_and_giveaways'
       WHEN cs.canonical_service ~ 'coordinator|planner|wedding_coordination|day_of|on_the_day|wizard' THEN 'planner_coordinator'
       WHEN cs.canonical_service ~ 'catholic_church|christian_church|chapel|cathedral|basilica|mosque|inc_locale|temple|civil_registrar' THEN 'religious_venue'
       WHEN cs.canonical_service ~ 'venue|hotel|garden|beach|resort|hall|tent|farm|estate' THEN 'venue'
       WHEN cs.canonical_service ~ 'church_fee' THEN 'church_fees'
       ELSE 'misc'
     END)::TEXT AS coarse_category
  FROM public.canonical_service_schemas cs
  CROSS JOIN positions p
  CROSS JOIN LATERAL (
    -- Rotate the starting city per canonical_service so the same 5
    -- cities aren't reused for adjacent categories.
    SELECT *
    FROM cities
    WHERE rn = ((abs(hashtext(cs.canonical_service)) + p.pos) % 20) + 1
  ) c
)

INSERT INTO public.vendor_profiles (
  user_id,
  created_by_admin_user_id,
  business_name,
  business_slug,
  tagline,
  services,
  location_city,
  hq_address,
  hq_latitude,
  hq_longitude,
  is_published,
  public_visibility,
  compatible_ceremony_types,
  compatible_venue_settings,
  event_types
)
SELECT
  NULL,
  NULL,
  format('TEST · %s #%s · %s', cand.label, cand.pos + 1, cand.city_name),
  format(
    'test-%s-%s-%s',
    replace(cand.canonical_service, '_', '-'),
    cand.pos + 1,
    cand.city_slug
  ),
  format('Sample %s vendor for marketplace testing.', cand.label),
  ARRAY[cand.canonical_service, cand.coarse_category],
  cand.city_name,
  format('%s, Philippines', cand.city_name),
  cand.lat,
  cand.lng,
  TRUE,
  'coming_soon',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY['wedding']::TEXT[]
FROM candidates cand
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_profiles vp
  WHERE LOWER(vp.business_slug) = LOWER(format(
    'test-%s-%s-%s',
    replace(cand.canonical_service, '_', '-'),
    cand.pos + 1,
    cand.city_slug
  ))
);

COMMIT;
