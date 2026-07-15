-- samahan_communities_foundation
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- Samahan (communities) minimal foundation. Owner-locked model 2026-07-15
-- (Composable_Event_Build_Map_2026-07-15.md §6 + Samahan_Minimal_Build_Plan_
-- 2026-07-15.md §2): communities + community_members(role organizer|member) +
-- one standing rotating invite token per community (event_join_tokens
-- precedent) + events.community_id, class-gated by the
-- events_wedding_fields_consistency CHECK precedent. Private, invite-link-only
-- in V1 — no discovery, no nesting (parent_community_id is a deliberate later
-- migration once cascade semantics are owner-locked).
-- ₱0 rule: rows only — no compute, no R2 in the minimal cut.

BEGIN;

-- 1 · communities -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.communities (
  id            BIGSERIAL PRIMARY KEY,
  community_id  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id     TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('C'),
  name          TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  kind          TEXT NOT NULL DEFAULT 'barkada'
                  CHECK (kind IN ('barkada', 'parish', 'clan', 'org', 'other')),
  description   TEXT CHECK (description IS NULL OR char_length(description) <= 280),
  -- Creator survives account deletion: community is a shared asset, not a
  -- per-user record (contrast dependents' owner-CASCADE).
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS communities_created_by_idx ON public.communities(created_by);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- 2 · community_members --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_members (
  id            BIGSERIAL PRIMARY KEY,
  community_id  UUID NOT NULL REFERENCES public.communities(community_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('organizer', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_members_community_idx ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS community_members_user_idx      ON public.community_members(user_id);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- 3 · community_invite_tokens ---------------------------------------------------
-- One standing rotating link per community — mirrors event_join_tokens
-- (20260512000000 §6: UNIQUE event_id, service-role redemption). No expiry by
-- default (NULL); organizers rotate to kill a leaked link.

CREATE TABLE IF NOT EXISTS public.community_invite_tokens (
  id            BIGSERIAL PRIMARY KEY,
  community_id  UUID NOT NULL UNIQUE REFERENCES public.communities(community_id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_invite_tokens_token_idx ON public.community_invite_tokens(token);

ALTER TABLE public.community_invite_tokens ENABLE ROW LEVEL SECURITY;

-- 4 · Helper functions — mirror current_event_ids() exactly
--     (20260512000000 §7: SECURITY DEFINER STABLE, SET search_path = public).
--     SECURITY DEFINER is what breaks the community_members-policy-reads-
--     community_members recursion.

CREATE OR REPLACE FUNCTION public.current_community_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT community_id FROM public.community_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_organizer_community_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT community_id FROM public.community_members
  WHERE user_id = auth.uid() AND role = 'organizer';
$$;

GRANT EXECUTE ON FUNCTION public.current_community_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organizer_community_ids() TO authenticated;

-- 5 · RLS — Pattern B analog (membership-scoped read; organizer write; admin override)

-- communities: members read their own communities. No roster scraping vector —
-- a non-member can't even see the community row.
DROP POLICY IF EXISTS community_member_can_read ON public.communities;
CREATE POLICY community_member_can_read ON public.communities
  FOR SELECT TO authenticated
  USING (community_id IN (SELECT public.current_community_ids()) OR public.is_admin());

-- Creation: any authenticated user, stamped as themselves (tighter than the
-- events authenticated_can_create_event WITH CHECK (TRUE) — we know created_by).
-- The server action inserts the organizer membership in the same action
-- (create-event precedent: app layer adds the first member row).
DROP POLICY IF EXISTS authenticated_can_create_community ON public.communities;
CREATE POLICY authenticated_can_create_community ON public.communities
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS organizer_can_update_community ON public.communities;
CREATE POLICY organizer_can_update_community ON public.communities
  FOR UPDATE TO authenticated
  USING (community_id IN (SELECT public.current_organizer_community_ids()) OR public.is_admin())
  WITH CHECK (community_id IN (SELECT public.current_organizer_community_ids()) OR public.is_admin());
-- No DELETE policy: soft archive only; hard delete is service-role/admin-mediated.

-- community_members: the roster is visible ONLY to members of that same
-- community (RA 10173 guardrail — consent to be listed is granted BY joining,
-- and only fellow members can see the list).
DROP POLICY IF EXISTS community_roster_member_read ON public.community_members;
CREATE POLICY community_roster_member_read ON public.community_members
  FOR SELECT TO authenticated
  USING (community_id IN (SELECT public.current_community_ids()) OR public.is_admin());

-- Joins are token-redeemed via the service-role client (event_join_tokens
-- precedent: "redemption happens via a service-role … not direct RLS write").
-- No INSERT policy for regular users on purpose.
DROP POLICY IF EXISTS community_member_admin_insert ON public.community_members;
CREATE POLICY community_member_admin_insert ON public.community_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Role changes (promote/demote): organizers of that community, or admin.
DROP POLICY IF EXISTS community_member_role_update ON public.community_members;
CREATE POLICY community_member_role_update ON public.community_members
  FOR UPDATE TO authenticated
  USING (community_id IN (SELECT public.current_organizer_community_ids()) OR public.is_admin())
  WITH CHECK (community_id IN (SELECT public.current_organizer_community_ids()) OR public.is_admin());

-- Leave (self) or remove (organizer/admin). Last-organizer guard is app-side
-- (server action re-checks organizer count in the same request).
DROP POLICY IF EXISTS community_member_leave_or_remove ON public.community_members;
CREATE POLICY community_member_leave_or_remove ON public.community_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR community_id IN (SELECT public.current_organizer_community_ids())
    OR public.is_admin()
  );

-- community_invite_tokens: organizer-only, full control. Members must NOT see
-- the standing token (a member seeing it could mass-invite; the organizer gate
-- is the product boundary). Public redemption reads go through the admin client.
DROP POLICY IF EXISTS invite_tokens_organizer_all ON public.community_invite_tokens;
CREATE POLICY invite_tokens_organizer_all ON public.community_invite_tokens
  FOR ALL TO authenticated
  USING (community_id IN (SELECT public.current_organizer_community_ids()) OR public.is_admin())
  WITH CHECK (community_id IN (SELECT public.current_organizer_community_ids()) OR public.is_admin());

-- 6 · events.community_id + class CHECK ----------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS community_id UUID
    REFERENCES public.communities(community_id) ON DELETE SET NULL;
-- ON DELETE SET NULL: killing a community must never delete its events — they
-- fall back to their creator's personal ownership (creator keeps their
-- event_members 'couple' row).

CREATE INDEX IF NOT EXISTS events_community_id_idx
  ON public.events(community_id) WHERE community_id IS NOT NULL;

-- Class gate — copies the events_wedding_fields_consistency precedent
-- (20260521080000: hard-coded type list in a CHECK; deny-by-default). The
-- eligible list mirrors the event_class='community_eligible' seed in
-- 20270807254184 EXACTLY. Owner lock: a Samahan can NEVER own a personal
-- milestone (wedding · debut · christening · gender_reveal · birthday ·
-- graduation). Widening this list later = one small migration, same as the
-- profile seed it mirrors. App-side resolveProfile().eventClass is the UX
-- gate; this CHECK is the bypass-proof backstop.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'events_community_class_consistency'
       AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_community_class_consistency
      CHECK (
        community_id IS NULL
        OR event_type::text IN
          ('simple_event', 'corporate', 'travel', 'celebration',
           'tournament', 'reunion', 'anniversary')
      );
  END IF;
END $$;

-- Community events are visible to the whole community (a member should see
-- the reunion exists even before they're an event guest). Additive SELECT
-- policy alongside event_member_can_read — read-only; event WRITE stays with
-- event membership.
DROP POLICY IF EXISTS community_member_can_read_events ON public.events;
CREATE POLICY community_member_can_read_events ON public.events
  FOR SELECT TO authenticated
  USING (
    community_id IS NOT NULL
    AND community_id IN (SELECT public.current_community_ids())
  );

COMMENT ON TABLE public.communities IS
  'Samahan — a standing group (barkada/parish/clan/org). Private + invite-link-only in V1. Owner-locked 2026-07-15: may own community_eligible event types only, never personal milestones.';
COMMENT ON COLUMN public.events.community_id IS
  'Owning Samahan for community-class events. NULL = personal event (default, unchanged). CHECK events_community_class_consistency mirrors the event_class seed in 20270807254184.';

COMMIT;
