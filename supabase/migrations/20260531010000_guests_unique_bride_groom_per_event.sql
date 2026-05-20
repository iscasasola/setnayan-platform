-- ============================================================================
-- 20260531010000_guests_unique_bride_groom_per_event.sql
--
-- Hard-single enforcement for the bride + groom roles added in
-- 20260531000000_guest_role_add_bride_groom.sql. One bride and one groom
-- per event (not-deleted rows only). Inserts/updates that violate this
-- raise a unique_violation that the UI catches and renders as
-- "Already a Bride in this event — change theirs first."
--
-- Soft-deleted guests (deleted_at IS NOT NULL) don't count, so the
-- couple can re-cast the role if a guest is removed.
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS guests_one_bride_per_event
  ON public.guests (event_id)
  WHERE role = 'bride' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guests_one_groom_per_event
  ON public.guests (event_id)
  WHERE role = 'groom' AND deleted_at IS NULL;

COMMIT;
