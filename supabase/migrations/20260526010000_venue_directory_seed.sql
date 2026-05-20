-- ============================================================================
-- 20260526000000_venue_directory_seed.sql
--
-- V1 read-only directory of known PH wedding venues, used by the marketplace
-- PairedVenuePanel (apps/web/app/vendors/_components/paired-venue-panel.tsx)
-- to recommend ceremony venues near a couple's reception anchor.
--
-- Why this is a separate table (not vendor_profiles):
--   • vendor_profiles.user_id is NOT NULL UNIQUE — every row needs a real
--     auth.users owner. Seeding 50 placeholders would need 50 fake user
--     accounts, polluting the auth table with non-bookable rows.
--   • Venues need a different schema in V1.2 anyway (per-location calendar,
--     day-rates, capacity tiers) — see Vendor_Taxonomy_V1_Master.md § 9
--     line 541. Adding those columns onto vendor_profiles muddles two
--     models.
--   • V1 directory entries are INFORMATIONAL only — couples can't book or
--     contact venues through Setnayan until V1.2 ships the bookable
--     iteration. The directory powers the "Ceremony venues near your
--     reception" recommendation panel + the planning context.
--
-- V1.2 migration path: when the dedicated venue marketplace ships, this
-- table either gets ALTER'd into the new schema, OR rows migrate via a
-- copy script. The slug + lat/lng are the stable join key in either case.
--
-- Owner-validation note: this seed list is the FIRST PASS. Owner reviews
-- the rows on PR open and adjusts. The full list aims for top wedding
-- regions (NCR · Tagaytay · Batangas · Cebu · Boracay · Bohol · Davao) +
-- coverage across the 5 faith categories. Religious venues use the
-- ceremony_type enum values for compatible_ceremony_types[].
--
-- Idempotent (all INSERTs use ON CONFLICT (slug) DO NOTHING).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. venue_directory_type enum
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.venue_directory_type AS ENUM (
    -- Ceremony venues
    'catholic_church',
    'christian_church',
    'inc_chapel',
    'mosque',
    'cultural_site',
    'civil_registrar',
    -- Reception venues (also can host combined-venue weddings except hotel_ballroom)
    'hotel_ballroom',
    'garden',
    'beach',
    'destination_resort',
    'heritage',
    'outdoor_tent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. venue_directory table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.venue_directory (
  venue_directory_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 80),
  name                      TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 200),
  venue_type                public.venue_directory_type NOT NULL,
  location_city             TEXT NOT NULL
    CHECK (length(location_city) BETWEEN 1 AND 100),
  hq_address                TEXT
    CHECK (hq_address IS NULL OR length(hq_address) BETWEEN 1 AND 500),
  hq_latitude               NUMERIC(10, 7) NOT NULL
    CHECK (hq_latitude BETWEEN -90 AND 90),
  hq_longitude              NUMERIC(10, 7) NOT NULL
    CHECK (hq_longitude BETWEEN -180 AND 180),
  compatible_ceremony_types TEXT[] NOT NULL DEFAULT '{}',
  source_note               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venue_directory_coords_idx
  ON public.venue_directory (hq_latitude, hq_longitude);

CREATE INDEX IF NOT EXISTS venue_directory_type_idx
  ON public.venue_directory (venue_type);

CREATE INDEX IF NOT EXISTS venue_directory_compatible_ceremony_types_idx
  ON public.venue_directory USING GIN (compatible_ceremony_types);

COMMENT ON TABLE public.venue_directory IS
  'V1 read-only directory of known PH wedding venues. Powers the '
  'PairedVenuePanel recommendation engine. V1.2 venue iteration migrates '
  'these rows to a bookable schema with per-location calendars + day-rates.';

COMMENT ON COLUMN public.venue_directory.compatible_ceremony_types IS
  'Subset of `public.ceremony_type` enum values this venue can host. '
  'Religious venues are restricted to their faith (e.g. catholic_church → '
  '[''catholic'']). Reception venues that work for any ceremony are open '
  '(empty array OR all values).';

-- ----------------------------------------------------------------------------
-- 3. RLS — anon + auth read; admin write
-- ----------------------------------------------------------------------------

ALTER TABLE public.venue_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_directory_read_all ON public.venue_directory;
CREATE POLICY venue_directory_read_all
  ON public.venue_directory FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS venue_directory_admin_write ON public.venue_directory;
CREATE POLICY venue_directory_admin_write
  ON public.venue_directory FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal = TRUE)
    )
  );

-- ----------------------------------------------------------------------------
-- 4. SEED — first-pass PH wedding venue directory (owner validates on PR)
--
-- Coordinates: approximate centers from public mapping data. Owner /
-- admin can override individual rows via UPDATE before V1 launch. The
-- haversine distance math is tolerant of ~50m drift, which is what
-- city-center coords typically resolve to.
--
-- Regions covered: NCR · Tagaytay · Cavite · Batangas · Cebu · Mactan ·
-- Bohol · Boracay · Davao. Coverage gaps acknowledged: Iloilo, Bacolod,
-- Baguio, CDO, Zamboanga — add in follow-up PRs once recruitment maps
-- those regions.
-- ----------------------------------------------------------------------------

INSERT INTO public.venue_directory
  (slug, name, venue_type, location_city, hq_address, hq_latitude, hq_longitude, compatible_ceremony_types, source_note)
VALUES
  -- ══════════════════ CATHOLIC CHURCHES — NCR ══════════════════
  ('manila-cathedral', 'Manila Cathedral', 'catholic_church', 'Manila',
   'Plaza Roma, Intramuros, Manila', 14.5919, 120.9742,
   ARRAY['catholic'], 'Archdiocesan cathedral — Intramuros'),

  ('san-agustin-church', 'San Agustin Church', 'catholic_church', 'Manila',
   'General Luna St, Intramuros, Manila', 14.5891, 120.9747,
   ARRAY['catholic'], 'UNESCO heritage Augustinian church'),

  ('quiapo-church', 'Minor Basilica of the Black Nazarene (Quiapo Church)', 'catholic_church', 'Manila',
   'Plaza Miranda, Quiapo, Manila', 14.5972, 120.9831,
   ARRAY['catholic'], NULL),

  ('sto-domingo-church', 'Sto. Domingo Church', 'catholic_church', 'Quezon City',
   'Quezon Avenue, Quezon City', 14.6233, 121.0286,
   ARRAY['catholic'], 'National Shrine of Our Lady of the Most Holy Rosary'),

  ('sacred-heart-cubao', 'Sacred Heart Parish — Cubao', 'catholic_church', 'Quezon City',
   '11th Avenue, Cubao, Quezon City', 14.6196, 121.0586,
   ARRAY['catholic'], NULL),

  ('christ-the-king-greenmeadows', 'Christ the King Parish — Greenmeadows', 'catholic_church', 'Quezon City',
   'Greenmeadows Avenue, Quezon City', 14.6076, 121.0573,
   ARRAY['catholic'], NULL),

  ('mary-the-queen-greenhills', 'Mary the Queen Parish — Greenhills', 'catholic_church', 'San Juan',
   'Greenhills, San Juan', 14.6029, 121.0489,
   ARRAY['catholic'], NULL),

  ('our-lady-of-guadalupe-makati', 'National Shrine of Our Lady of Guadalupe', 'catholic_church', 'Makati',
   'Guadalupe Viejo, Makati', 14.5613, 121.0467,
   ARRAY['catholic'], NULL),

  ('santuario-de-san-jose-greenhills', 'Santuario de San Jose Parish', 'catholic_church', 'San Juan',
   'Aurora Boulevard, Greenhills, San Juan', 14.6004, 121.0438,
   ARRAY['catholic'], NULL),

  ('mt-carmel-shrine-new-manila', 'Mt. Carmel Shrine — New Manila', 'catholic_church', 'Quezon City',
   'Broadway Avenue, New Manila, Quezon City', 14.6118, 121.0317,
   ARRAY['catholic'], NULL),

  -- ══════════════════ CATHOLIC CHURCHES — Tagaytay / Cavite / Batangas ══════════════════
  ('pink-sisters-tagaytay', 'Pink Sisters Convent — Tagaytay', 'catholic_church', 'Tagaytay',
   'Calamba Road, Tagaytay', 14.0856, 120.9203,
   ARRAY['catholic'], 'Holy Spirit Adoration sisters chapel'),

  ('st-anthony-parish-tagaytay', 'Saint Anthony Parish — Tagaytay', 'catholic_church', 'Tagaytay',
   'Tagaytay City', 14.0945, 120.9320,
   ARRAY['catholic'], NULL),

  ('our-lady-of-manaoag-tagaytay', 'Our Lady of Manaoag Chapel — Tagaytay', 'catholic_church', 'Tagaytay',
   'Tagaytay City', 14.1156, 120.9572,
   ARRAY['catholic'], 'Replica shrine of Pangasinan original'),

  ('caleruega-church', 'Caleruega — Transfiguration Chapel', 'catholic_church', 'Batangas',
   'Batulao, Nasugbu, Batangas', 14.1208, 120.7625,
   ARRAY['catholic'], 'Dominican retreat house chapel'),

  ('pico-de-loro-chapel', 'Pico de Loro Chapel', 'catholic_church', 'Batangas',
   'Hamilo Coast, Nasugbu, Batangas', 14.1933, 120.6481,
   ARRAY['catholic'], NULL),

  -- ══════════════════ CATHOLIC CHURCHES — Cebu / Visayas ══════════════════
  ('cebu-metropolitan-cathedral', 'Cebu Metropolitan Cathedral', 'catholic_church', 'Cebu City',
   'P. Burgos Street, Cebu City', 10.2952, 123.9019,
   ARRAY['catholic'], NULL),

  ('santo-nino-basilica-cebu', 'Basilica Minore del Santo Niño', 'catholic_church', 'Cebu City',
   'Osmeña Boulevard, Cebu City', 10.2935, 123.9021,
   ARRAY['catholic'], 'Oldest Catholic church in the Philippines'),

  ('iloilo-cathedral', 'Jaro Metropolitan Cathedral', 'catholic_church', 'Iloilo City',
   'Jaro, Iloilo City', 10.7367, 122.5644,
   ARRAY['catholic'], NULL),

  -- ══════════════════ CATHOLIC CHURCHES — Davao / Mindanao ══════════════════
  ('davao-cathedral', 'San Pedro Cathedral — Davao', 'catholic_church', 'Davao City',
   'San Pedro Street, Davao City', 7.0682, 125.6094,
   ARRAY['catholic'], NULL),

  -- ══════════════════ INC CHAPELS ══════════════════
  ('inc-central-office-quezon-city', 'INC Central Office', 'inc_chapel', 'Quezon City',
   'Central Office, Quezon City', 14.6491, 121.0509,
   ARRAY['inc'], 'Iglesia ni Cristo administrative HQ — local weddings'),

  ('inc-locale-manila-lambert', 'INC Local of Maluwalhating Bayan ng Lipa', 'inc_chapel', 'Manila',
   'Lambert, Manila', 14.5995, 120.9842,
   ARRAY['inc'], NULL),

  ('inc-locale-quezon-city', 'INC Local of Cubao', 'inc_chapel', 'Quezon City',
   'Cubao, Quezon City', 14.6760, 121.0437,
   ARRAY['inc'], NULL),

  -- ══════════════════ MOSQUES ══════════════════
  ('manila-golden-mosque', 'Manila Golden Mosque', 'mosque', 'Manila',
   'Globo de Oro St, Quiapo, Manila', 14.5994, 120.9831,
   ARRAY['muslim'], 'Largest mosque in NCR'),

  ('marawi-grand-mosque', 'Marawi Grand Mosque', 'mosque', 'Marawi',
   'Marawi City, Lanao del Sur', 8.0078, 124.2942,
   ARRAY['muslim'], NULL),

  ('cotabato-grand-mosque', 'Sultan Haji Hassanal Bolkiah Masjid (Cotabato Grand Mosque)', 'mosque', 'Cotabato',
   'Cotabato City', 7.2236, 124.2486,
   ARRAY['muslim'], NULL),

  -- ══════════════════ CHRISTIAN CHURCHES ══════════════════
  ('ccf-pasig', 'Christ''s Commission Fellowship — Ortigas', 'christian_church', 'Pasig',
   'Ortigas Center, Pasig', 14.5708, 121.0772,
   ARRAY['christian'], 'Evangelical megachurch'),

  ('victory-fort-bgc', 'Victory Christian Fellowship — Fort BGC', 'christian_church', 'Taguig',
   'Bonifacio Global City, Taguig', 14.5500, 121.0518,
   ARRAY['christian'], NULL),

  ('jil-mandaluyong', 'Jesus is Lord — Mandaluyong', 'christian_church', 'Mandaluyong',
   'Mandaluyong', 14.5867, 121.0432,
   ARRAY['christian'], NULL),

  -- ══════════════════ HOTEL BALLROOMS — Manila ══════════════════
  ('manila-marriott-hotel', 'Manila Marriott Hotel', 'hotel_ballroom', 'Pasay',
   'Newport Boulevard, Pasay', 14.5208, 121.0156,
   ARRAY[]::TEXT[], 'Newport City, near NAIA T3'),

  ('solaire-resort-manila', 'Solaire Resort & Casino', 'hotel_ballroom', 'Parañaque',
   'Entertainment City, Parañaque', 14.5358, 120.9836,
   ARRAY[]::TEXT[], 'Sky Tower Grand Ballroom'),

  ('conrad-manila', 'Conrad Manila', 'hotel_ballroom', 'Pasay',
   'Mall of Asia Complex, Pasay', 14.5544, 120.9856,
   ARRAY[]::TEXT[], NULL),

  ('shangri-la-fort', 'Shangri-La at the Fort', 'hotel_ballroom', 'Taguig',
   '30th Street, Bonifacio Global City, Taguig', 14.5494, 121.0508,
   ARRAY[]::TEXT[], NULL),

  ('peninsula-manila', 'The Peninsula Manila', 'hotel_ballroom', 'Makati',
   'Ayala Avenue, Makati', 14.5587, 121.0234,
   ARRAY[]::TEXT[], 'Rigodon Ballroom'),

  ('manila-hotel', 'The Manila Hotel', 'hotel_ballroom', 'Manila',
   'One Rizal Park, Manila', 14.5897, 120.9722,
   ARRAY[]::TEXT[], 'Historic Centennial Hall'),

  ('sofitel-philippine-plaza', 'Sofitel Philippine Plaza', 'hotel_ballroom', 'Pasay',
   'CCP Complex, Pasay', 14.5556, 120.9802,
   ARRAY[]::TEXT[], 'Grand Plaza Ballroom'),

  ('diamond-hotel', 'Diamond Hotel Philippines', 'hotel_ballroom', 'Manila',
   'Roxas Boulevard, Manila', 14.5749, 120.9839,
   ARRAY[]::TEXT[], NULL),

  -- ══════════════════ HOTEL BALLROOMS — Tagaytay ══════════════════
  ('tagaytay-marriott-hotel', 'Tagaytay Marriott Hotel', 'hotel_ballroom', 'Tagaytay',
   'Aguinaldo Highway, Tagaytay', 14.0786, 120.9619,
   ARRAY[]::TEXT[], NULL),

  ('taal-vista-hotel', 'Taal Vista Hotel', 'hotel_ballroom', 'Tagaytay',
   'Aguinaldo Highway, Tagaytay', 14.0866, 120.9405,
   ARRAY[]::TEXT[], 'Tagaytay landmark — Taal Lake view'),

  ('twin-lakes-tagaytay', 'Twin Lakes Hotel', 'hotel_ballroom', 'Tagaytay',
   'Laurel, Batangas (near Tagaytay)', 14.0997, 120.9344,
   ARRAY[]::TEXT[], NULL),

  -- ══════════════════ HOTEL BALLROOMS — Cebu / Mactan ══════════════════
  ('cebu-marriott-hotel', 'Cebu Marriott Hotel', 'hotel_ballroom', 'Cebu City',
   'Cebu Business Park, Cebu City', 10.3268, 123.9039,
   ARRAY[]::TEXT[], NULL),

  ('shangri-la-mactan', 'Shangri-La''s Mactan Resort & Spa', 'destination_resort', 'Mactan',
   'Punta Engaño, Lapu-Lapu City', 10.3128, 124.0167,
   ARRAY['catholic', 'christian', 'civil'], 'Beachfront chapel + ballroom'),

  ('crimson-mactan', 'Crimson Resort & Spa Mactan', 'destination_resort', 'Mactan',
   'Mactan, Lapu-Lapu City', 10.3083, 124.0292,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  -- ══════════════════ GARDEN VENUES ══════════════════
  ('antonios-garden-tagaytay', 'Antonio''s Garden — Tagaytay', 'garden', 'Tagaytay',
   'Purok 138, Barangay Neogan, Tagaytay', 14.0856, 120.9219,
   ARRAY['catholic', 'christian', 'civil'], 'Garden ceremony + reception'),

  ('sonyas-garden-tagaytay', 'Sonya''s Garden — Tagaytay', 'garden', 'Tagaytay',
   'Buck Estate, Alfonso, Cavite', 14.0989, 120.9389,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  ('hillcreek-gardens-tagaytay', 'Hillcreek Gardens — Tagaytay', 'garden', 'Tagaytay',
   'Brgy. Pulong Saging, Tagaytay', 14.0961, 120.9067,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  ('glass-garden-pasig', 'Glass Garden — Pasig', 'garden', 'Pasig',
   'C. Raymundo Avenue, Pasig', 14.5750, 121.0825,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  -- ══════════════════ BEACH / DESTINATION ══════════════════
  ('shangri-la-boracay', 'Shangri-La''s Boracay Resort & Spa', 'beach', 'Boracay',
   'Punta Bunga, Boracay Island, Aklan', 11.9722, 121.9217,
   ARRAY['catholic', 'christian', 'civil'], 'Beachfront wedding pavilion'),

  ('henann-regency-boracay', 'Henann Regency Resort & Spa', 'beach', 'Boracay',
   'Station 2, White Beach, Boracay', 11.9613, 121.9244,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  ('pico-sands-hotel', 'Pico Sands Hotel', 'beach', 'Batangas',
   'Hamilo Coast, Nasugbu, Batangas', 14.1936, 120.6489,
   ARRAY['catholic', 'christian', 'civil'], 'Pico de Loro Cove beach venue'),

  ('eskaya-bohol', 'Eskaya Beach Resort & Spa', 'destination_resort', 'Bohol',
   'Panglao Island, Bohol', 9.6253, 124.3614,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  ('anvaya-cove-bataan', 'Anvaya Cove', 'beach', 'Bataan',
   'Morong, Bataan', 14.7556, 120.2381,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  -- ══════════════════ HERITAGE / HACIENDA ══════════════════
  ('las-casas-filipinas-bataan', 'Las Casas Filipinas de Acuzar', 'heritage', 'Bataan',
   'Bagac, Bataan', 14.7167, 120.2861,
   ARRAY['catholic', 'christian', 'civil'], 'Heritage village with chapel'),

  ('hacienda-isabella-cavite', 'Hacienda Isabella', 'heritage', 'Cavite',
   'Indang, Cavite', 14.1933, 120.8956,
   ARRAY['catholic', 'christian', 'civil'], NULL),

  ('casino-espanol-cebu', 'Casino Español de Cebu', 'heritage', 'Cebu City',
   'V. Ranudo Street, Cebu City', 10.2961, 123.9018,
   ARRAY[]::TEXT[], NULL),

  -- ══════════════════ CIVIL REGISTRARS (top LGUs) ══════════════════
  ('manila-city-hall-registrar', 'Manila City Hall — Civil Registrar', 'civil_registrar', 'Manila',
   'Manila City Hall, Padre Burgos Avenue, Manila', 14.5907, 120.9819,
   ARRAY['civil'], NULL),

  ('quezon-city-hall-registrar', 'Quezon City Hall — Civil Registrar', 'civil_registrar', 'Quezon City',
   'Quezon City Hall, Elliptical Road, Quezon City', 14.6510, 121.0496,
   ARRAY['civil'], NULL),

  ('makati-city-hall-registrar', 'Makati City Hall — Civil Registrar', 'civil_registrar', 'Makati',
   'Makati City Hall, J.P. Rizal Extension, Makati', 14.5547, 121.0224,
   ARRAY['civil'], NULL),

  ('cebu-city-hall-registrar', 'Cebu City Hall — Civil Registrar', 'civil_registrar', 'Cebu City',
   'Cebu City Hall, M.C. Briones Street, Cebu City', 10.2941, 123.9019,
   ARRAY['civil'], NULL),

  ('davao-city-hall-registrar', 'Davao City Hall — Civil Registrar', 'civil_registrar', 'Davao City',
   'San Pedro Street, Davao City', 7.0656, 125.6086,
   ARRAY['civil'], NULL)

ON CONFLICT (slug) DO NOTHING;

COMMIT;
