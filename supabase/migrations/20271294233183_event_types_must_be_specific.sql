-- event_types_must_be_specific
-- ============================================================================
-- EVENT TYPES MUST BE SPECIFIC (owner 2026-10-28, DECISION_LOG "EVENT TYPES
-- MUST BE SPECIFIC — NO GENERIC 'CELEBRATION' / 'OTHER EVENT' FOR NEW EVENTS;
-- 'WHO IS IT FOR?' APPROVED"). Owner, verbatim: "Other Event - no we need to be
-- specific because the coverage of services." Each type scopes which supplier
-- categories cover it, so a generic one covers nothing well.
--
-- THREE PARTS, ALL ADDITIVE OR DATA:
--
--  1. "Celebration" leaves the create pickers for NEW events. It is the SAME
--     switch Admin › Event types › Status ▾ "Hidden from couples" writes
--     (`enabled = FALSE`, status stays 'active') — so the owner can flip it back
--     from the console, and EVERY creation door (the grid, /start, onboarding,
--     the create action's own `getCreatableEventTypes` check) follows one value.
--     ⚠ The enum value, the vocab row and every stored `events.event_type =
--     'celebration'` are UNTOUCHED: existing events keep working, and their host
--     is offered one line in Event settings to pick a specific type.
--
--  2. `event_type_requests` — "Can't find yours? Ask us to add it". The person
--     names the event; it lands in Admin › Event types; when the admin adds it
--     (and it is in the picker) the person is told in-app
--     (`event_type_added`, its own migration before this one). No email.
--
--  3. A GROUP may own every type its profile calls `community_eligible`. The
--     backstop CHECK `events_community_class_consistency` lagged the profiles
--     for three types (gala_night · date · hangout — profiled community_eligible
--     by 20271026170286, whose header says "a gala, a date night or a barkada
--     hangout is exactly the kind of thing a Samahan should be able to own"), so
--     a group that picked one passed the app gate and was refused by the
--     database. "Your groups" in the picker now offers them, so the CHECK is
--     widened to match. Widening only — every existing row still passes.
-- ============================================================================

-- ── 1 · Celebration: hidden from couples (not retired, not deleted) ─────────
UPDATE public.event_type_vocab
   SET enabled = FALSE, updated_at = now()
 WHERE event_type = 'celebration'
   AND enabled IS DISTINCT FROM FALSE;

-- ── 2 · The request queue ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_type_requests (
  request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who asked — the row's SUBJECT (RLS pattern A: `user_id`, their own row). Erasure deletes it
  -- (lib/erasure/coverage.ts OWN_ROW_DELETES); the CASCADE is that same decision at the database.
  user_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- What they typed — the kind of event, in their words ("Alumni homecoming").
  label         TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 80),
  --   pending   → waiting for the admin
  --   linked    → the admin made (or named) the type; it is not in the picker yet
  --   added     → the type is in the picker and the person has been told
  --   dismissed → the admin closed it without a type
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'linked', 'added', 'dismissed')),
  -- The type it became. Set exactly when it is linked or added.
  event_type    TEXT REFERENCES public.event_type_vocab(event_type),
  resolved_by   UUID,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_type_requests_type_iff_linked
    CHECK ((status IN ('linked', 'added')) = (event_type IS NOT NULL))
);

ALTER TABLE public.event_type_requests ENABLE ROW LEVEL SECURITY;

-- One open ask per person per name — a double tap is one row, not two.
CREATE UNIQUE INDEX IF NOT EXISTS event_type_requests_one_open_ask
  ON public.event_type_requests (user_id, lower(btrim(label)))
  WHERE status = 'pending';
-- The admin queue reads open asks newest first; the "added" sweep reads by type.
CREATE INDEX IF NOT EXISTS event_type_requests_status_idx
  ON public.event_type_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS event_type_requests_type_idx
  ON public.event_type_requests (event_type) WHERE event_type IS NOT NULL;

-- RLS — pattern A (per-user private data) narrowed to the verbs it needs:
-- the person may ASK (insert their own, open, untyped row) and READ their own;
-- only an admin resolves. The console reads and writes through the service
-- client after requireAdmin(); the is_admin() policy is defence in depth.
DROP POLICY IF EXISTS event_type_requests_ask ON public.event_type_requests;
CREATE POLICY event_type_requests_ask
  ON public.event_type_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND event_type IS NULL
    AND resolved_by IS NULL
    AND resolved_at IS NULL
  );

DROP POLICY IF EXISTS event_type_requests_read_own ON public.event_type_requests;
CREATE POLICY event_type_requests_read_own
  ON public.event_type_requests FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS event_type_requests_admin_write ON public.event_type_requests;
CREATE POLICY event_type_requests_admin_write
  ON public.event_type_requests FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS event_type_requests_admin_delete ON public.event_type_requests;
CREATE POLICY event_type_requests_admin_delete
  ON public.event_type_requests FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- Nobody signed out asks anything.
REVOKE ALL ON public.event_type_requests FROM anon;

COMMENT ON TABLE public.event_type_requests IS
  '"Can''t find yours? Ask us to add it" (owner 2026-10-28). A host names an event type we do not have; it shows in Admin › Event types; when the type is in the picker the host is told in-app (notification_type event_type_added). No email.';

-- ── 3 · A group may own what its profile says it may ───────────────────────
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_community_class_consistency;
ALTER TABLE public.events
  ADD CONSTRAINT events_community_class_consistency
  CHECK (
    community_id IS NULL
    OR event_type::text IN
      ('simple_event', 'corporate', 'travel', 'celebration',
       'tournament', 'reunion', 'anniversary',
       'concert', 'open_house', 'grand_opening',
       'gala_night', 'date', 'hangout')
  );
