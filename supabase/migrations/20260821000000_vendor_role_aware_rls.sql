-- 20260821000000_vendor_role_aware_rls.sql
-- Phase 2b — role-aware vendor data access (the multi-user workspace payoff).
--
-- Before: the whole vendor data layer was OWNER-ONLY at the RLS level
-- (current_vendor_profile_ids() + vendor_services_owner both keyed on
-- vendor_profiles.user_id), so non-owner admins/agents could read nothing.
--
-- After:
--   • owner + admin ("main account holders") see everything — achieved by
--     redefining current_vendor_profile_ids() to owner+admin, which propagates
--     to every policy already using it (chat_threads, chat_messages,
--     vendor_follows, vendor_branches, vendor_token_boosters, unread count).
--   • agents see ONLY their assigned services + the customers tied to them
--     (a couple's event_vendors.service_id points at the booked vendor_services
--     row) — via two new helpers + explicit clauses on vendor_services + chat.
--   • Couple-side access (current_couple_event_ids) is UNTOUCHED.
--
-- Role ranking comes from the existing public.current_vendor_ids(min_role)
-- (owner > admin > agent > viewer), so agents (rank < admin) are excluded from
-- the owner/admin clauses and only ever reach the assignment-scoped clauses.

-- ── 1. current_vendor_profile_ids() : owner-only → owner + admin ────────────
CREATE OR REPLACE FUNCTION public.current_vendor_profile_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Owner (legacy rows + the trigger-seeded 'owner' membership) ...
  SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = auth.uid()
  UNION
  -- ... plus owner/admin team members (rank >= admin).
  SELECT public.current_vendor_ids('admin');
$$;

-- ── 2. Agent scoping helpers ────────────────────────────────────────────────
-- Services the current user is assigned to as a team member.
CREATE OR REPLACE FUNCTION public.agent_assigned_service_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT vsa.vendor_service_id
  FROM public.vendor_service_agents vsa
  JOIN public.vendor_team_members vtm
    ON vtm.vendor_team_member_id = vsa.vendor_team_member_id
  WHERE vtm.user_id = auth.uid();
$$;

-- Events (customers) that booked one of the current user's assigned services.
CREATE OR REPLACE FUNCTION public.agent_customer_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ev.event_id
  FROM public.event_vendors ev
  WHERE ev.service_id IN (SELECT public.agent_assigned_service_ids());
$$;

GRANT EXECUTE ON FUNCTION public.agent_assigned_service_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_customer_event_ids() TO authenticated;

-- ── 3. vendor_services : owner/admin full · agent assigned ──────────────────
-- Replaces the owner-only FOR ALL policy. owner/admin manage all; an agent
-- reads/edits only services assigned to them. (A brand-new row's id isn't yet
-- in the assigned set, so agents can't create services — only owner/admin can,
-- which matches the role intent.) vendor_services_public_read is untouched.
DROP POLICY IF EXISTS vendor_services_owner ON public.vendor_services;
DROP POLICY IF EXISTS vendor_services_manage ON public.vendor_services;
-- current_vendor_profile_ids() (redefined above) = owner-direct (always, even
-- if a legacy owner lacks an 'owner' team row) + admin members. Using it here
-- guarantees the owner never loses access to their own services.
CREATE POLICY vendor_services_manage
  ON public.vendor_services FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_service_id IN (SELECT public.agent_assigned_service_ids())
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_service_id IN (SELECT public.agent_assigned_service_ids())
  );

-- ── 4. chat_threads + chat_messages : add the agent clause ──────────────────
-- owner/admin already covered (current_vendor_profile_ids redefined above).
-- The agent sees a thread/message only when it's their vendor AND the event
-- booked one of their assigned services. Couple side unchanged.
DROP POLICY IF EXISTS chat_threads_member_read ON public.chat_threads;
CREATE POLICY chat_threads_member_read
  ON public.chat_threads FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

DROP POLICY IF EXISTS chat_threads_member_write ON public.chat_threads;
CREATE POLICY chat_threads_member_write
  ON public.chat_threads FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

DROP POLICY IF EXISTS chat_messages_member_read ON public.chat_messages;
CREATE POLICY chat_messages_member_read
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

DROP POLICY IF EXISTS chat_messages_member_insert ON public.chat_messages;
CREATE POLICY chat_messages_member_insert
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

-- ── 5. vendor_profiles : any team member can read their vendor's profile ─────
-- The dashboard resolves the active profile for a logged-in member; a non-owner
-- member needs to read the profile row by id. Additive SELECT policy (existing
-- owner + public-read policies untouched). Members only — gated by
-- current_vendor_ids('viewer') (owner > admin > agent > viewer).
DROP POLICY IF EXISTS vendor_profiles_member_read ON public.vendor_profiles;
CREATE POLICY vendor_profiles_member_read
  ON public.vendor_profiles FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')));
