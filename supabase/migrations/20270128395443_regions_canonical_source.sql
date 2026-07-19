-- Migration: 20270128395443_regions_canonical_source.sql
-- Canonical PH region taxonomy — single source of truth for the 4 incompatible
-- region spellings scattered across the app (owner-approved 2026-06-19).
--
-- BEFORE: no regions table. Four vocabularies disagree —
--   V1 onboarding hyphen slugs   (events.region · actions.ts / onboarding-shell.tsx)  'c-visayas','c-luzon','n-mindanao','cagayan','abroad'
--   V2 match-criteria underscore (lib/match-criteria.ts REGION_OPTIONS)               'central_visayas','central_luzon','northern_mindanao','cagayan_valley','outside_ph'
--   V3 PSGC codes                (vendor_profiles.hq_region · lib/regions.ts)         'NCR','VII','III'...'BARMM','NIR'
--   V4 wedding-cities rk         (_data/wedding-cities.ts)                            'cagayan-valley' (4th spelling, re-normalized to 'cagayan' by resolvePick)
--   + burn bands hand-maintained over three of those in lib/v2/region-token-burn.ts.
--
-- AFTER: public.regions = one canonical row per region (slug = the V1 hyphen slug),
-- with aliases[] absorbing every other spelling; public.wedding_destinations =
-- the curated city carousel keyed to regions.slug.
--
-- ADDITIVE + IDEMPOTENT — CREATE TABLE IF NOT EXISTS + ON CONFLICT seeds. Does
-- NOT drop the TS consts; deployed code keeps working until each consumer is
-- migrated to read through lib/region-source.ts. RLS at CREATE TABLE time:
-- public read (anon + authenticated), admin write — mirrors public.venue_directory.

-- ============================================================================
-- 1. public.regions — canonical region taxonomy
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.regions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,           -- canonical = V1 onboarding hyphen slug ('c-visayas')
  psgc_code       TEXT UNIQUE,                    -- PSGC code ('VII'); NULL for the non-scopable 'abroad' row
  display_label   TEXT NOT NULL,                  -- short friendly label ('Central Visayas')
  descriptor      TEXT,                           -- long picker descriptor ('VII · Central Visayas (Cebu, Bohol, Panglao, Dumaguete)')
  aliases         TEXT[] NOT NULL DEFAULT '{}',   -- every other spelling that resolves here (underscore variant, 'cagayan-valley', psgc code, 'outside_ph', etc.) — stored lower-cased
  burn_band       SMALLINT NOT NULL DEFAULT 1 CHECK (burn_band BETWEEN 1 AND 3), -- 1/2/3 = ₱100/₱200/₱300, lifted from BURN_BAND_REGIONS
  centroid_lat    DOUBLE PRECISION,               -- from REGION_CENTROID (fallback coords)
  centroid_lon    DOUBLE PRECISION,
  sort_order      INTEGER NOT NULL DEFAULT 999,   -- PH_REGIONS order: NCR first, PSGC numeric, BARMM+NIR last
  is_scopable     BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE for 'abroad' (no region scope / show full pool)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index so alias lookups (slug = ANY / aliases @> ARRAY[...]) stay fast.
CREATE INDEX IF NOT EXISTS regions_aliases_gin ON public.regions USING GIN (aliases);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regions_read_all ON public.regions;
CREATE POLICY regions_read_all
  ON public.regions FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS regions_admin_write ON public.regions;
CREATE POLICY regions_admin_write
  ON public.regions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u
            WHERE u.user_id = auth.uid()
              AND (u.account_type = 'admin' OR u.is_internal = TRUE))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u
            WHERE u.user_id = auth.uid()
              AND (u.account_type = 'admin' OR u.is_internal = TRUE))
  );

-- ---- seed (canonical slug, psgc, label, descriptor, aliases[], band, lat, lon, sort, scopable) ----
-- aliases collapse the 4 spellings: underscore variant + 'cagayan-valley' (V4) + psgc code itself + 'outside_ph'.
INSERT INTO public.regions
  (slug, psgc_code, display_label, descriptor, aliases, burn_band, centroid_lat, centroid_lon, sort_order, is_scopable)
VALUES
  ('ncr',          'NCR',  'Metro Manila',       'NCR · Metro Manila',
     ARRAY['ncr']::TEXT[],                                              3, 14.58, 121.00,  1, TRUE),
  ('car',          'CAR',  'Cordillera (CAR)',   'CAR · Cordillera (Baguio, La Trinidad, Sagada, Banaue)',
     ARRAY['car']::TEXT[],                                              2, 16.90, 120.90,  2, TRUE),
  ('ilocos',       'I',    'Ilocos Region',      'I · Ilocos Region (Vigan, Laoag, Dagupan)',
     ARRAY['i','ilocos']::TEXT[],                                       2, 17.40, 120.50,  3, TRUE),
  ('cagayan',      'II',   'Cagayan Valley',     'II · Cagayan Valley (Tuguegarao, Santiago)',
     ARRAY['ii','cagayan_valley','cagayan-valley']::TEXT[],             2, 17.30, 121.80,  4, TRUE),
  ('c-luzon',      'III',  'Central Luzon',      'III · Central Luzon (Pampanga, Bulacan, Tarlac, Subic)',
     ARRAY['iii','central_luzon']::TEXT[],                              3, 15.30, 120.60,  5, TRUE),
  ('calabarzon',   'IV-A', 'CALABARZON',         'IV-A · CALABARZON (Tagaytay, Cavite, Laguna, Batangas, Rizal, Quezon)',
     ARRAY['iv-a','calabarzon']::TEXT[],                                3, 14.20, 121.30,  6, TRUE),
  ('mimaropa',     'IV-B', 'MIMAROPA',           'IV-B · MIMAROPA (Palawan, Coron, El Nido, Mindoro)',
     ARRAY['iv-b','mimaropa']::TEXT[],                                  2, 12.00, 120.80,  7, TRUE),
  ('bicol',        'V',    'Bicol Region',       'V · Bicol (Legazpi, Naga, Sorsogon)',
     ARRAY['v','bicol']::TEXT[],                                        1, 13.40, 123.40,  8, TRUE),
  ('w-visayas',    'VI',   'Western Visayas',    'VI · Western Visayas (Iloilo, Bacolod, Boracay, Aklan)',
     ARRAY['vi','western_visayas']::TEXT[],                             2, 10.90, 122.60,  9, TRUE),
  ('c-visayas',    'VII',  'Central Visayas',    'VII · Central Visayas (Cebu, Bohol, Panglao, Dumaguete)',
     ARRAY['vii','central_visayas']::TEXT[],                            2, 10.00, 123.60, 10, TRUE),
  ('e-visayas',    'VIII', 'Eastern Visayas',    'VIII · Eastern Visayas (Tacloban, Ormoc)',
     ARRAY['viii','eastern_visayas']::TEXT[],                           1, 11.40, 124.90, 11, TRUE),
  ('zamboanga',    'IX',   'Zamboanga Peninsula','IX · Zamboanga Peninsula (Zamboanga, Dipolog)',
     ARRAY['ix','zamboanga']::TEXT[],                                   1,  7.80, 122.50, 12, TRUE),
  ('n-mindanao',   'X',    'Northern Mindanao',  'X · Northern Mindanao (Cagayan de Oro, Iligan, Malaybalay)',
     ARRAY['x','northern_mindanao']::TEXT[],                            2,  8.30, 124.70, 13, TRUE),
  ('davao',        'XI',   'Davao Region',       'XI · Davao Region (Davao City, Tagum, Digos)',
     ARRAY['xi','davao']::TEXT[],                                       2,  7.10, 125.60, 14, TRUE),
  ('soccsksargen', 'XII',  'SOCCSKSARGEN',       'XII · SOCCSKSARGEN (General Santos, Koronadal, Cotabato City)',
     ARRAY['xii','soccsksargen']::TEXT[],                               1,  6.30, 124.80, 15, TRUE),
  ('caraga',       'XIII', 'Caraga',             'XIII · Caraga (Butuan, Surigao)',
     ARRAY['xiii','caraga']::TEXT[],                                    1,  9.20, 125.80, 16, TRUE),
  ('barmm',        'BARMM','Bangsamoro (BARMM)', 'BARMM · Bangsamoro (Marawi, Cotabato, Sulu, Tawi-Tawi)',
     ARRAY['barmm']::TEXT[],                                            1,  6.50, 122.00, 17, TRUE),
  ('nir',          'NIR',  'Negros Island Region','NIR · Negros Island Region (Bacolod, Dumaguete)',
     ARRAY['nir']::TEXT[],                                              2, 10.00, 123.00, 18, TRUE),
  ('abroad',        NULL,  'Outside the Philippines','Outside the PH',
     ARRAY['abroad','outside_ph']::TEXT[],                              1,  NULL,  NULL,  99, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. public.wedding_destinations — curated city carousel (photo + nugget)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wedding_destinations (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city_key      TEXT NOT NULL UNIQUE,            -- wedding-cities `k` ('cebu','tagaytay')
  display_name  TEXT NOT NULL,                   -- wedding-cities `n` ('Cebu City')
  region_code   TEXT NOT NULL REFERENCES public.regions(slug) ON UPDATE CASCADE,
  region_label  TEXT,                            -- wedding-cities `r` ('Cebu · Central Visayas')
  rank          INTEGER,                         -- TOP30 order / CITIES.top; NULL = searchable-only (not in carousel)
  photo_key     TEXT,                            -- public/onboarding/cities/{city_key}.webp (NULL if no real photo)
  nugget        TEXT,                            -- wedding-cities `nug`
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  city_aliases  TEXT[] NOT NULL DEFAULT '{}',    -- case-folded city spellings from CITY_TO_REGION ('cebu city','mactan','mandaue') so regionForCity() reads the DB
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wedding_destinations_region_idx ON public.wedding_destinations (region_code);
CREATE INDEX IF NOT EXISTS wedding_destinations_rank_idx   ON public.wedding_destinations (rank) WHERE rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS wedding_destinations_aliases_gin ON public.wedding_destinations USING GIN (city_aliases);

ALTER TABLE public.wedding_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wedding_destinations_read_all ON public.wedding_destinations;
CREATE POLICY wedding_destinations_read_all
  ON public.wedding_destinations FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS wedding_destinations_admin_write ON public.wedding_destinations;
CREATE POLICY wedding_destinations_admin_write
  ON public.wedding_destinations FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u
            WHERE u.user_id = auth.uid()
              AND (u.account_type = 'admin' OR u.is_internal = TRUE))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u
            WHERE u.user_id = auth.uid()
              AND (u.account_type = 'admin' OR u.is_internal = TRUE))
  );

-- ---- seed (city_key, name, region_code [CANONICAL slug — 'cagayan-valley' collapsed to 'cagayan'], region_label, rank, photo_key, nugget, lat, lon) ----
-- rank = TOP30 1-based index; carousel-only photos exist for the TOP30.
INSERT INTO public.wedding_destinations
  (city_key, display_name, region_code, region_label, rank, photo_key, nugget, lat, lon)
VALUES
  ('tagaytay','Tagaytay','calabarzon','Cavite · CALABARZON',1,'onboarding/cities/tagaytay.webp','Cool-climate gardens & ridges over Taal — the metro''s favorite weekend wedding escape.',14.106,120.962),
  ('cebu','Cebu City','c-visayas','Cebu · Central Visayas',2,'onboarding/cities/cebu.webp','Heritage-church vows at the Basilica, paired with island-resort receptions.',10.316,123.886),
  ('boracay','Boracay','w-visayas','Aklan · Western Visayas',3,'onboarding/cities/boracay.webp','Barefoot sunset ceremonies on White Beach — the country''s beach-wedding icon.',11.969,121.925),
  ('elnido','El Nido','mimaropa','Palawan · MIMAROPA',4,'onboarding/cities/elnido.webp','Island-hopping destination weddings on hidden lagoons and limestone coves.',11.196,119.398),
  ('baguio','Baguio','car','Benguet · CAR',5,'onboarding/cities/baguio.webp','Pine-scented gardens and cool weather all year for an intimate highland wedding.',16.402,120.596),
  ('nasugbu','Nasugbu','calabarzon','Batangas · CALABARZON',6,'onboarding/cities/nasugbu.webp','Calatagan & Nasugbu beach resorts, an easy drive south of Manila.',14.067,120.632),
  ('panglao','Panglao','c-visayas','Bohol · Central Visayas',7,'onboarding/cities/panglao.webp','White-sand beach vows near the Chocolate Hills and old stone churches.',9.578,123.749),
  ('manila','Manila','ncr','Metro Manila · NCR',8,'onboarding/cities/manila.webp','Intramuros grandeur — San Agustín Church and historic walled-city receptions.',14.599,120.984),
  ('makati','Makati','ncr','Metro Manila · NCR',9,'onboarding/cities/makati.webp','Skyline rooftops and five-star ballrooms for a polished city wedding.',14.554,121.025),
  ('vigan','Vigan','ilocos','Ilocos Sur · Ilocos',10,'onboarding/cities/vigan.webp','Spanish-colonial romance along cobblestone Calle Crisologo.',17.575,120.387),
  ('quezon-city','Quezon City','ncr','Metro Manila · NCR',11,'onboarding/cities/quezon-city.webp','Grand cathedrals and hotel ballrooms — the metro''s biggest church capacities.',14.676,121.044),
  ('taguig','Taguig · BGC','ncr','Metro Manila · NCR',12,'onboarding/cities/taguig.webp','BGC''s modern skyline venues and rooftop receptions.',14.517,121.050),
  ('davao','Davao City','davao','Davao del Sur · Davao',13,'onboarding/cities/davao.webp','Garden estates and Samal-island resorts in the south''s biggest city.',7.190,125.455),
  ('iloilo','Iloilo City','w-visayas','Iloilo · Western Visayas',14,'onboarding/cities/iloilo.webp','Heritage churches (Molo · Miag-ao) and warm Ilonggo feasts.',10.720,122.562),
  ('bacolod','Bacolod','w-visayas','Negros Occidental · W. Visayas',15,'onboarding/cities/bacolod.webp','MassKara warmth — garden and sugar-baron heritage-house weddings.',10.640,122.969),
  ('palawan','Puerto Princesa','mimaropa','Palawan · MIMAROPA',16,'onboarding/cities/palawan.webp','Underground-river country — beach and garden venues in Palawan''s capital.',9.739,118.734),
  ('coron','Coron','mimaropa','Palawan · MIMAROPA',17,'onboarding/cities/coron.webp','Limestone lagoons and shipwreck-blue water for an island-bound wedding.',12.005,120.204),
  ('siargao','Siargao · Gen. Luna','caraga','Surigao del Norte · Caraga',18,'onboarding/cities/siargao.webp','Surf-town beach weddings — laid-back, barefoot, island-cool.',9.787,126.162),
  ('dumaguete','Dumaguete','c-visayas','Negros Oriental · C. Visayas',19,'onboarding/cities/dumaguete.webp','The gentle seaside ''City of Gentle People'' — campus-town charm.',9.307,123.308),
  ('bohol','Tagbilaran · Bohol','c-visayas','Bohol · Central Visayas',20,'onboarding/cities/bohol.webp','Gateway to Panglao''s beaches and the Chocolate Hills.',9.647,123.855),
  ('mactan','Lapu-Lapu · Mactan','c-visayas','Cebu · Central Visayas',21,'onboarding/cities/mactan.webp','Island resorts off Cebu — beachfront ceremonies a causeway from the city.',10.310,123.982),
  ('subic','Subic','c-luzon','Zambales · Central Luzon',22,'onboarding/cities/subic.webp','Bayside resorts and freeport venues, two hours from Manila.',14.788,120.282),
  ('launion','San Fernando · La Union','ilocos','La Union · Ilocos',23,'onboarding/cities/launion.webp','Surf-coast sunsets up north — relaxed beach weddings in La Union.',16.615,120.319),
  ('clark','Angeles · Clark','c-luzon','Pampanga · Central Luzon',24,'onboarding/cities/clark.webp','Clark''s hotels and hangar-sized venues near the international airport.',15.168,120.586),
  ('calatagan','Calatagan','calabarzon','Batangas · CALABARZON',25,'onboarding/cities/calatagan.webp','Resort beaches and seaside chapels at Batangas'' western tip.',13.833,120.632),
  ('antipolo','Antipolo','calabarzon','Rizal · CALABARZON',26,'onboarding/cities/antipolo.webp','Hilltop chapels and garden venues with a view over the metro.',14.624,121.176),
  ('cdo','Cagayan de Oro','n-mindanao','Misamis Oriental · N. Mindanao',27,'onboarding/cities/cdo.webp','River-adventure city with riverside and hotel venues.',8.482,124.647),
  ('siquijor','Siquijor','c-visayas','Siquijor · Central Visayas',28,'onboarding/cities/siquijor.webp','Mystic-island beaches and old churches under century-old trees.',9.214,123.515),
  ('legazpi','Legazpi','bicol','Albay · Bicol',29,'onboarding/cities/legazpi.webp','Weddings framed by the perfect cone of Mayon Volcano.',13.139,123.733),
  ('sagada','Sagada','car','Mountain Province · CAR',30,'onboarding/cities/sagada.webp','Pine highlands and hanging-cliff drama for an offbeat mountain wedding.',17.083,120.900),
  -- ---- searchable-only (no carousel photo · rank NULL) ----
  ('pasig','Pasig','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.576,121.085),
  ('pasay','Pasay','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.538,120.997),
  ('mandaluyong','Mandaluyong','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.577,121.034),
  ('paranaque','Parañaque','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.479,121.020),
  ('muntinlupa','Muntinlupa · Alabang','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.408,121.042),
  ('marikina','Marikina','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.650,121.102),
  ('caloocan','Caloocan','ncr','Metro Manila · NCR',NULL,NULL,NULL,14.651,120.972),
  ('batangas','Batangas City','calabarzon','Batangas · CALABARZON',NULL,NULL,NULL,13.756,121.058),
  ('lipa','Lipa','calabarzon','Batangas · CALABARZON',NULL,NULL,NULL,13.941,121.163),
  ('calamba','Calamba','calabarzon','Laguna · CALABARZON',NULL,NULL,NULL,14.213,121.165),
  ('sta-rosa','Santa Rosa','calabarzon','Laguna · CALABARZON',NULL,NULL,NULL,14.312,121.111),
  ('dasma','Dasmariñas','calabarzon','Cavite · CALABARZON',NULL,NULL,NULL,14.329,120.937),
  ('bacoor','Bacoor','calabarzon','Cavite · CALABARZON',NULL,NULL,NULL,14.459,120.959),
  ('lucena','Lucena','calabarzon','Quezon · CALABARZON',NULL,NULL,NULL,13.931,121.617),
  ('mandaue','Mandaue','c-visayas','Cebu · Central Visayas',NULL,NULL,NULL,10.323,123.922),
  ('kalibo','Kalibo','w-visayas','Aklan · Western Visayas',NULL,NULL,NULL,11.706,122.366),
  ('roxas','Roxas · Capiz','w-visayas','Capiz · Western Visayas',NULL,NULL,NULL,11.585,122.751),
  ('laoag','Laoag','ilocos','Ilocos Norte · Ilocos',NULL,NULL,NULL,18.197,120.594),
  ('dagupan','Dagupan','ilocos','Pangasinan · Ilocos',NULL,NULL,NULL,16.043,120.333),
  ('pampanga','San Fernando · Pampanga','c-luzon','Pampanga · Central Luzon',NULL,NULL,NULL,15.034,120.689),
  ('olongapo','Olongapo','c-luzon','Zambales · Central Luzon',NULL,NULL,NULL,14.829,120.282),
  ('malolos','Malolos · Bulacan','c-luzon','Bulacan · Central Luzon',NULL,NULL,NULL,14.844,120.811),
  ('tarlac','Tarlac City','c-luzon','Tarlac · Central Luzon',NULL,NULL,NULL,15.488,120.588),
  ('baler','Baler','c-luzon','Aurora · Central Luzon',NULL,NULL,'Surf-coast Pacific sunrises on the east shore.',15.759,121.563),
  ('tuguegarao','Tuguegarao','cagayan','Cagayan · Cagayan Valley',NULL,NULL,NULL,17.613,121.727),
  ('santiago','Santiago · Isabela','cagayan','Isabela · Cagayan Valley',NULL,NULL,NULL,16.687,121.548),
  ('batanes','Basco · Batanes','cagayan','Batanes · Cagayan Valley',NULL,NULL,'Rolling hills, stone houses and cliff-edge chapels — the country''s northern frontier.',20.448,121.970),
  ('naga','Naga','bicol','Camarines Sur · Bicol',NULL,NULL,'Pilgrim-city churches and Mt. Isarog garden venues.',13.619,123.181),
  ('caramoan','Caramoan','bicol','Camarines Sur · Bicol',NULL,NULL,'Dramatic limestone islets for a castaway-chic celebration.',13.770,123.862),
  ('sorsogon','Sorsogon City','bicol','Sorsogon · Bicol',NULL,NULL,NULL,12.973,124.007),
  ('puerto-galera','Puerto Galera','mimaropa','Or. Mindoro · MIMAROPA',NULL,NULL,'White-beach coves a short crossing from Batangas.',13.503,120.954),
  ('tagum','Tagum','davao','Davao del Norte · Davao',NULL,NULL,NULL,7.448,125.808),
  ('camiguin','Camiguin','n-mindanao','Camiguin · N. Mindanao',NULL,NULL,NULL,9.173,124.730),
  ('iligan','Iligan','n-mindanao','Lanao del Norte · N. Mindanao',NULL,NULL,NULL,8.228,124.245),
  ('gensan','General Santos','soccsksargen','South Cotabato · SOCCSKSARGEN',NULL,NULL,NULL,6.113,125.171),
  ('cotabato','Cotabato City','barmm','Maguindanao · BARMM',NULL,NULL,NULL,7.223,124.247),
  ('zamboanga','Zamboanga City','zamboanga','Zamboanga del Sur · Zamboanga',NULL,NULL,'‘Asia’s Latin City’ — Spanish-flavored heritage weddings.',6.921,122.079),
  ('dipolog','Dipolog','zamboanga','Zamboanga del Norte · Zamboanga',NULL,NULL,NULL,8.589,123.341),
  ('butuan','Butuan','caraga','Agusan del Norte · Caraga',NULL,NULL,NULL,8.948,125.540),
  ('tacloban','Tacloban','e-visayas','Leyte · Eastern Visayas',NULL,NULL,NULL,11.244,125.004),
  ('ormoc','Ormoc','e-visayas','Leyte · Eastern Visayas',NULL,NULL,NULL,11.006,124.608),
  ('bantayan','Bantayan Island','c-visayas','Cebu · Central Visayas',NULL,NULL,'Powder-white sandbars off northern Cebu.',11.170,123.722)
ON CONFLICT (city_key) DO NOTHING;

-- NOTE: city_aliases[] left empty in the seed above for brevity. A follow-up
-- UPDATE (or a second additive migration) backfills each row's city_aliases
-- from lib/regions.ts CITY_TO_REGION (~150 case-folded spellings, e.g.
-- 'cebu city'/'cebu'/'mactan'→cebu region) so regionForCity() can read the DB.
-- regionForCity() keeps using the TS Map until that backfill + helper land.
