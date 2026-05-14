-- Add 'ceremonial_venue' to vendor_category enum.
--
-- Filipino weddings frequently have separate venues for the ceremony (church,
-- garden, beach, civil hall) and the reception. The existing 'venue' value
-- now semantically represents the Reception Venue (label updated to "Reception
-- Venue" in lib/vendors.ts); 'ceremonial_venue' is the new enum value for the
-- ceremony location, surfaced under the CEREMONY service group.
--
-- Idempotent: IF NOT EXISTS handles re-runs.

ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'ceremonial_venue';
