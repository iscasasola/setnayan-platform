-- event_days_how_many_days_is_your_event
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📅 "HOW MANY DAYS IS YOUR EVENT?" (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE APPROVED — HOW MANY DAYS?
-- FIRST · N-DAY OPTIONS · EXACT DATE CAN BE A RANGE · ONE CITY OR AREA"; prototype
-- `prototypes/event_dates_edit_2026-11-13/index.html`; plan `plans/per_day_coverage_2026-11-13/PLAN.md` step 1).
--
-- ── THE ONE NEW FACT: `events.event_days` ─────────────────────────────────────────────────────────────────────────
-- How many days the event runs. 1 (the default) is every event as it is today. The cap is PER EVENT TYPE
-- (`event_type_profiles.max_days`, 20271343002292 — 30 · 7 · 1); the column's own CHECK is only the outer bound
-- 1..30, and the app refuses past the type's own cap (`eventSpanRefusal`, lib/event-type-profile.ts).
--
--   · While the date is still OPTIONS (`date_mode` 'specific' + `date_candidates`, or a `date_window_*` range),
--     each candidate is the START day of an N-day option, and a window is where the N-day block may START. This
--     column is the only place N lives while nothing is exact.
--   · Once the date is exact (`event_date` → `event_end_date`, the one main span — DECISION_LOG 2026-11-13 "ONE MAIN
--     DATE SPAN"), the writers keep this column equal to the span's length (end − start + 1), so the two never
--     disagree. Both writers are in `app/dashboard/[eventId]/actions.ts` (`updateEventDate`,
--     `updateEventDateOptions`) and the onboarding insert (`lib/onboarding/event-insert.ts`).
--
-- Additive. No back-fill beyond the default (every live event is a 1-day event: measured in the plan, "0 multi-day
-- events"). RLS unchanged: the existing row policies on `events` govern who may write it.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_days SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_days_range' AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_days_range CHECK (event_days BETWEEN 1 AND 30);
  END IF;
END $$;

COMMENT ON COLUMN public.events.event_days IS
  'How many days the event runs (owner 2026-11-13, "How many days is your event?"). 1 = a one-day event (default). '
  'Capped per type by event_type_profiles.max_days in the app; 1..30 here. While the date is options, each '
  'date_candidates entry is the START of an N-day option and a date_window_* range is where the block may start; '
  'once exact, it equals event_end_date - event_date + 1.';

-- ── WHO MAY READ AND WRITE IT ───────────────────────────────────────────────────────────────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column allowlists (20271007100000,
-- 20271005100000): a new column is born unreadable AND unwritable to `authenticated`, and an ungranted column makes
-- PostgREST refuse the ENTIRE query that names it.
--   · authenticated — SELECT (the Suppliers page and its date sheet read it on the host's session) + UPDATE (the
--     date writers in `actions.ts` write it on the couple's own session, so RLS still decides the row).
--   · anon — NOTHING. No guest-facing reader names it.
GRANT SELECT (event_days) ON public.events TO authenticated;
GRANT UPDATE (event_days) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT), so the block below is reproduced
-- VERBATIM from 20271302139506 (the latest carrier of it) — extracted mechanically, not retyped — including its
-- private list and its refuse-if-empty guard.

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

-- ── PROOF — it proves itself on apply ───────────────────────────────────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'event_days', 'SELECT') THEN
    RAISE EXCEPTION 'event_days: authenticated cannot read it — every events query naming it would fail';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'event_days', 'UPDATE') THEN
    RAISE EXCEPTION 'event_days: authenticated cannot write it — the couple''s date save would fail';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'event_days'
  ) THEN
    RAISE EXCEPTION 'event_days: events_host does not carry it — the host read path would refuse it';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token', 'photo_delivery_oauth_token_encrypted', 'photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'event_days: events_host now projects a secret column — the rebuild widened it';
  END IF;
END $$;
