-- ============================================================================
-- 20261215000000_guard_guest_edits_when_locked.sql
--
-- ADAPTIVE PAX PRICING — Phase 9 (post-finalize guest-edit guard).
--
-- Owner decision #6: "anything after [the deadline] cannot work." Once the
-- guest count is finalized (events.guest_count_locked_at set), the COUNT can no
-- longer change. This trigger enforces it path-independently — couple guest
-- page, quick-add, import, the guest self-RSVP portal, accepted claims, all of
-- it — so the locked count is real, not just protected at the pricing layer.
--
-- Scope (deliberately narrow):
--  - Blocks only COUNT-AFFECTING writes: INSERT (new guest), rsvp_status change,
--    soft-delete (deleted_at change), and hard DELETE. Cosmetic edits post-lock
--    (photo, tags, seating, meal) still pass — only the headcount is frozen.
--  - service_role is exempt (admin/system + the finalize path itself).
--  - Check-in is unaffected regardless: it writes guest_checkins, never guests.
--
-- The app shows a friendly "list finalized" pre-check on the main add paths;
-- this trigger is the defense-in-depth that catches every other path.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_guest_edits_when_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_at timestamptz;
BEGIN
  -- System / admin / the service-role finalize path may always write.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- A cosmetic UPDATE (count unchanged) is allowed even when locked.
  IF TG_OP = 'UPDATE'
     AND NEW.rsvp_status IS NOT DISTINCT FROM OLD.rsvp_status
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;

  SELECT e.guest_count_locked_at INTO locked_at
  FROM public.events e
  WHERE e.event_id = COALESCE(NEW.event_id, OLD.event_id);

  IF locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Your guest list is finalized — the guest count is locked.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_guest_edits_when_locked_trg ON public.guests;
CREATE TRIGGER guard_guest_edits_when_locked_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.guests
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_guest_edits_when_locked();

COMMIT;
