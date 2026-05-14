-- Add 'religious_venue' to vendor_category enum.
--
-- Religious Ceremony Venues are specifically the venues belonging to a
-- religious institute — church, chapel, temple, mosque, etc. — where a
-- religious ceremony is held inside that institute. Garden/beach/civil
-- ceremony venues remain under the existing 'venue' category (which serves
-- both ceremonies and receptions in the non-religious case). Only when a
-- garden is part of a religious institute does it qualify as religious_venue.
--
-- Surfaced under the CEREMONY service group in lib/vendors.ts.
--
-- Idempotent: IF NOT EXISTS handles re-runs.

ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'religious_venue';
