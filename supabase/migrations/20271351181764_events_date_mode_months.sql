-- ============================================================================
-- "SOME MONTHS" — A DATE MODE OF ITS OWN (Find · Build · Book, Build 1 — owner 2026-11-17)
-- ============================================================================
--
-- Owner, 2026-11-17 (drawing v15 · DECISION_LOG "Find·Build·Book open questions" Q1/Q5), approved for this PR the same
-- day ("Yes, all five", relayed by the controller on PR #7920): the When step offers "Some months — up to 3, apart",
-- and "Not sure yet" always ends in a 1–3 month pick, never blank. Neither shape fits the shipped two
-- (`specific` = 1–4 candidate DAYS · `window` = one contiguous range), so:
--
--   events.date_mode  CHECK widened to admit 'months'
--   events.date_months DATE[] — the FIRST DAY of each month picked (YYYY-MM-01), up to 3, no duplicates.
--                      Only meaningful with date_mode = 'months'; event_date stays EMPTY, exactly like the other two
--                      (the date is an OUTPUT — a booking makes it exact).
--
-- 🔒 GRANTS: `public.events` revokes table-level SELECT/UPDATE and re-grants per-column allowlists — an ungranted
-- column makes PostgREST refuse the WHOLE query that names it (lint-events-column-grants). The host writes this on
-- their own session (create + the date sheet), exactly like recur_cadence: SELECT · UPDATE · INSERT to authenticated.
-- anon gets NOTHING — no guest-facing reader names it.
-- events_host is rebuilt after the grants because its projection is COMPUTED from them; the block is copied
-- VERBATIM from its latest carrier, 20271344065097 (extracted mechanically, not retyped).
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS date_months DATE[];

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_date_mode_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_date_mode_check
  CHECK (date_mode IS NULL OR date_mode IN ('specific', 'window', 'months'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_date_months_shape_check') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_date_months_shape_check
      CHECK (
        date_months IS NULL
        OR (
          cardinality(date_months) BETWEEN 1 AND 3
          AND array_position(date_months, NULL) IS NULL
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.events.date_months IS
  'date_mode = months: the first day (YYYY-MM-01) of each month the host is considering, up to 3 (owner 2026-11-17 "Some months"). event_date stays empty until a booking makes it exact.';

GRANT SELECT (date_months) ON public.events TO authenticated;
GRANT UPDATE (date_months) ON public.events TO authenticated;
GRANT INSERT (date_months) ON public.events TO authenticated;

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

COMMIT;
