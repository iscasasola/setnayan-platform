-- A couple may leave the same-date count.
--
-- ⚖ DPO ruling 2026-10-23 (corpus DECISION_LOG, "OWNER ANSWERS ON THE BUILD
-- TRACKER"): *"couples may opt out of the same-date count"*. Until now /privacy
-- said plainly "You cannot switch this one off" (RoPA DPS-17 carried the open
-- question for the DPO). This is the switch.
--
-- What it does: an event with this set is left out of the count other couples
-- see ("N other couples inquired for your date"). It does not change what this
-- couple sees, and it never reaches a supplier.
--
-- ── GRANTS ──────────────────────────────────────────────────────────────────
-- `events` SELECT is a column allowlist (20271007100000), so a new column is
-- born unreadable to `authenticated`: GRANT SELECT so the couple's own settings
-- page can read their answer. NO UPDATE grant — `events` UPDATE RLS is
-- row-level, so the couple writes it through a membership-checked server action
-- on the service role, the same shape as `live_media_public`.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS same_date_count_opt_out boolean NOT NULL DEFAULT false;

GRANT SELECT (same_date_count_opt_out) ON public.events TO authenticated;

COMMENT ON COLUMN public.events.same_date_count_opt_out IS
  'The couple left the same-date count (DPO ruling 2026-10-23). TRUE = this '
  'event never contributes to the "N other couples inquired for your date" '
  'count other couples see. Read by the couple vendors page holds query; '
  'written by setSameDateCountOptOut (service-role, host-checked).';

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271276545380 (the latest
-- carrier of it) — extracted mechanically, not retyped — including its private
-- list and its refuse-if-empty guard.

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
