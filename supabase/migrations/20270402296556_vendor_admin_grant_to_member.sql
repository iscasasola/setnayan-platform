-- ============================================================================
-- Admin grant → a specific team member's personal wallet
-- ============================================================================
-- Owner 2026-07-01 ("buy"): mirror the buy flow on the Setnayan-staff GRANT
-- screen — let an admin comp a SPECIFIC teammate, not only the founder.
--
-- Founder grants keep the existing earned-voucher path (45-day expiry,
-- `grant_admin_direct_tokens`). A grant to a NON-founder member credits that
-- member's personal PURCHASED balance (`vendor_member_token_wallets`) — the
-- per-member wallet has no voucher/expiry machinery, so a member comp is a
-- never-expiring credit (the same bucket the buy flow lands in). Non-transferable.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grant_member_purchased_tokens(
  p_vendor_id           UUID,
  p_member_user_id      UUID,
  p_token_count         INT,
  p_granted_by_admin_id UUID,
  p_rationale           TEXT,
  p_idempotency_key     TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_existing TEXT;
BEGIN
  IF p_token_count <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOKEN_COUNT: must be positive';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members
     WHERE vendor_profile_id = p_vendor_id AND user_id = p_member_user_id
  ) THEN
    RAISE EXCEPTION 'NOT_A_MEMBER: recipient is not on this team';
  END IF;

  -- Idempotency · re-running the same logical grant is a no-op (shared audit
  -- table with the founder path; idempotency_key is UNIQUE there).
  SELECT idempotency_key INTO v_existing
    FROM public.token_grants_log WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.vendor_member_token_wallets (vendor_id, user_id, purchased_tokens)
  VALUES (p_vendor_id, p_member_user_id, p_token_count)
  ON CONFLICT (vendor_id, user_id) DO UPDATE
    SET purchased_tokens = vendor_member_token_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
        updated_at = NOW();

  INSERT INTO public.token_grants_log
    (vendor_id, grant_source, tokens_granted, related_voucher_id,
     granted_by_admin_id, rationale, idempotency_key)
  VALUES
    (p_vendor_id, 'admin_grant', p_token_count, NULL, p_granted_by_admin_id,
     COALESCE(NULLIF(p_rationale, ''), 'Admin member grant')
       || ' · to member ' || p_member_user_id::text,
     p_idempotency_key);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Money path — DEFINER-only (the admin action calls it via the service-role
-- client, which bypasses this REVOKE; no authenticated client may call it).
REVOKE ALL ON FUNCTION public.grant_member_purchased_tokens(UUID, UUID, INT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.grant_member_purchased_tokens(UUID, UUID, INT, UUID, TEXT, TEXT) IS
  'Admin comp to a NON-founder member''s personal purchased balance (vendor_member_token_wallets · never-expire). Founder grants stay on grant_admin_direct_tokens (45-day earned voucher). Idempotent via token_grants_log.idempotency_key.';
