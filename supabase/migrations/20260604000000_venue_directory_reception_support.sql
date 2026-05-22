-- ============================================================================
-- 20260604000000_venue_directory_reception_support.sql
--
-- Iteration 0050 (Venue Directory · V1 — promoted from V1.2 2026-05-22 evening).
-- Extends the V1 read-only PH venue directory (shipped 2026-05-26 in
-- `20260526010000_venue_directory_seed.sql`) so it can host RECEPTION venues
-- alongside the existing Ceremony venues (churches, mosques, INC chapels,
-- civil registrars).
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. ENUM EXPANSION — adds 6 reception-venue values to
--    `public.venue_directory_type`:
--      • banquet_hall       (hotel ballroom / convention space — generic,
--                            distinct from the existing more-specific
--                            `hotel_ballroom`)
--      • garden_estate      (Antonio's / Sonya's / Hillcreek-style estates
--                            with garden ceremony + reception spaces)
--      • beach_resort       (Boracay / Mactan / Panglao-style beach resorts;
--                            distinct from the more-specific `beach` which
--                            currently maps to beachfront ceremony-only)
--      • destination_resort (multi-room resorts in Tagaytay / Boracay /
--                            Palawan that aren't strictly beach-only;
--                            already exists pre-this-migration)
--      • heritage_hacienda  (Spanish-era haciendas + Las Casas-style heritage
--                            estates with chapel + reception combos)
--      • outdoor_tent       (tent-only or open-field reception with
--                            optional ceremony marquee; already exists)
--      • restaurant         (private-dining restaurants used as intimate
--                            reception venues — Antonio's Tagaytay being
--                            the canonical example; differs from
--                            garden_estate by lacking outdoor ceremony
--                            space)
--      • multi_purpose_hall (church halls, school auditoriums, sports
--                            clubs — non-luxe banquet alternatives that
--                            many Filipino couples use for budget weddings)
--
--    Of the 8 the task instructed, `destination_resort` + `outdoor_tent`
--    already exist in the enum (shipped 2026-05-26). The migration uses
--    `ADD VALUE IF NOT EXISTS` so re-runs are no-ops.
--
-- 2. COLUMNS — adds 9 columns to `public.venue_directory`:
--      • venue_category              ceremony / reception / combined
--      • capacity_min · capacity_max headcount range (50-5000)
--      • day_rate_php_min · _max     PHP whole pesos (matches
--                                    vendor_services.starting_price_php)
--      • description                 1-3 sentence summary
--      • amenities                   JSONB array of amenity tags
--      • compatible_venue_settings   TEXT[] of `venue_setting` enum
--                                    values for couples filtering by
--                                    chosen reception type
--      • is_bookable_via_setnayan    V1.5+ true-bookability flag
--      • is_demo · demo_batch_id     mirrors vendor_profiles demo pattern
--                                    shipped 2026-06-03 in
--                                    `20260603200000_demo_vendor_fixtures_schema.sql`
--
--    All columns are NULLABLE or have safe defaults so existing rows
--    (28 churches/mosques/INC chapels/civil registrars + 0 reception
--    rows pre-this-migration) keep working.
--
-- 3. BACKFILL — every existing row predates `venue_category`. They are
--    ALL ceremony venues (Catholic churches / INC chapels / mosques /
--    civil registrars / heritage chapels / Christian-fellowship spaces).
--    Backfill stamps `venue_category = 'ceremony'` defensively on any
--    NULL-or-empty value. Default also fires for any future inserts
--    that don't specify a category.
--
-- 4. INDEXES — 4 partial indexes covering the dominant query shapes:
--      • venue_directory_category_idx       — filter by category
--      • venue_directory_compat_venue_set_idx — GIN on the venue_settings
--        array for "match my wedding" filtering in Reception folder
--      • venue_directory_capacity_idx        — capacity-range filter
--      • venue_directory_demo_idx           — partial WHERE is_demo
--        (matches the vendor_profiles partial pattern)
--
-- WHY (per feedback_setnayan_document_changes_with_why.md)
-- --------------------------------------------------------
-- CLAUDE.md 2026-05-20 row 470 (12-folder marketplace remap) locked
-- Reception as filter-only via venue_setting, with V1.2 deferred for
-- bookable venue records with calendars + day-rates. Owner approved
-- pulling that V1.2 work forward to V1 on 2026-05-22 evening — the
-- Reception folder shipping with seven faceted chips but zero venue
-- cards looked like a placeholder, and the architecture review showed
-- the foundation (this migration + seed) could ship without the
-- bookable calendar layer. Day-rates display + capacity filter +
-- amenities chips give couples real value at the marketplace surface
-- while booking continues to flow through chat inquiry (V1.5+ adds
-- real per-location calendars + day-rate orders).
--
-- The is_demo flag is intentional — Setnayan does not have signed
-- agreements with these venues yet; the seed venues are synthetic
-- representations of real Filipino reception venues for V1
-- marketplace dogfooding. Same pattern as the demo vendors shipped
-- 2026-06-03; cleanup deadline 2026-12-01 before public launch.
--
-- HARD CLEANUP DEADLINE: December 1, 2026 (public launch).
-- The same CI guard pattern at apps/web/scripts/check-no-demo-in-prod.ts
-- will be extended to enforce a maximum demo-venue count post-launch.
--
-- REVERSIBLE
-- ----------
-- Down migration (commented; owner runs manually if rolled back):
--
--   DROP INDEX IF EXISTS venue_directory_demo_idx;
--   DROP INDEX IF EXISTS venue_directory_capacity_idx;
--   DROP INDEX IF EXISTS venue_directory_compat_venue_set_idx;
--   DROP INDEX IF EXISTS venue_directory_category_idx;
--   ALTER TABLE public.venue_directory
--     DROP CONSTRAINT IF EXISTS venue_directory_day_rate_max_gte_min,
--     DROP CONSTRAINT IF EXISTS venue_directory_day_rate_min_nonneg,
--     DROP CONSTRAINT IF EXISTS venue_directory_capacity_max_gte_min,
--     DROP CONSTRAINT IF EXISTS venue_directory_capacity_min_pos,
--     DROP CONSTRAINT IF EXISTS venue_directory_description_length,
--     DROP CONSTRAINT IF EXISTS venue_directory_venue_category_valid,
--     DROP COLUMN IF EXISTS demo_batch_id,
--     DROP COLUMN IF EXISTS is_demo,
--     DROP COLUMN IF EXISTS is_bookable_via_setnayan,
--     DROP COLUMN IF EXISTS compatible_venue_settings,
--     DROP COLUMN IF EXISTS amenities,
--     DROP COLUMN IF EXISTS description,
--     DROP COLUMN IF EXISTS day_rate_php_max,
--     DROP COLUMN IF EXISTS day_rate_php_min,
--     DROP COLUMN IF EXISTS capacity_max,
--     DROP COLUMN IF EXISTS capacity_min,
--     DROP COLUMN IF EXISTS venue_category;
--   -- Enum values cannot be dropped in Postgres without recreating the
--   -- type. Leave them in place — they are forward-compatible additions.
--
-- Idempotent — IF NOT EXISTS guards everywhere; re-run is a no-op.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. venue_directory_type enum · ADD reception values
--
-- The enum already contains hotel_ballroom, garden, beach, destination_resort,
-- heritage, outdoor_tent (shipped 2026-05-26). We add the 6 newer keys
-- requested by the V1 promotion (banquet_hall is generic, garden_estate
-- explicitly covers the multi-space estate pattern, beach_resort distinguishes
-- from the bare-beach ceremony venue, heritage_hacienda covers Las
-- Casas / Hacienda Isabella, restaurant covers Antonio's-style private
-- dining, multi_purpose_hall covers budget-friendly church halls).
--
-- Each ADD VALUE is its own statement (Postgres requires that — multiple
-- ADD VALUEs cannot be combined). IF NOT EXISTS makes each one idempotent.
--
-- IMPORTANT — SEED MAPPING NOTE
-- The 2026-05-22 V1 promotion shipped Agent B + Agent C UI work
-- (`apps/web/lib/venue-recommendations.ts → findReceptionVenuesByVenueSetting`
-- and the venue detail page `displayVenueType()`) BEFORE this migration
-- landed, and those helpers only know the original 6 reception types
-- (hotel_ballroom, garden, beach, destination_resort, heritage,
-- outdoor_tent). The companion seed migration
-- `20260604010000_venue_directory_reception_seed.sql` uses those 6
-- existing values per row so venues surface in the deployed UI
-- immediately. The 6 new values added here are reserved for V1.x
-- onboarding where vendor partners want a more-specific category;
-- Agent B/C extend their helpers at that time.
-- ----------------------------------------------------------------------------

ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'banquet_hall';
ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'garden_estate';
ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'beach_resort';
ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'heritage_hacienda';
ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'restaurant';
ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'multi_purpose_hall';

COMMIT;

-- ============================================================================
-- New enum values cannot be referenced by index predicates / DEFAULT clauses
-- in the same transaction that added them. Split into a fresh transaction
-- for the column additions + indexes that read those values.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 2. venue_directory · 9 new columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.venue_directory
  ADD COLUMN IF NOT EXISTS venue_category            TEXT NOT NULL DEFAULT 'ceremony',
  ADD COLUMN IF NOT EXISTS capacity_min              INT,
  ADD COLUMN IF NOT EXISTS capacity_max              INT,
  ADD COLUMN IF NOT EXISTS day_rate_php_min          INT,
  ADD COLUMN IF NOT EXISTS day_rate_php_max          INT,
  ADD COLUMN IF NOT EXISTS description               TEXT,
  ADD COLUMN IF NOT EXISTS amenities                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compatible_venue_settings TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_bookable_via_setnayan  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_demo                   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_batch_id             UUID;

-- ----------------------------------------------------------------------------
-- 3. Constraints (guarded — re-running is safe)
--
-- The DO-block-with-EXCEPTION-WHEN-duplicate-object pattern mirrors the
-- hero-images migration shipped 2026-05-26.
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_venue_category_valid
      CHECK (venue_category IN ('ceremony', 'reception', 'combined'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_description_length
      CHECK (description IS NULL OR length(description) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_capacity_min_pos
      CHECK (capacity_min IS NULL OR (capacity_min > 0 AND capacity_min <= 5000));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_capacity_max_gte_min
      CHECK (
        capacity_max IS NULL
        OR (capacity_max >= COALESCE(capacity_min, 0) AND capacity_max <= 5000)
      );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_day_rate_min_nonneg
      CHECK (day_rate_php_min IS NULL OR day_rate_php_min >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.venue_directory
    ADD CONSTRAINT venue_directory_day_rate_max_gte_min
      CHECK (
        day_rate_php_max IS NULL
        OR day_rate_php_max >= COALESCE(day_rate_php_min, 0)
      );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4. Column comments
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.venue_directory.venue_category IS
  'Distinguishes Ceremony folder rows (existing churches/chapels/mosques/'
  'civil registrars) from Reception folder rows (hotels/gardens/beach '
  'resorts/etc.) and Combined rows (garden estates / heritage estates / '
  'beach resorts that genuinely host both). Backfilled to ceremony for '
  'all pre-2026-06-04 rows. Default ceremony also keeps any forgotten '
  'INSERT compatible.';

COMMENT ON COLUMN public.venue_directory.capacity_min IS
  'Minimum reception headcount the venue serves (e.g., 50). NULL for '
  'ceremony-only venues. CHECK enforces 1-5000.';

COMMENT ON COLUMN public.venue_directory.capacity_max IS
  'Maximum reception headcount (e.g., 500). NULL for ceremony-only '
  'venues. CHECK enforces >= capacity_min.';

COMMENT ON COLUMN public.venue_directory.day_rate_php_min IS
  'Starting day-rate in PHP whole pesos (matches '
  '`vendor_services.starting_price_php`). NULL = inquire-only. V1.5+ '
  'will swap to PHP centavos for centavos-canon consistency once '
  'real bookability ships.';

COMMENT ON COLUMN public.venue_directory.day_rate_php_max IS
  'Upper day-rate in PHP whole pesos. NULL = single-rate venues only '
  'show the min figure.';

COMMENT ON COLUMN public.venue_directory.description IS
  '1-3 sentence venue-feel summary. Max 2000 chars. Displayed in '
  'Reception folder venue cards + the venue detail page.';

COMMENT ON COLUMN public.venue_directory.amenities IS
  'JSONB array of amenity tags using a consistent controlled vocabulary: '
  'catering_included, in_house_decor, valet_parking, bridal_suite, '
  'ocean_view, garden_view, heritage_architecture, ballroom, '
  'outdoor_space, indoor_air_conditioned, accommodation_available, '
  'parking_50plus, av_equipment, dance_floor. Empty array (default) '
  'means amenities not specified.';

COMMENT ON COLUMN public.venue_directory.compatible_venue_settings IS
  'For Reception folder filtering: which `venue_setting` enum values '
  'this venue maps to. Hotel ballroom -> [''banquet_hall'']; Tagaytay '
  'garden estate -> [''garden'', ''outdoor_tent'']; beach resort -> '
  '[''beach'']; heritage venue -> [''heritage'']; destination resort '
  '-> [''destination'']. Drives the venue-match filter in /vendors '
  'Reception folder.';

COMMENT ON COLUMN public.venue_directory.is_bookable_via_setnayan IS
  'V1.5+ flag — TRUE when the venue has a real per-location calendar + '
  'day-rate order flow. V1 always FALSE; couples inquire via chat. '
  'Inquiry-only behavior is preserved while bookability ramps.';

COMMENT ON COLUMN public.venue_directory.is_demo IS
  'TRUE = synthetic venue created by the 2026-06-04 reception seed '
  '(`20260604010000_venue_directory_reception_seed.sql`) for V1 '
  'marketplace dogfooding. Mirrors `vendor_profiles.is_demo`. '
  'Hard cleanup deadline: 2026-12-01 (public launch).';

COMMENT ON COLUMN public.venue_directory.demo_batch_id IS
  'UUID grouping demo venue rows by seed batch (matches the '
  'vendor_profiles.demo_batch_id pattern). Lets admin cleanup-batch '
  'endpoints delete a single seed run while leaving other batches alone.';

-- ----------------------------------------------------------------------------
-- 5. Defensive backfill
--
-- Existing 28 rows (Catholic churches / INC chapels / mosques / civil
-- registrars / heritage venues) are ALL ceremony venues. Since the
-- column was added with DEFAULT 'ceremony', the rows already inherit
-- the correct value via the ADD COLUMN default-fill. This UPDATE is
-- belt-and-braces — catches any row that somehow has NULL or '' (no
-- known case but the spec brief explicitly requested it).
-- ----------------------------------------------------------------------------

UPDATE public.venue_directory
   SET venue_category = 'ceremony'
 WHERE venue_category IS NULL
    OR venue_category = '';

-- ----------------------------------------------------------------------------
-- 6. Indexes — partial where it pays off
-- ----------------------------------------------------------------------------

-- Full index: filter by category is the dominant query in Reception folder
-- (`WHERE venue_category IN ('reception', 'combined')`).
CREATE INDEX IF NOT EXISTS venue_directory_category_idx
  ON public.venue_directory (venue_category);

-- GIN: array-containment for the "match my wedding" filter
-- (`WHERE compatible_venue_settings && ARRAY['garden']::text[]`).
CREATE INDEX IF NOT EXISTS venue_directory_compat_venue_set_idx
  ON public.venue_directory USING GIN (compatible_venue_settings);

-- Capacity filter — only covers rows that ACTUALLY HAVE max set (Ceremony
-- venues don't, so they skip the index entirely).
CREATE INDEX IF NOT EXISTS venue_directory_capacity_idx
  ON public.venue_directory (capacity_min, capacity_max)
  WHERE capacity_max IS NOT NULL;

-- Partial on demo rows — matches the vendor_profiles_is_demo_idx pattern.
CREATE INDEX IF NOT EXISTS venue_directory_demo_idx
  ON public.venue_directory (created_at DESC)
  WHERE is_demo = TRUE;

-- Lookup by demo batch — admin cleanup-batch endpoint.
CREATE INDEX IF NOT EXISTS venue_directory_demo_batch_id_idx
  ON public.venue_directory (demo_batch_id)
  WHERE demo_batch_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. RLS — no changes needed
--
-- Existing policies (venue_directory_read_all + venue_directory_admin_write
-- from 20260526010000) already cover the new columns. Anon + authenticated
-- read all rows; admins write all rows. Demo filtering happens at the
-- query layer (Agent B's Reception folder rewrite) not RLS.
-- ----------------------------------------------------------------------------

COMMIT;
