-- db enforced two admin gate high risk writes
--
-- Phase 2b of the Admin Account-Access Model (Admin_Account_Access_Model_2026-06-22.md
-- §4 / security audit mustFix #1): the two-admin "four-eyes" gate was UI-only.
-- An admin could execute a critical action (large refund, big comp grant, change
-- the platform's receiving accounts, promote an admin, re-price a SKU) BEFORE the
-- second-admin approval landed. This migration pushes the gate down to the DB:
-- a BEFORE trigger on each high-risk table REJECTS the write unless a matching,
-- still-valid, UNCONSUMED `admin_approval_requests` row is `status='approved'`,
-- then CONSUMES that approval (one approval = one write — replay is impossible).
--
-- ⚠ SAFETY: the whole mechanism is FLAG-GATED OFF by default via a tri-state
-- column `platform_settings.two_admin_enforcement_enabled` (NULL/FALSE = INERT).
-- The SQL resolver FAILS OFF on ANY error (missing table/column, NULL, bad value).
-- With the flag NULL/off every trigger early-returns NEW unchanged, so prod is
-- byte-identical to before. The owner flips it ON (per path) only after testing.
--
-- KEEP IDEMPOTENT: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION ·
--   DROP TRIGGER IF EXISTS … ; CREATE TRIGGER · constraint via DROP-then-ADD.

-- ============================================================================
-- 0. The flag (tri-state, fails-off) — mirrors setnayan_ai_paywall_enabled.
-- ============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS two_admin_enforcement_enabled BOOLEAN;

COMMENT ON COLUMN public.platform_settings.two_admin_enforcement_enabled IS
  'DB-level two-admin enforcement (Admin Account-Access Model §4 / Phase 2b). '
  'Tri-state: NULL = INERT (triggers pass every write untouched — prod default); '
  'TRUE = enforce (gated high-risk writes require a prior approved admin_approval_requests row); '
  'FALSE = disabled (same as NULL). Non-secret feature flag; world-readable like '
  'the rest of platform_settings. The owner flips this ON only after testing each gated path.';

-- SQL-side resolver. SECURITY DEFINER so it reads platform_settings regardless
-- of the caller's role (RLS, service-role, or table-owner trigger context). It
-- is the load-bearing SAFETY primitive: it MUST fail off. Any error inside the
-- read (table absent on a partial migration, column absent, etc.) is swallowed
-- and the function returns FALSE → triggers become inert. STABLE: one read per
-- statement is fine; the flag does not change within a single write.
CREATE OR REPLACE FUNCTION public.two_admin_enforcement_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v BOOLEAN;
BEGIN
  SELECT two_admin_enforcement_enabled INTO v
    FROM public.platform_settings
   WHERE id = 1;
  -- NULL (tri-state "defer"/unset) and any non-TRUE value → OFF.
  RETURN COALESCE(v, FALSE);
EXCEPTION
  WHEN OTHERS THEN
    -- FAIL OFF: never let a flag-read error block a legitimate prod write.
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.two_admin_enforcement_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.two_admin_enforcement_enabled() TO authenticated, service_role;

-- ============================================================================
-- 1. Extend the action_type catalog with the four new gate types.
--    (promote_to_admin already exists — it is reused.)
-- ============================================================================

ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'refund_over_25k',
    'comp_grant_over_10k',
    'change_receiving_account',
    'service_catalog_price_change'
  ));

-- Consumption marker: an approval is spent the first time a gated write claims
-- it. The trigger sets these three columns atomically (UPDATE … WHERE
-- consumed_at IS NULL), so two concurrent writes can never both claim the same
-- approval — one approval = exactly one write. consumed_by_table/_pk make the
-- audit trail self-describing (which write spent which approval).
ALTER TABLE public.admin_approval_requests
  ADD COLUMN IF NOT EXISTS consumed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed_by_table  TEXT,
  ADD COLUMN IF NOT EXISTS consumed_by_pk     TEXT;

-- Fast lookup of the claimable approval for a (action_type, target) pair.
-- Partial index over the open set (approved + unconsumed) keeps it tiny.
CREATE INDEX IF NOT EXISTS admin_approval_requests_consumable_idx
  ON public.admin_approval_requests (action_type, target_user_id, target_id)
  WHERE status = 'approved' AND consumed_at IS NULL;

-- ============================================================================
-- 2. The explicit approval link on each gated write.
--    A write opts into the gate by carrying the approval_id it satisfies. The
--    trigger validates + consumes it. Nullable + additive, so existing
--    code paths (and the flag-off state) are unaffected.
-- ============================================================================

ALTER TABLE public.order_refunds
  ADD COLUMN IF NOT EXISTS approval_request_id UUID
    REFERENCES public.admin_approval_requests(approval_id) ON DELETE SET NULL;

ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS approval_request_id UUID
    REFERENCES public.admin_approval_requests(approval_id) ON DELETE SET NULL;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS approval_request_id UUID
    REFERENCES public.admin_approval_requests(approval_id) ON DELETE SET NULL;

ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS approval_request_id UUID
    REFERENCES public.admin_approval_requests(approval_id) ON DELETE SET NULL;

-- `users` promotion: comp_grants already has two_admin_approval_id, but users
-- has no such column. Reuse the same explicit-link convention.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS promote_approval_request_id UUID
    REFERENCES public.admin_approval_requests(approval_id) ON DELETE SET NULL;

-- ============================================================================
-- 3. Shared claim+consume helper (SECURITY DEFINER — reads/updates the approval
--    table regardless of caller role). Validates that p_approval_id is:
--      • present and points at a real row,
--      • status='approved' (already four-eyes-decided by a different admin —
--        the existing CHECK admin_approval_four_eyes + the atomic approve() claim
--        guarantee decided_by <> initiated_by, so this is genuinely two-admin),
--      • the matching action_type,
--      • not expired,
--      • the matching target (when a target is supplied),
--      • not yet consumed.
--    Then it CONSUMES it atomically. Returns nothing; RAISEs to block the write.
--    p_target_user_id / p_target_id are matched only when non-NULL on BOTH sides
--    (a refund/SKU/receiving-account approval has no user target).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_two_admin_approval(
  p_approval_id     UUID,
  p_action_type     TEXT,
  p_target_user_id  UUID,
  p_target_id       TEXT,
  p_by_table        TEXT,
  p_by_pk           TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_consumed UUID;
BEGIN
  IF p_approval_id IS NULL THEN
    RAISE EXCEPTION 'TWO_ADMIN_REQUIRED: % needs an approved two-admin request (approval_request_id was null)', p_action_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- Atomic claim: flip consumed_* on exactly the row that is approved, matching,
  -- unexpired, target-aligned, and STILL UNCONSUMED. RETURNING tells us whether
  -- we won the claim. A second write for the same approval finds consumed_at set
  -- and gets zero rows → it is rejected below.
  UPDATE public.admin_approval_requests
     SET consumed_at       = NOW(),
         consumed_by_table = p_by_table,
         consumed_by_pk    = p_by_pk
   WHERE approval_id = p_approval_id
     AND status = 'approved'
     AND action_type = p_action_type
     AND (expires_at IS NULL OR expires_at > NOW())
     AND consumed_at IS NULL
     -- Target match: enforced only when the approval carries a target of that
     -- kind. Refund/SKU/receiving-account approvals carry neither, so both
     -- predicates pass via the NULL branch.
     AND (target_user_id IS NULL OR p_target_user_id IS NULL OR target_user_id = p_target_user_id)
     AND (target_id      IS NULL OR p_target_id      IS NULL OR target_id      = p_target_id)
  RETURNING approval_id INTO v_consumed;

  IF v_consumed IS NULL THEN
    RAISE EXCEPTION 'TWO_ADMIN_REQUIRED: approval % is not a valid, approved, matching, unexpired, unconsumed % request', p_approval_id, p_action_type
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_two_admin_approval(UUID, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
-- Service-role only — this is internal to the triggers. authenticated never calls it directly.
GRANT EXECUTE ON FUNCTION public.claim_two_admin_approval(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- 4. Per-table BEFORE triggers. Each: (a) early-return when the flag is off
--    (INERT), (b) early-return when the write is NOT the specific high-risk
--    transition (every other write to the table passes untouched), (c) else
--    claim+consume the approval or RAISE.
-- ============================================================================

-- 4.1 — order_refunds INSERT where refund_amount_centavos > ₱25,000 (2,500,000c)
CREATE OR REPLACE FUNCTION public.gate_refund_over_25k()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.two_admin_enforcement_enabled() THEN RETURN NEW; END IF;
  -- Only the >₱25K refund is gated. ≤₱25K refunds (and every other field) pass.
  IF COALESCE(NEW.refund_amount_centavos, 0) <= 2500000 THEN RETURN NEW; END IF;

  PERFORM public.claim_two_admin_approval(
    NEW.approval_request_id, 'refund_over_25k',
    NULL, NEW.order_id::text,
    'order_refunds', NEW.refund_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_refunds_two_admin_gate ON public.order_refunds;
CREATE TRIGGER order_refunds_two_admin_gate
  BEFORE INSERT ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.gate_refund_over_25k();

-- 4.2 — comp_grants INSERT where retail_value_centavos > ₱10,000 (1,000,000c)
CREATE OR REPLACE FUNCTION public.gate_comp_grant_over_10k()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.two_admin_enforcement_enabled() THEN RETURN NEW; END IF;
  IF COALESCE(NEW.retail_value_centavos, 0) <= 1000000 THEN RETURN NEW; END IF;

  -- Target match on the recipient user so an approval for user A can't grant a
  -- big comp to user B.
  PERFORM public.claim_two_admin_approval(
    NEW.approval_request_id, 'comp_grant_over_10k',
    NEW.user_id, NULL,
    'comp_grants', NEW.grant_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comp_grants_two_admin_gate ON public.comp_grants;
CREATE TRIGGER comp_grants_two_admin_gate
  BEFORE INSERT ON public.comp_grants
  FOR EACH ROW EXECUTE FUNCTION public.gate_comp_grant_over_10k();

-- 4.3 — platform_settings UPDATE that changes any BDO/GCash RECEIVING-ACCOUNT
--        field (the platform's own payee details — fraud-critical). All the
--        OTHER platform_settings fields (business name, VAT rate, feature flags
--        incl. the two_admin flag itself) pass untouched. INSERT is not gated:
--        the singleton row (id=1) is seeded once at bootstrap.
CREATE OR REPLACE FUNCTION public.gate_change_receiving_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed BOOLEAN;
BEGIN
  IF NOT public.two_admin_enforcement_enabled() THEN RETURN NEW; END IF;

  -- IS DISTINCT FROM is NULL-safe (NULL→value and value→NULL both count).
  v_changed :=
       NEW.bdo_account_name   IS DISTINCT FROM OLD.bdo_account_name
    OR NEW.bdo_account_number IS DISTINCT FROM OLD.bdo_account_number
    OR NEW.bdo_qr_url         IS DISTINCT FROM OLD.bdo_qr_url
    OR NEW.gcash_account_name IS DISTINCT FROM OLD.gcash_account_name
    OR NEW.gcash_number       IS DISTINCT FROM OLD.gcash_number
    OR NEW.gcash_qr_url       IS DISTINCT FROM OLD.gcash_qr_url;

  IF NOT v_changed THEN RETURN NEW; END IF;

  PERFORM public.claim_two_admin_approval(
    NEW.approval_request_id, 'change_receiving_account',
    NULL, NEW.id::text,
    'platform_settings', NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_settings_two_admin_gate ON public.platform_settings;
CREATE TRIGGER platform_settings_two_admin_gate
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.gate_change_receiving_account();

-- 4.4 — users gaining admin (account_type → 'admin'), on INSERT or UPDATE.
--        Reuses the existing 'promote_to_admin' action_type. The approval's
--        target_user_id must match the row being promoted.
CREATE OR REPLACE FUNCTION public.gate_promote_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gaining_admin BOOLEAN;
BEGIN
  IF NOT public.two_admin_enforcement_enabled() THEN RETURN NEW; END IF;

  -- INSERT: a brand-new row that is already admin. UPDATE: a row transitioning
  -- INTO admin (was not admin before). A row that is already admin and stays
  -- admin (and any non-admin write) passes untouched.
  IF TG_OP = 'INSERT' THEN
    v_gaining_admin := NEW.account_type = 'admin';
  ELSE
    v_gaining_admin := NEW.account_type = 'admin' AND OLD.account_type IS DISTINCT FROM 'admin';
  END IF;

  IF NOT v_gaining_admin THEN RETURN NEW; END IF;

  PERFORM public.claim_two_admin_approval(
    NEW.promote_approval_request_id, 'promote_to_admin',
    NEW.user_id, NULL,
    'users', NEW.user_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_two_admin_gate ON public.users;
CREATE TRIGGER users_two_admin_gate
  BEFORE INSERT OR UPDATE OF account_type ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.gate_promote_to_admin();

-- 4.5 — service_catalog UPDATE that changes price_centavos OR unit (frequency).
--        Every other column edit (display_name, description, is_active, etc.)
--        passes untouched. INSERT (new SKU rows / seeds) is not gated.
CREATE OR REPLACE FUNCTION public.gate_service_catalog_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.two_admin_enforcement_enabled() THEN RETURN NEW; END IF;

  IF NEW.price_centavos IS NOT DISTINCT FROM OLD.price_centavos
     AND NEW.unit IS NOT DISTINCT FROM OLD.unit THEN
    RETURN NEW;
  END IF;

  PERFORM public.claim_two_admin_approval(
    NEW.approval_request_id, 'service_catalog_price_change',
    NULL, NEW.sku_code,
    'service_catalog', NEW.sku_code
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_catalog_two_admin_gate ON public.service_catalog;
CREATE TRIGGER service_catalog_two_admin_gate
  BEFORE UPDATE OF price_centavos, unit ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.gate_service_catalog_price_change();
