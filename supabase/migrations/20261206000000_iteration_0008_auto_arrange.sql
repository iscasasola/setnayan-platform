-- ============================================================================
-- 20261206000000_iteration_0008_auto_arrange.sql
-- Iteration 0008 — "Auto Arrange" expansion (owner-directed 2026-06-13):
-- one deterministic click lays out table positions stage-out, anchors vendor
-- booths to the perimeter, and seats guests by priority tier. Zero AI calls —
-- pure sorting logic in lib/seating.ts.
--
-- (a) guests.seating_priority — explicit per-guest priority override (1–4)
--     of the tier derived from the locked 0001 role taxonomy (roleTier()).
--     NULL = keep deriving from role/group (existing behaviour, default).
--     This deliberately does NOT add a parallel tag vocabulary: 'Primary
--     Sponsor' (principal_sponsor), 'Immediate Family' (bride/groom_*_family
--     + parents), 'Barkada' (group_category friends / custom groups) and
--     'Standard' (guest) already exist as locked enums; the override only
--     lets a host bump an individual without changing their role.
--
-- (b) event_floor_booths — vendor booth markers on the seat-plan canvas
--     (Photo Booth, Mobile Bar, …). Coordinates are percent (0–100) of the
--     editor canvas, matching event_tables.x_pos / event_floor_plan.*. The
--     editor + auto-arrange enforce the hardcoded perimeter rules (anchor to
--     walls, never the stage wall, clear of door corridors) client-side via
--     lib/seating.ts; the DB stores wherever the rules placed them.
--
-- Additive + idempotent — safe on a live DB. Pattern B RLS (couple on the
-- event reads + writes; nobody else), enabled at CREATE TABLE time, matching
-- event_floor_plan.
-- ============================================================================

BEGIN;

-- (a) per-guest priority override --------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS seating_priority SMALLINT
    CHECK (seating_priority BETWEEN 1 AND 4);

COMMENT ON COLUMN public.guests.seating_priority IS
  'Explicit seating-priority tier override (1=highest..4). NULL = derive from role/group via lib/seating roleTier(). Auto-seat fills tier 1 nearest the stage.';

-- (b) vendor booth markers ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_floor_booths (
  id          BIGSERIAL PRIMARY KEY,
  booth_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  booth_type  TEXT NOT NULL CHECK (booth_type IN (
    'photo_booth', 'mobile_bar', 'dessert_station', 'gift_table',
    'souvenir_table', 'custom'
  )),
  label       TEXT NOT NULL,
  x_pos       NUMERIC NOT NULL DEFAULT 50,
  y_pos       NUMERIC NOT NULL DEFAULT 95,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_floor_booths_event_id_idx
  ON public.event_floor_booths(event_id);

ALTER TABLE public.event_floor_booths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_floor_booths_couple_read ON public.event_floor_booths;
CREATE POLICY event_floor_booths_couple_read
  ON public.event_floor_booths FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_floor_booths_couple_write ON public.event_floor_booths;
CREATE POLICY event_floor_booths_couple_write
  ON public.event_floor_booths FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
