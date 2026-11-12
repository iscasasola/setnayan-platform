-- an edited form stays with its event
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- PIECE 3a · FORMS — VIEW FIRST, AN EDIT SAVES A NEW FORM THAT STAYS WITH THE
-- EVENT, "ALSO KEEP IN MY LIBRARY".
--
-- Rulings (DECISION_LOG 2026-11-12):
--   • "A FORM IS VIEWED BEFORE IT IS EDITED OR SENT; AN EDIT SAVES A NEW FORM"
--     — the original in the library is untouched, anything already sent keeps
--     the version that was sent.
--   • "APPROVED — THE QUOTE · NEGOTIATION CHAT · FILES · HUB · FORMS DESIGN"
--     call (3): an edited form stays with THAT event only, with a "Save to my
--     library" option on it.  Call (5): no cap on forms per event.
--   • "FORMS, OFFERS AND BUNDLES HAVE NO PLAN LIMIT".
--
-- No new table. EXTENDS vendor_forms (20271325118550) with three columns:
--   for_event_id         the event an edit-before-send was made for (NULL =
--                        a plain library form, every shipped row)
--   edited_from_form_id  the form it was edited from (same shop)
--   in_library           TRUE = listed in "Your forms · the library" (every
--                        shipped row); FALSE = with its event only
--
-- Guards (a policy sees one row, so triggers say the cross-row parts):
--   1. an event-only form (in_library = FALSE) is sent ONLY into its own event
--      — for every writer, the on-booking service-role lane included;
--   2. an event-only form is linked to NO service card (a linked form is sent
--      by itself on booking — into OTHER events);
--   3. a form leaves the library by being retired, never by in_library going
--      TRUE → FALSE (a library form may already be linked and sent);
--   4. for_event_id names an event the shop talks to (a chat thread), and
--      edited_from_form_id names one of the shop's OWN forms.
-- RLS is unchanged: vendor_forms_owner_all (the shop, or admin) still decides
-- who writes; vendor_forms_sent_couple_select still lets a couple read a form
-- only once it was SENT into their event — an unsent event-only form is never
-- read by the couple.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.vendor_forms
  ADD COLUMN IF NOT EXISTS for_event_id        UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_from_form_id UUID REFERENCES public.vendor_forms(form_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS in_library          BOOLEAN NOT NULL DEFAULT TRUE;

-- "This event's forms · N" reads by (shop, event).
CREATE INDEX IF NOT EXISTS vendor_forms_for_event_idx
  ON public.vendor_forms (vendor_profile_id, for_event_id)
  WHERE for_event_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_forms.for_event_id IS
  'The event an edit-before-send was made for (DECISION_LOG 2026-11-12, Piece 3a). NULL = a plain library form.';
COMMENT ON COLUMN public.vendor_forms.edited_from_form_id IS
  'The shop''s own form this one was edited from — the original is never changed by the edit.';
COMMENT ON COLUMN public.vendor_forms.in_library IS
  'TRUE = listed in the shop''s library (every pre-3a row). FALSE = stays with for_event_id only; sent only there, linked to no card. Goes FALSE → TRUE ("Save to my library"), never back.';

-- ── guard 3 + 4 · the form row itself ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_vendor_form_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.in_library AND NOT NEW.in_library THEN
    RAISE EXCEPTION 'a library form leaves the library by being retired' USING ERRCODE = '42501';
  END IF;
  -- An event-only form names its event when it is made (a later event delete may NULL it — that is the FK's).
  IF TG_OP = 'INSERT' AND NOT NEW.in_library AND NEW.for_event_id IS NULL THEN
    RAISE EXCEPTION 'a form kept out of the library stays with an event' USING ERRCODE = '23514';
  END IF;
  IF NEW.for_event_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.for_event_id IS DISTINCT FROM NEW.for_event_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_threads t
        WHERE t.event_id = NEW.for_event_id
          AND t.vendor_profile_id = NEW.vendor_profile_id
     ) THEN
    RAISE EXCEPTION 'a form is made for an event the shop talks to' USING ERRCODE = '42501';
  END IF;
  IF NEW.edited_from_form_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.edited_from_form_id IS DISTINCT FROM NEW.edited_from_form_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_forms f
        WHERE f.form_id = NEW.edited_from_form_id
          AND f.vendor_profile_id = NEW.vendor_profile_id
     ) THEN
    RAISE EXCEPTION 'a form is edited from one of the shop''s own forms' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vendor_forms_event_scope_guard ON public.vendor_forms;
CREATE TRIGGER vendor_forms_event_scope_guard
  BEFORE INSERT OR UPDATE OF in_library, for_event_id, edited_from_form_id, vendor_profile_id ON public.vendor_forms
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_form_event_scope();

-- ── guard 1 · an event-only form is sent only into its own event ──────────
CREATE OR REPLACE FUNCTION public.guard_event_form_send_own_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vendor_forms f
     WHERE f.form_id = NEW.form_id
       AND NOT f.in_library
       AND f.for_event_id IS DISTINCT FROM NEW.event_id
  ) THEN
    RAISE EXCEPTION 'a form kept with one event is sent only into that event' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_form_sends_own_event_guard ON public.event_form_sends;
CREATE TRIGGER event_form_sends_own_event_guard
  BEFORE INSERT OR UPDATE ON public.event_form_sends
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_form_send_own_event();

-- ── guard 2 · an event-only form is linked to no card ─────────────────────
CREATE OR REPLACE FUNCTION public.guard_vendor_form_link_in_library()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendor_forms f WHERE f.form_id = NEW.form_id AND NOT f.in_library) THEN
    RAISE EXCEPTION 'a form kept with one event is linked to no service card' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vendor_form_service_links_in_library_guard ON public.vendor_form_service_links;
CREATE TRIGGER vendor_form_service_links_in_library_guard
  BEFORE INSERT OR UPDATE ON public.vendor_form_service_links
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_form_link_in_library();

COMMIT;
