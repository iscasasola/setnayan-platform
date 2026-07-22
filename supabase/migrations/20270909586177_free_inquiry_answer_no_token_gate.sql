-- ============================================================================
-- 20270909586177_free_inquiry_answer_no_token_gate.sql
--
-- MAKE ANSWERING AN INQUIRY FREE — decouple the vendor "answer" path from the
-- (now-unsellable) purchasable token packs.
--
-- WHY: the vendor token packs are being retired (companion migration
-- 20270910266901_retire_vendor_token_packs). Before this change the live accept
-- path (chat-actions.ts `acceptInquiry` → unlock_vendor_event) BURNED 1-3 region-
-- banded tokens for every NEW (vendor,event) unlock on the verified/solo/pro/
-- enterprise tiers, and RAISED `INSUFFICIENT_WALLET_BALANCES` (rolling the whole
-- tx back) when the answering member had no balance. With packs unsellable, a
-- token-less paid vendor whose only token source was packs could be STRANDED —
-- unable to answer a couple at all. That is the exact failure this migration
-- prevents.
--
-- WHAT: this is the live body of unlock_vendor_event VERBATIM (from
-- 20270819553697 — creator P2 spine, which copied 20270818135217 founder_seats
-- + the influencer-spend tag) with ONE change: the token cost for a normal
-- answer is forced to zero. Every gate is preserved — the answering-member
-- check (FORBIDDEN), the FREE-tier block (TIER_FREE_NO_INAPP), idempotent
-- re-accept, the verified ≤10-new-unlocks/rolling-week throttle
-- (VERIFIED_WEEKLY_LIMIT), and the founder-seat comp. Only the token BURN is
-- neutralised: v_tokens is set to 0 before the debit guard, so
-- `IF v_paid AND v_tokens > 0` is never entered → no consume_* call → the
-- INSUFFICIENT_WALLET_BALANCES branch can no longer fire. The unlock row still
-- records (at 0 tokens burned), so the 10/week count + idempotency are intact.
--
-- SCOPE / REVERSIBILITY: the token WALLET, subscription bundle-token grants, the
-- consume_* RPCs, and the burn plumbing all still EXIST and are untouched — only
-- the answer no longer draws on them. To restore burn-on-answer, revert this
-- migration (re-apply the 20270819553697 body). The parallel HOLD path
-- (unlock_vendor_event_hold, NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED, default OFF)
-- is dormant and intentionally left as-is.
--
-- Idempotent (CREATE OR REPLACE; privileges preserved, re-asserted for safety).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unlock_vendor_event(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_region     TEXT;
  v_tokens     INT;
  v_band       SMALLINT;
  v_tier       TEXT;
  v_already    BOOLEAN;
  v_week_count INT;
  v_rowcount   INT;
  v_paid       BOOLEAN;
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_seat_comp  BOOLEAN;
BEGIN
  -- (a) Answering member gate: founder + co-admins + assigned agents may answer;
  -- viewers / non-members are blocked.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = p_vendor_profile_id
      AND tm.user_id = v_actor
      AND tm.role IN ('owner', 'admin', 'agent')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member of this vendor';
  END IF;

  SELECT user_id INTO v_founder FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  -- Founder-seat comp (platform founder ≠ v_founder, the vendor-team founder).
  v_seat_comp := public.event_host_holds_founder_seat(p_event_id);

  IF v_tier = 'verified' AND NOT v_seat_comp THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days'
       AND comp_reason IS NULL;
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    -- Region → burn_band single source (regions, alias-resolved). Retained for
    -- the returned context / band record even though nothing is charged.
    SELECT r.burn_band
      INTO v_band
      FROM public.regions r
     WHERE lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.slug)
        OR lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.psgc_code)
        OR r.aliases @> ARRAY[lower(COALESCE(NULLIF(v_region, ''), ''))]
     LIMIT 1;
    IF v_band IS NULL THEN
      v_band := 1;
    END IF;
    v_tokens := v_band;
  ELSE
    v_tokens := 0;
    v_band := NULL;
  END IF;

  IF v_seat_comp THEN
    v_tokens := 0;
  END IF;

  -- ── PACKS RETIRED 2026-07-22 · ANSWERING IS FREE ─────────────────────────────
  -- Token packs are retired (companion 20270910266901), so the answer must not
  -- gate on a purchasable token. Force the burn to zero for EVERY tier here:
  -- with v_tokens = 0 the debit guard below (`IF v_paid AND v_tokens > 0`) is
  -- never entered, so no consume_* runs and INSUFFICIENT_WALLET_BALANCES can no
  -- longer fire — a token-less paid vendor can always answer. All gates above
  -- (FORBIDDEN / TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / idempotency /
  -- founder comp) are unchanged. Revert this migration to restore burn-on-answer.
  v_tokens := 0;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band, comp_reason)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_region, v_band,
     CASE WHEN v_seat_comp THEN 'founder' END)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Burn path retained but now unreachable on the answer (v_tokens is always 0
  -- above). Left in place so reverting this migration cleanly restores charging.
  IF v_paid AND v_tokens > 0 THEN
    IF v_actor = v_founder THEN
      PERFORM public.consume_vendor_assets_per_voucher(
        p_vendor_profile_id, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
        jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
      );
    ELSE
      PERFORM public.consume_member_purchased_tokens(
        p_vendor_profile_id, v_actor, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
        jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.vendor_profile_id = p_vendor_profile_id
         AND t.event_id = p_event_id
         AND t.referring_chapter_id IS NOT NULL
    ) THEN
      UPDATE public.token_redemptions_log
         SET spend_source = 'lead_unlock'
       WHERE vendor_id = p_vendor_profile_id
         AND service_code = 'INQUIRY_UNLOCK'
         AND related_event_id = p_event_id
         AND spend_source IS NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'charged', (v_paid AND v_tokens > 0), 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier,
    'founder_comp', v_seat_comp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.unlock_vendor_event(UUID, UUID) IS
  'Tier-gated inquiry unlock (2026-07-22: answering is FREE). Gates preserved — FREE blocked (TIER_FREE_NO_INAPP) · verified ≤10 new unlocks/rolling-week (VERIFIED_WEEKLY_LIMIT) · answering-member-only (FORBIDDEN) · idempotent per (vendor,event) · founder-seat comp. Token BURN neutralised (v_tokens forced to 0): no consume_* runs, INSUFFICIENT_WALLET_BALANCES can no longer fire — decoupled from the retired token packs. Wallet/bundle/consume plumbing left intact for reversibility.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;
