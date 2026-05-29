-- ============================================================================
-- 20260703500000_vendor_token_grants.sql
-- Vendor token grants · founder bonus expiry + admin direct grant + voucher
-- `grant_tokens` type. Owner brief 2026-05-29.
--
-- Timestamp 20260703500000 deliberately inserts this migration BETWEEN
-- 20260703000000_v2_phase_a_per_voucher_granularity.sql (substrate · gives
-- us earned_token_vouchers + token_grants_log + evaluate_earned_token_
-- expiry · already applied to prod) and 20260704000000_v2_phase_d_master_
-- qr_crew_devices.sql (broken at push time 2026-05-29 PM · pre-existing
-- schema collision with Phase A's registered_crew_devices columns · not
-- ours to fix). Inserting BEFORE Phase D lets `supabase db push` apply
-- this migration cleanly · Phase D's pre-existing failure persists for
-- whoever owns the V2 Phase D migration to resolve. Not pilot-blocking
-- because Phase D substrate is not consumed by anything shipped pre-pilot
-- (master event QR + crew device pairing is post-pilot V2 cutover scope).
-- ============================================================================
--
-- WHY THIS MIGRATION EXISTS
--
-- Three coupled deliverables landed against a substrate that already has the
-- token plumbing — this migration closes the policy gaps:
--
--   (1) Founder bonus 100 tokens fires via 20260630000000_verified_vendor_
--       token_bonus_trigger.sql when verification_state flips to 'verified',
--       but the trigger writes to vendor_wallets.earned_tokens + token_
--       rewards_log only. It does NOT write to earned_token_vouchers (added
--       2026-05-28 by 20260703000000), so the 45-day expiry promise is
--       aspirational rather than enforceable.
--
--       FIX: extend the trigger functions to ALSO insert an earned_token_
--       vouchers row with expires_at = NOW() + 45 days + grant_source =
--       'pilot_grant' (the existing CHECK enum already covers this case
--       per the V2 substrate · no enum change needed). The two writes
--       (wallet credit + voucher row) live in the same transaction so the
--       balance and the voucher provenance never diverge.
--
--   (2) Admin direct grant + voucher 'grant_tokens' type · BOTH need a
--       common helper to issue an expiring grant atomically. The function
--       grant_admin_direct_tokens() takes (vendor_id, token_count, ttl_days,
--       grant_source, granted_by_admin_id, rationale, idempotency_key) and:
--         (a) inserts earned_token_vouchers (the expiring per-voucher row)
--         (b) inserts token_grants_log (the idempotent audit · UNIQUE key)
--         (c) calls evaluate_earned_token_expiry() to refresh the wallet
--             cache
--       Returns the new voucher_id. Idempotent via UNIQUE idempotency_key.
--
--   (3) discount_codes.discount_type CHECK constraint gains 'grant_tokens'.
--       Two new columns hold the policy: token_grant_count INT (the N tokens
--       the voucher mints on redemption) + token_grant_ttl_days INT (the
--       per-redemption expiry window · default 45 days · 1-365 range).
--
--       The triple-shape value-coherence CHECK is extended to a quadruple-
--       shape: pct_off · pct_off_capped · free · grant_tokens. For
--       grant_tokens vouchers the pct_value + cap_centavos columns MUST be
--       NULL (vendor reward, not a discount on a service) and the two new
--       columns MUST be set + positive.
--
-- WHY ADDITIVE — V1 + V2 surfaces unchanged
--
-- Pilot 2026-06-01 launches in 3 days. Owner directive across the 2026-05-28
-- decision-log rows is non-destructive Phase A: schema appends, no breaking
-- ALTERs. This migration follows that pattern:
--
--   ✓ vendor_wallets table shape       (kept · trigger now also writes voucher)
--   ✓ earned_token_vouchers            (kept · new rows from grants land here)
--   ✓ token_grants_log                 (kept · new INSERT call sites)
--   ✓ discount_codes                   (CHECK swap + 2 new columns · no DROP)
--   ✓ existing pct_off / pct_off_capped / free vouchers (untouched · the new
--     CHECK is a strict superset)
--
-- WHY a separate helper function (vs raw INSERTs from app code)
--
-- The earned_token_vouchers + token_grants_log INSERTs need to be atomic
-- and need to share the related_voucher_id linking. Server-side plpgsql
-- with SECURITY DEFINER bypasses the RLS gates cleanly so the SECURITY
-- DEFINER context handles writes from any caller (admin trigger, admin
-- server action, vendor redemption server action) without each one having
-- to gate via service-role client manually.
--
-- DECISION-LOG REFERENCES
--
--   CLAUDE.md 2026-05-28 tenth row · v2.1 BRIEF LOCKED AS CANONICAL
--     - 100-token founder bonus on verification (substrate)
--   CLAUDE.md 2026-05-29 (this row) · vendor token grants · founder bonus
--     expiry + admin direct grant + voucher 'grant_tokens' type
--
-- PILOT 2026-06-01 IMPACT
--   - Founder bonus 100 tokens now expire 45 days post-verification (was
--     aspirational · now enforced via voucher row)
--   - Admin can grant additional tokens with custom expiry through the new
--     /admin/vendors/[id]/tokens surface
--   - Owner can mint a 'grant_tokens' voucher and hand the code to a vendor
--     account who redeems it via /vendor-dashboard/redeem-code
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — extend discount_codes CHECK + add new columns
-- ============================================================================
-- New voucher type 'grant_tokens' is COUPLE-SIDE-INVISIBLE: it only redeems
-- via the new vendor-dashboard surface. token_grant_count is the N tokens
-- the voucher mints per redemption. token_grant_ttl_days is the expiry
-- window applied to the earned_token_vouchers row on redemption.

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS token_grant_count INT,
  ADD COLUMN IF NOT EXISTS token_grant_ttl_days INT;

COMMENT ON COLUMN public.discount_codes.token_grant_count IS
  'For discount_type=grant_tokens · the N tokens credited to redeeming vendor wallet. NULL for non-grant_tokens vouchers.';

COMMENT ON COLUMN public.discount_codes.token_grant_ttl_days IS
  'For discount_type=grant_tokens · the per-redemption expiry window in days (1-365 · default 45). Applied to earned_token_vouchers.expires_at on redemption.';

-- Drop the old triple-shape CHECK + replace with quadruple-shape.
-- 20260529020000 named this constraint discount_codes_value_coherence_v2.
ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_value_coherence_v2;

ALTER TABLE public.discount_codes
  ADD CONSTRAINT discount_codes_value_coherence_v3 CHECK (
    (discount_type = 'pct_off'        AND pct_value BETWEEN 1 AND 100 AND cap_centavos IS NULL AND token_grant_count IS NULL AND token_grant_ttl_days IS NULL) OR
    (discount_type = 'pct_off_capped' AND pct_value BETWEEN 1 AND 100 AND cap_centavos > 0     AND token_grant_count IS NULL AND token_grant_ttl_days IS NULL) OR
    (discount_type = 'free'           AND pct_value IS NULL          AND cap_centavos IS NULL AND token_grant_count IS NULL AND token_grant_ttl_days IS NULL) OR
    (discount_type = 'grant_tokens'   AND pct_value IS NULL          AND cap_centavos IS NULL AND token_grant_count > 0     AND token_grant_ttl_days BETWEEN 1 AND 365)
  );

-- Extend the discount_type list to include the new value.
-- 20260529020000 named this constraint discount_codes_type_check_v2.
ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_type_check_v2;

ALTER TABLE public.discount_codes
  ADD CONSTRAINT discount_codes_type_check_v3 CHECK (
    discount_type IN ('pct_off', 'pct_off_capped', 'free', 'grant_tokens')
  );

COMMENT ON CONSTRAINT discount_codes_type_check_v3 ON public.discount_codes IS
  'Voucher discount_type · 4 values · grant_tokens is the vendor-side reward type added 2026-05-29.';

COMMENT ON CONSTRAINT discount_codes_value_coherence_v3 ON public.discount_codes IS
  'Quadruple-shape coherence per discount_type · grant_tokens requires token_grant_count > 0 + token_grant_ttl_days BETWEEN 1 AND 365.';

-- ============================================================================
-- PART 2 — grant_admin_direct_tokens · idempotent helper for token grants
-- ============================================================================
-- Called from:
--   (a) admin/vendors/[id]/tokens action (admin_grant source)
--   (b) vendor-dashboard/redeem-code action (admin_grant source · voucher
--       redemption mints a voucher-backed grant)
--   (c) The grant trigger functions for vendor-verified bonus (pilot_grant
--       source) — updated in PART 4 below.
--
-- Idempotent via UNIQUE token_grants_log.idempotency_key — re-running the
-- same logical operation (e.g. admin double-clicks Grant) is a no-op.
-- Returns the voucher_id of the newly-created earned_token_vouchers row.
-- Returns NULL on idempotency-key collision (caller can detect by checking
-- the return value).

CREATE OR REPLACE FUNCTION public.grant_admin_direct_tokens(
  p_vendor_id           UUID,
  p_token_count         INT,
  p_ttl_days            INT,
  p_grant_source        TEXT,
  p_granted_by_admin_id UUID,
  p_rationale           TEXT,
  p_idempotency_key     TEXT
) RETURNS UUID AS $$
DECLARE
  v_voucher_id  UUID;
  v_existing    UUID;
BEGIN
  IF p_token_count <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOKEN_COUNT: must be positive';
  END IF;
  IF p_ttl_days < 1 OR p_ttl_days > 365 THEN
    RAISE EXCEPTION 'INVALID_TTL: must be between 1 and 365 days';
  END IF;
  IF p_grant_source NOT IN ('pilot_grant', 'telemetry_reward', 'manpower_handshake', 'admin_grant', 'referral_reward') THEN
    RAISE EXCEPTION 'INVALID_GRANT_SOURCE: %', p_grant_source;
  END IF;

  -- Idempotency check · re-running the same logical operation is a no-op.
  SELECT related_voucher_id INTO v_existing
    FROM public.token_grants_log
   WHERE idempotency_key = p_idempotency_key;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- (a) Mint the expiring voucher row.
  INSERT INTO public.earned_token_vouchers
    (vendor_id, tokens_granted, tokens_remaining, expires_at, grant_source, grant_metadata)
  VALUES
    (p_vendor_id, p_token_count, p_token_count, NOW() + (p_ttl_days * INTERVAL '1 day'), p_grant_source,
     jsonb_build_object('rationale', p_rationale, 'granted_by_admin_id', p_granted_by_admin_id))
  RETURNING voucher_id INTO v_voucher_id;

  -- (b) Audit row · idempotency_key UNIQUE prevents double-grant on retry.
  INSERT INTO public.token_grants_log
    (vendor_id, grant_source, tokens_granted, related_voucher_id,
     granted_by_admin_id, rationale, idempotency_key)
  VALUES
    (p_vendor_id, p_grant_source, p_token_count, v_voucher_id,
     p_granted_by_admin_id, p_rationale, p_idempotency_key);

  -- (c) Refresh the wallet earned_tokens cache.
  PERFORM public.evaluate_earned_token_expiry(p_vendor_id);

  RETURN v_voucher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.grant_admin_direct_tokens(UUID, INT, INT, TEXT, UUID, TEXT, TEXT) IS
  'Atomic token grant helper · writes earned_token_vouchers + token_grants_log + refreshes vendor_wallets cache. Idempotent via UNIQUE idempotency_key. SECURITY DEFINER bypasses RLS for the writes.';

-- ============================================================================
-- PART 3 — vendor-side voucher redemption sweep (RPC for redeem-code action)
-- ============================================================================
-- Called by the vendor redemption server action. Validates the voucher
-- against discount_codes (active · within effective window · uses < max
-- · vendor account allow-list if private) · then mints the grant via
-- grant_admin_direct_tokens() · then bumps uses_count atomically.
--
-- Distinct from couple-side redemption · vouchers of type 'grant_tokens'
-- DO NOT write a discount_code_redemptions row (that table is order-scoped
-- · vendor redemption has no order). The uses_count increment + the
-- token_grants_log row are the audit trail.
--
-- Returns (voucher_id, tokens_granted, expires_at). RAISEs on failure with
-- machine-readable codes the app action maps to brand-voice copy.

CREATE OR REPLACE FUNCTION public.redeem_vendor_token_voucher(
  p_vendor_id            UUID,
  p_vendor_user_id       UUID,
  p_code                 TEXT
) RETURNS TABLE (
  voucher_id        UUID,
  tokens_granted    INT,
  expires_at        TIMESTAMPTZ
) AS $$
DECLARE
  v_code_row        RECORD;
  v_eligible_count  INT;
  v_is_eligible     BOOLEAN;
  v_already_redeemed BOOLEAN;
  v_new_voucher_id  UUID;
  v_expires_at      TIMESTAMPTZ;
BEGIN
  -- Normalize the code.
  p_code := upper(trim(p_code));

  IF p_code !~ '^[A-Z0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_FORMAT';
  END IF;

  -- (1) Look up the code.
  SELECT discount_code_id, discount_type, token_grant_count, token_grant_ttl_days,
         effective_from, expires_at, max_uses, uses_count, is_active
    INTO v_code_row
    FROM public.discount_codes
   WHERE code = p_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  -- (2) Type gate · only grant_tokens vouchers redeem here.
  IF v_code_row.discount_type != 'grant_tokens' THEN
    RAISE EXCEPTION 'WRONG_TYPE';
  END IF;

  IF NOT v_code_row.is_active THEN
    RAISE EXCEPTION 'INACTIVE';
  END IF;

  -- (3) Effective window.
  IF v_code_row.effective_from IS NOT NULL AND v_code_row.effective_from > NOW() THEN
    RAISE EXCEPTION 'NOT_YET_EFFECTIVE';
  END IF;

  IF v_code_row.expires_at < NOW() THEN
    RAISE EXCEPTION 'EXPIRED';
  END IF;

  -- (4) Use cap.
  IF v_code_row.max_uses IS NOT NULL AND v_code_row.uses_count >= v_code_row.max_uses THEN
    RAISE EXCEPTION 'USES_EXHAUSTED';
  END IF;

  -- (5) Private voucher eligibility · if rows exist in
  -- discount_code_eligible_users, the vendor's USER account must be listed.
  SELECT COUNT(*) INTO v_eligible_count
    FROM public.discount_code_eligible_users
   WHERE discount_code_id = v_code_row.discount_code_id;

  IF v_eligible_count > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM public.discount_code_eligible_users
       WHERE discount_code_id = v_code_row.discount_code_id
         AND user_id = p_vendor_user_id
    ) INTO v_is_eligible;

    IF NOT v_is_eligible THEN
      RAISE EXCEPTION 'NOT_ELIGIBLE';
    END IF;
  END IF;

  -- (6) Per-vendor uniqueness · prevent the same vendor account redeeming
  -- the same grant_tokens code twice. Implemented via token_grants_log
  -- idempotency_key 'voucher:<code>:<vendor>' below.
  SELECT EXISTS(
    SELECT 1 FROM public.token_grants_log
     WHERE idempotency_key = 'voucher:' || p_code || ':' || p_vendor_id::text
  ) INTO v_already_redeemed;

  IF v_already_redeemed THEN
    RAISE EXCEPTION 'ALREADY_REDEEMED';
  END IF;

  -- (7) Mint the grant via the canonical helper.
  v_new_voucher_id := public.grant_admin_direct_tokens(
    p_vendor_id,
    v_code_row.token_grant_count,
    v_code_row.token_grant_ttl_days,
    'admin_grant',
    NULL,
    'Voucher redemption · code ' || p_code,
    'voucher:' || p_code || ':' || p_vendor_id::text
  );

  -- (8) Bump uses_count atomically.
  UPDATE public.discount_codes
     SET uses_count = uses_count + 1
   WHERE discount_code_id = v_code_row.discount_code_id;

  -- (9) Read back the expires_at for the response.
  SELECT etv.expires_at INTO v_expires_at
    FROM public.earned_token_vouchers etv
   WHERE etv.voucher_id = v_new_voucher_id;

  RETURN QUERY
    SELECT v_new_voucher_id, v_code_row.token_grant_count, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.redeem_vendor_token_voucher(UUID, UUID, TEXT) IS
  'Vendor-side redemption of a grant_tokens voucher · validates + mints via grant_admin_direct_tokens + bumps uses_count. Per-vendor uniqueness via idempotency_key voucher:<code>:<vendor>. Raises on failure with INVALID_FORMAT / NOT_FOUND / WRONG_TYPE / INACTIVE / NOT_YET_EFFECTIVE / EXPIRED / USES_EXHAUSTED / NOT_ELIGIBLE / ALREADY_REDEEMED.';

-- ============================================================================
-- PART 4 — extend the verified-vendor trigger to write voucher rows
-- ============================================================================
-- 20260630000000 shipped two trigger functions:
--   grant_verified_vendor_bonus()             — AFTER UPDATE on verification_state
--   grant_verified_vendor_bonus_on_insert()   — AFTER INSERT
--
-- Both write to vendor_wallets.earned_tokens + token_rewards_log. We
-- replace both with versions that ALSO write an earned_token_vouchers row
-- via grant_admin_direct_tokens(). The old token_rewards_log INSERT is
-- preserved (legacy audit trail · external consumers may already grep it).
--
-- Idempotency: the existing token_rewards_log check is preserved · so a
-- vendor that goes verified → demoted → re-verified does NOT get a second
-- 100-token grant. grant_admin_direct_tokens() also dedups via its own
-- idempotency_key ('founder_bonus:<vendor_id>') as belt-and-suspenders.

CREATE OR REPLACE FUNCTION public.grant_verified_vendor_bonus()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_amount  INT := 100;
  v_ttl_days      INT := 45;
  v_already_paid  BOOLEAN;
  v_sentinel_evt  UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NEW.verification_state = 'verified'
     AND (OLD.verification_state IS NULL OR OLD.verification_state != 'verified')
  THEN
    -- Legacy idempotency check · preserves backward-compat behavior.
    SELECT EXISTS(
      SELECT 1 FROM public.token_rewards_log
       WHERE vendor_id = NEW.vendor_profile_id
         AND service_code = 'VERIFIED_VENDOR_BONUS_100'
    ) INTO v_already_paid;

    IF v_already_paid THEN
      RETURN NEW;
    END IF;

    -- Mint the expiring grant via the canonical helper.
    -- Source 'pilot_grant' per V2 substrate · CHECK enum already accepts it.
    -- Idempotency key matches the legacy audit-row uniqueness.
    PERFORM public.grant_admin_direct_tokens(
      NEW.vendor_profile_id,
      v_bonus_amount,
      v_ttl_days,
      'pilot_grant',
      NULL,
      'Verified vendor bonus · 100 tokens · valid for 45 days',
      'founder_bonus:' || NEW.vendor_profile_id::text
    );

    -- Legacy audit row · preserved for external consumers.
    INSERT INTO public.token_rewards_log
      (vendor_id, event_id, service_code, tokens_awarded)
    VALUES
      (NEW.vendor_profile_id, v_sentinel_evt, 'VERIFIED_VENDOR_BONUS_100', v_bonus_amount);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.grant_verified_vendor_bonus_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_amount  INT := 100;
  v_ttl_days      INT := 45;
  v_already_paid  BOOLEAN;
  v_sentinel_evt  UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NEW.verification_state = 'verified' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.token_rewards_log
       WHERE vendor_id = NEW.vendor_profile_id
         AND service_code = 'VERIFIED_VENDOR_BONUS_100'
    ) INTO v_already_paid;

    IF v_already_paid THEN
      RETURN NEW;
    END IF;

    PERFORM public.grant_admin_direct_tokens(
      NEW.vendor_profile_id,
      v_bonus_amount,
      v_ttl_days,
      'pilot_grant',
      NULL,
      'Verified vendor bonus · 100 tokens · valid for 45 days',
      'founder_bonus:' || NEW.vendor_profile_id::text
    );

    INSERT INTO public.token_rewards_log
      (vendor_id, event_id, service_code, tokens_awarded)
    VALUES
      (NEW.vendor_profile_id, v_sentinel_evt, 'VERIFIED_VENDOR_BONUS_100', v_bonus_amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers themselves are unchanged · just the function bodies refresh.

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase Studio SQL editor):
--
-- -- (1) Discount-code CHECK accepts grant_tokens:
-- INSERT INTO public.discount_codes
--   (code, discount_type, token_grant_count, token_grant_ttl_days,
--    covered_service_keys, expires_at, created_by_admin_id)
-- VALUES ('TESTVCH1', 'grant_tokens', 50, 30,
--         ARRAY[]::TEXT[], NOW() + INTERVAL '30 days',
--         (SELECT user_id FROM users WHERE account_type='admin' LIMIT 1));
-- -- Expected: 1 row inserted
--
-- -- (2) Helper function exists:
-- SELECT proname FROM pg_proc
--   WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
--     AND proname IN ('grant_admin_direct_tokens', 'redeem_vendor_token_voucher')
--   ORDER BY proname;
-- -- Expected: 2 rows
--
-- -- (3) Trigger functions updated:
-- SELECT pg_get_functiondef('public.grant_verified_vendor_bonus'::regproc::oid);
-- -- Expected: function body now includes 'grant_admin_direct_tokens' call
--
-- -- (4) Test the helper end-to-end (replace UUIDs with real values):
-- SELECT public.grant_admin_direct_tokens(
--   '<vendor_profile_id>'::uuid,
--   50,
--   30,
--   'admin_grant',
--   '<admin_user_id>'::uuid,
--   'Manual test grant',
--   'test_grant:1'
-- );
-- SELECT earned_tokens FROM vendor_wallets WHERE vendor_id='<vendor_profile_id>';
-- -- Expected: earned_tokens >= 50 (plus any prior balance)
-- SELECT expires_at FROM earned_token_vouchers WHERE voucher_id IN
--   (SELECT related_voucher_id FROM token_grants_log WHERE idempotency_key='test_grant:1');
-- -- Expected: ~30 days from NOW()
--
-- -- (5) Idempotency check: re-run the same call:
-- SELECT public.grant_admin_direct_tokens(
--   '<vendor_profile_id>'::uuid, 50, 30, 'admin_grant',
--   '<admin_user_id>'::uuid, 'Manual test grant', 'test_grant:1'
-- );
-- -- Expected: returns the same voucher_id as the first call · no double-grant
-- ============================================================================
