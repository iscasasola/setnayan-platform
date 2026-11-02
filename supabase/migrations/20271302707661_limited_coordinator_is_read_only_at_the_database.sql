-- ============================================================================
-- A COORDINATOR THE HOSTS SET TO LIMITED IS READ-ONLY AT THE DATABASE TOO.
-- (event-dashboard audit 2026-11-02 #19 — the database half; the server-action
-- half is PR #7179, lib/limited-helper-gate.ts.)
--
-- Owner 2026-10-29 (DECISION_LOG "ONLY TWO LEVELS — LIMITED AND FULL",
-- lib/coordinator-access-level.ts): LIMITED is "the limited helper's grant: view
-- every part, change nothing … until you allow a part in Event details › Access".
-- It is written onto the coordinator's OWN seat (role_subtype
-- 'wedding_planner_external' → member_type 'coordinator') as
-- permissions_json.access_level = 'limited', areas all 'view'.
--
-- ── WHAT WAS OPEN ───────────────────────────────────────────────────────────
-- 1 · public.is_limited_helper(event_id) — the predicate of every RESTRICTIVE
--     lh_ro_* write refusal (migrations 20271251336140 §7, 20271288470033) and
--     of the server-action gate — asked only role_subtype = 'viewer'. A Limited
--     coordinator is not a 'viewer' seat, so all 20 lh_ro tables (Live Studio,
--     Panood, Papic missions, check-ins, guest columns, appointments…) let her
--     write. (The 19 area-gated tables already refused her: her areas are 'view'.)
-- 2 · Fourteen tables admit a writer by current_event_ids() / any accepted
--     event_moderators seat / current_moderator_event_ids() — none of which
--     looks at the seat's level, and none of which the §7 scan caught (it keyed
--     on the word 'coordinator' in the policy text). There a limited helper
--     ('viewer') could write too.
--
-- ── WHAT CHANGES (canonical patterns only — no new kind of policy) ──────────
-- 1 · is_limited_helper also answers TRUE for a live seat whose recorded level
--     is 'limited'. Every existing lh_ro_* refusal, the area-aware ones and the
--     server-action gate now cover her, with no policy rewritten.
-- 2 · The same RESTRICTIVE lh_ro_* trio (INSERT / UPDATE / DELETE, whichever the
--     table's permissive policies grant) on each table below. Where the table
--     belongs to an area a host can set to Edit, the refusal carries that area
--     exactly as 20271288470033 wrote it; where a supplier writes the same table
--     through its OWN booking arm (proposal amendments), that arm is kept.
--       vendors area     event_manual_vendors · event_category_decisions
--       vendors + supplier arm   proposal_amendments · proposal_amendment_items
--       no area (plain)  coordinator_feature_recommendations · event_egift_methods
--                        event_gift_records · event_sponsors · event_wish_items
--                        event_site_drafts · kwento_assignments
--                        patiktok_source_clips · patiktok_render_job_clips (via its job)
--
-- NOT touched, on purpose: event_day_requests (its coordinator arm is the
-- booked SUPPLIER — current_coordinator_booked_event_ids — proposing a request
-- the hosts approve, not a seat writing the plan). Couple-only policies
-- (member_type = 'couple') never admitted a Limited coordinator.
--
-- A co-host (Full access → 'couple') and a seat never asked are unchanged.
-- A refusal is written only for a verb `authenticated` is GRANTED on the table (event_gift_records holds UPDATE
-- only — its rows are inserted and removed by the server); a policy on an ungranted verb can never be reached, and
-- tests/db/a-samahan-lives-while-one-stays.db.test.ts refuses one.
-- Idempotent: CREATE OR REPLACE, DROP POLICY IF EXISTS + CREATE POLICY, then a
-- self-check that refuses to commit unless every listed table carries its trio.
-- Held by tests/db/limited-coordinator-is-read-only.db.test.ts.
-- ============================================================================

-- ── 1 · the one predicate ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_limited_helper(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_moderators m
    WHERE m.event_id = p_event_id
      AND m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL
      AND m.removed_at IS NULL
      AND (
        m.role_subtype = 'viewer'
        OR (m.permissions_json ->> 'access_level') = 'limited'
      )
  );
$$;
REVOKE ALL ON FUNCTION public.is_limited_helper(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_limited_helper(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_limited_helper(uuid) IS
  'Is the caller a live LIMITED seat on this event: a limited helper (role_subtype viewer) OR a coordinator '
  'the hosts set to Limited (permissions_json.access_level = limited, owner 2026-10-29). The predicate of every '
  'RESTRICTIVE lh_ro_* write refusal and of the server-action gate (lib/limited-helper-gate.ts).';

-- ── 2 · the refusals the scan missed ────────────────────────────────────────
DO $$
DECLARE
  r record;
  short text;
  cond text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- table,                              area,      ins,   upd,   del,   supplier arm
      ('coordinator_feature_recommendations', NULL,      true,  false, false, false),
      ('event_category_decisions',            'vendors', true,  true,  true,  false),
      ('event_egift_methods',                 NULL,      true,  true,  true,  false),
      ('event_gift_records',                  NULL,      true,  true,  true,  false),
      ('event_manual_vendors',                'vendors', true,  true,  true,  false),
      ('event_sponsors',                      NULL,      true,  true,  true,  false),
      ('event_wish_items',                    NULL,      true,  true,  true,  false),
      ('event_site_drafts',                   NULL,      true,  true,  true,  false),
      ('kwento_assignments',                  NULL,      true,  true,  true,  false),
      ('patiktok_source_clips',               NULL,      true,  true,  false, false),
      ('proposal_amendments',                 'vendors', true,  true,  false, true),
      ('proposal_amendment_items',            'vendors', true,  true,  false, true)
    ) AS v(t, area, ins, upd, del, supplier)
  LOOP
    IF to_regclass('public.' || r.t) IS NULL THEN
      CONTINUE;
    END IF;
    short := left(r.t, 40);
    cond := 'NOT public.is_limited_helper(event_id)';
    IF r.area IS NOT NULL THEN
      cond := cond || format(
        ' OR event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels(%L) l WHERE l.level = ''edit'')',
        r.area);
    END IF;
    IF r.supplier THEN
      cond := cond || ' OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_ins_' || short, r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_upd_' || short, r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_del_' || short, r.t);
    IF r.ins AND has_table_privilege('authenticated', 'public.' || r.t, 'INSERT') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)', 'lh_ro_ins_' || short, r.t, cond);
    END IF;
    IF r.upd AND has_table_privilege('authenticated', 'public.' || r.t, 'UPDATE') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s)', 'lh_ro_upd_' || short, r.t, cond);
    END IF;
    IF r.del AND has_table_privilege('authenticated', 'public.' || r.t, 'DELETE') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)', 'lh_ro_del_' || short, r.t, cond);
    END IF;
  END LOOP;
END;
$$;

-- The junction has no event_id of its own: the refusal asks of its render job's event.
DO $$
BEGIN
  IF to_regclass('public.patiktok_render_job_clips') IS NOT NULL THEN
    DROP POLICY IF EXISTS lh_ro_ins_patiktok_render_job_clips ON public.patiktok_render_job_clips;
    CREATE POLICY lh_ro_ins_patiktok_render_job_clips ON public.patiktok_render_job_clips
      AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (NOT public.is_limited_helper(
        (SELECT j.event_id FROM public.patiktok_render_jobs j WHERE j.job_id = patiktok_render_job_clips.job_id)
      ));
  END IF;
END;
$$;

-- ── 3 · self-check ──────────────────────────────────────────────────────────
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(v.t || '/' || v.cmd, ', ')
    INTO missing
    FROM (VALUES
      ('coordinator_feature_recommendations', 'INSERT'),
      ('event_category_decisions', 'INSERT'), ('event_category_decisions', 'UPDATE'), ('event_category_decisions', 'DELETE'),
      ('event_egift_methods', 'INSERT'), ('event_egift_methods', 'UPDATE'), ('event_egift_methods', 'DELETE'),
      ('event_gift_records', 'INSERT'), ('event_gift_records', 'UPDATE'), ('event_gift_records', 'DELETE'),
      ('event_manual_vendors', 'INSERT'), ('event_manual_vendors', 'UPDATE'), ('event_manual_vendors', 'DELETE'),
      ('event_sponsors', 'INSERT'), ('event_sponsors', 'UPDATE'), ('event_sponsors', 'DELETE'),
      ('event_wish_items', 'INSERT'), ('event_wish_items', 'UPDATE'), ('event_wish_items', 'DELETE'),
      ('event_site_drafts', 'INSERT'), ('event_site_drafts', 'UPDATE'), ('event_site_drafts', 'DELETE'),
      ('kwento_assignments', 'INSERT'), ('kwento_assignments', 'UPDATE'), ('kwento_assignments', 'DELETE'),
      ('patiktok_source_clips', 'INSERT'), ('patiktok_source_clips', 'UPDATE'),
      ('patiktok_render_job_clips', 'INSERT'),
      ('proposal_amendments', 'INSERT'), ('proposal_amendments', 'UPDATE'),
      ('proposal_amendment_items', 'INSERT'), ('proposal_amendment_items', 'UPDATE')
    ) AS v(t, cmd)
   WHERE to_regclass('public.' || v.t) IS NOT NULL
     AND has_table_privilege('authenticated', 'public.' || v.t, v.cmd)
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = v.t
          AND p.permissive = 'RESTRICTIVE' AND p.cmd = v.cmd
          AND coalesce(p.qual, p.with_check) ILIKE '%is_limited_helper%'
     );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'limited-seat refusal missing on: %', missing;
  END IF;
END;
$$;
