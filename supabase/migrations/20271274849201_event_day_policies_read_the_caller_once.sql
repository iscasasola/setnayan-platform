-- ============================================================================
-- Event-day load · the hot tables' policies read the caller ONCE per query
-- ============================================================================
--
-- WHAT CHANGES: in 37 row-level-security policies on the fifteen tables an
-- event day hits hardest, every bare `auth.uid()`, `auth.jwt()`, `auth.role()`
-- and `is_admin()` is wrapped as `(select auth.uid())` etc. NOTHING ELSE — not a
-- name, a command, a role, a permissive/restrictive mode, or any other word of
-- any predicate. The text below is production's LIVE `pg_policy` text (measured
-- 2026-10-18 via a SELECT-only read and found byte-identical to the migration
-- replay's), with only that wrapping applied.
--
-- WHY: a bare STABLE call in a policy is evaluated once PER ROW the policy
-- looks at; wrapped in a scalar sub-SELECT, Postgres plans it as an InitPlan and
-- evaluates it ONCE PER QUERY. Supabase's advisor `auth_rls_initplan` flags
-- exactly this (302 findings, 27 of them on these tables); `is_admin()` is the
-- same shape (a STABLE zero-argument SQL function that reads public.users), so
-- it gets the same wrapping.
--
-- WHY THE ANSWER CANNOT CHANGE: each wrapped function takes no argument and is
-- STABLE (auth.uid/jwt/role read the request's JWT GUCs; is_admin reads
-- public.users). A STABLE function returns the same value for the same
-- arguments within one statement, and an InitPlan runs inside that same
-- statement with that same snapshot — so "once per row" and "once per query"
-- return the identical value for every row. The DO block at the bottom refuses
-- to commit unless every policy's new text is exactly its old text with that
-- wrapping and nothing else, and `apps/web/tests/db/
-- event-day-policies-admit-the-same-rows.db.test.ts` proves owner / guest /
-- coordinator / stranger / admin see and write the same rows before and after.
--
-- ⚠ Policies not listed here were NOT touched: a helper that takes the row's
-- own column (`moderator_area_level(event_id, …)`, `is_limited_helper(event_id)`,
-- `is_event_member(event_id, user_id)`) depends on the row and cannot be hoisted.
-- `IN (SELECT current_couple_event_ids())` is already an uncorrelated sub-SELECT
-- (a hashed SubPlan, evaluated once) and is left exactly as written.
--
-- Also here: `count_unread_message_threads()` reads auth.uid() once instead of
-- once per message and per read-marker row. Same body, same signature, same
-- STABLE SECURITY DEFINER + search_path; CREATE OR REPLACE keeps its grants.
-- ============================================================================

-- ── the "before", for the self-check at the bottom ─────────────────────────
CREATE TEMP TABLE IF NOT EXISTS _event_day_policy_before (
  tbl   text NOT NULL,
  pol   text NOT NULL,
  mode  boolean,
  cmd   "char",
  roles oid[],
  qual  text,
  chk   text
);
TRUNCATE _event_day_policy_before;

INSERT INTO _event_day_policy_before (tbl, pol, mode, cmd, roles, qual, chk)
SELECT v.tbl, v.pol, p.polpermissive, p.polcmd, p.polroles,
       pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)
  FROM (VALUES
    ('events', 'anon_cannot_create_public_event'),
    ('events', 'anon_cannot_publish_event'),
    ('events', 'couple_can_delete_event'),
    ('events', 'couple_can_update_event'),
    ('event_members', 'couple_can_add_member'),
    ('event_members', 'couple_can_delete_member'),
    ('event_members', 'couple_can_update_member'),
    ('event_members', 'member_reads_membership'),
    ('event_moderators', 'event_moderators_select_own_events'),
    ('guests', 'couple_writes_guest'),
    ('orders', 'orders_insert_status_guard'),
    ('orders', 'orders_owner_read'),
    ('orders', 'orders_owner_write'),
    ('orders', 'orders_update_status_guard'),
    ('payments', 'payments_insert_status_guard'),
    ('payments', 'payments_owner_insert'),
    ('payments', 'payments_owner_read'),
    ('notifications', 'notifications_recipient_read'),
    ('notifications', 'notifications_recipient_update'),
    ('papic_photos', 'papic_photos_claimer_delete'),
    ('papic_photos', 'papic_photos_claimer_read'),
    ('papic_photos', 'papic_photos_claimer_update'),
    ('papic_photos', 'papic_photos_couple_delete'),
    ('papic_photos', 'papic_photos_couple_read'),
    ('papic_photos', 'papic_photos_couple_update'),
    ('papic_guest_captures', 'papic_guest_captures_admin_all'),
    ('papic_guest_captures', 'papic_guest_captures_couple_read'),
    ('papic_mission_completions', 'papic_mission_completions_admin_all'),
    ('papic_mission_completions', 'papic_mission_completions_host_decides'),
    ('papic_mission_completions', 'papic_mission_completions_member_read'),
    ('papic_missions', 'papic_missions_member_all'),
    ('papic_limited_snapshots', 'papic_limited_snapshots_couple_full'),
    ('papic_seat_day_usage', 'papic_seat_day_usage_claimer_read'),
    ('papic_seat_day_usage', 'papic_seat_day_usage_couple_full'),
    ('vendor_profiles', 'vendor_profiles_admin_unclaimed_read'),
    ('vendor_profiles', 'vendor_profiles_admin_unclaimed_write'),
    ('vendor_profiles', 'vendor_profiles_owner')
  ) AS v(tbl, pol)
  LEFT JOIN pg_policy p
    ON p.polrelid = ('public.' || v.tbl)::regclass AND p.polname = v.pol;

-- ── public.events ────────────────────────────────────────────────────────────
ALTER POLICY anon_cannot_create_public_event ON public.events
  WITH CHECK ((((((select auth.jwt()) ->> 'is_anonymous'::text))::boolean IS NOT TRUE) OR ((landing_page_visibility = 'private'::text) AND (scheduled_launch_at IS NULL))));
ALTER POLICY anon_cannot_publish_event ON public.events
  USING (true)
  WITH CHECK ((((((select auth.jwt()) ->> 'is_anonymous'::text))::boolean IS NOT TRUE) OR ((landing_page_visibility = 'private'::text) AND (scheduled_launch_at IS NULL))));
ALTER POLICY couple_can_delete_event ON public.events
  USING (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));
ALTER POLICY couple_can_update_event ON public.events
  USING (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));

-- ── public.event_members ─────────────────────────────────────────────────────
ALTER POLICY couple_can_add_member ON public.event_members
  WITH CHECK (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));
ALTER POLICY couple_can_delete_member ON public.event_members
  USING (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));
ALTER POLICY couple_can_update_member ON public.event_members
  USING (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));
ALTER POLICY member_reads_membership ON public.event_members
  USING (((user_id = (select auth.uid())) OR (event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));

-- ── public.event_moderators ──────────────────────────────────────────────────
ALTER POLICY event_moderators_select_own_events ON public.event_moderators
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = event_moderators.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));

-- ── public.guests ────────────────────────────────────────────────────────────
ALTER POLICY couple_writes_guest ON public.guests
  USING (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())))
  WITH CHECK (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (select public.is_admin())));

-- ── public.orders ────────────────────────────────────────────────────────────
ALTER POLICY orders_insert_status_guard ON public.orders
  WITH CHECK ((((select auth.role()) = 'service_role'::text) OR (select public.is_admin()) OR (status = ANY (ARRAY['draft'::order_status, 'submitted'::order_status, 'awaiting_payment'::order_status, 'cancelled'::order_status]))));
ALTER POLICY orders_owner_read ON public.orders
  USING (((user_id = (select auth.uid())) OR (select public.is_admin()) OR ((event_id IN ( SELECT current_couple_or_coordinator_event_ids() AS current_couple_or_coordinator_event_ids)) AND ((user_id IS NULL) OR is_event_member(event_id, user_id)))));
ALTER POLICY orders_owner_write ON public.orders
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY orders_update_status_guard ON public.orders
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((((select auth.role()) = 'service_role'::text) OR (select public.is_admin()) OR (status = ANY (ARRAY['draft'::order_status, 'submitted'::order_status, 'awaiting_payment'::order_status, 'cancelled'::order_status]))));

-- ── public.payments ──────────────────────────────────────────────────────────
ALTER POLICY payments_insert_status_guard ON public.payments
  WITH CHECK ((((select auth.role()) = 'service_role'::text) OR (select public.is_admin()) OR (status = 'pending'::payment_status)));
ALTER POLICY payments_owner_insert ON public.payments
  WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY payments_owner_read ON public.payments
  USING ((user_id = (select auth.uid())));

-- ── public.notifications ─────────────────────────────────────────────────────
ALTER POLICY notifications_recipient_read ON public.notifications
  USING ((user_id = (select auth.uid())));
ALTER POLICY notifications_recipient_update ON public.notifications
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- ── public.papic_photos ──────────────────────────────────────────────────────
ALTER POLICY papic_photos_claimer_delete ON public.papic_photos
  USING ((EXISTS ( SELECT 1 FROM paparazzi_seats ps WHERE ((ps.seat_id = papic_photos.paparazzi_seat_id) AND (ps.claimer_user_id = (select auth.uid())) AND (ps.event_id = papic_photos.event_id)))));
ALTER POLICY papic_photos_claimer_read ON public.papic_photos
  USING ((EXISTS ( SELECT 1 FROM paparazzi_seats ps WHERE ((ps.seat_id = papic_photos.paparazzi_seat_id) AND (ps.claimer_user_id = (select auth.uid())) AND (ps.event_id = papic_photos.event_id)))));
ALTER POLICY papic_photos_claimer_update ON public.papic_photos
  USING ((EXISTS ( SELECT 1 FROM paparazzi_seats ps WHERE ((ps.seat_id = papic_photos.paparazzi_seat_id) AND (ps.claimer_user_id = (select auth.uid())) AND (ps.event_id = papic_photos.event_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM paparazzi_seats ps WHERE ((ps.seat_id = papic_photos.paparazzi_seat_id) AND (ps.claimer_user_id = (select auth.uid())) AND (ps.revoked_at IS NULL) AND (ps.event_id = papic_photos.event_id)))));
ALTER POLICY papic_photos_couple_delete ON public.papic_photos
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_photos.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));
ALTER POLICY papic_photos_couple_read ON public.papic_photos
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_photos.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));
ALTER POLICY papic_photos_couple_update ON public.papic_photos
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_photos.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))))
  WITH CHECK (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_photos.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));

-- ── public.papic_guest_captures ──────────────────────────────────────────────
ALTER POLICY papic_guest_captures_admin_all ON public.papic_guest_captures
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));
ALTER POLICY papic_guest_captures_couple_read ON public.papic_guest_captures
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_guest_captures.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));

-- ── public.papic_mission_completions ─────────────────────────────────────────
ALTER POLICY papic_mission_completions_admin_all ON public.papic_mission_completions
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));
ALTER POLICY papic_mission_completions_host_decides ON public.papic_mission_completions
  USING (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (event_id IN ( SELECT em.event_id FROM event_moderators em WHERE ((em.user_id = (select auth.uid())) AND (em.accepted_at IS NOT NULL) AND (em.removed_at IS NULL))))))
  WITH CHECK (((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR (event_id IN ( SELECT em.event_id FROM event_moderators em WHERE ((em.user_id = (select auth.uid())) AND (em.accepted_at IS NOT NULL) AND (em.removed_at IS NULL))))));
ALTER POLICY papic_mission_completions_member_read ON public.papic_mission_completions
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_mission_completions.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = ANY (ARRAY['couple'::member_type, 'coordinator'::member_type])))))));

-- ── public.papic_missions ────────────────────────────────────────────────────
ALTER POLICY papic_missions_member_all ON public.papic_missions
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_missions.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = ANY (ARRAY['couple'::member_type, 'coordinator'::member_type])))))))
  WITH CHECK (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_missions.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = ANY (ARRAY['couple'::member_type, 'coordinator'::member_type])))))));

-- ── public.papic_limited_snapshots ───────────────────────────────────────────
ALTER POLICY papic_limited_snapshots_couple_full ON public.papic_limited_snapshots
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_limited_snapshots.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))))
  WITH CHECK (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_limited_snapshots.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));

-- ── public.papic_seat_day_usage ──────────────────────────────────────────────
ALTER POLICY papic_seat_day_usage_claimer_read ON public.papic_seat_day_usage
  USING ((EXISTS ( SELECT 1 FROM paparazzi_seats ps WHERE ((ps.seat_id = papic_seat_day_usage.seat_id) AND (ps.claimer_user_id = (select auth.uid()))))));
ALTER POLICY papic_seat_day_usage_couple_full ON public.papic_seat_day_usage
  USING (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_seat_day_usage.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))))
  WITH CHECK (((select public.is_admin()) OR (EXISTS ( SELECT 1 FROM event_members em WHERE ((em.event_id = papic_seat_day_usage.event_id) AND (em.user_id = (select auth.uid())) AND (em.member_type = 'couple'::member_type))))));

-- ── public.vendor_profiles ───────────────────────────────────────────────────
ALTER POLICY vendor_profiles_admin_unclaimed_read ON public.vendor_profiles
  USING (((user_id IS NULL) AND (select public.is_admin())));
ALTER POLICY vendor_profiles_admin_unclaimed_write ON public.vendor_profiles
  USING (((user_id IS NULL) AND (select public.is_admin())))
  WITH CHECK ((select public.is_admin()));
ALTER POLICY vendor_profiles_owner ON public.vendor_profiles
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- ── the unread-messages badge's count: auth.uid() once per call ───────────
CREATE OR REPLACE FUNCTION public.count_unread_message_threads()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.chat_threads t
  WHERE (
    t.event_id IN (SELECT public.current_couple_event_ids())
    OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  )
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.thread_id = t.thread_id
      AND m.sender_user_id IS DISTINCT FROM (SELECT auth.uid())
      AND m.created_at > COALESCE(
        (SELECT r.last_read_at FROM public.chat_thread_reads r
         WHERE r.thread_id = t.thread_id AND r.user_id = (SELECT auth.uid())),
        'epoch'::timestamptz)
  );
$$;

-- ── SELF-CHECK: refuse to commit unless ONLY the wrapping changed ─────────
-- Re-runnable: an already-wrapped "before" is unwrapped first, so applying this
-- file twice expects the same end state instead of a double wrap.
DO $$
DECLARE
  r         record;
  now_qual  text;
  now_chk   text;
  now_mode  boolean;
  now_cmd   "char";
  now_roles oid[];
  bad       text := '';
  n         int  := 0;
BEGIN
  FOR r IN SELECT * FROM _event_day_policy_before LOOP
    n := n + 1;
    IF r.qual IS NULL AND r.chk IS NULL THEN
      bad := bad || format(E'\n  %s.%s: not found before the rewrite', r.tbl, r.pol);
      CONTINUE;
    END IF;
    SELECT pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid),
           p.polpermissive, p.polcmd, p.polroles
      INTO now_qual, now_chk, now_mode, now_cmd, now_roles
      FROM pg_policy p
     WHERE p.polrelid = ('public.' || r.tbl)::regclass AND p.polname = r.pol;
    IF now_mode IS DISTINCT FROM r.mode OR now_cmd IS DISTINCT FROM r.cmd
       OR now_roles IS DISTINCT FROM r.roles THEN
      bad := bad || format(E'\n  %s.%s: mode/command/roles changed', r.tbl, r.pol);
    END IF;
    IF now_qual IS DISTINCT FROM
         replace(replace(replace(replace(
         replace(replace(replace(replace(r.qual,
           '( SELECT auth.uid() AS uid)', 'auth.uid()'),
           '( SELECT auth.jwt() AS jwt)', 'auth.jwt()'),
           '( SELECT auth.role() AS role)', 'auth.role()'),
           '( SELECT is_admin() AS is_admin)', 'is_admin()'),
           'auth.uid()', '( SELECT auth.uid() AS uid)'),
           'auth.jwt()', '( SELECT auth.jwt() AS jwt)'),
           'auth.role()', '( SELECT auth.role() AS role)'),
           'is_admin()', '( SELECT is_admin() AS is_admin)')
    THEN
      bad := bad || format(E'\n  %s.%s USING: %s', r.tbl, r.pol, now_qual);
    END IF;
    IF now_chk IS DISTINCT FROM
         replace(replace(replace(replace(
         replace(replace(replace(replace(r.chk,
           '( SELECT auth.uid() AS uid)', 'auth.uid()'),
           '( SELECT auth.jwt() AS jwt)', 'auth.jwt()'),
           '( SELECT auth.role() AS role)', 'auth.role()'),
           '( SELECT is_admin() AS is_admin)', 'is_admin()'),
           'auth.uid()', '( SELECT auth.uid() AS uid)'),
           'auth.jwt()', '( SELECT auth.jwt() AS jwt)'),
           'auth.role()', '( SELECT auth.role() AS role)'),
           'is_admin()', '( SELECT is_admin() AS is_admin)')
    THEN
      bad := bad || format(E'\n  %s.%s WITH CHECK: %s', r.tbl, r.pol, now_chk);
    END IF;
  END LOOP;
  IF n <> 37 THEN
    bad := bad || format(E'\n  expected 37 policies in the list, found %s', n);
  END IF;
  IF bad <> '' THEN
    RAISE EXCEPTION 'event-day policy rewrite changed more than the wrapping:%', bad;
  END IF;
END $$;

DROP TABLE _event_day_policy_before;
