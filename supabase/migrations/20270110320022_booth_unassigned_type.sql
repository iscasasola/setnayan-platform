-- ============================================================================
-- 20261209000000_booth_unassigned_type.sql
-- Iteration 0008 — "place a booth, then pick which booth" (owner-directed
-- 2026-06-13). Adding a booth now drops a BLANK pin the couple types
-- afterwards, instead of choosing the type up front from a dropdown.
--
-- The blank state needs to persist (a couple can save a half-built plan and
-- pick types later), so 'unassigned' joins the booth_type CHECK. Everything
-- else about event_floor_booths is unchanged.
--
-- Additive + idempotent — safe on a live DB; existing rows keep their type.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_floor_booths
  DROP CONSTRAINT IF EXISTS event_floor_booths_booth_type_check;

ALTER TABLE public.event_floor_booths
  ADD CONSTRAINT event_floor_booths_booth_type_check
  CHECK (booth_type IN (
    'photo_booth', 'mobile_bar', 'dessert_station', 'gift_table',
    'souvenir_table', 'custom', 'unassigned'
  ));

COMMENT ON COLUMN public.event_floor_booths.booth_type IS
  'Booth kind. ''unassigned'' = a blank pin the couple has placed but not yet typed (place-then-pick); the editor prompts for the type.';

COMMIT;
