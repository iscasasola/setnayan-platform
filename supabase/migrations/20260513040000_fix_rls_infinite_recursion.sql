-- ============================================================================
-- 20260513040000_fix_rls_infinite_recursion.sql
-- Fix: RLS policies on event_members were referencing event_members in
-- subqueries, triggering infinite recursion at query time.
--
-- The root cause: USING (event_id IN (SELECT FROM event_members ...)) inside
-- a policy ON event_members causes the inner SELECT to re-trigger the same
-- policy, recursing forever. Postgres aborts with "infinite recursion
-- detected in policy".
--
-- Fix: route every subquery on event_members through a SECURITY DEFINER
-- helper that bypasses RLS for the lookup. Adds two new helpers in addition
-- to the four locked ones, then rewrites every policy that referenced
-- event_members inline.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. New SECURITY DEFINER helpers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_couple_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id FROM public.event_members
  WHERE user_id = auth.uid() AND member_type = 'couple';
$$;

CREATE OR REPLACE FUNCTION public.current_user_guest_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT guest_id FROM public.event_members
  WHERE user_id = auth.uid() AND guest_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.current_couple_event_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_guest_ids() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. event_members policies (the infinite-recursion source)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS member_reads_membership ON public.event_members;
CREATE POLICY member_reads_membership ON public.event_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS member_can_self_join ON public.event_members;
CREATE POLICY member_can_self_join ON public.event_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_can_update_member ON public.event_members;
CREATE POLICY couple_can_update_member ON public.event_members
  FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_can_delete_member ON public.event_members;
CREATE POLICY couple_can_delete_member ON public.event_members
  FOR DELETE TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 3. events policies that subqueried event_members
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS couple_can_update_event ON public.events;
CREATE POLICY couple_can_update_event ON public.events
  FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS couple_can_delete_event ON public.events;
CREATE POLICY couple_can_delete_event ON public.events
  FOR DELETE TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 4. event_join_tokens
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS couple_manages_join_token ON public.event_join_tokens;
CREATE POLICY couple_manages_join_token ON public.event_join_tokens
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 5. guests + households
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS couple_writes_guest ON public.guests;
CREATE POLICY couple_writes_guest ON public.guests
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS guest_reads_own_row ON public.guests;
CREATE POLICY guest_reads_own_row ON public.guests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND guest_id IN (SELECT public.current_user_guest_ids())
  );

DROP POLICY IF EXISTS couple_writes_household ON public.households;
CREATE POLICY couple_writes_household ON public.households
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

COMMIT;
