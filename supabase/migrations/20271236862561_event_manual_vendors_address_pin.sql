-- ============================================================================
-- 20271236862561_event_manual_vendors_address_pin.sql
--
-- AN ADDRESS PIN, NOT JUST AN ADDRESS.
--
-- Owner, 2026-09-20, listing what the Add-manually popup carries:
--   "Vendor Name · Contact Person · Contact Number · Address Pin · Services
--    Covered · Inclusions · Price · Payment Plan"
--
-- He wrote *pin*, not *address*. `address` (20271236460588) is the text a
-- human reads; these two are the point on the map a guest is routed to. Both
-- are needed: a pin with no text is unreadable on a printed brief, and text
-- with no pin cannot open a map app.
--
-- ── SHAPE COPIED FROM THE COLUMNS THAT ALREADY DO THIS ────────────────────
-- Plain NUMERIC pairs, exactly like `events.venue_latitude/longitude` and
-- `vendor_profiles.hq_latitude/longitude`. Deliberately NOT PostGIS: `lib/geo.ts`
-- states the V1 decision ("we deliberately don't pull PostGIS for this — the
-- columns are plain NUMERIC") and nothing here needs a spatial index.
--
-- The CHECKs are the ones a coordinate pair can actually carry. They are worth
-- having because the value arrives from a map widget and a geocoder, and a
-- swapped lat/lng — the classic failure — lands a Philippine venue in the
-- Indian Ocean rather than erroring. Latitude is the tighter range, so a
-- swapped pair usually trips it here instead of silently shipping.
--
-- ── WHY NULLABLE ──────────────────────────────────────────────────────────
-- Every existing row predates the field; and the pin is genuinely optional for
-- the categories that are not a place. Even for a venue the ADDRESS is what is
-- required at the application layer (`lib/manual-venue-address.ts`) — a couple
-- who knows the street but cannot find the building on a map must still be
-- able to save. Demanding a pin would block that, and a wrong pin is worse
-- than none: it routes guests somewhere real and incorrect.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS address_latitude  NUMERIC;

ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS address_longitude NUMERIC;

ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT IF EXISTS event_manual_vendors_address_latitude_range;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_address_latitude_range
  CHECK (address_latitude IS NULL OR (address_latitude >= -90 AND address_latitude <= 90));

ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT IF EXISTS event_manual_vendors_address_longitude_range;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_address_longitude_range
  CHECK (address_longitude IS NULL OR (address_longitude >= -180 AND address_longitude <= 180));

-- Both or neither. Half a coordinate is not a location, and a lone latitude
-- would read as "we have a pin" to any caller that checks one column.
ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT IF EXISTS event_manual_vendors_address_pin_complete;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_address_pin_complete
  CHECK (
    (address_latitude IS NULL AND address_longitude IS NULL)
    OR (address_latitude IS NOT NULL AND address_longitude IS NOT NULL)
  );

COMMENT ON COLUMN public.event_manual_vendors.address_latitude IS
  'Map pin for a supplier the couple added themselves — the point a guest is '
  'routed to, paired with the human-readable `address`. Plain NUMERIC, matching '
  'events.venue_latitude and the V1 no-PostGIS decision in lib/geo.ts. Optional '
  'even for a venue: the ADDRESS is what the app requires, because a wrong pin '
  'is worse than no pin. Always written with address_longitude (CHECK).';

COMMIT;
