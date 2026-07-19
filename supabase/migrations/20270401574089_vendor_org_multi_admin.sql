-- ============================================================================
-- Vendor account = multi-admin ORG/store model
-- ============================================================================
-- Owner-locked 2026-07-01 (Q&A). A vendor account is a STORE that user
-- accounts join with a role — it is NOT a person. Supersedes the 2026-05-12
-- single-`owner` role lock (iteration 0022 §2.6a).
--
-- This migration collapses the privileged singular `owner` role into `admin`
-- (the new top role), opens team management to ANY admin, and installs two
-- DB-level governance guards that cannot be bypassed by a direct client write:
--   1. ≥1 admin floor — a store can never reach zero admins.
--   2. Peer-admin demotion/removal requires a majority vote of the OTHER
--      admins (target excluded). Self-step-down needs no vote.
-- Plus: subscription purchase is gated to admins only.
--
-- The `owner` enum value is RETAINED (Postgres cannot cheaply drop an enum
-- value) but is now unused — every `owner` row is migrated to `admin` and no
-- code path writes `owner` again.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Backfill owner → admin (BEFORE the guard trigger exists, so the role
--    transition is treated as a plain promotion and never blocked).
-- ----------------------------------------------------------------------------
UPDATE public.vendor_team_members
   SET role = 'admin', updated_at = now()
 WHERE role = 'owner';

-- Safety: every CLAIMED vendor_profile must have at least one admin. Seed the
-- founder (vendor_profiles.user_id) as admin where a claimed profile has none.
-- UNCLAIMED profiles (user_id IS NULL · admin-pre-staged, not yet claimed) have
-- no human to seat and are skipped — vendor_team_members.user_id is NOT NULL.
INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
SELECT vp.vendor_profile_id, vp.user_id, 'admin'
  FROM public.vendor_profiles vp
 WHERE vp.user_id IS NOT NULL
   AND NOT EXISTS (
   SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = vp.vendor_profile_id AND tm.role = 'admin'
 )
ON CONFLICT (vendor_profile_id, user_id) DO UPDATE SET role = 'admin';

-- ----------------------------------------------------------------------------
-- 2. New-vendor bootstrap seeds an ADMIN row (was 'owner').
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_vendor_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_profile_id UUID;
BEGIN
  IF NEW.account_type = 'vendor' THEN
    INSERT INTO public.vendor_profiles (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING vendor_profile_id INTO v_vendor_profile_id;

    IF v_vendor_profile_id IS NULL THEN
      SELECT vendor_profile_id INTO v_vendor_profile_id
      FROM public.vendor_profiles
      WHERE user_id = NEW.user_id;
    END IF;

    IF v_vendor_profile_id IS NOT NULL THEN
      -- The store creator auto-becomes ADMIN (the new top role).
      INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
      VALUES (v_vendor_profile_id, NEW.user_id, 'admin')
      ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS write policy: ANY admin of the store can manage the team (was the
--    single vendor_profiles.user_id owner). The governance guards below run
--    regardless of how the write arrives, so opening this up is safe.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS vendor_team_members_owner_write ON public.vendor_team_members;
DROP POLICY IF EXISTS vendor_team_members_admin_write ON public.vendor_team_members;
CREATE POLICY vendor_team_members_admin_write
  ON public.vendor_team_members FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

-- ----------------------------------------------------------------------------
-- 4. Governance guard trigger — enforced for EVERY write (direct client OR
--    SECURITY DEFINER RPC). The vote-executing RPC sets a transaction-local
--    flag `app.vendor_admin_change_approved=true` to authorize a peer-admin
--    change; everything else must respect the floor + vote rules.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_team_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       UUID := auth.uid();
  v_approved    BOOLEAN := COALESCE(current_setting('app.vendor_admin_change_approved', true), '') = 'true';
  v_other_admins INT;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    -- Removing ANOTHER admin needs the approved flag; self-removal is allowed.
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: removing another admin needs a team vote';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: demoting another admin needs a team vote';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_team_guard_trg ON public.vendor_team_members;
CREATE TRIGGER vendor_team_guard_trg
  BEFORE UPDATE OR DELETE ON public.vendor_team_members
  FOR EACH ROW EXECUTE FUNCTION public.vendor_team_guard();

-- ----------------------------------------------------------------------------
-- 5. Peer-admin demotion vote — motions + votes tables.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_admin_motions (
  motion_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  target_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_member_id   UUID NOT NULL REFERENCES public.vendor_team_members(vendor_team_member_id) ON DELETE CASCADE,
  kind               TEXT NOT NULL DEFAULT 'demote' CHECK (kind IN ('demote', 'remove')),
  new_role           public.vendor_team_role NOT NULL DEFAULT 'agent',
  proposed_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'executed', 'rejected', 'cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ
);
-- At most one OPEN motion per (store, target).
CREATE UNIQUE INDEX IF NOT EXISTS vendor_admin_motions_one_open_idx
  ON public.vendor_admin_motions(vendor_profile_id, target_user_id)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS vendor_admin_motions_vendor_idx
  ON public.vendor_admin_motions(vendor_profile_id);

CREATE TABLE IF NOT EXISTS public.vendor_admin_motion_votes (
  motion_id      UUID NOT NULL REFERENCES public.vendor_admin_motions(motion_id) ON DELETE CASCADE,
  voter_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approve        BOOLEAN NOT NULL,
  voted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (motion_id, voter_user_id)
);

ALTER TABLE public.vendor_admin_motions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_admin_motion_votes ENABLE ROW LEVEL SECURITY;

-- Admins of the store read its motions/votes. All WRITES go through the
-- SECURITY DEFINER RPCs below (no direct write policy).
DROP POLICY IF EXISTS vendor_admin_motions_admin_read ON public.vendor_admin_motions;
CREATE POLICY vendor_admin_motions_admin_read
  ON public.vendor_admin_motions FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_admin_motion_votes_admin_read ON public.vendor_admin_motion_votes;
CREATE POLICY vendor_admin_motion_votes_admin_read
  ON public.vendor_admin_motion_votes FOR SELECT TO authenticated
  USING (motion_id IN (
    SELECT motion_id FROM public.vendor_admin_motions
     WHERE vendor_profile_id IN (SELECT public.current_vendor_ids('admin'))
  ));

-- ----------------------------------------------------------------------------
-- 6. Resolve a motion: count admins EXCLUDING the target, apply majority of
--    the others (floor(N/2)+1). Execute (demote/remove) when reached, reject
--    when mathematically impossible, else leave open.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_vendor_admin_motion(p_motion_id UUID)
RETURNS public.vendor_admin_motions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m           public.vendor_admin_motions;
  v_others    INT;
  v_needed    INT;
  v_approvals INT;
  v_rejections INT;
BEGIN
  SELECT * INTO m FROM public.vendor_admin_motions WHERE motion_id = p_motion_id FOR UPDATE;
  IF m.motion_id IS NULL OR m.status <> 'open' THEN
    RETURN m;
  END IF;

  SELECT count(*) INTO v_others FROM public.vendor_team_members
    WHERE vendor_profile_id = m.vendor_profile_id AND role = 'admin'
      AND user_id <> m.target_user_id;
  IF v_others < 1 THEN
    RETURN m;  -- target is the only admin; floor blocks — leave open
  END IF;

  v_needed := (v_others / 2) + 1;  -- integer division → strict majority

  SELECT count(*) FILTER (WHERE v.approve), count(*) FILTER (WHERE NOT v.approve)
    INTO v_approvals, v_rejections
  FROM public.vendor_admin_motion_votes v
  JOIN public.vendor_team_members tm
    ON tm.user_id = v.voter_user_id
   AND tm.vendor_profile_id = m.vendor_profile_id
   AND tm.role = 'admin'
  WHERE v.motion_id = m.motion_id
    AND v.voter_user_id <> m.target_user_id;

  IF v_approvals >= v_needed THEN
    PERFORM set_config('app.vendor_admin_change_approved', 'true', true);
    IF m.kind = 'remove' THEN
      DELETE FROM public.vendor_team_members
        WHERE vendor_profile_id = m.vendor_profile_id AND user_id = m.target_user_id;
    ELSE
      UPDATE public.vendor_team_members
        SET role = m.new_role, updated_at = now()
        WHERE vendor_profile_id = m.vendor_profile_id AND user_id = m.target_user_id;
    END IF;
    PERFORM set_config('app.vendor_admin_change_approved', 'false', true);
    UPDATE public.vendor_admin_motions SET status = 'executed', resolved_at = now()
      WHERE motion_id = m.motion_id RETURNING * INTO m;
  ELSIF v_rejections > (v_others - v_needed) THEN
    UPDATE public.vendor_admin_motions SET status = 'rejected', resolved_at = now()
      WHERE motion_id = m.motion_id RETURNING * INTO m;
  END IF;

  RETURN m;
END;
$$;

-- Propose a motion to demote or remove a PEER admin. Records the proposer's
-- approval and resolves immediately (2-admin store → passes at once).
CREATE OR REPLACE FUNCTION public.vendor_propose_admin_motion(
  p_vendor_profile_id UUID,
  p_target_user_id    UUID,
  p_kind              TEXT DEFAULT 'demote',
  p_new_role          TEXT DEFAULT 'agent'
) RETURNS public.vendor_admin_motions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor         UUID := auth.uid();
  v_target_member UUID;
  m               public.vendor_admin_motions;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_kind NOT IN ('demote', 'remove') THEN RAISE EXCEPTION 'BAD_KIND'; END IF;
  IF p_kind = 'demote' AND p_new_role NOT IN ('agent', 'viewer') THEN
    RAISE EXCEPTION 'BAD_NEW_ROLE: demote target must be agent or viewer';
  END IF;
  IF p_target_user_id = v_actor THEN
    RAISE EXCEPTION 'CANNOT_TARGET_SELF: use step-down to leave the admin role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_team_members
       WHERE vendor_profile_id = p_vendor_profile_id AND user_id = v_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN';
  END IF;
  SELECT vendor_team_member_id INTO v_target_member FROM public.vendor_team_members
    WHERE vendor_profile_id = p_vendor_profile_id AND user_id = p_target_user_id AND role = 'admin';
  IF v_target_member IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_ADMIN: only an admin can be put to a vote';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendor_admin_motions
       WHERE vendor_profile_id = p_vendor_profile_id AND target_user_id = p_target_user_id AND status = 'open') THEN
    RAISE EXCEPTION 'MOTION_ALREADY_OPEN';
  END IF;

  INSERT INTO public.vendor_admin_motions
    (vendor_profile_id, target_user_id, target_member_id, kind, new_role, proposed_by)
  VALUES (p_vendor_profile_id, p_target_user_id, v_target_member, p_kind,
          CASE WHEN p_kind = 'demote' THEN p_new_role::public.vendor_team_role
               ELSE 'agent'::public.vendor_team_role END,
          v_actor)
  RETURNING * INTO m;

  INSERT INTO public.vendor_admin_motion_votes (motion_id, voter_user_id, approve)
  VALUES (m.motion_id, v_actor, true);

  RETURN public._resolve_vendor_admin_motion(m.motion_id);
END;
$$;

-- Cast / change a vote on an open motion.
CREATE OR REPLACE FUNCTION public.vendor_vote_admin_motion(p_motion_id UUID, p_approve BOOLEAN)
RETURNS public.vendor_admin_motions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  m       public.vendor_admin_motions;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO m FROM public.vendor_admin_motions WHERE motion_id = p_motion_id;
  IF m.motion_id IS NULL THEN RAISE EXCEPTION 'MOTION_NOT_FOUND'; END IF;
  IF m.status <> 'open' THEN RAISE EXCEPTION 'MOTION_CLOSED'; END IF;
  IF v_actor = m.target_user_id THEN RAISE EXCEPTION 'TARGET_CANNOT_VOTE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_team_members
       WHERE vendor_profile_id = m.vendor_profile_id AND user_id = v_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN';
  END IF;

  INSERT INTO public.vendor_admin_motion_votes (motion_id, voter_user_id, approve)
  VALUES (p_motion_id, v_actor, p_approve)
  ON CONFLICT (motion_id, voter_user_id) DO UPDATE SET approve = EXCLUDED.approve, voted_at = now();

  RETURN public._resolve_vendor_admin_motion(p_motion_id);
END;
$$;

-- Cancel an open motion (any admin of the store).
CREATE OR REPLACE FUNCTION public.vendor_cancel_admin_motion(p_motion_id UUID)
RETURNS public.vendor_admin_motions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  m       public.vendor_admin_motions;
BEGIN
  SELECT * INTO m FROM public.vendor_admin_motions WHERE motion_id = p_motion_id;
  IF m.motion_id IS NULL THEN RAISE EXCEPTION 'MOTION_NOT_FOUND'; END IF;
  IF m.status <> 'open' THEN RETURN m; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_team_members
       WHERE vendor_profile_id = m.vendor_profile_id AND user_id = v_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN';
  END IF;
  UPDATE public.vendor_admin_motions SET status = 'cancelled', resolved_at = now()
    WHERE motion_id = p_motion_id RETURNING * INTO m;
  RETURN m;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_propose_admin_motion(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_vote_admin_motion(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_cancel_admin_motion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._resolve_vendor_admin_motion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_propose_admin_motion(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_vote_admin_motion(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_cancel_admin_motion(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. Subscription is an ORG-WIDE entitlement — only an admin may purchase it.
--    (Was founder-only via vendor_profiles.user_id; now any admin, none-else.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_vendor_subscription(p_sku_code TEXT)
RETURNS public.vendor_subscriptions AS $$
DECLARE
  v_vendor_id UUID;
  v_price     NUMERIC(10,2);
  v_offering  TEXT;
  v_cycle     TEXT;
  v_period    INT;
  v_tier      public.vendor_tier_state;
  v_ref       TEXT;
  v_row       public.vendor_subscriptions;
BEGIN
  -- Admin-only: resolve the store where the caller is an admin.
  SELECT vid INTO v_vendor_id FROM public.current_vendor_ids('admin') AS vid LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN: only a store admin can purchase a subscription';
  END IF;

  SELECT price_php, offering_type INTO v_price, v_offering
    FROM public.vendor_billing_catalog
    WHERE sku_code = p_sku_code
      AND offering_type IN ('subscription_monthly', 'subscription_annual')
      AND is_active = TRUE;
  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'INVALID_SKU: %', p_sku_code;
  END IF;

  IF v_offering = 'subscription_annual' THEN
    v_cycle := 'annual';
    v_period := 365;
  ELSE
    v_cycle := 'monthly';
    v_period := 28;
  END IF;

  IF p_sku_code LIKE 'pro\_vendor\_%' THEN
    v_tier := 'pro';
  ELSIF p_sku_code LIKE 'enterprise\_vendor\_%' THEN
    v_tier := 'enterprise';
  ELSE
    RAISE EXCEPTION 'UNMAPPED_SKU_TIER: %', p_sku_code;
  END IF;

  v_ref := 'SUB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.vendor_subscriptions
    (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, period_days)
  VALUES (v_vendor_id, p_sku_code, v_tier, v_cycle, v_price, v_ref, v_period)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.create_vendor_subscription(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vendor_subscription(TEXT) TO authenticated;

COMMENT ON TABLE public.vendor_admin_motions IS
  'Peer-admin demotion/removal votes (vendor multi-admin org model · 2026-07-01). Majority of admins EXCLUDING the target. Writes only via vendor_propose/vote/cancel_admin_motion RPCs.';
