-- ============================================================================
-- 20260617000000_iteration_0006_vendor_hero_photos_pilot_polish.sql
--
-- WHY (canonical lock in CLAUDE.md decision log row 2026-05-24 "Vendor hero
-- photos pilot polish · Pexels CDN stock for 1019 vendor_profiles + 39
-- venue_directory rows + TEST-prefix rename"):
--
-- The 5-20 personal/family pilot cohort (per [[project_setnayan_pilot_timeline]],
-- launching ~2026-06-01) browses the wizard's Reception Venue card +
-- marketplace surfaces daily. Today those cards render a big-letter
-- initials placeholder because (a) the 59 admin-owned-unclaimed famous
-- venues (Conrad Manila, Cebu Marriott, Shangri-La at the Fort, etc. ·
-- seeded by 20260529000000_venue_directory_seed.sql into vendor_profiles)
-- have NO logo_url, and (b) the 960 TEST marketplace vendors (per
-- 20260601000000_marketplace_test_seed_960_vendors.sql) carry "TEST · "
-- prefixes and equally have no logo_url. The big T/S/C/D/M letters in
-- the screenshot are the initials fallback firing on every card.
--
-- Owner directive 2026-05-24 (AskUserQuestion + multi-turn): full
-- coverage (venues + all marketplace vendors) + rename TEST rows to
-- proper names + add photos. Approach matches the 2026-05-23 Wedding
-- Attire Guide arc (PR #449 → #455) which proved the Pexels CDN
-- hotlinking pattern works: zero compute cost, ~3-4h turnaround, visual
-- polish indistinguishable from real customer uploads at marketplace
-- card resolution.
--
-- This migration is data-only:
--   (1) Strip "TEST · " prefix from 960 marketplace seed rows (owner-
--       picked Option A — "Rename to proper vendor names + add photos").
--       Stripped form reads naturally ("Tent / Outdoor-Cover Rental #1
--       · Makati") and surfaces what each test vendor actually does +
--       where, which is the pilot polish target.
--   (2) Backfill vendor_profiles.logo_url for ~1019 rows (59 famous +
--       960 test) with category-appropriate Pexels CDN URLs. The
--       existing photo ladder in apps/web/lib/wizard-recommendations.ts +
--       apps/web/app/vendors/_components/vendor-card.tsx is
--       `primary_photo_url ?? logo_url ?? initials` — populating
--       logo_url lights up tier 2 of that ladder without touching code.
--   (3) Backfill venue_directory.hero_image_url + hero_image_attribution
--       + hero_image_license + hero_image_source_url for the 39 NULL
--       rows (10 religious venues left over from
--       20260526020000_venue_directory_hero_images.sql §2 + 29 reception
--       venues from 20260604010000_venue_directory_reception_seed.sql
--       that were never photo-seeded).
--
-- Pexels License classification: Pexels permits free use for any
-- purpose, attribution not required, no permission needed (https://
-- www.pexels.com/license/). Closest semantic match in the existing
-- hero_image_license enum is 'CC0-1.0' — both function as
-- public-domain-equivalent for downstream consumers. The
-- hero_image_attribution string still credits Pexels by name + license
-- by convention even though Pexels License doesn't legally require it.
--
-- Photo source: ~115 verified Pexels CDN URLs, all batch-curl 200 OK
-- before ship (verification run 2026-05-24). Photos sourced from
-- Pexels search results across 28 wedding-relevant categories
-- (ceremony, reception, photographer, catering, cake, florals, makeup,
-- band, gown, suit, DJ, photobooth, ballroom, garden, beach, tent,
-- rings, car, invitation, coordinator, cocktail bar, lights/sound,
-- string quartet, transportation). Each canonical_service routes to
-- the most-relevant category pool; the 5 vendors per service in
-- different cities (per the test seed design) rotate through the pool
-- via row_number modulo so adjacent cards in a city result set don't
-- repeat the same photo.
--
-- next.config.ts companion: images.pexels.com added to remotePatterns
-- in the same PR so next/image accepts the new URLs.
--
-- Idempotent: every UPDATE guards on `logo_url IS NULL`,
-- `hero_image_url IS NULL`, or `business_name LIKE 'TEST · %'` so
-- re-running the migration is safe. New vendor uploads will overwrite
-- the Pexels URLs without conflict.
--
-- Cross-references:
--   CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars" —
--     3-phase asset sourcing strategy (V1 internet placeholders → V1.x
--     Higgsfield Filipino-specific → V1.x+ stylist real uploads). This
--     migration is the V1 placeholder phase for the vendor_profiles
--     surface specifically.
--   CLAUDE.md 2026-05-23 fifth row "Wedding Attire Guide arc" —
--     PR #449/#451/#453/#455 establishing the Pexels CDN hotlinking
--     pattern this migration follows.
--   CLAUDE.md 2026-05-18 row 8 — pilot strategy + June 1 gate.
--   CLAUDE.md 2026-05-22 row 11 "Unified QR Code Lifecycle Model" —
--     venue browse surface architectural lock.
--   20260526010000_venue_directory_seed.sql — venue_directory base
--     seed (59 famous venues).
--   20260526020000_venue_directory_hero_images.sql — venue_directory
--     hero_image_url constraint + first-pass 18 religious venue photos.
--   20260529000000_venue_directory_seed.sql — vendor_profiles famous
--     venue admin-owned-unclaimed seed.
--   20260601000000_marketplace_test_seed_960_vendors.sql — 960 TEST
--     marketplace seed rows.
--   20260604010000_venue_directory_reception_seed.sql — reception
--     side of venue_directory.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Strip "TEST · " prefix from the 960 marketplace seed business names.
--    Per owner directive 2026-05-24 — pilot couples shouldn't see "TEST"
--    in their vendor browse. The stripped form ("Tent / Outdoor-Cover
--    Rental #1 · Makati") reads as a generic-but-real PH service vendor.
--    Real vendors will overwrite their names on signup; the test seed
--    stays grep-able via business_slug LIKE 'test-%' (untouched here).
-- ----------------------------------------------------------------------------

UPDATE public.vendor_profiles
SET business_name = REGEXP_REPLACE(business_name, '^TEST · ', '')
WHERE business_name LIKE 'TEST · %';

-- ----------------------------------------------------------------------------
-- 2. Backfill vendor_profiles.logo_url — Pass A: 59 famous venues by slug
--    (admin-owned-unclaimed rows from 20260529000000_venue_directory_seed).
--    Photo picked per venue_type so a hotel ballroom looks like a hotel
--    ballroom, a garden venue looks like a garden, etc.
-- ----------------------------------------------------------------------------

-- ═══ Catholic Churches (19) — wedding ceremony pool, 6-photo rotation ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'manila-cathedral' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'quiapo-church' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'santo-domingo-church' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'sacred-heart-cubao' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'christ-the-king-parish' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'mary-the-queen-parish' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'our-lady-of-guadalupe' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'santuario-de-san-jose' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'mt-carmel-shrine-new-manila' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'san-agustin-intramuros' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'pink-sisters-tagaytay' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'st-anthony-tagaytay' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'our-lady-of-manaoag' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'caleruega-church' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'pico-de-loro-chapel' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'cebu-metropolitan-cathedral' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'basilica-santo-nino-cebu' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'jaro-cathedral-iloilo' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'san-pedro-cathedral-davao' AND logo_url IS NULL;

-- ═══ INC Chapels (3) ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'inc-central-office' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'inc-locale-manila' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'inc-locale-qc' AND logo_url IS NULL;

-- ═══ Mosques (3) — ceremony pool, religious-architecture-flavored ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'manila-golden-mosque' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'marawi-grand-mosque' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'cotabato-grand-mosque' AND logo_url IS NULL;

-- ═══ Christian Churches (3) ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'ccf-ortigas' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'victory-fort-bgc' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'jil-main' AND logo_url IS NULL;

-- ═══ Hotel Ballrooms (14) — hotel ballroom pool, 5-photo rotation ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/19569865/pexels-photo-19569865.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'manila-marriott' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/2504911/pexels-photo-2504911.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'solaire-manila' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/30584407/pexels-photo-30584407.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'conrad-manila' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32990165/pexels-photo-32990165.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'shangri-la-fort' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37240724/pexels-photo-37240724.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'peninsula-manila' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/19569865/pexels-photo-19569865.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'manila-hotel' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/2504911/pexels-photo-2504911.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'sofitel-philippine-plaza' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/30584407/pexels-photo-30584407.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'diamond-hotel' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32990165/pexels-photo-32990165.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'tagaytay-marriott' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37240724/pexels-photo-37240724.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'taal-vista-hotel' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/19569865/pexels-photo-19569865.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'twin-lakes-hotel' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/2504911/pexels-photo-2504911.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'cebu-marriott' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/30584407/pexels-photo-30584407.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'shangri-la-mactan' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32990165/pexels-photo-32990165.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'crimson-mactan' AND logo_url IS NULL;

-- ═══ Garden Venues (4) — garden pool, 4-photo rotation ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'antonios-tagaytay' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/36380132/pexels-photo-36380132.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'sonyas-garden' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/35629338/pexels-photo-35629338.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'hillcreek-gardens-tagaytay' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/35629351/pexels-photo-35629351.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'glass-garden-pasig' AND logo_url IS NULL;

-- ═══ Beach / Destination (5) — beach pool, 5-photo rotation ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/27442593/pexels-photo-27442593.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'shangri-la-boracay' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/9470486/pexels-photo-9470486.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'henann-regency-boracay' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/32113384/pexels-photo-32113384.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'pico-sands-hotel' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/2549004/pexels-photo-2549004.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'eskaya-bohol' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/169196/pexels-photo-169196.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'anvaya-cove-bataan' AND logo_url IS NULL;

-- ═══ Heritage (3) — garden pool (heritage venues read garden-y at thumb size) ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'las-casas-filipinas' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/36380132/pexels-photo-36380132.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'hacienda-isabella' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/35629338/pexels-photo-35629338.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'casino-espanol-manila' AND logo_url IS NULL;

-- ═══ Civil Registrars (5) — coordinator pool (formal indoor) ═══
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'manila-city-hall' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/14581440/pexels-photo-14581440.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'quezon-city-hall' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/37190289/pexels-photo-37190289.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'makati-city-hall' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/5195038/pexels-photo-5195038.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'cebu-city-hall' AND logo_url IS NULL;
UPDATE public.vendor_profiles SET logo_url = 'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE business_slug = 'davao-city-hall' AND logo_url IS NULL;

COMMIT;

-- ============================================================================
-- 3. Backfill vendor_profiles.logo_url — Pass B: 960 test marketplace rows
--    by canonical_service category. Uses ROW_NUMBER() to rotate through
--    each category's photo pool so 5 vendors in different cities show 5
--    different photos.
--
--    The 960 rows live across 192 canonical_services × 5 city positions.
--    Strategy: bucket each row to a coarse category via regex match on
--    the canonical_service in services[1], then pick from that
--    category's photo pool by `pos = (row_number - 1) % pool_size`. The
--    test seed already populated services[1] with the canonical_service
--    and services[2] with the coarse_category — we use services[1] here
--    so the bucket mapping survives if the test seed's coarse_category
--    heuristic ever changes.
--
--    Each category has 4-6 photos; rotation gives visual variety per
--    city group without per-row curation effort.
-- ============================================================================

BEGIN;

WITH category_pools AS (
  -- 28 category pools × 4-6 photos each. Postgres ARRAY of photo URLs
  -- so the modulo rotation is a clean indexed lookup.
  SELECT
    'officiant'::TEXT AS bucket,
    ARRAY[
      'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800'
    ]::TEXT[] AS pool
  UNION ALL SELECT 'photographer', ARRAY[
    'https://images.pexels.com/photos/17057198/pexels-photo-17057198.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/32652766/pexels-photo-32652766.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/35325793/pexels-photo-35325793.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/21560369/pexels-photo-21560369.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/31296631/pexels-photo-31296631.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'catering', ARRAY[
    'https://images.pexels.com/photos/28976236/pexels-photo-28976236.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29068721/pexels-photo-29068721.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29587700/pexels-photo-29587700.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/28976230/pexels-photo-28976230.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/28976234/pexels-photo-28976234.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'cake_maker', ARRAY[
    'https://images.pexels.com/photos/11712500/pexels-photo-11712500.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/32552698/pexels-photo-32552698.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30445121/pexels-photo-30445121.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/35670065/pexels-photo-35670065.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30233153/pexels-photo-30233153.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'florist', ARRAY[
    'https://images.pexels.com/photos/7119089/pexels-photo-7119089.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3023228/pexels-photo-3023228.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30891127/pexels-photo-30891127.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/10838755/pexels-photo-10838755.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/9342923/pexels-photo-9342923.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'makeup_artist', ARRAY[
    'https://images.pexels.com/photos/34955448/pexels-photo-34955448.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30809480/pexels-photo-30809480.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29133472/pexels-photo-29133472.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/28863325/pexels-photo-28863325.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14358523/pexels-photo-14358523.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'live_band', ARRAY[
    'https://images.pexels.com/photos/19154212/pexels-photo-19154212.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14759055/pexels-photo-14759055.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/27018254/pexels-photo-27018254.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/33776252/pexels-photo-33776252.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/9002826/pexels-photo-9002826.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'dj', ARRAY[
    'https://images.pexels.com/photos/9005458/pexels-photo-9005458.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/35243129/pexels-photo-35243129.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/9005510/pexels-photo-9005510.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/36098638/pexels-photo-36098638.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/10781266/pexels-photo-10781266.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'gown_designer', ARRAY[
    'https://images.pexels.com/photos/6536968/pexels-photo-6536968.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/28863325/pexels-photo-28863325.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/5978140/pexels-photo-5978140.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/5618793/pexels-photo-5618793.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14358523/pexels-photo-14358523.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'suit_designer', ARRAY[
    'https://images.pexels.com/photos/34317977/pexels-photo-34317977.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11813859/pexels-photo-11813859.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/18689054/pexels-photo-18689054.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/4259798/pexels-photo-4259798.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/12919459/pexels-photo-12919459.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'photobooth', ARRAY[
    'https://images.pexels.com/photos/13788485/pexels-photo-13788485.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/9342943/pexels-photo-9342943.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2606402/pexels-photo-2606402.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2449445/pexels-photo-2449445.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/37325399/pexels-photo-37325399.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'mobile_bar', ARRAY[
    'https://images.pexels.com/photos/15325595/pexels-photo-15325595.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/34575937/pexels-photo-34575937.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/4485344/pexels-photo-4485344.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/18251320/pexels-photo-18251320.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/4485407/pexels-photo-4485407.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'rings', ARRAY[
    'https://images.pexels.com/photos/36069125/pexels-photo-36069125.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/17261921/pexels-photo-17261921.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/13524236/pexels-photo-13524236.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/31451756/pexels-photo-31451756.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7260320/pexels-photo-7260320.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'transportation', ARRAY[
    'https://images.pexels.com/photos/20678074/pexels-photo-20678074.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/5966184/pexels-photo-5966184.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/8328301/pexels-photo-8328301.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/18456004/pexels-photo-18456004.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29500425/pexels-photo-29500425.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'invitations_stationery', ARRAY[
    'https://images.pexels.com/photos/11650189/pexels-photo-11650189.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650472/pexels-photo-11650472.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650477/pexels-photo-11650477.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650185/pexels-photo-11650185.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650473/pexels-photo-11650473.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'planner_coordinator', ARRAY[
    'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14581440/pexels-photo-14581440.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/37190289/pexels-photo-37190289.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/5195038/pexels-photo-5195038.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'lights_and_sound', ARRAY[
    'https://images.pexels.com/photos/13230484/pexels-photo-13230484.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/12787862/pexels-photo-12787862.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/976862/pexels-photo-976862.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29261518/pexels-photo-29261518.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30831640/pexels-photo-30831640.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'string_quartet', ARRAY[
    'https://images.pexels.com/photos/7095031/pexels-photo-7095031.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095821/pexels-photo-7095821.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095043/pexels-photo-7095043.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095027/pexels-photo-7095027.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095053/pexels-photo-7095053.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'venue', ARRAY[
    'https://images.pexels.com/photos/19569865/pexels-photo-19569865.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/27442593/pexels-photo-27442593.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30584407/pexels-photo-30584407.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/37240724/pexels-photo-37240724.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'religious_venue', ARRAY[
    'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'videographer', ARRAY[
    'https://images.pexels.com/photos/17057198/pexels-photo-17057198.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/32652766/pexels-photo-32652766.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/35325793/pexels-photo-35325793.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/21560369/pexels-photo-21560369.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/31296631/pexels-photo-31296631.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'hair_stylist', ARRAY[
    'https://images.pexels.com/photos/34955448/pexels-photo-34955448.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30809480/pexels-photo-30809480.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29133472/pexels-photo-29133472.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/28863325/pexels-photo-28863325.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14358523/pexels-photo-14358523.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'reception_decor', ARRAY[
    'https://images.pexels.com/photos/7119089/pexels-photo-7119089.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/12954015/pexels-photo-12954015.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/27958450/pexels-photo-27958450.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/12876406/pexels-photo-12876406.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/33914537/pexels-photo-33914537.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'host_emcee', ARRAY[
    'https://images.pexels.com/photos/9005458/pexels-photo-9005458.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14581440/pexels-photo-14581440.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/19154212/pexels-photo-19154212.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'choir', ARRAY[
    'https://images.pexels.com/photos/7095031/pexels-photo-7095031.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095821/pexels-photo-7095821.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095043/pexels-photo-7095043.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7095027/pexels-photo-7095027.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'led_screens', ARRAY[
    'https://images.pexels.com/photos/13230484/pexels-photo-13230484.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/12787862/pexels-photo-12787862.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/29261518/pexels-photo-29261518.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/30831640/pexels-photo-30831640.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'security', ARRAY[
    'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14581440/pexels-photo-14581440.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/37190289/pexels-photo-37190289.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'gifts_and_giveaways', ARRAY[
    'https://images.pexels.com/photos/11650189/pexels-photo-11650189.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650472/pexels-photo-11650472.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650477/pexels-photo-11650477.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/11650185/pexels-photo-11650185.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'church_fees', ARRAY[
    'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/32142652/pexels-photo-32142652.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
  UNION ALL SELECT 'misc', ARRAY[
    'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/12954015/pexels-photo-12954015.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/14581440/pexels-photo-14581440.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/37190289/pexels-photo-37190289.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]::TEXT[]
),

-- Bucket every vendor_profiles row to one of the 28 category pools.
-- Mirrors the coarse_category CASE in the marketplace_test_seed but
-- consumes services[1] (the canonical_service) so the mapping survives
-- if the seed's heuristic changes.
bucketed AS (
  SELECT
    vp.vendor_profile_id,
    vp.services,
    (CASE
       WHEN COALESCE(vp.services[1], '') ~ 'priest|minister|pastor|imam|judge|officiant|reverend|rabbi' THEN 'officiant'
       WHEN COALESCE(vp.services[1], '') ~ 'photographer|photography|prenup_shoot|engagement_shoot|boudoir' THEN 'photographer'
       WHEN COALESCE(vp.services[1], '') ~ 'videographer|videography|cinematographer|highlight_video|highlight_reel|ai_edited_highlight|drone_videographer' THEN 'videographer'
       WHEN COALESCE(vp.services[1], '') ~ 'photobooth|photo_booth|gif_booth' THEN 'photobooth'
       WHEN COALESCE(vp.services[1], '') ~ 'mobile_bar|bar_service|bartender|cocktail' THEN 'mobile_bar'
       WHEN COALESCE(vp.services[1], '') ~ 'catering|food_truck|live_station|paella|pasta_station|carving_station|grazing|dessert_bar|halal_catering|lechonero|halo_halo|charcuterie|cotton_candy|crepe|live_cooking|ice_cream' THEN 'catering'
       WHEN COALESCE(vp.services[1], '') ~ 'cake|pastry|dessert' THEN 'cake_maker'
       WHEN COALESCE(vp.services[1], '') ~ 'string_quartet|string_ensemble|string_trio' THEN 'string_quartet'
       WHEN COALESCE(vp.services[1], '') ~ 'choir|chorale' THEN 'choir'
       WHEN COALESCE(vp.services[1], '') ~ '^dj$|^dj_|_dj$' THEN 'dj'
       WHEN COALESCE(vp.services[1], '') ~ 'band|acoustic_duo|acoustic_trio|live_music|live_band|solo_musician|folk_performer|kulintang|rondalla|acoustic_performer' THEN 'live_band'
       WHEN COALESCE(vp.services[1], '') ~ 'host|emcee|mc_' THEN 'host_emcee'
       WHEN COALESCE(vp.services[1], '') ~ 'florist|flower|floral|bouquet|bridal_bouquet' THEN 'florist'
       WHEN COALESCE(vp.services[1], '') ~ 'decor|styling|stylist|setup|backdrop|tablescape|prop|capiz|hacienda_heritage_decor|maranao_okir_decor' THEN 'reception_decor'
       WHEN COALESCE(vp.services[1], '') ~ 'makeup|hmua|family_mua' THEN 'makeup_artist'
       WHEN COALESCE(vp.services[1], '') ~ 'hair' THEN 'hair_stylist'
       WHEN COALESCE(vp.services[1], '') ~ 'gown|bridal_attire|bridal_modest|wedding_dress|entourage_gown|bridesmaid_dress|filipiniana|junior_bridesmaid|flower_girl_dress|maranao_wedding_attire' THEN 'gown_designer'
       WHEN COALESCE(vp.services[1], '') ~ 'suit|barong|tuxedo|groom_attire|entourage_suit|groomsman|junior_groomsman|groom_grooming' THEN 'suit_designer'
       WHEN COALESCE(vp.services[1], '') ~ 'ring|jewel' THEN 'rings'
       WHEN COALESCE(vp.services[1], '') ~ 'invitation|stationery|save_the_date|monogram|signage|seating_chart|ceremony_program|live_calligraphy' THEN 'invitations_stationery'
       WHEN COALESCE(vp.services[1], '') ~ 'transport|car_|shuttle|coach|trolley|bridal_car|bridal_boat|horse_drawn|honeymoon_planner|travel_coordinator' THEN 'transportation'
       WHEN COALESCE(vp.services[1], '') ~ 'lights_and_sound|sound_system|lighting_design|av_|lights_sound|outdoor_sound' THEN 'lights_and_sound'
       WHEN COALESCE(vp.services[1], '') ~ 'led_|projector|video_wall|screen|led_dance_floor' THEN 'led_screens'
       WHEN COALESCE(vp.services[1], '') ~ 'security|usher|coordinator_assistant' THEN 'security'
       WHEN COALESCE(vp.services[1], '') ~ 'giveaway|gift|favor|souvenir|godchild_token|keychain' THEN 'gifts_and_giveaways'
       WHEN COALESCE(vp.services[1], '') ~ 'coordinator|planner|wedding_coordination|day_of|on_the_day|wizard|despedida_planner|destination_wedding_specialist|destination_wedding_travel_coordinator|gender_separated_reception_coordinator|inc_wedding_coordinator|mahr_coordination' THEN 'planner_coordinator'
       WHEN COALESCE(vp.services[1], '') ~ 'catholic_church|christian_church|chapel|cathedral|basilica|mosque|inc_locale|temple|civil_registrar' THEN 'religious_venue'
       WHEN COALESCE(vp.services[1], '') ~ 'venue|hotel|garden|beach|resort|hall|tent|farm|estate' THEN 'venue'
       WHEN COALESCE(vp.services[1], '') ~ 'church_fee|cfo|pre_cana|inc_counseling' THEN 'church_fees'
       ELSE 'misc'
     END)::TEXT AS bucket,
    -- Stable per-bucket index for pool rotation. ROW_NUMBER over the
    -- bucket so vendors of the same canonical_service in different
    -- cities pick different pool positions.
    ROW_NUMBER() OVER (
      PARTITION BY (CASE
         WHEN COALESCE(vp.services[1], '') ~ 'priest|minister|pastor|imam|judge|officiant|reverend|rabbi' THEN 'officiant'
         WHEN COALESCE(vp.services[1], '') ~ 'photographer|photography|prenup_shoot|engagement_shoot|boudoir' THEN 'photographer'
         WHEN COALESCE(vp.services[1], '') ~ 'videographer|videography|cinematographer|highlight_video|highlight_reel|ai_edited_highlight|drone_videographer' THEN 'videographer'
         WHEN COALESCE(vp.services[1], '') ~ 'photobooth|photo_booth|gif_booth' THEN 'photobooth'
         WHEN COALESCE(vp.services[1], '') ~ 'mobile_bar|bar_service|bartender|cocktail' THEN 'mobile_bar'
         WHEN COALESCE(vp.services[1], '') ~ 'catering|food_truck|live_station|paella|pasta_station|carving_station|grazing|dessert_bar|halal_catering|lechonero|halo_halo|charcuterie|cotton_candy|crepe|live_cooking|ice_cream' THEN 'catering'
         WHEN COALESCE(vp.services[1], '') ~ 'cake|pastry|dessert' THEN 'cake_maker'
         WHEN COALESCE(vp.services[1], '') ~ 'string_quartet|string_ensemble|string_trio' THEN 'string_quartet'
         WHEN COALESCE(vp.services[1], '') ~ 'choir|chorale' THEN 'choir'
         WHEN COALESCE(vp.services[1], '') ~ '^dj$|^dj_|_dj$' THEN 'dj'
         WHEN COALESCE(vp.services[1], '') ~ 'band|acoustic_duo|acoustic_trio|live_music|live_band|solo_musician|folk_performer|kulintang|rondalla|acoustic_performer' THEN 'live_band'
         WHEN COALESCE(vp.services[1], '') ~ 'host|emcee|mc_' THEN 'host_emcee'
         WHEN COALESCE(vp.services[1], '') ~ 'florist|flower|floral|bouquet|bridal_bouquet' THEN 'florist'
         WHEN COALESCE(vp.services[1], '') ~ 'decor|styling|stylist|setup|backdrop|tablescape|prop|capiz|hacienda_heritage_decor|maranao_okir_decor' THEN 'reception_decor'
         WHEN COALESCE(vp.services[1], '') ~ 'makeup|hmua|family_mua' THEN 'makeup_artist'
         WHEN COALESCE(vp.services[1], '') ~ 'hair' THEN 'hair_stylist'
         WHEN COALESCE(vp.services[1], '') ~ 'gown|bridal_attire|bridal_modest|wedding_dress|entourage_gown|bridesmaid_dress|filipiniana|junior_bridesmaid|flower_girl_dress|maranao_wedding_attire' THEN 'gown_designer'
         WHEN COALESCE(vp.services[1], '') ~ 'suit|barong|tuxedo|groom_attire|entourage_suit|groomsman|junior_groomsman|groom_grooming' THEN 'suit_designer'
         WHEN COALESCE(vp.services[1], '') ~ 'ring|jewel' THEN 'rings'
         WHEN COALESCE(vp.services[1], '') ~ 'invitation|stationery|save_the_date|monogram|signage|seating_chart|ceremony_program|live_calligraphy' THEN 'invitations_stationery'
         WHEN COALESCE(vp.services[1], '') ~ 'transport|car_|shuttle|coach|trolley|bridal_car|bridal_boat|horse_drawn|honeymoon_planner|travel_coordinator' THEN 'transportation'
         WHEN COALESCE(vp.services[1], '') ~ 'lights_and_sound|sound_system|lighting_design|av_|lights_sound|outdoor_sound' THEN 'lights_and_sound'
         WHEN COALESCE(vp.services[1], '') ~ 'led_|projector|video_wall|screen|led_dance_floor' THEN 'led_screens'
         WHEN COALESCE(vp.services[1], '') ~ 'security|usher|coordinator_assistant' THEN 'security'
         WHEN COALESCE(vp.services[1], '') ~ 'giveaway|gift|favor|souvenir|godchild_token|keychain' THEN 'gifts_and_giveaways'
         WHEN COALESCE(vp.services[1], '') ~ 'coordinator|planner|wedding_coordination|day_of|on_the_day|wizard|despedida_planner|destination_wedding_specialist|destination_wedding_travel_coordinator|gender_separated_reception_coordinator|inc_wedding_coordinator|mahr_coordination' THEN 'planner_coordinator'
         WHEN COALESCE(vp.services[1], '') ~ 'catholic_church|christian_church|chapel|cathedral|basilica|mosque|inc_locale|temple|civil_registrar' THEN 'religious_venue'
         WHEN COALESCE(vp.services[1], '') ~ 'venue|hotel|garden|beach|resort|hall|tent|farm|estate' THEN 'venue'
         WHEN COALESCE(vp.services[1], '') ~ 'church_fee|cfo|pre_cana|inc_counseling' THEN 'church_fees'
         ELSE 'misc'
       END)
      ORDER BY vp.created_at, vp.vendor_profile_id
    ) AS row_idx
  FROM public.vendor_profiles vp
  WHERE vp.logo_url IS NULL
)

UPDATE public.vendor_profiles vp
SET logo_url = cp.pool[ ((b.row_idx - 1) % cardinality(cp.pool)) + 1 ]
FROM bucketed b
JOIN category_pools cp ON cp.bucket = b.bucket
WHERE vp.vendor_profile_id = b.vendor_profile_id
  AND vp.logo_url IS NULL;

COMMIT;

-- ============================================================================
-- 4. Backfill venue_directory.hero_image_url (+ attribution + license +
--    source_url) for the 39 NULL rows. Per migration
--    20260526020000_venue_directory_hero_images.sql §2 constraints, all
--    four columns must be set together or all NULL — partial fills are
--    rejected.
--
--    Categorization mirrors venue_directory.venue_type / venue_category
--    where present, falling back to slug heuristics for older rows.
-- ============================================================================

BEGIN;

-- ═══ Catholic Churches (10 still NULL from §2 of the original
-- religious-venue seed migration) — wedding ceremony pool ═══
UPDATE public.venue_directory SET
  hero_image_url = 'https://images.pexels.com/photos/10279235/pexels-photo-10279235.jpeg?auto=compress&cs=tinysrgb&w=800',
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/photo/10279235/'
WHERE slug IN (
  'mary-the-queen-greenhills',
  'st-anthony-parish-tagaytay',
  'our-lady-of-manaoag-tagaytay',
  'pico-de-loro-chapel'
) AND hero_image_url IS NULL;

-- ═══ INC Locales (2 still NULL) — wedding ceremony pool ═══
UPDATE public.venue_directory SET
  hero_image_url = 'https://images.pexels.com/photos/3212018/pexels-photo-3212018.jpeg?auto=compress&cs=tinysrgb&w=800',
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/photo/3212018/'
WHERE slug IN (
  'inc-locale-manila-lambert',
  'inc-locale-quezon-city'
) AND hero_image_url IS NULL;

-- ═══ Mosques (1 still NULL) ═══
UPDATE public.venue_directory SET
  hero_image_url = 'https://images.pexels.com/photos/37479647/pexels-photo-37479647.jpeg?auto=compress&cs=tinysrgb&w=800',
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/photo/37479647/'
WHERE slug = 'cotabato-grand-mosque' AND hero_image_url IS NULL;

-- ═══ Christian Churches (3 still NULL) ═══
UPDATE public.venue_directory SET
  hero_image_url = 'https://images.pexels.com/photos/15511100/pexels-photo-15511100.jpeg?auto=compress&cs=tinysrgb&w=800',
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/photo/15511100/'
WHERE slug IN (
  'ccf-pasig',
  'victory-fort-bgc',
  'jil-mandaluyong'
) AND hero_image_url IS NULL;

-- ═══ Hotel ballrooms (~14 rows) — hotel ballroom pool, slug-keyed rotation ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 5)
    WHEN 0 THEN 'https://images.pexels.com/photos/19569865/pexels-photo-19569865.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/2504911/pexels-photo-2504911.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 2 THEN 'https://images.pexels.com/photos/30584407/pexels-photo-30584407.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 3 THEN 'https://images.pexels.com/photos/32990165/pexels-photo-32990165.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/37240724/pexels-photo-37240724.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type IN ('hotel_ballroom', 'banquet_hall') AND hero_image_url IS NULL;

-- ═══ Garden venues (~4 rows) — venue_directory_type enum: 'garden' + 'garden_estate' (V1.2) ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 4)
    WHEN 0 THEN 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/36380132/pexels-photo-36380132.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 2 THEN 'https://images.pexels.com/photos/35629338/pexels-photo-35629338.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/35629351/pexels-photo-35629351.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type IN ('garden', 'garden_estate') AND hero_image_url IS NULL;

-- ═══ Beach / Destination (~5 rows) — enum: 'beach' + 'beach_resort' (V1.2) + 'destination_resort' ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 5)
    WHEN 0 THEN 'https://images.pexels.com/photos/27442593/pexels-photo-27442593.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/9470486/pexels-photo-9470486.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 2 THEN 'https://images.pexels.com/photos/32113384/pexels-photo-32113384.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 3 THEN 'https://images.pexels.com/photos/2549004/pexels-photo-2549004.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/169196/pexels-photo-169196.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type IN ('beach', 'beach_resort', 'destination_resort') AND hero_image_url IS NULL;

-- ═══ Heritage (~3 rows) — enum: 'heritage' + 'heritage_hacienda' (V1.2) — garden pool (heritage venues read garden-y) ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 3)
    WHEN 0 THEN 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/36380132/pexels-photo-36380132.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/35629338/pexels-photo-35629338.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type IN ('heritage', 'heritage_hacienda') AND hero_image_url IS NULL;

-- ═══ Civil Registrars (~5 rows) — coordinator pool (formal indoor) ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 3)
    WHEN 0 THEN 'https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/14581440/pexels-photo-14581440.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/37190289/pexels-photo-37190289.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type = 'civil_registrar' AND hero_image_url IS NULL;

-- ═══ Outdoor tents (~rows) — enum: 'outdoor_tent' (single value) ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 4)
    WHEN 0 THEN 'https://images.pexels.com/photos/5889122/pexels-photo-5889122.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/28886690/pexels-photo-28886690.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 2 THEN 'https://images.pexels.com/photos/9864907/pexels-photo-9864907.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/9473070/pexels-photo-9473070.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type = 'outdoor_tent' AND hero_image_url IS NULL;

-- ═══ Restaurant + Multi-purpose hall (V1.2 additions) — generic venue pool ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 3)
    WHEN 0 THEN 'https://images.pexels.com/photos/12954015/pexels-photo-12954015.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/27958450/pexels-photo-27958450.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/33914537/pexels-photo-33914537.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE venue_type IN ('restaurant', 'multi_purpose_hall') AND hero_image_url IS NULL;

-- ═══ Catch-all for any remaining venue_type with no hero_image_url —
-- ═══ rotates through a generic 3-photo venue pool so no row stays NULL. ═══
UPDATE public.venue_directory SET
  hero_image_url = CASE (abs(hashtext(slug)) % 3)
    WHEN 0 THEN 'https://images.pexels.com/photos/19569865/pexels-photo-19569865.jpeg?auto=compress&cs=tinysrgb&w=800'
    WHEN 1 THEN 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&w=800'
    ELSE        'https://images.pexels.com/photos/12954015/pexels-photo-12954015.jpeg?auto=compress&cs=tinysrgb&w=800'
  END,
  hero_image_attribution = 'Photo via Pexels (Pexels License)',
  hero_image_license = 'CC0-1.0',
  hero_image_source_url = 'https://www.pexels.com/license/'
WHERE hero_image_url IS NULL;

COMMIT;
