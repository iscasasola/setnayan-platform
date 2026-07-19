-- booth_types_band_live_stations
--
-- Owner directive 2026-07-04: vendors run more kinds of booths in the 3D Plan —
-- a band/stage, a live-COOKING (action) station, and a live-PERFORMANCE spot,
-- each with its own 3D silhouette. Add those three booth kinds to the
-- event_floor_booths.booth_type CHECK.
--
-- Also FIXES a latent gap: 'registration_desk' is used in the app (the seating
-- editor auto-places a Front Desk, and BOOTH_CATALOG offers it) but it was
-- dropped from the prod CHECK by 20270110320022 — a registration_desk insert
-- would violate the constraint. Re-include it here.
--
-- Additive + idempotent (drop/re-add the whole CHECK) — safe on a live DB;
-- every existing row keeps its type.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_floor_booths
  DROP CONSTRAINT IF EXISTS event_floor_booths_booth_type_check;

ALTER TABLE public.event_floor_booths
  ADD CONSTRAINT event_floor_booths_booth_type_check
  CHECK (booth_type IN (
    'photo_booth', 'mobile_bar', 'dessert_station', 'gift_table',
    'souvenir_table', 'registration_desk',
    'band', 'live_cooking', 'live_performance',
    'custom', 'unassigned'
  ));

COMMENT ON COLUMN public.event_floor_booths.booth_type IS
  'Booth kind. ''unassigned'' = a blank pin the couple placed but not yet typed. '
  'band / live_cooking (action/carving station) / live_performance (acoustic act) '
  'added 2026-07-04 for the vendor 3D-Plan booths.';

COMMIT;

