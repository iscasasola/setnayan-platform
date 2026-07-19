-- ============================================================================
-- Tokens never expire (owner 2026-07-01: "no expiry for all tokens")
-- ============================================================================
-- Purchased tokens (vendor_wallets.purchased_tokens + vendor_member_token_wallets)
-- already never expire. The only remaining timer was on EARNED/GRANTED tokens,
-- held as `earned_token_vouchers` with a 45-day `expires_at`. This retires that
-- timer: admin grants now mint never-expire vouchers, and every currently-live
-- voucher is extended to never-expire. Already-expired vouchers are left dead
-- (not resurrected).
--
-- Sentinel: `2999-12-31` (a real far-future timestamp, NOT `'infinity'`, so the
-- frontend `new Date(expires_at)` never becomes Invalid Date). All burn/eval
-- logic keys on `expires_at > NOW()`, which the sentinel satisfies forever, so
-- no change to consume_vendor_assets_per_voucher / evaluate_earned_token_expiry
-- is needed. Supersedes the 2026-05-28 "earned vouchers expire 45 days" lock.
-- ============================================================================

-- 1. Extend every currently-live voucher to never-expire (preserve balances;
--    don't resurrect already-expired ones).
UPDATE public.earned_token_vouchers
   SET expires_at = TIMESTAMPTZ '2999-12-31 00:00:00+00'
 WHERE expires_at > NOW();

-- 2. Admin grants now mint never-expire vouchers. `p_ttl_days` is retained for
--    signature/back-compat but IGNORED (no timer anymore). Body is otherwise
--    the live 20260703500000 version.
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
  -- p_ttl_days is ignored (tokens never expire · owner 2026-07-01); no range
  -- check remains.
  IF p_grant_source NOT IN ('pilot_grant', 'telemetry_reward', 'manpower_handshake', 'admin_grant', 'referral_reward') THEN
    RAISE EXCEPTION 'INVALID_GRANT_SOURCE: %', p_grant_source;
  END IF;

  SELECT related_voucher_id INTO v_existing
    FROM public.token_grants_log
   WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- (a) Mint a NEVER-EXPIRE voucher row.
  INSERT INTO public.earned_token_vouchers
    (vendor_id, tokens_granted, tokens_remaining, expires_at, grant_source, grant_metadata)
  VALUES
    (p_vendor_id, p_token_count, p_token_count, TIMESTAMPTZ '2999-12-31 00:00:00+00', p_grant_source,
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

-- Preserve the money-path lockdown from 20270226279630 (DEFINER-only).
REVOKE EXECUTE ON FUNCTION public.grant_admin_direct_tokens(uuid, integer, integer, text, uuid, text, text)
  FROM anon, authenticated, PUBLIC;

COMMENT ON TABLE public.vendor_wallets IS
  'V2 dual-balance vendor token wallet. Tokens NEVER expire (owner 2026-07-01) — earned_tokens are the live sum of non-expired earned_token_vouchers, and every voucher is now minted/extended to a 2999 far-future sentinel.';
