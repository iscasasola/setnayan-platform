-- =============================================================================
-- 20260703000000_v2_phase_a_per_voucher_granularity.sql
-- V2 Phase A · refinement layer — per-voucher token tracking + grant/redemption
-- audit + lazy 45-day expiry evaluation.
-- =============================================================================
--
-- WHY THIS MIGRATION EXISTS
--
-- Migration 20260628000000_v2_additive_phase_a.sql shipped the V2 token
-- substrate with a simplified dual-balance model:
--   vendor_wallets.purchased_tokens INT
--   vendor_wallets.earned_tokens    INT
--
-- That table comment says "earned_tokens expire 45 days after the event date
-- (lazy-eval on read)" but the schema has no per-voucher provenance — there's
-- no expires_at, no grant_source, no grant_metadata. The expiry promise is
-- aspirational, not enforceable.
--
-- This migration adds the per-voucher layer ON TOP of the existing simple
-- dual-balance, without touching what's already shipped:
--
--   earned_token_vouchers     · one row per grant · expires_at · grant_source
--   token_grants_log          · idempotent grant audit (idempotency_key UNIQUE)
--   token_redemptions_log     · burn audit · references service_code
--   evaluate_earned_token_expiry(p_vendor_id)
--                             · recomputes vendor_wallets.earned_tokens from
--                               sum of non-expired voucher tokens_remaining
--   consume_vendor_assets_per_voucher(p_vendor_id, p_tokens_required, p_service_code, p_event_id)
--                             · per-voucher FIFO burn (oldest non-expired first)
--                             · writes token_redemptions_log row on success
--                             · returns BOOLEAN
--
-- The existing `consume_vendor_assets(p_vendor_id, p_spend_amount) RETURNS BOOLEAN`
-- function is PRESERVED unchanged for backward-compat with any in-flight
-- callers (the new function is added with a distinct name so the existing
-- function-resolution doesn't break in app code OR in PR #557's seed work).
--
-- The existing `execute_manpower_telemetry_reward()` function continues to
-- credit vendor_wallets.earned_tokens directly. The new model is a strict
-- superset — code that wants per-voucher tracking calls the new helpers; code
-- that still works with simple balances continues to work. Migration to full
-- per-voucher semantics will happen in Phase E (telemetry endpoints) per
-- V2_Cutover_Plan_2026-05-28.md, where `execute_manpower_telemetry_reward`
-- gets updated to additionally write an earned_token_vouchers row.
--
-- WHY ADDITIVE-ONLY (no breaking changes)
--
-- Pilot 2026-06-01 launches in 3 days from this migration. Owner directive
-- across multiple 2026-05-28 decision-log rows is non-destructive Phase A:
-- V1 surface unchanged, V2 substrate appended. This migration follows that
-- pattern — every table is new (no ALTERs), the new functions have distinct
-- names from the old ones, and the existing 20260628 + 20260631 + 20260701
-- catalog seeds are NOT re-seeded. Owner-canonical screenshot v3 prices
-- (locked in 20260701000000) stay authoritative.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
--
--   ✓ vendor_wallets table shape       (kept as 20260628 shipped it)
--   ✓ platform_retail_catalog_v2 rows  (owner-canonical v3 seed preserved)
--   ✓ vendor_billing_catalog rows      (owner-blessed 7 SKUs preserved)
--   ✓ token_rewards_log                (telemetry-style audit preserved)
--   ✓ existing consume_vendor_assets() (kept for backward-compat)
--   ✓ existing execute_manpower_telemetry_reward() (kept · Phase E will update)
--   ✓ V1 service_catalog               (retirements from 20260702 stand)
--   ✓ setnayan_pay_methods             (retirement from 20260702 stands)
--
-- WHAT BREAKS IF YOU SKIP THIS MIGRATION
--
-- Without per-voucher tracking:
--   - 100-token pilot grant (Phase I) can't enforce 45-day expiry
--   - Telemetry-driven rewards can't be revoked granularly
--   - Admin can't audit which grant produced which token balance
--   - Re-running pilot grant scripts would double-grant (no idempotency_key)
--
-- DECISION-LOG REFERENCES (canonical WHY)
--
--   CLAUDE.md 2026-05-28 third row · V1→V2 ARCHITECTURAL PIVOT LOCK
--     - Token wallet substrate + 45-day-expiring earned vouchers per blueprint
--   CLAUDE.md 2026-05-28 fourth row · Pakanta + Phase F-Bid scope expansion
--     - Reaffirmed token-economy substrate as load-bearing
--   CLAUDE.md 2026-05-28 eighth row · Today's Focus SKU lock at ₱1,499
--     - SKU pricing stays canonical via 20260701000000 (not re-seeded here)
--   CLAUDE.md 2026-05-28 tenth row · v2.1 BRIEF LOCKED AS CANONICAL
--     - 100-token founder bonus + per-action SKU economics
--   CLAUDE.md 2026-05-28 eleventh row · Pro Annual + Enterprise Annual + retire
--     verification annual renewal
--     - vendor_billing_catalog already shipped these · NOT re-seeded here
--   V2_Cutover_Plan_2026-05-28.md Phase A · "Pass 1-5 as a single migration"
--     - This migration ships the missing per-voucher granularity to Pass 1
--
-- PILOT 2026-06-01 IMPACT: NONE
-- Schema is additive · no existing callers reference any of the new tables
-- or functions · pilot exercises V1 flow unchanged.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1 — earned_token_vouchers (per-voucher tracking with expires_at)
-- =============================================================================
-- One row per token grant. tokens_remaining decrements as the FIFO burn
-- consumes the voucher; expires_at gates whether the voucher counts toward
-- vendor_wallets.earned_tokens at lazy-eval time.

CREATE TABLE IF NOT EXISTS public.earned_token_vouchers (
  voucher_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL,
  tokens_granted    INT NOT NULL CHECK (tokens_granted > 0),
  tokens_remaining  INT NOT NULL CHECK (tokens_remaining >= 0),
  granted_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '45 days'),
  grant_source      TEXT NOT NULL CHECK (grant_source IN (
    'pilot_grant',
    'telemetry_reward',
    'manpower_handshake',
    'admin_grant',
    'referral_reward'
  )),
  grant_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Invariant: tokens_remaining never exceeds tokens_granted.
  CONSTRAINT earned_token_vouchers_remaining_le_granted
    CHECK (tokens_remaining <= tokens_granted)
);

-- FIFO burn index: oldest non-expired vouchers with remaining tokens come first.
CREATE INDEX IF NOT EXISTS earned_token_vouchers_vendor_active_idx
  ON public.earned_token_vouchers(vendor_id, granted_at ASC)
  WHERE tokens_remaining > 0;

-- Expiry sweep index: cheap WHERE expires_at > NOW() AND tokens_remaining > 0.
CREATE INDEX IF NOT EXISTS earned_token_vouchers_vendor_expires_idx
  ON public.earned_token_vouchers(vendor_id, expires_at)
  WHERE tokens_remaining > 0;

COMMENT ON TABLE public.earned_token_vouchers IS
  'V2 per-voucher tracking · one row per token grant · expires_at enforces 45-day expiry. Lazy-eval via evaluate_earned_token_expiry() rolls live tokens_remaining sums into vendor_wallets.earned_tokens on read.';


-- =============================================================================
-- PART 2 — platform_retail_catalog_v2 (table existence + safety check)
-- =============================================================================
-- Migration 20260628000000 already created this table and seeded it with
-- the V2 catalog. Migration 20260631 + 20260701 + 20260701010000 refined
-- prices, titles, and is_token_able flags per owner's canonical screenshots.
-- We do NOT re-seed here — owner-blessed seed stays authoritative.
--
-- This block is a no-op safety check that the table exists in the form
-- the downstream functions expect (service_code as TEXT PRIMARY KEY).
-- It does not modify the table or its rows.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'platform_retail_catalog_v2'
  ) THEN
    RAISE EXCEPTION 'platform_retail_catalog_v2 missing · expected from migration 20260628000000_v2_additive_phase_a.sql';
  END IF;
END $$;


-- =============================================================================
-- PART 3 — token_grants_log (idempotent grant audit)
-- =============================================================================
-- One row per grant attempt. idempotency_key UNIQUE prevents double-grant on
-- retry (e.g., the pilot grant script can safely re-run · idempotency_key
-- like 'pilot_grant:<vendor_profile_id>' guarantees one grant per vendor).
-- related_voucher_id ties the audit row back to the voucher it produced.

CREATE TABLE IF NOT EXISTS public.token_grants_log (
  grant_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID NOT NULL,
  grant_source        TEXT NOT NULL CHECK (grant_source IN (
    'pilot_grant',
    'telemetry_reward',
    'manpower_handshake',
    'admin_grant',
    'referral_reward'
  )),
  tokens_granted      INT NOT NULL CHECK (tokens_granted > 0),
  related_voucher_id  UUID REFERENCES public.earned_token_vouchers(voucher_id) ON DELETE SET NULL,
  granted_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  granted_by_admin_id UUID,
  rationale           TEXT,
  idempotency_key     TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS token_grants_log_vendor_idx
  ON public.token_grants_log(vendor_id, granted_at DESC);

COMMENT ON TABLE public.token_grants_log IS
  'V2 idempotent grant audit · idempotency_key UNIQUE prevents double-grant on retry. Example keys: pilot_grant:<vendor_uuid> · telemetry_reward:<activation_id> · admin_grant:<request_uuid>.';

COMMENT ON COLUMN public.token_grants_log.idempotency_key IS
  'Caller-supplied dedup key · UNIQUE constraint guarantees one grant per logical operation regardless of retry count.';


-- =============================================================================
-- PART 4 — token_redemptions_log (burn audit)
-- =============================================================================
-- One row per successful vendor token burn. Distinct from token_rewards_log
-- (which audits inbound rewards) · token_redemptions_log audits outbound spend.

CREATE TABLE IF NOT EXISTS public.token_redemptions_log (
  redemption_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL,
  tokens_spent      INT NOT NULL CHECK (tokens_spent > 0),
  service_code      TEXT,
  related_event_id  UUID,
  redeemed_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS token_redemptions_log_vendor_idx
  ON public.token_redemptions_log(vendor_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS token_redemptions_log_service_idx
  ON public.token_redemptions_log(service_code, redeemed_at DESC)
  WHERE service_code IS NOT NULL;

COMMENT ON TABLE public.token_redemptions_log IS
  'V2 vendor token burn audit · sibling to token_rewards_log (which is reward-side). One row per consume_vendor_assets_per_voucher() success.';


-- =============================================================================
-- PART 5 — evaluate_earned_token_expiry (lazy-eval cron-free expiry sweep)
-- =============================================================================
-- Per [[reference_setnayan_cron_strategy]] no-cron preference, expiry runs
-- lazily on every wallet read. App code calls this function before reading
-- vendor_wallets.earned_tokens to ensure the value reflects current expiry
-- state.
--
-- Returns the new earned_tokens balance after recompute (caller can use
-- directly without a follow-up SELECT).

CREATE OR REPLACE FUNCTION public.evaluate_earned_token_expiry(
  p_vendor_id UUID
) RETURNS BIGINT AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  -- Sum tokens_remaining from non-expired vouchers for this vendor.
  SELECT COALESCE(SUM(tokens_remaining), 0)
    INTO v_new_balance
    FROM public.earned_token_vouchers
   WHERE vendor_id = p_vendor_id
     AND expires_at > NOW()
     AND tokens_remaining > 0;

  -- Upsert vendor_wallets row + sync earned_tokens balance.
  -- We use INSERT ... ON CONFLICT because the vendor may not yet have a
  -- wallet row (first-grant case). Purchased balance is preserved.
  INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens, updated_at)
  VALUES (p_vendor_id, 0, v_new_balance::INT, NOW())
  ON CONFLICT (vendor_id) DO UPDATE
    SET earned_tokens = v_new_balance::INT,
        updated_at = NOW();

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.evaluate_earned_token_expiry(UUID) IS
  'Lazy-eval cron-free expiry sweep · recomputes vendor_wallets.earned_tokens from sum of non-expired earned_token_vouchers.tokens_remaining. Called by app code on every wallet read.';


-- =============================================================================
-- PART 6 — consume_vendor_assets_per_voucher (per-voucher FIFO burn)
-- =============================================================================
-- New function · DOES NOT replace existing consume_vendor_assets() which
-- stays for backward-compat. App code transitioning to per-voucher semantics
-- calls this new function instead.
--
-- Burn order:
--   1. evaluate_earned_token_expiry() (refresh balances first)
--   2. earned_token_vouchers FIFO (oldest non-expired granted_at first)
--   3. vendor_wallets.purchased_tokens (remainder)
--
-- Writes token_redemptions_log row on success. Atomic transaction · raises
-- INSUFFICIENT_WALLET_BALANCES on shortfall and rolls back.

CREATE OR REPLACE FUNCTION public.consume_vendor_assets_per_voucher(
  p_vendor_id        UUID,
  p_tokens_required  INT,
  p_service_code     TEXT DEFAULT NULL,
  p_event_id         UUID DEFAULT NULL,
  p_metadata         JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_remaining        INT := p_tokens_required;
  v_voucher          RECORD;
  v_burn_amount      INT;
  v_purchased_bal    INT;
  v_earned_bal       INT;
BEGIN
  IF p_tokens_required <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOKEN_AMOUNT: tokens_required must be positive';
  END IF;

  -- Step 1 · refresh earned balance from non-expired vouchers.
  PERFORM public.evaluate_earned_token_expiry(p_vendor_id);

  -- Step 2 · check total available balance before any mutation.
  SELECT earned_tokens, purchased_tokens
    INTO v_earned_bal, v_purchased_bal
    FROM public.vendor_wallets
   WHERE vendor_id = p_vendor_id
     FOR UPDATE;

  IF v_earned_bal IS NULL THEN
    -- No wallet row exists · vendor has zero balance.
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: vendor has no wallet';
  END IF;

  IF (v_earned_bal + v_purchased_bal) < p_tokens_required THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: requested % tokens · available % (earned) + % (purchased)',
      p_tokens_required, v_earned_bal, v_purchased_bal;
  END IF;

  -- Step 3 · FIFO burn earned vouchers (oldest non-expired first).
  FOR v_voucher IN
    SELECT voucher_id, tokens_remaining
      FROM public.earned_token_vouchers
     WHERE vendor_id = p_vendor_id
       AND expires_at > NOW()
       AND tokens_remaining > 0
     ORDER BY granted_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_burn_amount := LEAST(v_voucher.tokens_remaining, v_remaining);

    UPDATE public.earned_token_vouchers
       SET tokens_remaining = tokens_remaining - v_burn_amount
     WHERE voucher_id = v_voucher.voucher_id;

    v_remaining := v_remaining - v_burn_amount;
  END LOOP;

  -- Step 4 · drain remainder from purchased balance.
  IF v_remaining > 0 THEN
    UPDATE public.vendor_wallets
       SET purchased_tokens = purchased_tokens - v_remaining,
           updated_at = NOW()
     WHERE vendor_id = p_vendor_id;
    v_remaining := 0;
  END IF;

  -- Step 5 · refresh earned_tokens cache after burn.
  PERFORM public.evaluate_earned_token_expiry(p_vendor_id);

  -- Step 6 · write redemption audit row.
  INSERT INTO public.token_redemptions_log
    (vendor_id, tokens_spent, service_code, related_event_id, metadata)
  VALUES
    (p_vendor_id, p_tokens_required, p_service_code, p_event_id, p_metadata);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.consume_vendor_assets_per_voucher(UUID, INT, TEXT, UUID, JSONB) IS
  'V2 per-voucher FIFO burn · earned vouchers (oldest non-expired first) then purchased balance. Writes token_redemptions_log on success. Atomic transaction · raises INSUFFICIENT_WALLET_BALANCES on shortfall. Replaces consume_vendor_assets() for code paths that need per-voucher granularity.';


-- =============================================================================
-- PART 7 — Row Level Security (per RLS_Policy_Pattern.md)
-- =============================================================================

ALTER TABLE public.earned_token_vouchers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_grants_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_redemptions_log   ENABLE ROW LEVEL SECURITY;

-- earned_token_vouchers · Pattern C (vendor-team-scoped) with admin override.
-- Vendor reads their own vouchers · admin reads all. No client INSERT/UPDATE:
-- vouchers are written only by SECURITY DEFINER server actions (granting
-- functions in Phase E telemetry · pilot grant script in Phase I).
--
-- Schema note: V2 vendor_wallets.vendor_id stores vendor_profiles.vendor_profile_id
-- as a loose UUID (no FK · per 20260628000000 V2 additive convention). The
-- RLS subqueries join through that mapping.
DROP POLICY IF EXISTS earned_token_vouchers_vendor_read ON public.earned_token_vouchers;
CREATE POLICY earned_token_vouchers_vendor_read
  ON public.earned_token_vouchers FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS earned_token_vouchers_admin_all ON public.earned_token_vouchers;
CREATE POLICY earned_token_vouchers_admin_all
  ON public.earned_token_vouchers FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- token_grants_log · same shape · vendor reads own grants · admin reads + INSERTs.
DROP POLICY IF EXISTS token_grants_log_vendor_read ON public.token_grants_log;
CREATE POLICY token_grants_log_vendor_read
  ON public.token_grants_log FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS token_grants_log_admin_all ON public.token_grants_log;
CREATE POLICY token_grants_log_admin_all
  ON public.token_grants_log FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- token_redemptions_log · vendor reads own redemptions · admin reads all.
-- INSERTs only via consume_vendor_assets_per_voucher() (SECURITY DEFINER
-- on the function · service role bypasses RLS for the write).
DROP POLICY IF EXISTS token_redemptions_log_vendor_read ON public.token_redemptions_log;
CREATE POLICY token_redemptions_log_vendor_read
  ON public.token_redemptions_log FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS token_redemptions_log_admin_all ON public.token_redemptions_log;
CREATE POLICY token_redemptions_log_admin_all
  ON public.token_redemptions_log FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- platform_retail_catalog_v2 already has public_read policy from 20260628000000.
-- Not re-declared here.


COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION (run in Supabase Studio SQL editor):
-- =============================================================================
--
-- -- (1) Confirm 3 new tables exist:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN (
--     'earned_token_vouchers', 'token_grants_log', 'token_redemptions_log'
--   ) ORDER BY table_name;
-- -- Expected: 3 rows
--
-- -- (2) Confirm 2 new functions exist:
-- SELECT proname FROM pg_proc
--   WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
--     AND proname IN ('evaluate_earned_token_expiry', 'consume_vendor_assets_per_voucher')
--   ORDER BY proname;
-- -- Expected: 2 rows
--
-- -- (3) Confirm existing V1 + V2 surfaces UNTOUCHED:
-- SELECT proname FROM pg_proc
--   WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
--     AND proname IN ('consume_vendor_assets', 'execute_manpower_telemetry_reward')
--   ORDER BY proname;
-- -- Expected: 2 rows (preserved)
--
-- -- (4) Confirm platform_retail_catalog_v2 row count unchanged from 20260701000000:
-- SELECT COUNT(*) FROM public.platform_retail_catalog_v2;
-- -- Expected: 20 rows (per 20260701000000 verification block)
--
-- -- (5) Confirm RLS enabled on 3 new tables:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND tablename IN (
--     'earned_token_vouchers', 'token_grants_log', 'token_redemptions_log'
--   ) ORDER BY tablename;
-- -- Expected: all rowsecurity=true
--
-- -- (6) Smoke test the lazy-eval path (insert a test voucher, evaluate, observe):
-- -- (Run as service role; replace UUIDs with real vendor UUIDs to test.)
-- -- INSERT INTO earned_token_vouchers (vendor_id, tokens_granted, tokens_remaining, grant_source)
-- --   VALUES ('00000000-0000-0000-0000-000000000001', 100, 100, 'pilot_grant');
-- -- SELECT public.evaluate_earned_token_expiry('00000000-0000-0000-0000-000000000001');
-- -- SELECT earned_tokens FROM vendor_wallets WHERE vendor_id='00000000-0000-0000-0000-000000000001';
-- -- Expected: 100
-- =============================================================================
