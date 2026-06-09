-- ============================================================================
-- 20261019000000_vendor_claim_flat_token_burn.sql
-- Manual-add claim → FLAT 1-token burn (owner-locked 2026-06-09).
--
-- When a couple "Add manually"s a vendor on the Shortlist, Setnayan mints a
-- claim invite (the QR the vendor scans). When that vendor claims the couple —
-- whether they sign in to an existing account or create a new one — the SYNC
-- costs the vendor ONE token (owner: "adding customer will cost 1 ticket to
-- sync"). Owner chose a FLAT 1 token here (2026-06-09), distinct from the
-- region-banded 1/2/3 burn-on-answer (unlock_vendor_event): a manual add is a
-- couple-initiated, pre-qualified connection, so it's a flat, cheaper unlock.
--
-- Reuses the SAME per-(vendor, event) idempotency record as burn-on-answer
-- (vendor_event_unlocks · UNIQUE(vendor_profile_id, event_id)), so a vendor that
-- already unlocked this event — via a prior inquiry-accept OR a prior claim —
-- syncs for FREE (one unlock covers all the vendor's services for that event,
-- the locked token-economy contract).
--
-- SAFETY: this RPC is called best-effort from the claim flow AFTER the vendor
-- has already been linked to the event (applyClaimAutoLink writes the link in
-- earlier, separate statements). If the vendor can't afford the token, the burn
-- RAISES and the whole RPC tx rolls back (incl. the unlock insert → no phantom
-- unlock), but the link still stands — the couple's manual add is NEVER blocked
-- by the vendor's wallet. The owner-side policy for charging a zero-token new
-- vendor later is an open follow-up (DECISION_LOG 2026-06-09).
-- ============================================================================

-- Flat 1-token claim unlock. Returns JSONB:
--   {charged:true,  already:false, tokens:1}  — first sync; burned 1
--   {charged:false, already:true,  tokens:0}  — already unlocked (free)
-- RAISES INSUFFICIENT_WALLET_BALANCES (rolling the whole tx back, so no unlock
-- row persists) when the vendor can't afford it — the caller swallows it so the
-- already-committed link survives.
--
-- No auth.uid() ownership check: unlike unlock_vendor_event (called by the
-- vendor in their own session), this RPC is invoked SERVER-SIDE from the claim
-- finalize flow via the service-role admin client, AFTER that flow has validated
-- the claim token + that the authenticated vendor owns the profile. EXECUTE is
-- therefore restricted to service_role only (NOT authenticated) so a signed-in
-- user can't call it directly to burn an arbitrary vendor's tokens.
CREATE OR REPLACE FUNCTION public.claim_unlock_vendor_event(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_rowcount INT;
BEGIN
  -- Idempotency gate: one unlock per (vendor, event). Shared with burn-on-answer
  -- — if a row already exists the vendor already unlocked this event → free sync.
  -- region_slug/band stay NULL to mark this as a flat claim unlock (not banded).
  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, 1, NULL, NULL)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;

  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Fresh unlock → burn exactly 1 token. On shortfall this RAISES
  -- INSUFFICIENT_WALLET_BALANCES and the whole tx (incl. the insert above) rolls
  -- back — no phantom unlock; the caller keeps the already-committed link.
  PERFORM public.consume_vendor_assets_per_voucher(
    p_vendor_profile_id,
    1,
    'MANUAL_CLAIM_UNLOCK',
    p_event_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('charged', true, 'already', false, 'tokens', 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.claim_unlock_vendor_event(UUID, UUID) IS
  'Manual-add claim sync: idempotent FLAT 1-token burn per (vendor, event), sharing vendor_event_unlocks with burn-on-answer (already-unlocked → free). Service-role only (called server-side from the claim flow after validation). RAISES INSUFFICIENT_WALLET_BALANCES (rolling back, no phantom unlock) when unaffordable; the caller swallows it so the link survives. Owner-locked 2026-06-09 (flat, not region-banded).';

REVOKE ALL ON FUNCTION public.claim_unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_unlock_vendor_event(UUID, UUID) TO service_role;
