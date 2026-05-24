-- ============================================================================
-- 20260620000000_iteration_0006_vendor_profiles_hq_region.sql
--
-- Adds `hq_region` to `vendor_profiles` so the Concierge wizard Card 02
-- (Reception Venue) can offer a Region → City cascade filter on top of the
-- existing location_city dropdown. Filipino weddings frequently scope vendor
-- search by region first (NCR / Metro Manila vs Tagaytay & Calabarzon vs
-- Cebu vs Boracay vs Davao) before narrowing to a specific city. Without a
-- region anchor the dropdown surfaces every city alphabetically, which
-- forces the host to know exact city names to find what they want — bad UX
-- on mobile + bad signal density when one host wants every NCR caterer and
-- another wants every Cebu caterer.
--
-- Owner directive 2026-05-24 (verbatim):
--   "For reception venue. instead of Straight City, let us choose Region
--    first then City after. so customers can also search by region if they
--    do not define city."
--
-- This migration ships the column + a one-shot backfill that maps the most
-- common ~50 Filipino wedding cities to their canonical PSGC region code.
-- Anything not in the backfill stays NULL · the wizard filter treats NULL
-- as "region unknown · don't filter out" (same NULL-safe OR pattern the
-- religion-compat + venue-setting-compat filters use, locked CLAUDE.md
-- 2026-05-22 PR #305 + PR #311).
--
-- Why PSGC region codes (not display names):
--   • Stable foreign-keyable strings (NCR, IV-A, VII, etc.) — display
--     names shift over time (CALABARZON officially "Region IV-A" since
--     2002; CARAGA officially "Region XIII" since 1995). Codes don't.
--   • The `apps/web/lib/regions.ts` canonical table maps code → display
--     name so the UI surface can rename without re-migrating data.
--   • Existing PH government spatial taxonomies (DTI · DPWH · BIR · NSO)
--     all key on PSGC codes, so future integrations (e.g., BIR Form
--     2307 region tax-allocation per CLAUDE.md 2026-05-12 iteration 0026)
--     can read this column without re-derivation.
--
-- What's IN the backfill (~50 cities · the 95th-percentile of PH wedding
-- vendor distribution per `marketplace_test_seed_960_vendors.sql` + the
-- 8 owner-locked Top Destinations chip strip):
--   NCR        — Manila · Quezon City · Makati · Taguig · Pasig ·
--                Mandaluyong · San Juan · Pasay · Parañaque · Caloocan ·
--                Las Piñas · Marikina · Muntinlupa · Valenzuela ·
--                Malabon · Navotas · Pateros
--   CAR        — Baguio · La Trinidad · Sagada · Banaue
--   I          — Vigan · Laoag · Dagupan · San Fernando (La Union)
--   II         — Tuguegarao · Santiago
--   III        — Angeles · Clark · San Fernando (Pampanga) · Bulacan ·
--                Olongapo · Subic · Pampanga · Tarlac
--   IV-A       — Tagaytay · Cavite City · Batangas City · Lipa ·
--                Calamba · Sta. Rosa · Antipolo · Lucena · Laguna ·
--                Cavite · Batangas · Rizal · Quezon
--   IV-B       — Puerto Princesa · Palawan · Coron · El Nido · Mindoro
--   V          — Legazpi · Naga · Sorsogon · Albay
--   VI         — Iloilo City · Bacolod · Boracay (Aklan) · Aklan ·
--                Antique · Capiz · Guimaras · Negros Occidental
--   VII        — Cebu City · Mactan · Lapu-Lapu · Mandaue · Talisay ·
--                Bohol · Panglao · Tagbilaran · Dumaguete · Negros Oriental
--   VIII       — Tacloban · Ormoc · Catbalogan · Borongan
--   IX         — Zamboanga City · Dipolog · Pagadian
--   X          — Cagayan de Oro · Iligan · Malaybalay · Valencia
--   XI         — Davao City · Tagum · Mati · Digos
--   XII        — General Santos · Koronadal · Kidapawan · Cotabato City
--   XIII       — Butuan · Surigao · Bayugan
--   BARMM      — Marawi · Cotabato (BARMM) · Sulu · Tawi-Tawi
--   NIR        — (Negros Island Region · created 2024 split, owner can
--                 toggle later · currently maps Bacolod/Dumaguete to VI/VII)
--
-- What's NOT in the backfill — cities the seed map doesn't recognize stay
-- NULL · the wizard filter passes them through unfiltered when no region
-- is picked (same as today's behavior) + hides them from results when a
-- specific region IS picked (intentional · the host wants vendors in
-- their picked region, not "unknown region" rows). Admin can patch any
-- mis-categorized row later via Supabase Studio. Future vendor onboarding
-- should derive hq_region from hq_address geocoding the same way
-- hq_latitude/hq_longitude derive today (per migration
-- 20260525010000_vendor_hq_geocode_and_event_venue_anchor.sql).
--
-- The backfill is gated on `WHERE hq_region IS NULL` so re-running the
-- migration won't overwrite admin-corrected values. Cities are matched
-- LOWER(TRIM(location_city)) so casing/whitespace variants in seed data
-- ("Cebu City" / "cebu city" / "Cebu City ") all resolve correctly.
--
-- Idempotent · safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1 · column add (idempotent)
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS hq_region TEXT;

COMMENT ON COLUMN public.vendor_profiles.hq_region IS
  'PSGC region code (NCR / CAR / I…XIII / BARMM / NIR) derived from '
  'location_city or hq_address. Drives the Concierge wizard Card 02 '
  'Reception Venue Region → City cascade filter. NULL = region unknown '
  'or off-platform vendor outside the canonical PH region taxonomy. '
  'Filter treats NULL as "do not hide" when no region is picked, and '
  'as "hide" when a region IS picked (canonical NULL-safe filter shape '
  'matches religion + venue-setting compat from PR #305/PR #311). '
  'Iteration 0006 · added 2026-05-24 per owner Card 02 directive.';

-- ----------------------------------------------------------------------------
-- Step 2 · backfill from location_city → PSGC region code
--
-- One INSERT-shaped CTE that lists every (lower-case city name) → region
-- mapping, then a single UPDATE that joins on LOWER(TRIM(location_city)).
-- Gated on `vp.hq_region IS NULL` so:
--   • First run populates every recognizable row.
--   • Re-runs leave admin-corrected values intact.
--   • Newly-inserted vendor_profiles rows (before app code derives region
--     server-side) get backfilled on the next migration sweep.
-- ----------------------------------------------------------------------------

WITH city_to_region (city_lc, region_code) AS (
  VALUES
    -- NCR · 17 cities of Metro Manila
    ('manila',              'NCR'),
    ('quezon city',         'NCR'),
    ('makati',              'NCR'),
    ('makati city',         'NCR'),
    ('taguig',              'NCR'),
    ('taguig city',         'NCR'),
    ('pasig',               'NCR'),
    ('pasig city',          'NCR'),
    ('mandaluyong',         'NCR'),
    ('mandaluyong city',    'NCR'),
    ('san juan',            'NCR'),
    ('san juan city',       'NCR'),
    ('pasay',               'NCR'),
    ('pasay city',          'NCR'),
    ('parañaque',           'NCR'),
    ('paranaque',           'NCR'),
    ('parañaque city',      'NCR'),
    ('paranaque city',      'NCR'),
    ('caloocan',            'NCR'),
    ('caloocan city',       'NCR'),
    ('las piñas',           'NCR'),
    ('las pinas',           'NCR'),
    ('marikina',            'NCR'),
    ('marikina city',       'NCR'),
    ('muntinlupa',          'NCR'),
    ('muntinlupa city',     'NCR'),
    ('valenzuela',          'NCR'),
    ('valenzuela city',     'NCR'),
    ('malabon',             'NCR'),
    ('navotas',             'NCR'),
    ('pateros',             'NCR'),
    -- CAR · Cordillera Administrative Region
    ('baguio',              'CAR'),
    ('baguio city',         'CAR'),
    ('la trinidad',         'CAR'),
    ('sagada',              'CAR'),
    ('banaue',              'CAR'),
    -- Region I · Ilocos Region
    ('vigan',               'I'),
    ('vigan city',          'I'),
    ('laoag',               'I'),
    ('laoag city',          'I'),
    ('dagupan',             'I'),
    ('dagupan city',        'I'),
    ('san fernando',        'I'),   -- La Union (collision risk noted below)
    ('san fernando la union', 'I'),
    -- Region II · Cagayan Valley
    ('tuguegarao',          'II'),
    ('tuguegarao city',     'II'),
    ('santiago',            'II'),
    ('santiago city',       'II'),
    -- Region III · Central Luzon
    ('angeles',             'III'),
    ('angeles city',        'III'),
    ('clark',               'III'),
    ('clark freeport',      'III'),
    ('pampanga',            'III'),
    ('san fernando pampanga', 'III'),
    ('bulacan',             'III'),
    ('olongapo',            'III'),
    ('olongapo city',       'III'),
    ('subic',               'III'),
    ('tarlac',              'III'),
    ('tarlac city',         'III'),
    -- Region IV-A · CALABARZON
    ('tagaytay',            'IV-A'),
    ('tagaytay city',       'IV-A'),
    ('cavite city',         'IV-A'),
    ('cavite',              'IV-A'),
    ('batangas city',       'IV-A'),
    ('batangas',            'IV-A'),
    ('lipa',                'IV-A'),
    ('lipa city',           'IV-A'),
    ('calamba',             'IV-A'),
    ('calamba city',        'IV-A'),
    ('sta. rosa',           'IV-A'),
    ('santa rosa',          'IV-A'),
    ('sta rosa',            'IV-A'),
    ('antipolo',            'IV-A'),
    ('antipolo city',       'IV-A'),
    ('lucena',              'IV-A'),
    ('lucena city',         'IV-A'),
    ('laguna',              'IV-A'),
    ('rizal',               'IV-A'),
    ('quezon',              'IV-A'),
    -- Region IV-B · MIMAROPA
    ('puerto princesa',     'IV-B'),
    ('puerto princesa city','IV-B'),
    ('palawan',             'IV-B'),
    ('coron',               'IV-B'),
    ('el nido',             'IV-B'),
    ('mindoro',             'IV-B'),
    -- Region V · Bicol
    ('legazpi',             'V'),
    ('legazpi city',        'V'),
    ('legaspi',             'V'),
    ('legaspi city',        'V'),
    ('naga',                'V'),
    ('naga city',           'V'),
    ('sorsogon',            'V'),
    ('sorsogon city',       'V'),
    ('albay',               'V'),
    -- Region VI · Western Visayas
    ('iloilo city',         'VI'),
    ('iloilo',              'VI'),
    ('bacolod',             'VI'),
    ('bacolod city',        'VI'),
    ('boracay',             'VI'),
    ('aklan',               'VI'),
    ('antique',             'VI'),
    ('capiz',               'VI'),
    ('roxas',               'VI'),
    ('roxas city',          'VI'),
    ('guimaras',            'VI'),
    ('negros occidental',   'VI'),
    -- Region VII · Central Visayas
    ('cebu city',           'VII'),
    ('cebu',                'VII'),
    ('mactan',              'VII'),
    ('lapu-lapu',           'VII'),
    ('lapu-lapu city',      'VII'),
    ('lapulapu',            'VII'),
    ('lapulapu city',       'VII'),
    ('mandaue',             'VII'),
    ('mandaue city',        'VII'),
    ('talisay',             'VII'),
    ('talisay city',        'VII'),
    ('bohol',               'VII'),
    ('panglao',             'VII'),
    ('tagbilaran',          'VII'),
    ('tagbilaran city',     'VII'),
    ('dumaguete',           'VII'),
    ('dumaguete city',      'VII'),
    ('negros oriental',     'VII'),
    -- Region VIII · Eastern Visayas
    ('tacloban',            'VIII'),
    ('tacloban city',       'VIII'),
    ('ormoc',               'VIII'),
    ('ormoc city',          'VIII'),
    ('catbalogan',          'VIII'),
    ('borongan',            'VIII'),
    -- Region IX · Zamboanga Peninsula
    ('zamboanga city',      'IX'),
    ('zamboanga',           'IX'),
    ('dipolog',             'IX'),
    ('dipolog city',        'IX'),
    ('pagadian',            'IX'),
    ('pagadian city',       'IX'),
    -- Region X · Northern Mindanao
    ('cagayan de oro',      'X'),
    ('cagayan de oro city', 'X'),
    ('cdo',                 'X'),
    ('iligan',              'X'),
    ('iligan city',         'X'),
    ('malaybalay',          'X'),
    ('valencia',            'X'),
    -- Region XI · Davao
    ('davao city',          'XI'),
    ('davao',               'XI'),
    ('tagum',               'XI'),
    ('tagum city',          'XI'),
    ('mati',                'XI'),
    ('mati city',           'XI'),
    ('digos',               'XI'),
    ('digos city',          'XI'),
    -- Region XII · SOCCSKSARGEN
    ('general santos',      'XII'),
    ('general santos city', 'XII'),
    ('gensan',              'XII'),
    ('koronadal',           'XII'),
    ('koronadal city',      'XII'),
    ('kidapawan',           'XII'),
    ('kidapawan city',      'XII'),
    ('cotabato city',       'XII'),
    -- Region XIII · Caraga
    ('butuan',              'XIII'),
    ('butuan city',         'XIII'),
    ('surigao',             'XIII'),
    ('surigao city',        'XIII'),
    ('bayugan',             'XIII'),
    ('bayugan city',        'XIII'),
    -- BARMM · Bangsamoro Autonomous Region in Muslim Mindanao
    ('marawi',              'BARMM'),
    ('marawi city',         'BARMM'),
    ('cotabato',            'BARMM'),
    ('sulu',                'BARMM'),
    ('tawi-tawi',           'BARMM'),
    ('tawi tawi',           'BARMM')
)
UPDATE public.vendor_profiles vp
SET hq_region = ctr.region_code
FROM city_to_region ctr
WHERE vp.hq_region IS NULL
  AND vp.location_city IS NOT NULL
  AND LOWER(TRIM(vp.location_city)) = ctr.city_lc;

-- ----------------------------------------------------------------------------
-- Step 3 · partial index for region-only queries
--
-- Picks up the Card 02 Region picker case where the host picks a region
-- WITHOUT picking a specific city · the wizard hits
--   SELECT ... FROM vendor_market_stats WHERE hq_region = 'NCR' ...
-- The view passes through `vendor_profiles.hq_region` so the index on the
-- base table accelerates the view query too. Partial WHERE NOT NULL keeps
-- the index lean (most legacy rows + future off-platform inserts stay
-- NULL and don't get indexed).
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS vendor_profiles_hq_region_idx
  ON public.vendor_profiles (hq_region)
  WHERE hq_region IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Step 4 · refresh vendor_market_stats view
--
-- The marketplace + wizard read-path views all consume vendor_market_stats
-- (see migration 20260601020000_iteration_0006_vendor_market_stats_view.sql).
-- Adding hq_region to the SELECT means downstream code (vendor-pick-grid-card
-- + wizard-recommendations + future regional analytics) sees the column
-- without an additional JOIN to vendor_profiles. View recreated with
-- CREATE OR REPLACE so existing GRANTs and downstream dependencies are
-- preserved.
--
-- IMPORTANT · order matters: hq_region added next to hq_latitude/hq_longitude
-- so the column ordering follows the spatial-attribute grouping in the
-- view. Anyone reading the view in psql sees `location_city · hq_region ·
-- hq_latitude · hq_longitude` as a coherent block.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vendor_market_stats
WITH (security_invoker = true) AS
SELECT
  vp.vendor_profile_id,
  vp.public_id,
  vp.business_name,
  vp.business_slug,
  vp.tagline,
  vp.logo_url,
  vp.services,
  vp.location_city,
  vp.hq_latitude,
  vp.hq_longitude,
  vp.contact_email,
  vp.public_visibility,
  vp.event_types,
  vp.compatible_ceremony_types,
  vp.compatible_venue_settings,
  vp.created_at,
  COALESCE(vrs.avg_rating_overall, 0)::NUMERIC(3,2) AS avg_rating_overall,
  COALESCE(vrs.total_count, 0)::INT                 AS review_count,
  CASE
    WHEN vaa.tier = 'sponsored' THEN 2
    WHEN vaa.tier = 'boosted'   THEN 1
    ELSE 0
  END::INT                                           AS ad_rank,
  vaa.tier        AS ad_tier,
  vaa.sku_code    AS ad_sku_code,
  vaa.radius_km   AS ad_radius_km,
  vaa.expires_at  AS ad_expires_at,
  -- 2026-05-22 PM Setnayan-first sort key (from migration
  -- 20260607020000_vendor_market_stats_setnayan_first.sql) · TRUE when
  -- the vendor carries any first-party Setnayan canonical_service.
  -- MUST be preserved at column position 24 because Postgres CREATE OR
  -- REPLACE VIEW rejects column-position changes ("cannot change name of
  -- view column 'is_setnayan_service' to ...").
  (vp.services && ARRAY[
    'setnayan_concierge',
    'setnayan_papic',
    'setnayan_panood',
    'setnayan_patiktok',
    'setnayan_pakanta',
    'setnayan_pailaw',
    'setnayan_custom_monogram',
    'setnayan_save_the_date_mp4',
    'setnayan_ai_edited_highlight',
    'setnayan_ai_video_highlight'
  ]::TEXT[]) AS is_setnayan_service,
  -- 2026-05-24 · hq_region appended at position 25 (truly last). Postgres
  -- CREATE OR REPLACE VIEW disallows inserting new columns mid-list, so
  -- new columns MUST go at the END of the SELECT list. Every existing
  -- downstream consumer (vendor-pick-grid-card · /vendors browse · admin
  -- reports) reads by column name not index, so appending is safe.
  vp.hq_region
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);

GRANT SELECT ON public.vendor_market_stats TO anon, authenticated, service_role;

COMMENT ON VIEW public.vendor_market_stats IS
  'Marketplace read-path consolidation: vendor_profiles + vendor_review_stats '
  '+ vendor_active_ads with precomputed ad_rank for SQL-side sort. Adds '
  'hq_region 2026-05-24 for wizard Card 02 Region → City cascade. Used by '
  '/vendors + Concierge wizard vendor-pick cards.';

COMMIT;
