-- lead_token_holds hardening — money-path fixes from adversarial review (2026-07-12).
-- ============================================================================
-- Supersedes the functions in 20270726988829 (never mutate a merged migration —
-- CREATE OR REPLACE in a newer file wins). Two revenue-integrity fixes; both
-- close an UNDER-charge gap (never a double-charge, never couple-facing).
--
--   FIX 1 (concurrency) — the reservation read now locks the wallet row FOR
--     UPDATE, so two concurrent accepts by the same vendor can't both pass the
--     available-minus-held check and over-hold beyond the balance.
--   FIX 2 (verified quota) — release + sweep now DELETE the vendor_event_unlocks
--     row they created at accept (tokens_burned=0, never charged). Otherwise a
--     verified vendor's 10/week cap (which COUNTs unlock rows) would be drained
--     by ghosted fakes even though none were ever paid for.
--
-- Known, ACCEPTED v1 limitations (documented, not fixed here — vendor-favorable,
-- rare, sweep-safe): a couple that ghosts-then-returns after release, or a vendor
-- who drains their balance between hold and reply, yields one un-charged real
-- lead. Do NOT toggle the flag OFF while holds are outstanding (the consume hook
-- is flag-gated; the sweep would then release in-flight holds unpaid).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- unlock_vendor_event_hold — reservation now locks the wallet row (FIX 1).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_vendor_event_hold(
  p_vendor_profile_id UUID,
  p_event_id          UUID,
  p_thread_id         UUID DEFAULT NULL
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
  v_avail      INT;
  v_held       INT;
  v_is_founder BOOLEAN;
BEGIN
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
  v_is_founder := (v_actor = v_founder);

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'held', false, 'already', true, 'tokens', 0);
  END IF;

  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;
  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  IF v_tier = 'verified' THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days';
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    SELECT r.burn_band INTO v_band
      FROM public.regions r
     WHERE lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.slug)
        OR lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.psgc_code)
        OR r.aliases @> ARRAY[lower(COALESCE(NULLIF(v_region, ''), ''))]
     LIMIT 1;
    IF v_band IS NULL THEN v_band := 1; END IF;
    v_tokens := v_band;
  ELSE
    v_tokens := 0;
    v_band := NULL;
  END IF;

  -- Reservation — FIX 1: lock the wallet row FOR UPDATE so a concurrent accept by
  -- the same holder serializes here (reads this actor's held sum only AFTER the
  -- lock, so it sees a committed concurrent hold) → no over-hold past the balance.
  IF v_paid AND v_tokens > 0 THEN
    IF v_is_founder THEN
      PERFORM public.evaluate_earned_token_expiry(p_vendor_profile_id);
      SELECT COALESCE(earned_tokens, 0) + COALESCE(purchased_tokens, 0) INTO v_avail
        FROM public.vendor_wallets WHERE vendor_id = p_vendor_profile_id FOR UPDATE;
    ELSE
      SELECT COALESCE(purchased_tokens, 0) INTO v_avail
        FROM public.vendor_member_token_wallets
       WHERE vendor_id = p_vendor_profile_id AND user_id = v_actor FOR UPDATE;
    END IF;
    v_avail := COALESCE(v_avail, 0);

    SELECT COALESCE(SUM(tokens), 0) INTO v_held
      FROM public.lead_token_holds
     WHERE vendor_profile_id = p_vendor_profile_id
       AND holder_user_id = v_actor
       AND status = 'held';

    IF (v_avail - v_held) < v_tokens THEN
      RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: need % tokens · available % · % already held',
        v_tokens, v_avail, v_held;
    END IF;
  END IF;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, 0, v_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'held', false, 'already', true, 'tokens', 0);
  END IF;

  INSERT INTO public.lead_token_holds
    (vendor_profile_id, event_id, thread_id, holder_user_id, is_founder_draw,
     tokens, band, region, tier, status)
  VALUES
    (p_vendor_profile_id, p_event_id, p_thread_id, v_actor, v_is_founder,
     v_tokens, v_band, v_region, v_tier, 'held')
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  RETURN jsonb_build_object(
    'charged', false, 'held', true, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.unlock_vendor_event_hold(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event_hold(UUID, UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- release_lead_token_hold — also drop the never-charged unlock row (FIX 2).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_lead_token_hold(
  p_hold_id UUID,
  p_reason  TEXT DEFAULT 'ghost_no_reply'
) RETURNS JSONB AS $$
DECLARE
  v_h public.lead_token_holds;
BEGIN
  SELECT * INTO v_h FROM public.lead_token_holds WHERE hold_id = p_hold_id FOR UPDATE;
  IF v_h.hold_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_h.status <> 'held' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_h.status);
  END IF;

  UPDATE public.lead_token_holds
     SET status = 'released', released_at = now(), release_reason = p_reason
   WHERE hold_id = p_hold_id;

  -- The unlock row created at accept was never charged (tokens_burned=0). Drop it
  -- so it stops counting against the verified 10/week cap (FIX 2). The chat gate
  -- keys on chat_threads.inquiry_status, not this row, so removing it is safe.
  DELETE FROM public.vendor_event_unlocks
   WHERE vendor_profile_id = v_h.vendor_profile_id AND event_id = v_h.event_id;

  RETURN jsonb_build_object('ok', true, 'released', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.release_lead_token_hold(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_lead_token_hold(UUID, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- sweep_ghosted_lead_holds — bulk release + drop the never-charged unlock rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_ghosted_lead_holds(
  p_older_than INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS TABLE (hold_id UUID, vendor_profile_id UUID, event_id UUID, tokens INT) AS $$
BEGIN
  RETURN QUERY
  WITH released AS (
    UPDATE public.lead_token_holds h
       SET status = 'released', released_at = now(), release_reason = 'ghost_no_reply'
     WHERE h.status = 'held'
       AND h.held_at < now() - p_older_than
    RETURNING h.hold_id, h.vendor_profile_id, h.event_id, h.tokens
  ),
  dropped AS (
    DELETE FROM public.vendor_event_unlocks veu
     USING released r
     WHERE veu.vendor_profile_id = r.vendor_profile_id
       AND veu.event_id = r.event_id
    RETURNING veu.event_id
  )
  SELECT r.hold_id, r.vendor_profile_id, r.event_id, r.tokens FROM released r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.sweep_ghosted_lead_holds(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_ghosted_lead_holds(INTERVAL) TO service_role;
