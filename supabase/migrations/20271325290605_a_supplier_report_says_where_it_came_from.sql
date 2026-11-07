-- a supplier report says where it came from
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT = SUBJECT · NOTE · ORIGIN (owner 2026-11-08, DECISION_LOG row of that
-- name: "report will be subject, note and we must know where it came from").
--
-- A supplier files a Report from a picked client (Clients › <client> › Report).
-- It lands in the SHIPPED admin inbox — `help_messages` → /admin/help — not in
-- `user_reports` (that is the moderation queue: reason enum, event NOT NULL).
-- help_messages already carries the subject and the note; what it lacks is
-- WHERE IT CAME FROM. This migration adds exactly that:
--     origin_vendor_profile_id   the shop the report is from
--     origin_event_id            the client (event) it was filed on
--     origin_page                'clients.<page>' — the page it was filed from
--
-- ── WHY A TRIGGER AND NOT A POLICY ────────────────────────────────────────
-- `help_messages_anyone_insert` (WITH CHECK true, admits anon) is LOAD-BEARING:
-- the public /help form posts through the visitor's own session, and
-- 20271178066835's P3 proves it stays. Policies are OR'ed, so a narrower policy
-- cannot guard the new columns — a trigger does. A row with NO origin (every
-- shipped /help insert) passes untouched. A row WITH an origin must name the
-- reporter's OWN shop, and an event that shop actually talks to (a
-- chat_threads row); and its user_id is forced to whoever is signed in.
--
-- Admin is told in-app only (no email — "no new emails without his word").
-- RLS pattern unchanged: shipped insert-anyone + sender-read; admin reads via
-- the service role.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.help_messages
  ADD COLUMN IF NOT EXISTS origin_vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_event_id UUID
    REFERENCES public.events(event_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_page TEXT;

ALTER TABLE public.help_messages DROP CONSTRAINT IF EXISTS help_messages_origin_page_chk;
ALTER TABLE public.help_messages ADD CONSTRAINT help_messages_origin_page_chk
  CHECK (origin_page IS NULL OR origin_page ~ '^[a-z][a-z0-9_.]{1,63}$');

CREATE INDEX IF NOT EXISTS help_messages_origin_vendor_idx
  ON public.help_messages (origin_vendor_profile_id)
  WHERE origin_vendor_profile_id IS NOT NULL;

COMMENT ON COLUMN public.help_messages.origin_vendor_profile_id IS
  'Supplier Report (owner 2026-11-08 "REPORT = SUBJECT · NOTE · ORIGIN"): the shop it was filed from. Guarded by help_messages_origin_guard: must be the reporter''s own shop.';
COMMENT ON COLUMN public.help_messages.origin_event_id IS
  'Supplier Report: the client (event) it was filed on. Guarded: an event that shop has a conversation with.';
COMMENT ON COLUMN public.help_messages.origin_page IS
  'Supplier Report: the page it was filed from, e.g. clients.report.';

-- SECURITY INVOKER on purpose: every read below is one the reporter's own
-- session may already make (their shops via current_vendor_ids(), their own
-- chat_threads). The service role (server-side writers) passes by role.
CREATE OR REPLACE FUNCTION public.guard_help_message_origin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.origin_vendor_profile_id IS NULL
     AND NEW.origin_event_id IS NULL
     AND NEW.origin_page IS NULL THEN
    RETURN NEW;                       -- every shipped /help insert passes untouched
  END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.origin_vendor_profile_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.current_vendor_ids() AS v(id)
        WHERE v.id = NEW.origin_vendor_profile_id
     ) THEN
    RAISE EXCEPTION 'a report''s shop must be your own' USING ERRCODE = '42501';
  END IF;
  IF NEW.origin_event_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.chat_threads t
        WHERE t.event_id = NEW.origin_event_id
          AND t.vendor_profile_id = NEW.origin_vendor_profile_id
     ) THEN
    RAISE EXCEPTION 'a report can only name an event you work with' USING ERRCODE = '42501';
  END IF;
  NEW.user_id := auth.uid();          -- the reporter is who is signed in, never typed
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS help_messages_origin_guard ON public.help_messages;
CREATE TRIGGER help_messages_origin_guard
  BEFORE INSERT OR UPDATE OF origin_vendor_profile_id, origin_event_id, origin_page
  ON public.help_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_help_message_origin();

COMMIT;
