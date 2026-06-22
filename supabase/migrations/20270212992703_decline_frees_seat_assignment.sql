-- Smart seat-plan · decline auto-frees the seat (owner 2026-06-22).
-- When a guest's rsvp_status flips to 'declined', drop their seat assignment so
-- the chair is freed for someone else. A DB trigger is the one chokepoint that
-- covers EVERY decline path (public RSVP, dashboard edit, bulk, import, admin,
-- v1 API) without patching each — and the public RSVP path runs as the guest,
-- who has no RLS write on event_seat_assignments, so the function is
-- SECURITY DEFINER. Hard-deleting a guest already frees the seat via the FK
-- ON DELETE CASCADE; this only handles the status-transition case.
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
BEGIN;

CREATE OR REPLACE FUNCTION public.free_seat_on_decline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decline is a stronger signal than a manual seat lock, so a declined guest's
  -- seat is freed even if it was locked (owner: "decline auto removes them").
  DELETE FROM public.event_seat_assignments
    WHERE event_id = NEW.event_id
      AND guest_id = NEW.guest_id;
  RETURN NEW;
END;
$$;

-- Fire only on the real attending/pending/maybe → declined edge (the WHEN guard
-- makes it cheap + idempotent: re-saving an already-declined guest is a no-op,
-- and a later declined → attending re-flip leaves the freed seat as-is so the
-- couple/coordinator re-seats them, which auto-seat already supports).
DROP TRIGGER IF EXISTS guests_free_seat_on_decline ON public.guests;
CREATE TRIGGER guests_free_seat_on_decline
  AFTER UPDATE OF rsvp_status ON public.guests
  FOR EACH ROW
  WHEN (NEW.rsvp_status = 'declined' AND OLD.rsvp_status IS DISTINCT FROM 'declined')
  EXECUTE FUNCTION public.free_seat_on_decline();

COMMIT;
