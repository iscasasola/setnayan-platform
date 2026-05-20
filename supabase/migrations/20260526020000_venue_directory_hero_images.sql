-- ============================================================================
-- 20260526020000_venue_directory_hero_images.sql
--
-- Stacks on 20260526010000_venue_directory_seed.sql. Adds hero image columns
-- to public.venue_directory and seeds 18 of the 28 religious venues with
-- legally-clean Wikimedia Commons photos (license verified per row, all
-- URLs HTTP-checked 200 OK before this migration was authored).
--
-- Licensing posture (read before adding rows):
--   • Only Wikimedia Commons / CC-licensed / Public Domain images allowed.
--   • Attribution string must credit author + license; renderer pairs it
--     with hero_image_source_url to satisfy CC source-link requirements.
--   • PH has no freedom-of-panorama for modern architecture: photos of
--     post-1972 buildings carry a latent architectural-copyright risk we
--     mitigate by (a) preferring pre-1972 heritage venues, (b) using only
--     images already on Wikimedia (where architects haven't enforced), and
--     (c) replacing with parish/venue-uploaded photos once they claim the
--     listing.
--
-- Coverage:
--   • 18 of 28 religious venues seeded with photos.
--   • 10 marked NULL — owner curation or owner-uploaded photo on claim:
--       mary-the-queen-greenhills, st-anthony-parish-tagaytay,
--       our-lady-of-manaoag-tagaytay, pico-de-loro-chapel,
--       inc-locale-manila-lambert, inc-locale-quezon-city,
--       cotabato-grand-mosque, ccf-pasig, victory-fort-bgc,
--       jil-mandaluyong.
--   • 29 reception venues (hotels/gardens/beach/heritage/civil registrars)
--     not addressed here — separate followup PR with press-kit sourcing.
--
-- V1.2 migration path:
--   Hotlinking upload.wikimedia.org directly is fine for MVP (Wikimedia
--   explicitly permits it under CC-BY-SA). When the bookable venue
--   marketplace ships V1.2, copy images into Supabase Storage and repoint
--   hero_image_url at the Storage URL for speed/reliability.
--
-- Idempotent (uses ADD COLUMN IF NOT EXISTS + idempotent UPDATEs keyed on
-- the stable slug column).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.venue_directory
  ADD COLUMN IF NOT EXISTS hero_image_url         TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_attribution TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_license     TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_source_url  TEXT;

-- ----------------------------------------------------------------------------
-- 2. Sanity constraints (guarded — re-running the migration is safe)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_hero_image_url_https
      CHECK (hero_image_url IS NULL OR hero_image_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_hero_image_source_url_https
      CHECK (hero_image_source_url IS NULL OR hero_image_source_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_hero_image_attribution_required
      CHECK (
        (hero_image_url IS NULL AND hero_image_attribution IS NULL AND hero_image_license IS NULL)
        OR
        (hero_image_url IS NOT NULL AND hero_image_attribution IS NOT NULL AND hero_image_license IS NOT NULL)
      );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_hero_image_license_known
      CHECK (
        hero_image_license IS NULL
        OR hero_image_license IN (
          'CC-BY-SA-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-2.0',
          'CC-BY-4.0',    'CC-BY-3.0',    'CC-BY-2.0',
          'CC0-1.0',      'PD',
          'press-kit',    'owner-uploaded'
        )
      );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.venue_directory.hero_image_url IS
  'Direct image URL. V1 hotlinks upload.wikimedia.org; V1.2 migrates to Supabase Storage.';
COMMENT ON COLUMN public.venue_directory.hero_image_attribution IS
  'Display string credited under each hero photo, e.g. "Photo: <author> via Wikimedia Commons, CC-BY-SA 4.0". Required by CC-BY license terms.';
COMMENT ON COLUMN public.venue_directory.hero_image_license IS
  'License code (CC-BY-SA-X.Y / CC-BY-X.Y / CC0-1.0 / PD / press-kit / owner-uploaded). Renderer maps to the canonical license URL.';
COMMENT ON COLUMN public.venue_directory.hero_image_source_url IS
  'Source page URL (Wikimedia file page, press kit page, etc.) linked from the attribution per CC source-link requirements.';

-- ----------------------------------------------------------------------------
-- 3. Seed — 18 verified Wikimedia Commons hero photos
-- ----------------------------------------------------------------------------

-- ══════════════════ CATHOLIC — NCR HERITAGE ══════════════════

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Manila%2C_Filipinas%2C_2023-08-26%2C_DD_21.jpg',
  hero_image_attribution = 'Photo: Diego Delso via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Catedral_de_la_Inmaculada_Concepci%C3%B3n,_Manila,_Filipinas,_2023-08-26,_DD_21.jpg'
WHERE slug = 'manila-cathedral';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/9/98/San_Agustin_Church_2024-05-19.jpg',
  hero_image_attribution = 'Photo: LMP 2001 via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:San_Agustin_Church_2024-05-19.jpg'
WHERE slug = 'san-agustin-church';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/6/67/Allan_Jay_Quesada-_Quiapo_Church_DSC_0065_The_Minor_Basilica_of_the_Black_Nazarene_or_Quiapo_Church%2C_Manila.JPG',
  hero_image_attribution = 'Photo: Allan Jay Quesada via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Allan_Jay_Quesada-_Quiapo_Church_DSC_0065_The_Minor_Basilica_of_the_Black_Nazarene_or_Quiapo_Church,_Manila.JPG'
WHERE slug = 'quiapo-church';

-- ══════════════════ CATHOLIC — NCR MODERN ══════════════════

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/8/89/Santodomingochurchjf2225.JPG',
  hero_image_attribution = 'Photo: Ramon FVelasquez via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Santodomingochurchjf2225.JPG'
WHERE slug = 'sto-domingo-church';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/f/fe/SacredHeartParishKamuningjf0940_05.JPG',
  hero_image_attribution = 'Photo: Ramon FVelasquez via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:SacredHeartParishKamuningjf0940_05.JPG'
WHERE slug = 'sacred-heart-cubao';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/2/21/6033Christ_the_King_Parish_Church_Greenmeadows_01.jpg',
  hero_image_attribution = 'Photo: Judgefloro via Wikimedia Commons, Public Domain (CC0)',
  hero_image_license     = 'CC0-1.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:6033Christ_the_King_Parish_Church_Greenmeadows_01.jpg'
WHERE slug = 'christ-the-king-greenmeadows';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/f/fa/SantuariodeSanJosejf0250_01.JPG',
  hero_image_attribution = 'Photo: Ramon FVelasquez via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:SantuariodeSanJosejf0250_01.JPG'
WHERE slug = 'santuario-de-san-jose-greenhills';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/4/45/GuadalupeShrinejf3045_06.JPG',
  hero_image_attribution = 'Photo: Ramon FVelasquez via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:GuadalupeShrinejf3045_06.JPG'
WHERE slug = 'our-lady-of-guadalupe-makati';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/3/30/Basilica_of_the_National_Shrine_of_Our_Lady_of_Mount_Carmel%2C_New_Manila%2C_Quezon_City%2C_April_2022.jpg',
  hero_image_attribution = 'Photo: Ralff Nestor Nacor via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Basilica_of_the_National_Shrine_of_Our_Lady_of_Mount_Carmel,_New_Manila,_Quezon_City,_April_2022.jpg'
WHERE slug = 'mt-carmel-shrine-new-manila';

-- ══════════════════ CATHOLIC — TAGAYTAY / BATANGAS ══════════════════

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Phils_Tagaytay_Convent_of_Divine_Mercy_%28Pink_Sisters%29.JPG',
  hero_image_attribution = 'Photo: Ryme26 via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Phils_Tagaytay_Convent_of_Divine_Mercy_(Pink_Sisters).JPG'
WHERE slug = 'pink-sisters-tagaytay';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/6/64/Chapel_of_Transfiguration_Facade.jpg',
  hero_image_attribution = 'Photo: Lucidoadrian via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Chapel_of_Transfiguration_Facade.jpg'
WHERE slug = 'caleruega-church';

-- ══════════════════ CATHOLIC — VISAYAS / MINDANAO ══════════════════

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/8/87/Cebu_Metropolitan_Cathedral_front_view_Cebu_City.JPG',
  hero_image_attribution = 'Photo: Nickrds09 via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Cebu_Metropolitan_Cathedral_front_view_Cebu_City.JPG'
WHERE slug = 'cebu-metropolitan-cathedral';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/9/96/Basilica_Minore_del_Santo_Ni%C3%B1o_de_Cebu_%28Osme%C3%B1a_Boulevard%2C_Cebu_City%3B_09-05-2022%29.jpg',
  hero_image_attribution = 'Photo: Patrickroque01 via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Basilica_Minore_del_Santo_Ni%C3%B1o_de_Cebu_(Osme%C3%B1a_Boulevard,_Cebu_City;_09-05-2022).jpg'
WHERE slug = 'santo-nino-basilica-cebu';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Facade_of_Jaro_Cathedral_in_Iloilo_City%2C_Philippines.jpg',
  hero_image_attribution = 'Photo: Eduardojr5 via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Facade_of_Jaro_Cathedral_in_Iloilo_City,_Philippines.jpg'
WHERE slug = 'iloilo-cathedral';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/6/64/Phils_Davao_City_San_Pedro_Cathedral.JPG',
  hero_image_attribution = 'Photo: Ryme26 via Wikimedia Commons, CC-BY-SA 3.0',
  hero_image_license     = 'CC-BY-SA-3.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Phils_Davao_City_San_Pedro_Cathedral.JPG'
WHERE slug = 'davao-cathedral';

-- ══════════════════ INC ══════════════════

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Iglesia_ni_Cristo_%2834381678065%29.jpg',
  hero_image_attribution = 'Photo: Andrew Moore via Wikimedia Commons, CC-BY-SA 2.0',
  hero_image_license     = 'CC-BY-SA-2.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Iglesia_ni_Cristo_(34381678065).jpg'
WHERE slug = 'inc-central-office-quezon-city';

-- ══════════════════ MOSQUES ══════════════════

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/8/86/Manila_Golden_Mosque_%28Quiapo%2C_Manila%3B_2015-07-16%29_02.jpg',
  hero_image_attribution = 'Photo: Patrickroque01 via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Manila_Golden_Mosque_(Quiapo,_Manila;_2015-07-16)_02.jpg'
WHERE slug = 'manila-golden-mosque';

UPDATE public.venue_directory SET
  hero_image_url         = 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Grand_Mosque_of_Marawi.jpg',
  hero_image_attribution = 'Photo: Liem25 via Wikimedia Commons, CC-BY-SA 4.0',
  hero_image_license     = 'CC-BY-SA-4.0',
  hero_image_source_url  = 'https://commons.wikimedia.org/wiki/File:Grand_Mosque_of_Marawi.jpg'
WHERE slug = 'marawi-grand-mosque';

COMMIT;
