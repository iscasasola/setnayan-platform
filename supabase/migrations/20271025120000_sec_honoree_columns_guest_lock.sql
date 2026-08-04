-- 20271025120000_sec_honoree_columns_guest_lock.sql
--
-- SEC · deny events.honoree_label / honoree_dependent_id / signature_details to
--       guests, vendors and coordinators. Extends 20271008731642's guest lock.
--
-- THE HOLE. The events SELECT policies admit ANY event_members row —
-- current_event_ids() is `SELECT event_id FROM event_members WHERE user_id =
-- auth.uid()` with NO member-type filter — so guest, vendor and coordinator all
-- qualify. 20271008731642 denied birth data, budget, wizard_state and the Drive
-- folder, but NOT these three. signature_details holds a christening child's
-- birth date and sex, and a gender-reveal due date: RA 10173 sensitive personal
-- information, readable by anyone who scanned the couple's QR.
-- honoree_label / honoree_dependent_id name the celebrant — for a christening,
-- a minor — and were protected only by a comment in 20270821100000 saying they
-- are "never rendered on public/vendor/guest surfaces". A comment is not a grant.
--
-- ⚠⚠ WHY THE APP CHANGES SHIP IN THIS SAME MIGRATION'S PR — this is the whole
-- point of the PR and must not be split:
--
--   create-event/life-event-guard.ts read these columns through the RLS client
--   as `const { data } = await supabase…` — the error was DESTRUCTURED AWAY.
--   Revoke the columns and PostgREST errors, `data` is undefined, `(data ?? [])`
--   is empty, findBlockingLifeEvent([]) returns null, and the guard returns
--   "not blocked". The life-event cardinality cap — ONE in-planning wedding /
--   debut / christening / gender_reveal / birthday / graduation per honoree —
--   would silently become UNLIMITED, with green CI, because nothing checks or
--   logs the error. A security fix would have deleted the wedding cap.
--
--   Two more readers degraded the same silent way and are fixed alongside:
--     · [eventId]/checklist-actions.ts  (ceremony tailoring)
--     · [eventId]/schedule/actions.ts   (the free non-wedding Run-of-Show seed
--                                        would simply stop firing)
--
-- WHERE HOSTS READ THEM NOW: public.events_host — the couple/moderator-scoped
-- view from 20271008731642. Same columns, same row shape; guests get zero rows.
-- The edit at each call site is one token: .from('events') → .from('events_host').
--
-- ROLLBACK: re-run 20271008731642's DO block with the original private_columns
-- list (i.e. without the three added below), then rebuild the view likewise.

-- ── 1 · Deny the three columns to authenticated + anon ──────────────────────
DO $$
DECLARE
  -- 20271008731642's list, PLUS the three this migration adds. The full list is
  -- restated because the grant is recomputed from scratch below.
  private_columns TEXT[] := ARRAY[
    -- ▸ from 20271008731642 (unchanged)
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',

    -- ▸ NEW 2026-07-30. signature_details is the per-type onboarding payload:
    --   for a christening the child's birth date + sex, for a gender reveal the
    --   due date. Sensitive PI, and the celebrant is usually a minor.
    'signature_details',
    -- ▸ The celebrant's first name, and the FK to their dependents row. Together
    --   they identify a specific child to every guest, vendor and coordinator on
    --   the event. honoree_dependent_id additionally leaks that the honoree is a
    --   registered alaga — a minor's profile behind the dependent_minor_profiles
    --   control — to people who have no relationship with the guardian.
    'honoree_label',
    'honoree_dependent_id'
  ];
  missing TEXT;
  role_name TEXT;
  allowed TEXT;
BEGIN
  -- Fail loudly rather than silently skipping a renamed column.
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(private_columns) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'private_columns names non-existent events column(s): %', missing;
  END IF;

  FOREACH role_name IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    -- Recompute the allow-list from what the role can read TODAY minus the
    -- private set, so this composes with every earlier narrowing instead of
    -- resurrecting a column some other migration already denied.
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO allowed
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'events'
      AND c.column_name <> ALL (private_columns)
      AND has_column_privilege(role_name, 'public.events', c.column_name, 'SELECT');

    IF allowed IS NULL THEN
      RAISE EXCEPTION 'refusing to apply: computed allow-list for % is empty', role_name;
    END IF;

    -- Table-level REVOKE then a column allow-list GRANT. A bare column REVOKE is
    -- a silent no-op where a table-level grant exists.
    EXECUTE format('REVOKE SELECT ON public.events FROM %I', role_name);
    EXECUTE format('GRANT SELECT (%s) ON public.events TO %I', allowed, role_name);
  END LOOP;

  EXECUTE 'GRANT SELECT ON public.events TO service_role';
END $$;

-- ── 2 · Rebuild events_host so hosts keep reading them ──────────────────────
-- The projection is "everything authenticated may still read, PLUS the private
-- set" — so the three new columns must appear in this list or the host loses
-- them too.
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

-- Grant block reproduced verbatim from 20271008731642:387-390 — the REVOKE from
-- authenticated before the GRANT is what keeps a recreated view from inheriting
-- anything wider than SELECT.
REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

-- ── 3 · Post-conditions — prove the lock, and prove it did not overreach ────
DO $$
DECLARE
  r TEXT;
  c TEXT;
  leaked TEXT;
  lost   TEXT;
BEGIN
  -- (a) the three are unreadable by authenticated AND anon
  FOREACH r IN ARRAY ARRAY['authenticated','anon'] LOOP
    FOREACH c IN ARRAY ARRAY['signature_details','honoree_label','honoree_dependent_id'] LOOP
      IF has_column_privilege(r, 'public.events', c, 'SELECT') THEN
        leaked := coalesce(leaked || ', ', '') || r || '.' || c;
      END IF;
    END LOOP;
  END LOOP;
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'events column-SELECT lock failed — still readable: %', leaked;
  END IF;

  -- (b) the REVOKE SELECT did not disturb the column-scoped INSERT/UPDATE grants
  --     that 20271005100000 established (a table-level REVOKE SELECT must not
  --     collaterally drop write privileges).
  SELECT string_agg(c2.column_name, ', ') INTO lost
  FROM information_schema.columns c2
  WHERE c2.table_schema = 'public' AND c2.table_name = 'events'
    AND c2.column_name IN ('display_name','event_date','venue_name')
    AND NOT has_column_privilege('authenticated', 'public.events', c2.column_name, 'UPDATE');
  IF lost IS NOT NULL THEN
    RAISE EXCEPTION 'collateral damage: authenticated lost UPDATE on %', lost;
  END IF;

  -- (c) the host view still projects all three, or the guard has nowhere to read
  FOREACH c IN ARRAY ARRAY['signature_details','honoree_label','honoree_dependent_id'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = c
    ) THEN
      RAISE EXCEPTION 'events_host lost column % — the life-event guard would fail open', c;
    END IF;
  END LOOP;
END $$;
