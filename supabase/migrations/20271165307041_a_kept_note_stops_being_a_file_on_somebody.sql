-- ═══════════════════════════════════════════════════════════════════════════
-- THE SUPPLIER KEEPS THE NOTE. IT STOPS BEING A FILE ON A PERSON.
--
-- Owner, 2026-08-24: the supplier keeps the note, but it stops being filed under
-- that person's name. They keep their working history.
--
-- `vendor_client_notes` is the supplier's own CRM — up to 2,000 characters per
-- row, readable by nobody else including Setnayan. It is unambiguously their
-- business record, so *"vendor data stays"* reaches it. But its SUBJECT is the
-- couple, and the couple has just asked to be forgotten. The classification calls
-- this the trap in the other direction, and the owner's ruling threads it: the
-- WORKING HISTORY survives, the FILE ON A NAMED PERSON does not.
--
-- 🔑 SEVERING `event_id` IS EXACTLY THAT DISTINCTION, NOT A COMPROMISE. The note
-- carries no name, no contact and no user id of its own — the ONLY thing that
-- made it "this person's file" is the celebration it hangs off. Cut that and what
-- remains is what the supplier wrote, addressable only as their own history.
--
-- ⚠ A PRESERVED ROW NOBODY CAN READ IS NOT A KEPT NOTE. Measured: the only reader
-- is `/vendor-dashboard/clients/[eventId]`, which filters `.eq('event_id', …)` —
-- so severing alone would make every kept note permanently invisible, the "gate
-- with no handle" shape this repo has found five times. The same change adds the
-- surface that reads them.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_client_notes
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_client_notes
  DROP CONSTRAINT IF EXISTS vendor_client_notes_event_id_fkey;

ALTER TABLE public.vendor_client_notes
  ADD CONSTRAINT vendor_client_notes_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_client_notes.event_id IS
  'The celebration this note was written against. NULL once the couple deleted '
  'it: the supplier keeps what they wrote, and it stops being addressable as '
  'that person''s file (owner 2026-08-24). Read the orphans on the Clients hub '
  'under "Kept notes" — they are invisible to the per-event Customer Card.';

-- ⚠ THE REMINDER MUST NOT OUTLIVE THE PERSON IT IS ABOUT.
-- `remind_at` is a follow-up date on a named client ("chase the down-payment on
-- the 15th"). Once the celebration is gone there is nobody to chase, and a
-- reminder that fires about a deleted person is the file-on-a-person the owner's
-- ruling excludes — worse, it is one that reaches out on its own schedule.
-- Cleared at severance; the note's WORDS are untouched.
CREATE OR REPLACE FUNCTION public.unfile_client_notes_on_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.vendor_client_notes
     SET remind_at = NULL
   WHERE event_id = OLD.event_id
     AND remind_at IS NOT NULL;
  RETURN OLD;
END;
$function$;

-- 🔑 A SECURITY DEFINER FUNCTION IS EXECUTABLE BY PUBLIC BY DEFAULT, and a
-- trigger function needs no EXECUTE grant at all.
REVOKE ALL ON FUNCTION public.unfile_client_notes_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unfile_client_notes_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.unfile_client_notes_on_event_delete() FROM authenticated;

DROP TRIGGER IF EXISTS events_unfile_client_notes_on_delete ON public.events;
CREATE TRIGGER events_unfile_client_notes_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.unfile_client_notes_on_event_delete();
