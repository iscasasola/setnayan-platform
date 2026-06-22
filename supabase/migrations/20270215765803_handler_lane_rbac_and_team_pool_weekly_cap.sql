-- handler lane rbac and team pool weekly cap
-- ============================================================================
-- Admin account-access model — Phase 2c (handler-lane RBAC) + 2d (§10b team-pool
-- weekly cap).  Design doc: Admin_Account_Access_Model_2026-06-22.md §3 (RBAC),
-- §4 ("Per-member sub-cap on §10b shared pool"), §10 phase plan.
-- ============================================================================
--
-- SECURITY-AUDIT mustFixes this addresses:
--   • Handler-lane RBAC — today admin identity is FLAT (users.account_type /
--     is_internal / is_team_member), so a Verification handler can read/act on
--     the Payments and Disputes queues. We add a per-admin `handler_role` lane
--     (verification | payments | disputes | full) so a scoped handler is fenced
--     to its lane.
--   • §10b weekly pool cap — a single team-pool member could drain the whole
--     shared comp allocation. We add a per-member ROLLING-7-DAY spend cap
--     (default ₱2,500/member/week, admin-configurable) enforced by a BEFORE
--     INSERT trigger on comp_grants for source='team_pool'.
--
-- SAFETY — both enforcement paths are TRI-STATE, FAILS-OFF, and OFF by default:
--   • Every EXISTING admin defaults to handler_role='full' (unrestricted), so
--     nobody is locked out.
--   • The lane fence only BINDS when platform_settings.handler_lane_rbac_enforced
--     IS TRUE (NULL/FALSE → inert).  Enforcement lives in code (requireHandler);
--     this column is the kill-switch it reads.  RLS is NOT narrowed (would risk
--     lockout) — additive only.
--   • The pool-cap trigger is a no-op unless source='team_pool' AND
--     platform_settings.team_pool_weekly_cap_enforced IS TRUE.  There is no
--     team_pool comp insert path in the app today, so the trigger is inert on
--     all current inserts regardless.
--
-- Idempotent + purely additive.  Apply with:
--   supabase db push --db-url "$SUPABASE_DB_URL"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Handler-lane RBAC column on users.
--    TEXT + CHECK (repo convention — no new native enums; see migration README).
--    DEFAULT 'full' so every existing + future admin is unrestricted until the
--    owner explicitly scopes them down.  Non-admins also carry 'full' but it is
--    meaningless for them (the lane only gates admin surfaces).
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS handler_role TEXT NOT NULL DEFAULT 'full';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_handler_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_handler_role_check
  CHECK (handler_role IN ('verification', 'payments', 'disputes', 'full'));

COMMENT ON COLUMN public.users.handler_role IS
  'Admin account-access model Phase 2c — handler LANE scope. verification|payments|disputes restrict an admin to ONE console queue; full = unrestricted (default). Only binds when platform_settings.handler_lane_rbac_enforced IS TRUE; enforced in code (requireHandler), RLS additive only.';

-- ----------------------------------------------------------------------------
-- 2. Tri-state enforcement flags + the admin-configurable cap, on the
--    platform_settings singleton (id=1).  Mirrors the
--    setnayan_ai_paywall_enabled precedent (20270209911535): nullable BOOLEAN,
--    NULL = defer to fails-OFF default, TRUE/FALSE override.  Non-secret config,
--    so it lives on the world-readable singleton (not the encrypted secrets
--    table).
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS handler_lane_rbac_enforced BOOLEAN;

COMMENT ON COLUMN public.platform_settings.handler_lane_rbac_enforced IS
  'Handler-lane RBAC kill-switch. Tri-state: NULL = OFF (defer to fails-OFF default); TRUE = lane fence ON; FALSE = OFF. Read uncached by resolveHandlerLaneRbacEnforced(); fences requireHandler(lane). Default-OFF so enabling handler_role cannot lock existing admins out until the owner tests + flips this.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS team_pool_weekly_cap_enforced BOOLEAN;

COMMENT ON COLUMN public.platform_settings.team_pool_weekly_cap_enforced IS
  '§10b team-pool weekly-cap kill-switch. Tri-state: NULL = OFF (defer to fails-OFF default); TRUE = cap enforced; FALSE = OFF. The comp_grants trigger reads this and is inert unless TRUE.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS team_pool_weekly_cap_centavos INT;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_team_pool_weekly_cap_centavos_check;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_team_pool_weekly_cap_centavos_check
  CHECK (team_pool_weekly_cap_centavos IS NULL OR team_pool_weekly_cap_centavos >= 0);

COMMENT ON COLUMN public.platform_settings.team_pool_weekly_cap_centavos IS
  '§10b per-member rolling-7-day team-pool comp cap, in PHP centavos. NULL → defaults to 250000 (₱2,500) in the trigger + resolver. Admin-configurable.';

-- ----------------------------------------------------------------------------
-- 3. SQL helper: the caller's handler_role (SECURITY DEFINER, repo idiom).
--    Returns 'full' for non-admins / unknown callers (fails-OPEN at the SQL
--    layer — the binding fence is in code; this helper only serves additive
--    RLS / future RPCs and must never itself lock out a legitimate admin).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_handler_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT handler_role FROM public.users WHERE user_id = auth.uid()),
    'full'
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_handler_role() TO authenticated;

-- Lane predicate helper: TRUE when the caller may act in lane p_lane.
--   • 'full' handlers pass every lane.
--   • a scoped handler passes only its own lane.
--   • when the RBAC kill-switch is not TRUE, EVERY lane passes (fails-OFF) so
--     additive RLS using this helper stays inert until the owner enables it.
CREATE OR REPLACE FUNCTION public.admin_in_handler_lane(p_lane TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- kill-switch: inert unless explicitly TRUE
    COALESCE((SELECT handler_lane_rbac_enforced FROM public.platform_settings WHERE id = 1), FALSE) = FALSE
    OR public.admin_handler_role() = 'full'
    OR public.admin_handler_role() = p_lane;
$$;

GRANT EXECUTE ON FUNCTION public.admin_in_handler_lane(TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. §10b team-pool weekly cap — BEFORE INSERT trigger on comp_grants.
--    Mirrors enforce_vendor_self_comp_quota() (20260515030000) exactly in shape:
--    plpgsql, fires on every insert, early-returns unless the source matches,
--    RAISEs with an UPPER_SNAKE_CODE message the TS layer relays verbatim.
--    DIFFERENCES from the self-comp quota:
--      • gates on source='team_pool' (not 'vendor_self_comp')
--      • keys on NEW.granted_by (the team member) — not vendor_profile_id
--      • SUMs retail_value_centavos over a ROLLING 7-DAY window — not a COUNT
--        over the calendar quarter
--      • is itself gated by the team_pool_weekly_cap_enforced kill-switch, so it
--        is a no-op until the owner enables it
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_team_pool_weekly_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_enforced BOOLEAN;
  v_cap      INT;
  v_spent    BIGINT;
  v_amount   INT;
BEGIN
  -- Only the §10b shared pool is capped.
  IF NEW.source <> 'team_pool' THEN
    RETURN NEW;
  END IF;

  -- Kill-switch: inert unless explicitly enabled by the owner.
  SELECT COALESCE(team_pool_weekly_cap_enforced, FALSE),
         COALESCE(team_pool_weekly_cap_centavos, 250000)
    INTO v_enforced, v_cap
    FROM public.platform_settings
   WHERE id = 1;
  IF v_enforced IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;
  IF v_cap IS NULL THEN
    v_cap := 250000; -- ₱2,500 fail-safe default
  END IF;

  -- A team-pool comp must be attributable to a granting member, else the cap
  -- can't be enforced per-member.
  IF NEW.granted_by IS NULL THEN
    RAISE EXCEPTION 'TEAM_POOL_GRANT_REQUIRES_GRANTER: team_pool comps must record granted_by'
      USING ERRCODE = 'check_violation';
  END IF;

  v_amount := COALESCE(NEW.retail_value_centavos, 0);

  -- Rolling 7-day spend already booked by THIS member from the shared pool,
  -- excluding revoked grants.  Window is (NEW.created_at - 7 days, NEW.created_at].
  SELECT COALESCE(SUM(retail_value_centavos), 0) INTO v_spent
    FROM public.comp_grants
   WHERE source = 'team_pool'
     AND granted_by = NEW.granted_by
     AND revoked_at IS NULL
     AND created_at > (NEW.created_at - INTERVAL '7 days')
     AND created_at <= NEW.created_at;

  IF v_spent + v_amount > v_cap THEN
    RAISE EXCEPTION 'TEAM_POOL_WEEKLY_CAP_EXCEEDED: cap=% spent_7d=% this_grant=%',
      v_cap, v_spent, v_amount
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comp_grants_enforce_team_pool_weekly_cap
  ON public.comp_grants;
CREATE TRIGGER comp_grants_enforce_team_pool_weekly_cap
  BEFORE INSERT ON public.comp_grants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_pool_weekly_cap();

-- Index supporting the rolling-window SUM (partial — team_pool rows only).
CREATE INDEX IF NOT EXISTS idx_comp_grants_team_pool_member
  ON public.comp_grants(granted_by, created_at DESC)
  WHERE source = 'team_pool';
