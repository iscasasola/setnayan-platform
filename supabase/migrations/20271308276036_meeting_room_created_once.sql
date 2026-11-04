-- ============================================================================
-- A Virtual meeting's room is CREATED ONCE — who and when.
--
-- Owner 2026-11-04 (DECISION_LOG "ONE BUTTON THAT SAYS WHAT THE ROOM NEEDS"),
-- verbatim: "if a link shows. we can have a button conference room created.
-- you can enter. no conference room created, create one".
--
-- A Virtual meeting is a Jitsi link Setnayan makes ("VIRTUAL = JITSI ONLY").
-- From 15 min before the start the card shows ONE button: "Create the room"
-- until somebody on the meeting presses it, then "Room created · Enter the
-- room" for everyone. These two columns are that fact.
--
-- WHO MAY SET IT — the two sides of the meeting, and nobody else. No new
-- policy: the existing event_appointments UPDATE policies (couple side /
-- booked supplier side) already scope who can touch the row, so an outsider's
-- UPDATE matches zero rows. This trigger adds the rest:
--   · SET ONCE — after the first press the pair is frozen; a second press is a
--     no-op (the old values are kept, nothing raises).
--   · NOT FORGEABLE — the values are the server's: `now()` and `auth.uid()`,
--     whatever the client sent. With no signed-in user nothing is recorded.
--   · NEVER ON INSERT — a meeting is born with no room.
-- Guard: apps/web/tests/db/a-meeting-room-is-created-once.db.test.ts
-- ============================================================================

ALTER TABLE public.event_appointments
  ADD COLUMN IF NOT EXISTS room_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS room_created_by uuid;

COMMENT ON COLUMN public.event_appointments.room_created_at IS
  'When the Virtual meeting''s room was first created (set once, by the trigger tg_event_appointments_room_set_once).';
COMMENT ON COLUMN public.event_appointments.room_created_by IS
  'auth.uid() of whoever on the meeting first pressed "Create the room" (set once).';

CREATE OR REPLACE FUNCTION public.tg_event_appointments_room_set_once()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.room_created_at := NULL;
    NEW.room_created_by := NULL;
    RETURN NEW;
  END IF;

  IF OLD.room_created_at IS NOT NULL THEN
    -- Already created: frozen. A second press changes nothing.
    NEW.room_created_at := OLD.room_created_at;
    NEW.room_created_by := OLD.room_created_by;
  ELSIF NEW.room_created_at IS NOT NULL OR NEW.room_created_by IS NOT NULL THEN
    -- First press: the server's clock and the caller's own id — never the client's.
    IF auth.uid() IS NULL THEN
      NEW.room_created_at := NULL;
      NEW.room_created_by := NULL;
    ELSE
      NEW.room_created_at := now();
      NEW.room_created_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_appointments_room_set_once ON public.event_appointments;
CREATE TRIGGER event_appointments_room_set_once
  BEFORE INSERT OR UPDATE ON public.event_appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_appointments_room_set_once();
