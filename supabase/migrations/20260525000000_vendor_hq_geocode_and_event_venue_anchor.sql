-- ============================================================================
-- 20260525000000_vendor_hq_geocode_and_event_venue_anchor.sql
--
-- PR B of the owner's 2026-05-20 direction ("Reception Venue is the central
-- point. meaning. we will always say how many km away from venue.") +
-- 2026-05-21 clarification ("geocoder will be used by vendors to locate
-- their HQ").
--
-- Adds:
--   • vendor_profiles.hq_address      — free-text street address (vendor edit)
--   • vendor_profiles.hq_latitude     — geocoded from hq_address (or
--                                       location_city as fallback) by the
--                                       Nominatim helper in lib/geo.ts
--   • vendor_profiles.hq_longitude
--   • events.venue_latitude           — anchor for distance calcs. Populated
--                                       by saveVendorToPicks when the couple
--                                       saves a category='venue' vendor with
--                                       coordinates; admin can override.
--   • events.venue_longitude
--
-- Indexing: BRIN on the venue coords (events) + a partial BTREE on the
-- vendor coords (vendor_profiles) when both columns are non-null. Keeps the
-- distance read path cheap without dragging in PostGIS — V1 distance math
-- is haversine in app code.
--
-- All additive + nullable + idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles — HQ address + geocode columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS hq_address  TEXT
    CHECK (hq_address IS NULL OR length(hq_address) BETWEEN 1 AND 500);

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS hq_latitude  NUMERIC(10, 7)
    CHECK (hq_latitude IS NULL OR (hq_latitude BETWEEN -90 AND 90));

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS hq_longitude NUMERIC(10, 7)
    CHECK (hq_longitude IS NULL OR (hq_longitude BETWEEN -180 AND 180));

COMMENT ON COLUMN public.vendor_profiles.hq_address IS
  'Free-text street address of the vendor''s HQ. Vendor enters this from '
  '/vendor-dashboard. Used by lib/geo.geocodeNominatim to compute '
  'hq_latitude + hq_longitude on save. Optional — vendors without an HQ '
  'address still surface in search, just without a distance chip.';

COMMENT ON COLUMN public.vendor_profiles.hq_latitude IS
  'Decimal degrees. Auto-populated from hq_address (preferred) or '
  'location_city (fallback) via Nominatim. Admin may override directly. '
  'NULL = unknown.';

CREATE INDEX IF NOT EXISTS vendor_profiles_hq_coords_idx
  ON public.vendor_profiles (hq_latitude, hq_longitude)
  WHERE hq_latitude IS NOT NULL AND hq_longitude IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. events — reception venue anchor coords
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_latitude  NUMERIC(10, 7)
    CHECK (venue_latitude IS NULL OR (venue_latitude BETWEEN -90 AND 90));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_longitude NUMERIC(10, 7)
    CHECK (venue_longitude IS NULL OR (venue_longitude BETWEEN -180 AND 180));

COMMENT ON COLUMN public.events.venue_latitude IS
  'Reception venue anchor for distance calculations. Auto-populated by '
  'saveVendorToPicks when the couple saves a category=''venue'' vendor '
  'with coordinates (first-saved-wins). Admin can override. NULL = no '
  'venue locked yet, so distance chips are hidden on the marketplace.';

CREATE INDEX IF NOT EXISTS events_venue_coords_idx
  ON public.events (venue_latitude, venue_longitude)
  WHERE venue_latitude IS NOT NULL AND venue_longitude IS NOT NULL;

COMMIT;
