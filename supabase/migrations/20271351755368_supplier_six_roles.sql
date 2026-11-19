-- supplier_six_roles
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ── THE SIX SUPPLIER ROLES (owner 19 Nov 2026; map + drawing in iscasasola/setnayan-platform#8013) ─────────────────
--   Shop Manager · Branch Manager · Account Manager · Marketing · Event Crew · Helper — ONE role per person (owner:
--   "no" to two roles), each renamed by the shop for its own cards (`vendor_role_names`).
--
-- WHY THE RANK STAYS (map §2): every one of the ~80 policies compares `vendor_team_members.role` through
-- `current_vendor_ids(min_role)`. A rank is one-dimensional and a branch is a second dimension, so the six roles are a
-- new `duty` column BESIDE the rank, and the rank is DERIVED from the duty by a trigger — never typed by hand. All
-- existing policies keep working unchanged:
--     shop_manager → admin · branch_manager → agent · account_manager → agent ·
--     marketing → viewer · event_crew → viewer · helper → viewer
-- Marketing ranks `viewer`, the narrowest rank, so it gains nothing a Helper does not already read; its writes are the
-- one policy below (cards) and the shop-page actions' own gates (written with the service role after the gate).
--
-- WHAT IS NEW, AND WHERE (each is named so a reader can find it):
--   1. vendor_team_members.duty + .branch_id (+ backfill, NOT NULL)            — the role and where it works
--   2. vendor_team_duty_rank_trg (BEFORE)                                        — rank from duty, duty from a legacy rank
--   3. vendor_team_branch_manager_cards_trg (AFTER)                              — a Branch Manager holds their branch's cards
--   4. vendor_role_names                                                         — the shop's own name for each role
--   5. current_vendor_duty_ids(duty) · current_vendor_branch_manager_scopes()    — two helpers (owner sign-off: new pattern)
--   6. vendor_team_members_branch_manager_manage · vendor_service_agents_branch_manager_manage
--                                                                                — a Branch Manager runs their branch's team
--   7. vendor_branches_member_read                                               — the team can read branch names (cards)
--   8. vendor_services_marketing_read · vendor_services_marketing_update           — Marketing edits the shop's cards
--   9. current_vendor_dayof_grant_event_ids()                                    — event day: a client's Account / Branch
--                                                                                   Manager without a separate grant

-- ── 1 · duty + branch_id ─────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_team_members
  ADD COLUMN IF NOT EXISTS duty TEXT NULL;

ALTER TABLE public.vendor_team_members
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL
  REFERENCES public.vendor_branches(branch_id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_team_members_duty_known'
       AND conrelid = 'public.vendor_team_members'::regclass
  ) THEN
    ALTER TABLE public.vendor_team_members
      ADD CONSTRAINT vendor_team_members_duty_known
      CHECK (duty IS NULL OR duty IN ('shop_manager', 'branch_manager', 'account_manager', 'marketing', 'event_crew', 'helper'));
  END IF;
  -- Shop Manager and Marketing cover the whole shop (owner 19 Nov: Marketing "yes", whole shop).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_team_members_whole_shop_duty_has_no_branch'
       AND conrelid = 'public.vendor_team_members'::regclass
  ) THEN
    ALTER TABLE public.vendor_team_members
      ADD CONSTRAINT vendor_team_members_whole_shop_duty_has_no_branch
      CHECK (branch_id IS NULL OR duty NOT IN ('shop_manager', 'marketing'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vendor_team_members_branch_idx
  ON public.vendor_team_members (branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_team_members.duty IS
  'The person''s ONE supplier role (owner 19 Nov 2026): shop_manager · branch_manager · account_manager · marketing · event_crew · helper. The rank in `role` is derived from it by vendor_team_duty_rank_trg — never written by hand. The shop''s own word for it is vendor_role_names.display_name.';
COMMENT ON COLUMN public.vendor_team_members.branch_id IS
  'Where the person works: a vendor_branches row of THIS shop, or NULL = the main location. Always NULL for shop_manager and marketing (whole shop).';

-- ── 2 · the rank comes from the duty ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_duty_rank(p_duty TEXT)
RETURNS public.vendor_team_role
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_duty
    WHEN 'shop_manager'    THEN 'admin'::public.vendor_team_role
    WHEN 'branch_manager'  THEN 'agent'::public.vendor_team_role
    WHEN 'account_manager' THEN 'agent'::public.vendor_team_role
    ELSE 'viewer'::public.vendor_team_role
  END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_duty_of_rank(p_role TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN 'shop_manager'
    WHEN 'admin' THEN 'shop_manager'
    WHEN 'agent' THEN 'account_manager'
    ELSE 'helper'
  END;
$$;

COMMENT ON FUNCTION public.vendor_duty_rank(TEXT) IS
  'Six supplier roles → the RLS rank every existing policy reads. Mirrored in apps/web/lib/vendor-duties.ts (VENDOR_DUTY_RANK) and pinned by a test.';

-- Named so it sorts BEFORE `vendor_team_guard_trg` (Postgres fires BEFORE triggers in name order): the guard then sees
-- the derived rank, so "a shop keeps at least one admin" and "demoting another admin needs a vote" hold for a duty
-- change exactly as they hold for a rank change.
CREATE OR REPLACE FUNCTION public.vendor_team_duty_rank()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A writer that still names only the rank (the founder seat, the shop claim, older actions) gets that rank's role.
    IF NEW.duty IS NULL THEN
      NEW.duty := public.vendor_duty_of_rank(NEW.role::text);
    END IF;
  ELSE
    IF NEW.duty IS DISTINCT FROM OLD.duty THEN
      NULL; -- the duty moved: the rank follows below.
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      -- A legacy rank change (a two-admins vote, Step down): the duty follows the rank.
      NEW.duty := public.vendor_duty_of_rank(NEW.role::text);
    END IF;
  END IF;

  IF NEW.duty IS NULL THEN
    NEW.duty := public.vendor_duty_of_rank(NEW.role::text);
  END IF;
  NEW.role := public.vendor_duty_rank(NEW.duty);

  IF NEW.duty IN ('shop_manager', 'marketing') THEN
    NEW.branch_id := NULL;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_branches b
     WHERE b.branch_id = NEW.branch_id AND b.parent_vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'VENDOR_TEAM_BRANCH_NOT_THIS_SHOP: that branch is not one of this shop''s' USING ERRCODE = '23514';
  END IF;

  -- A Branch Manager holds their branch whole (the shipped "Whole branch" key, so later cards follow them in).
  IF NEW.duty = 'branch_manager' THEN
    NEW.whole_branch_keys := ARRAY[COALESCE(NEW.branch_id::text, 'main')];
  ELSIF TG_OP = 'UPDATE' AND OLD.duty = 'branch_manager' THEN
    NEW.whole_branch_keys := '{}'::text[];
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_team_duty_rank() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_team_duty_rank_trg ON public.vendor_team_members;
CREATE TRIGGER vendor_team_duty_rank_trg
  BEFORE INSERT OR UPDATE ON public.vendor_team_members
  FOR EACH ROW EXECUTE FUNCTION public.vendor_team_duty_rank();

-- ── 3 · a Branch Manager holds every card of their branch (and loses them when they stop) ──────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_team_branch_manager_cards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.duty = 'branch_manager'
     AND (NEW.duty IS DISTINCT FROM OLD.duty OR NEW.branch_id IS DISTINCT FROM OLD.branch_id) THEN
    DELETE FROM public.vendor_service_agents sa
     USING public.vendor_services vs
     WHERE sa.vendor_team_member_id = OLD.vendor_team_member_id
       AND vs.vendor_service_id = sa.vendor_service_id
       AND vs.vendor_profile_id = OLD.vendor_profile_id
       AND COALESCE(vs.branch_id::text, 'main') = COALESCE(OLD.branch_id::text, 'main');
  END IF;

  IF NEW.duty = 'branch_manager'
     AND (TG_OP = 'INSERT' OR NEW.duty IS DISTINCT FROM OLD.duty OR NEW.branch_id IS DISTINCT FROM OLD.branch_id) THEN
    INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id)
    SELECT vs.vendor_service_id, NEW.vendor_team_member_id
      FROM public.vendor_services vs
     WHERE vs.vendor_profile_id = NEW.vendor_profile_id
       AND COALESCE(vs.branch_id::text, 'main') = COALESCE(NEW.branch_id::text, 'main')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_team_branch_manager_cards() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_team_branch_manager_cards_trg ON public.vendor_team_members;
CREATE TRIGGER vendor_team_branch_manager_cards_trg
  AFTER INSERT OR UPDATE OF duty, branch_id ON public.vendor_team_members
  FOR EACH ROW EXECUTE FUNCTION public.vendor_team_branch_manager_cards();

-- Backfill: every seat gets the role nearest its rank (map §2) — nothing loses or gains access on day one.
-- A Team member who works exactly one location whole is filed at that branch.
UPDATE public.vendor_team_members m
   SET duty = public.vendor_duty_of_rank(m.role::text),
       branch_id = CASE
         WHEN m.role::text = 'agent' AND cardinality(m.whole_branch_keys) = 1 AND m.whole_branch_keys[1] <> 'main'
              AND EXISTS (SELECT 1 FROM public.vendor_branches b
                           WHERE b.branch_id::text = m.whole_branch_keys[1]
                             AND b.parent_vendor_profile_id = m.vendor_profile_id)
         THEN m.whole_branch_keys[1]::uuid
         ELSE NULL END
 WHERE m.duty IS NULL;

ALTER TABLE public.vendor_team_members ALTER COLUMN duty SET NOT NULL;

-- ── 4 · the shop's own name for each role ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_role_names (
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  duty              TEXT NOT NULL
                    CHECK (duty IN ('shop_manager', 'branch_manager', 'account_manager', 'marketing', 'event_crew', 'helper')),
  display_name      TEXT NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 40),
  updated_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, duty)
);

ALTER TABLE public.vendor_role_names ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vendor_role_names FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_role_names TO authenticated;
GRANT ALL ON public.vendor_role_names TO service_role;

DROP POLICY IF EXISTS vendor_role_names_member_read ON public.vendor_role_names;
CREATE POLICY vendor_role_names_member_read
  ON public.vendor_role_names FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')));

DROP POLICY IF EXISTS vendor_role_names_manager_write ON public.vendor_role_names;
CREATE POLICY vendor_role_names_manager_write
  ON public.vendor_role_names FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_role_names_admin_read ON public.vendor_role_names;
CREATE POLICY vendor_role_names_admin_read
  ON public.vendor_role_names FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.vendor_role_names IS
  'Team › Roles (owner 19 Nov 2026): a shop''s own word for each of the six fixed roles ("our Account Managers are Lead Stylists"), shown on every card of that role. Words only — what a role can do is fixed by `vendor_team_members.duty`. No row = the fixed name. Per ROLE per shop, so it is not `vendor_team_members.team_label` (per PERSON).';

-- ── 5 · two helpers ──────────────────────────────────────────────────────────────────────────────────────────────────
-- ⚠ A NEW CANONICAL RLS HELPER PAIR — flagged for owner sign-off in the PR (RLS_Policy_Pattern: "no invented patterns").
CREATE OR REPLACE FUNCTION public.current_vendor_duty_ids(p_duty TEXT)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT vendor_profile_id
    FROM public.vendor_team_members
   WHERE user_id = auth.uid()
     AND duty = p_duty
     AND deactivated_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.current_vendor_duty_ids(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_vendor_duty_ids(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_vendor_branch_manager_scopes()
RETURNS TABLE (vendor_profile_id UUID, branch_key TEXT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT m.vendor_profile_id, COALESCE(m.branch_id::text, 'main')
    FROM public.vendor_team_members m
   WHERE m.user_id = auth.uid()
     AND m.duty = 'branch_manager'
     AND m.deactivated_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.current_vendor_branch_manager_scopes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_vendor_branch_manager_scopes() TO authenticated;

COMMENT ON FUNCTION public.current_vendor_duty_ids(TEXT) IS
  'Shops where the caller holds this supplier role (vendor_team_members.duty) on an active seat. For the duty-shaped policies the rank cannot express (Marketing''s cards).';
COMMENT ON FUNCTION public.current_vendor_branch_manager_scopes() IS
  'The (shop, branch key) pairs the caller runs as Branch Manager — branch key = vendor_branches.branch_id as text, or ''main''.';

-- ── 6 · a Branch Manager runs their branch's team — at or below their level, inside the branch ─────────────────────
-- The WITH CHECK reads the row AFTER vendor_team_duty_rank_trg, so a Branch Manager can neither give a role above
-- Account Manager nor file anyone at another branch. Their own seat (duty branch_manager) is outside it.
DROP POLICY IF EXISTS vendor_team_members_branch_manager_manage ON public.vendor_team_members;
CREATE POLICY vendor_team_members_branch_manager_manage
  ON public.vendor_team_members FOR ALL
  TO authenticated
  USING (
    duty IN ('account_manager', 'event_crew', 'helper')
    AND (vendor_profile_id, COALESCE(branch_id::text, 'main')) IN (SELECT s.vendor_profile_id, s.branch_key FROM public.current_vendor_branch_manager_scopes() s)
  )
  WITH CHECK (
    duty IN ('account_manager', 'event_crew', 'helper')
    AND (vendor_profile_id, COALESCE(branch_id::text, 'main')) IN (SELECT s.vendor_profile_id, s.branch_key FROM public.current_vendor_branch_manager_scopes() s)
  );

-- …and ticks the cards of their branch for its Account Managers (Team › Who works what). Only an Account Manager
-- filed at the Branch Manager's branch, and only a card filed at that same branch.
DROP POLICY IF EXISTS vendor_service_agents_branch_manager_manage ON public.vendor_service_agents;
CREATE POLICY vendor_service_agents_branch_manager_manage
  ON public.vendor_service_agents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.vendor_team_members m
        JOIN public.vendor_services vs ON vs.vendor_service_id = vendor_service_agents.vendor_service_id
       WHERE m.vendor_team_member_id = vendor_service_agents.vendor_team_member_id
         AND m.duty = 'account_manager'
         AND vs.vendor_profile_id = m.vendor_profile_id
         AND COALESCE(vs.branch_id::text, 'main') = COALESCE(m.branch_id::text, 'main')
         AND (m.vendor_profile_id, COALESCE(m.branch_id::text, 'main')) IN (SELECT s.vendor_profile_id, s.branch_key FROM public.current_vendor_branch_manager_scopes() s)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.vendor_team_members m
        JOIN public.vendor_services vs ON vs.vendor_service_id = vendor_service_agents.vendor_service_id
       WHERE m.vendor_team_member_id = vendor_service_agents.vendor_team_member_id
         AND m.duty = 'account_manager'
         AND vs.vendor_profile_id = m.vendor_profile_id
         AND COALESCE(vs.branch_id::text, 'main') = COALESCE(m.branch_id::text, 'main')
         AND (m.vendor_profile_id, COALESCE(m.branch_id::text, 'main')) IN (SELECT s.vendor_profile_id, s.branch_key FROM public.current_vendor_branch_manager_scopes() s)
    )
  );

-- ── 7 · branch names for the team's cards ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vendor_branches_member_read ON public.vendor_branches;
CREATE POLICY vendor_branches_member_read
  ON public.vendor_branches FOR SELECT
  TO authenticated
  USING (parent_vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')));

-- ── 8 · Marketing edits the shop's cards (owner 19 Nov: "shop page, cards, photos, promos, ads") ───────────────────
-- READ + UPDATE only: Marketing neither opens nor deletes a card. (A row must be readable to be updated — there is no
-- member-read policy on vendor_services, so Marketing gets its own.)
DROP POLICY IF EXISTS vendor_services_marketing_read ON public.vendor_services;
CREATE POLICY vendor_services_marketing_read
  ON public.vendor_services FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_duty_ids('marketing')));

DROP POLICY IF EXISTS vendor_services_marketing_update ON public.vendor_services;
CREATE POLICY vendor_services_marketing_update
  ON public.vendor_services FOR UPDATE
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_duty_ids('marketing')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_duty_ids('marketing')));

-- ── 9 · event day: four ways in (owner 19 Nov: "event can also be handled by agent and branch admin and admin") ─────
-- Shop Manager (rank admin — unchanged), Event Crew (a grant — unchanged), and now the client's Account Manager and
-- the Branch Manager of the card's branch: the celebration booked a card they hold, so no separate grant is needed.
CREATE OR REPLACE FUNCTION public.current_vendor_dayof_grant_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id
  FROM public.vendor_event_access_grants
  WHERE grantee_user_id = auth.uid()
    AND revoked_at IS NULL
  UNION
  SELECT ev.event_id
  FROM public.event_vendors ev
  JOIN public.vendor_service_agents sa ON sa.vendor_service_id = ev.service_id
  JOIN public.vendor_team_members tm ON tm.vendor_team_member_id = sa.vendor_team_member_id
  WHERE tm.user_id = auth.uid()
    AND tm.duty IN ('account_manager', 'branch_manager')
    AND tm.deactivated_at IS NULL
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
$$;
GRANT EXECUTE ON FUNCTION public.current_vendor_dayof_grant_event_ids() TO authenticated;
