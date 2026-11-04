-- a_crew_drives_between_events
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🚗 EVENT CHAPTERS SLICE 5 — ONE CREW, TWO EVENTS, AND THE DRIVE BETWEEN THEM (owner 2026-11-04).
--
-- A supplier's crew ("Team A", "Second shooter") booked on two events the same day is flagged on the supplier's
-- schedule when its times overlap, or when the gap between them is shorter than the drive between the two venues.
-- The drive is the km between the two events' reception pins (`events.venue_latitude/longitude`) at ONE average
-- speed — and that speed is the owner's number, not the code's: owner, 2026-11-04, "Admin-set speed".
--
-- NULL = not set: no drive is estimated and only overlapping times are flagged. Never a default in code
-- (CLAUDE.md rule 9, "don't guess"). Edited on Admin › Settings, saved by the existing business-identity save.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS drive_speed_kmh NUMERIC(5, 1);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_drive_speed_kmh_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_drive_speed_kmh_range
  CHECK (drive_speed_kmh IS NULL OR (drive_speed_kmh > 0 AND drive_speed_kmh <= 150));

COMMENT ON COLUMN public.platform_settings.drive_speed_kmh IS
  'Average door-to-door driving speed (km/h) used to estimate a crew''s drive between two same-day events on the supplier schedule. NULL = not set: no drive estimate, only overlapping times are flagged. Owner-set on Admin › Settings (2026-11-04).';
