-- events_reveal_stages
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- constraint dropped before it is re-added, the view dropped before rebuild).
--
-- 🎭 WHERE THE REVEAL PLAYS — THE COUPLE'S CHOICE
-- Owner, 2026-09-25, verbatim (DECISION_LOG "OWNER ANSWERS — SIX CONTROLLER
-- QUESTIONS"): "they can pick where the want to keep it. having it on the
-- invitation and on the day will onlay be during the hero scene (First page)
-- after that, it will disappear."
--
-- The stages the couple has the opening play on — any of 'save_the_date',
-- 'rsvp' (the Invitation) and 'event' (On the Day). Never 'editorial': after the
-- day the story's cover leads the page.
--
-- 🔑 NULL = NEVER CHOSEN, NOT A DEFAULT WRITTEN FOR THEM. A NULL reads as the
-- 2026-09-14 rule it relaxes — the Save the Date only (`resolveRevealStages`,
-- apps/web/lib/reveal-stages.ts) — so every existing event keeps exactly the
-- page it has today, and no row claims a choice nobody made. An EMPTY array is
-- a real answer (every stage switched off).
--
-- 💾 Written only by the Event Hub Maker's draft → Apply (lib/hub-draft.ts,
-- `reveal_stages`), through the host's own session — so authenticated needs
-- UPDATE as well as SELECT. Read on the guest page and the invite door through
-- the admin client (app/[slug]/_lib/loaders.ts, app/[slug]/invite/page.tsx), so
-- anon needs nothing.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reveal_stages TEXT[];

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_reveal_stages_known;
ALTER TABLE public.events
  ADD CONSTRAINT events_reveal_stages_known
  CHECK (
    reveal_stages IS NULL
    OR reveal_stages <@ ARRAY['save_the_date', 'rsvp', 'event']::TEXT[]
  );

COMMENT ON COLUMN public.events.reveal_stages IS
  'Where the couple has the reveal (opening) play: any of save_the_date, rsvp (the Invitation), event (On the Day). '
  'Off the Save the Date it plays on the hero scene only. NULL = never chosen = the Save the Date only '
  '(resolveRevealStages in apps/web/lib/reveal-stages.ts). Written by the Event Hub Maker draft Apply.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY NAMING IT DIES ──
-- `public.events` revokes table-level SELECT and re-grants a per-column
-- allowlist (20271007100000 / 20271025120000); an ungranted column makes
-- PostgREST refuse the ENTIRE query that names it.
--   · authenticated — SELECT (the Maker reads it through the host's session)
--     and UPDATE (the draft's Apply writes it through the host's session).
--   · anon — NOTHING. Every guest surface reads the event through the admin client.
--   · service_role — already holds ALL on the table.
GRANT SELECT (reveal_stages) ON public.events TO authenticated;
GRANT UPDATE (reveal_stages) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271247112792 — extracted
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
  IF NOT has_column_privilege('authenticated', 'public.events', 'reveal_stages', 'SELECT') THEN
    RAISE EXCEPTION 'events.reveal_stages is not readable by authenticated — every events query naming it would be refused';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'reveal_stages', 'UPDATE') THEN
    RAISE EXCEPTION 'events.reveal_stages is not writable by authenticated — the Maker could never apply the choice';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'reveal_stages', 'SELECT') THEN
    RAISE EXCEPTION 'events.reveal_stages is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'reveal_stages'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without reveal_stages';
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
