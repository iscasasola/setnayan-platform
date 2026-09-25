-- events_print_details
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- constraint dropped before it is re-added, the view dropped before rebuild).
--
-- ⚖ EVENT HUB MAKER · PHASE 9 — PRINTS & TICKETS
-- (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 9 · DECISION_LOG 2026-09-24
-- "the printed invitation is a 3-card set … new fields needed: parents' names,
-- opening line").
--
-- The printed set needs a few things that have NO other home — and nothing that
-- does (owner 2026-09-25: parents live on the GUEST LIST, gift details on
-- E-GIFTS, the thank-you message is the E-Gifts message, the special message is
-- `events.special_message`; none of them is ever copied in here):
--   · opening_line — "With thanksgiving to God and with the blessing of our
--                 parents," — the couple's own words (templates FILL the box;
--                 the saved value is always their text).
--   · rsvp        — the "Kindly reply" CHOICE: { kind: 'host', moderator_id }
--                 (a host or the coordinator, whose name and number are read from
--                 their own account at print time) or { kind: 'manual', text }.
--   · include     — the Maker's Details toggles: what the prints include (guest
--                 names, parents, seat plan 3D/2D/List, E-Gifts details, the
--                 thank-you message, Love Story, the schedule, Mood Board colours,
--                 an NFC sticker spot, the opening line, the reply line, the
--                 special message). The Event Hub QR is not a toggle — it always
--                 prints (owner: "QR is automatic. NFC is optional").
--
-- 🔑 ONE JSONB, NOT A COLUMN PER CHOICE. All of it is read by the print set and
-- written by one form (the Maker's Details panel); a column each would be a
-- grant, an `events_host` projection and an exposure-baseline line apiece.
--
-- 🔑 NO CEREMONY-TIME COLUMN. Print uses the CEREMONY block's time from
-- `event_schedule_blocks` (block_type = 'ceremony'), not the first schedule item
-- and not a second typed copy of it (THEMES-2026-09-24.md: the hub shows the
-- arrival time, the paper shows the ceremony).
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS print_details JSONB;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_print_details_shape;
ALTER TABLE public.events
  ADD CONSTRAINT events_print_details_shape
  CHECK (
    print_details IS NULL
    OR (jsonb_typeof(print_details) = 'object' AND pg_column_size(print_details) <= 16384)
  );

COMMENT ON COLUMN public.events.print_details IS
  'Prints & Tickets (Event Hub Maker Phase 9): { opening_line, rsvp: {kind: host|manual, moderator_id|text}, '
  'include: {…toggles} }. Only what has no other home — parents are read from the guest list, gifts from '
  'E-Gifts. Read and sanitised by parsePrintDetails() in apps/web/lib/print-pieces.ts; written by POST '
  '/api/hub-print/words through the admin client after the host''s membership is proven. NULL = never set.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY NAMING IT DIES ──
-- `public.events` revokes table-level SELECT and re-grants a per-column
-- allowlist (20271007100000 / 20271025120000); an ungranted column makes
-- PostgREST refuse the ENTIRE query that names it.
--
-- ✅ WHICH ROLES NAME IT — asked per role, not "is there a grant":
--   · authenticated — SELECT. A host's own session may read it (the Maker's
--     workspace). No UPDATE: the only writer is the print route, which writes
--     through createAdminClient() after requireHostMembership — a session write
--     grant would widen the surface for a writer that does not exist.
--   · anon — NOTHING. No guest surface reads it; the print set is the couple's.
--   · service_role — already holds ALL on the table.
GRANT SELECT (print_details) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271243462207 — extracted
-- mechanically, not retyped — including its private list and its
-- refuse-if-empty guard.

DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          -- service_role only, named EXPLICITLY. NOT `auth.uid() IS NULL` —
          -- that is also true for anon, which would hand every row to an
          -- unauthenticated caller. Reproduced verbatim from 20271008731642.
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

-- ── POST-CONDITIONS — refuse to apply rather than ship a half-grant ─────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'print_details', 'SELECT') THEN
    RAISE EXCEPTION 'events.print_details is not readable by authenticated — every events query naming it would be refused';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'print_details', 'SELECT') THEN
    RAISE EXCEPTION 'events.print_details is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'print_details'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without print_details';
  END IF;
  -- The private columns must STILL project for hosts — a DROP VIEW + recompute
  -- can silently lose them, and that failure renders exactly like a couple who
  -- never filled those fields in.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 5 THEN
    RAISE EXCEPTION 'events_host lost a host-only private column in the rebuild';
  END IF;
END $$;
