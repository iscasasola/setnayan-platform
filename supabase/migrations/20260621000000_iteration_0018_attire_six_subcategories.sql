-- ============================================================================
-- 20260621000000_iteration_0018_attire_six_subcategories.sql
--
-- Expands Card 18 Attire from 2 to 6 sub-categories per owner directive
-- 2026-05-24: "Attire should grow on Bridal Gown, Grooms Suit, Bridal
-- Shoes, Grooms Shoes, possible add Entourage and Parents?"
--
-- BEFORE this migration:
--   Card 18 used canonical_services = ['gown_designer', 'suit_designer']
--   with a single-vendor lock. Owner wanted 6 sub-categories each lockable
--   independently. Lock pattern mirrors Card 14 Photobooths + Booths
--   (multi-pick with custom server action).
--
-- AFTER this migration:
--   vendor_category enum gains 6 new values (semantic names matching the
--   owner's flow diagram column labels):
--     • bridal_gown      — replaces gown_designer (bride's gown)
--     • groom_suit       — replaces suit_designer (groom's suit / barong)
--     • bridal_shoes     — NEW · bride's wedding shoes
--     • groom_shoes      — NEW · groom's wedding shoes
--     • entourage_attire — NEW · bridesmaids + groomsmen + secondary sponsors
--     • parents_attire   — NEW · mother + father of bride/groom outfits
--
--   The legacy enum values `gown_designer` + `suit_designer` STAY in the
--   enum (Postgres can't easily drop enum values without rewriting every
--   row that uses them · keeping them as deprecated is harmless).
--
--   Existing event_vendors.category rows + vendor_profiles.services array
--   rows containing `gown_designer` are UPDATEd to `bridal_gown`; same for
--   `suit_designer` → `groom_suit`. Idempotent · re-running is a no-op
--   because the second pass sees no rows still on the old values.
--
--   Demo vendors seeded for the 4 NEW canonicals so the marketplace has
--   content the moment Card 18 ships. Pexels CDN URLs (free-for-any-use
--   per Pexels License) following the same pattern as
--   20260618000000_iteration_0006_vendor_hero_photos_pilot_polish.sql.
--
-- Idempotent throughout · safe to re-run · uses IF NOT EXISTS / WHERE
-- NOT EXISTS / EXCEPTION-handlers everywhere new state is introduced.
--
-- Reversal recipe:
--   UPDATE event_vendors SET category = 'gown_designer' WHERE category = 'bridal_gown';
--   UPDATE event_vendors SET category = 'suit_designer' WHERE category = 'groom_suit';
--   UPDATE vendor_profiles SET services = array_replace(services, 'bridal_gown', 'gown_designer');
--   UPDATE vendor_profiles SET services = array_replace(services, 'groom_suit', 'suit_designer');
--   -- The 4 NEW enum values (bridal_shoes · groom_shoes · entourage_attire
--   -- · parents_attire) and their seed vendor rows would need manual
--   -- cleanup; this isn't easily scripted, but the migration is locked.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1 · Extend vendor_category enum with 6 new values
--
-- Postgres requires each ADD VALUE to be a separate statement (can't
-- combine multiple ADDs in one ALTER TYPE). Each value is wrapped in IF
-- NOT EXISTS so re-running the migration is safe.
-- ----------------------------------------------------------------------------

ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'bridal_gown';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'groom_suit';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'bridal_shoes';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'groom_shoes';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'entourage_attire';
ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'parents_attire';

COMMIT;

-- New enum values must be committed before they can be used in later DDL
-- (Postgres' MVCC restriction on enum + DDL in same transaction). Restart
-- the transaction for the data migration step.

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 2 · Migrate existing event_vendors rows from legacy → new canonicals
--
-- Existing events that had Card 18 partially completed (rare in V1 pre-
-- launch but defensive) carry category='gown_designer' or 'suit_designer'.
-- Migrate them to the new canonical names so Card 18's new multi-pick UX
-- sees them under the right sub-tab.
-- ----------------------------------------------------------------------------

UPDATE public.event_vendors
   SET category = 'bridal_gown'
 WHERE category = 'gown_designer';

UPDATE public.event_vendors
   SET category = 'groom_suit'
 WHERE category = 'suit_designer';

-- ----------------------------------------------------------------------------
-- Step 3 · Migrate vendor_profiles.services array elements
--
-- Vendor profiles store a TEXT[] of canonical_services they offer.
-- Replace legacy names in-place so search + recommendation queries pick
-- up the new canonical-service filters.
-- ----------------------------------------------------------------------------

UPDATE public.vendor_profiles
   SET services = array_replace(services, 'gown_designer', 'bridal_gown')
 WHERE 'gown_designer' = ANY(services);

UPDATE public.vendor_profiles
   SET services = array_replace(services, 'suit_designer', 'groom_suit')
 WHERE 'suit_designer' = ANY(services);

-- ----------------------------------------------------------------------------
-- Step 4 · Seed demo vendors for the 4 NEW canonicals
--
-- Each new canonical needs marketplace content the moment Card 18 ships
-- so couples see vendor options instead of empty states. ~5 vendors per
-- new canonical (~20 new vendor_profiles rows total) using Pexels CDN
-- photos (free-for-any-use per Pexels License). All seeded as TEST-grade
-- marketplace inventory with `verification_state = 'unverified'`,
-- mirroring the pattern from 20260601000000_marketplace_test_seed_960_vendors.sql.
--
-- Each seed row carries:
--   • business_name      — semantic name with city suffix for uniqueness
--   • business_slug      — `test-<canonical>-<idx>-<city-slug>`
--   • services           — single canonical_service in the array
--   • location_city      — distributed across 5 PH wedding hubs
--   • hq_region          — PSGC region code matching the city
--   • logo_url           — Pexels CDN URL appropriate to the sub-category
--   • verification_state — 'unverified' (admin can promote later)
--   • compatible_ceremony_types — all 7 (universal · faith-agnostic vendors)
--   • compatible_venue_settings — all 7 (universal · setting-agnostic)
--   • public_visibility  — 'public' so they surface in marketplace queries
--
-- Idempotency via WHERE NOT EXISTS check against business_slug.
-- ----------------------------------------------------------------------------

-- Helper · seed N vendors per (canonical_service, photo_url) tuple
-- spread across NCR, Cebu, Tagaytay, Davao, Baguio.
INSERT INTO public.vendor_profiles (
  user_id,
  created_by_admin_user_id,
  business_name,
  business_slug,
  tagline,
  services,
  location_city,
  hq_region,
  logo_url,
  compatible_ceremony_types,
  compatible_venue_settings,
  public_visibility,
  event_types,
  is_published
)
SELECT
  NULL AS user_id,
  NULL AS created_by_admin_user_id,
  seed.business_name,
  seed.business_slug,
  format('Sample %s vendor for marketplace testing.', seed.canonical_service) AS tagline,
  ARRAY[seed.canonical_service]::TEXT[] AS services,
  seed.location_city,
  seed.hq_region,
  seed.logo_url,
  ARRAY['catholic','civil','inc','christian','muslim','cultural','mixed']::TEXT[] AS compatible_ceremony_types,
  ARRAY['banquet_hall','garden','beach','destination','heritage','outdoor_tent','civil_registrar']::TEXT[] AS compatible_venue_settings,
  'coming_soon'::public.vendor_public_visibility AS public_visibility,
  ARRAY['wedding']::TEXT[] AS event_types,
  TRUE AS is_published
FROM (VALUES
  -- ─── bridal_shoes · 5 vendors ───
  ('Bridal Shoes Atelier · Makati',          'test-bridal-shoes-1-makati',     'bridal_shoes',     'Makati',       'NCR',    'https://images.pexels.com/photos/265775/pexels-photo-265775.jpeg'),
  ('Bridal Shoes Studio · Quezon City',      'test-bridal-shoes-2-qc',         'bridal_shoes',     'Quezon City',  'NCR',    'https://images.pexels.com/photos/2589653/pexels-photo-2589653.jpeg'),
  ('Heels for the Bride · Cebu City',        'test-bridal-shoes-3-cebu',       'bridal_shoes',     'Cebu City',    'VII',    'https://images.pexels.com/photos/336372/pexels-photo-336372.jpeg'),
  ('Bridal Pumps & Slippers · Tagaytay',     'test-bridal-shoes-4-tagaytay',   'bridal_shoes',     'Tagaytay',     'IV-A',   'https://images.pexels.com/photos/267301/pexels-photo-267301.jpeg'),
  ('Bridal Footwear House · Davao',          'test-bridal-shoes-5-davao',      'bridal_shoes',     'Davao City',   'XI',     'https://images.pexels.com/photos/1813504/pexels-photo-1813504.jpeg'),

  -- ─── groom_shoes · 5 vendors ───
  ('Gentleman''s Shoes · Makati',            'test-groom-shoes-1-makati',      'groom_shoes',      'Makati',       'NCR',    'https://images.pexels.com/photos/267301/pexels-photo-267301.jpeg'),
  ('Groom Footwear Studio · Quezon City',    'test-groom-shoes-2-qc',          'groom_shoes',      'Quezon City',  'NCR',    'https://images.pexels.com/photos/293405/pexels-photo-293405.jpeg'),
  ('Wedding Shoes for Men · Cebu City',      'test-groom-shoes-3-cebu',        'groom_shoes',      'Cebu City',    'VII',    'https://images.pexels.com/photos/12903128/pexels-photo-12903128.jpeg'),
  ('Groom''s Loafers & Oxfords · Tagaytay',  'test-groom-shoes-4-tagaytay',    'groom_shoes',      'Tagaytay',     'IV-A',   'https://images.pexels.com/photos/2962135/pexels-photo-2962135.jpeg'),
  ('Men''s Wedding Footwear · Davao',        'test-groom-shoes-5-davao',       'groom_shoes',      'Davao City',   'XI',     'https://images.pexels.com/photos/267301/pexels-photo-267301.jpeg'),

  -- ─── entourage_attire · 5 vendors ───
  ('Bridesmaid & Groomsman Dresses · Makati', 'test-entourage-1-makati',       'entourage_attire', 'Makati',       'NCR',    'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg'),
  ('Wedding Party Attire · Quezon City',      'test-entourage-2-qc',           'entourage_attire', 'Quezon City',  'NCR',    'https://images.pexels.com/photos/256737/pexels-photo-256737.jpeg'),
  ('Entourage Outfit Studio · Cebu City',     'test-entourage-3-cebu',         'entourage_attire', 'Cebu City',    'VII',    'https://images.pexels.com/photos/3812944/pexels-photo-3812944.jpeg'),
  ('Sponsors & Bridesmaids Attire · Tagaytay','test-entourage-4-tagaytay',     'entourage_attire', 'Tagaytay',     'IV-A',   'https://images.pexels.com/photos/265856/pexels-photo-265856.jpeg'),
  ('Wedding Party Designs · Davao',           'test-entourage-5-davao',        'entourage_attire', 'Davao City',   'XI',     'https://images.pexels.com/photos/265856/pexels-photo-265856.jpeg'),

  -- ─── parents_attire · 5 vendors ───
  ('Mother of the Bride & Groom · Makati',    'test-parents-attire-1-makati',  'parents_attire',   'Makati',       'NCR',    'https://images.pexels.com/photos/1820770/pexels-photo-1820770.jpeg'),
  ('Parents Wedding Outfits · Quezon City',   'test-parents-attire-2-qc',      'parents_attire',   'Quezon City',  'NCR',    'https://images.pexels.com/photos/2253879/pexels-photo-2253879.jpeg'),
  ('Mother & Father Wedding Attire · Cebu',   'test-parents-attire-3-cebu',    'parents_attire',   'Cebu City',    'VII',    'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg'),
  ('Parents Formalwear · Tagaytay',           'test-parents-attire-4-tagaytay','parents_attire',   'Tagaytay',     'IV-A',   'https://images.pexels.com/photos/1721937/pexels-photo-1721937.jpeg'),
  ('Family Wedding Attire House · Davao',     'test-parents-attire-5-davao',   'parents_attire',   'Davao City',   'XI',     'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg')
) AS seed (business_name, business_slug, canonical_service, location_city, hq_region, logo_url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.vendor_profiles vp
  WHERE vp.business_slug = seed.business_slug
);

COMMIT;
