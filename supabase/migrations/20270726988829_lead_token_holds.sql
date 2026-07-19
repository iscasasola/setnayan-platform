-- lead_token_holds — Phase B of fake-inquiry protection: token HOLD-and-release.
-- ============================================================================
-- Owner-approved 2026-07-12 ("build it now, flag-gated"). The problem: a vendor
-- accepting an inquiry BURNS a token immediately (`unlock_vendor_event`), so a
-- fake/never-replies lead costs the vendor real money. This adds a HOLD model:
-- accept RESERVES the token instead of spending it; the token is only truly
-- CONSUMED when the couple genuinely replies, and RELEASED (returned) if they
-- ghost. Fakes never reply → auto-release → the vendor never pays for a fake.
--
-- DESIGN — zero blast radius on the live money path:
--   • `unlock_vendor_event` (the live burn RPC) is UNTOUCHED. This adds a PARALLEL
--     `unlock_vendor_event_hold` the app calls ONLY when the flag is on.
--   • Strategy: DON'T debit at accept. Record a hold; `available = wallet balance
--     − outstanding held`. Consume debits via the EXISTING consume_* fns (once,
--     at reply). Release just flips status — nothing to refund, so no fragile
--     reversal of FIFO earned-voucher consumption.
--   • Reservation at hold time reads the SAME balance sources the burn draws from
--     (founder: evaluate_earned_token_expiry → vendor_wallets.earned+purchased ·
--     member: vendor_member_token_wallets.purchased) so a founder who holds only
--     earned-voucher tokens is never falsely blocked.
-- Flag-gated in the app (NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED, default OFF) — until
-- the owner flips it, every accept still runs the live burn path unchanged.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The hold ledger. One hold per (vendor, event), mirroring vendor_event_unlocks.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_token_holds (
  hold_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  thread_id          UUID REFERENCES public.chat_threads(thread_id) ON DELETE SET NULL,
  -- The answering member who would pay. Founder → store wallet; else personal.
  holder_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_founder_draw    BOOLEAN NOT NULL,
  tokens             INT NOT NULL CHECK (tokens >= 0),
  band               SMALLINT,
  region             TEXT,
  tier               TEXT,
  status             TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'consumed', 'released')),
  held_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at        TIMESTAMPTZ,
  released_at        TIMESTAMPTZ,
  consume_reason     TEXT,
  release_reason     TEXT,
  UNIQUE (vendor_profile_id, event_id)
);

COMMENT ON TABLE public.lead_token_holds IS
  'Phase-B token HOLD ledger (fake-inquiry protection). A hold is placed at accept instead of burning; CONSUMED (debited via consume_*) on a genuine couple reply; RELEASED (no debit) if the couple ghosts. available = wallet balance − SUM(held). Written only by the SECURITY DEFINER RPCs below.';

-- Sweep scan (held older than N) + per-holder reservation sum.
CREATE INDEX IF NOT EXISTS lead_token_holds_status_held_at_idx
  ON public.lead_token_holds (status, held_at);
CREATE INDEX IF NOT EXISTS lead_token_holds_holder_status_idx
  ON public.lead_token_holds (vendor_profile_id, holder_user_id, status);

ALTER TABLE public.lead_token_holds ENABLE ROW LEVEL SECURITY;

-- A vendor's team reads its own holds; admins read all. No write policy — every
-- mutation goes through the DEFINER RPCs (mirrors vendor_member_token_wallets).
DROP POLICY IF EXISTS lead_token_holds_vendor_read ON public.lead_token_holds;
CREATE POLICY lead_token_holds_vendor_read
  ON public.lead_token_holds FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 2. unlock_vendor_event_hold — the PARALLEL accept path. Mirrors every gate of
--    the live unlock_vendor_event byte-for-byte, then HOLDS instead of burning.
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
  -- Answering-member gate (identical to unlock_vendor_event).
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

  -- Idempotency: a re-accept of an already-unlocked (vendor,event) is free.
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

  -- Reservation: available (same sources the burn draws from) MINUS this actor's
  -- outstanding held tokens must cover the new hold. Preserves "you need tokens
  -- to accept" without a false block on a founder who holds only earned vouchers.
  IF v_paid AND v_tokens > 0 THEN
    IF v_is_founder THEN
      PERFORM public.evaluate_earned_token_expiry(p_vendor_profile_id);
      SELECT COALESCE(earned_tokens, 0) + COALESCE(purchased_tokens, 0) INTO v_avail
        FROM public.vendor_wallets WHERE vendor_id = p_vendor_profile_id;
    ELSE
      SELECT COALESCE(purchased_tokens, 0) INTO v_avail
        FROM public.vendor_member_token_wallets
       WHERE vendor_id = p_vendor_profile_id AND user_id = v_actor;
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

  -- Open the unlock (tokens_burned = 0 — nothing burned yet; consume stamps it).
  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, 0, v_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'held', false, 'already', true, 'tokens', 0);
  END IF;

  -- Record the hold (no debit). Free tiers (v_tokens = 0) still get a zero-token
  -- hold row so the lifecycle is uniform; consume/release no-op the debit.
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
-- 3. consume_lead_token_hold — the couple genuinely replied → charge for real.
--    Debits via the SAME consume_* the burn would have used. Idempotent.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_lead_token_hold(
  p_hold_id UUID,
  p_reason  TEXT DEFAULT 'couple_reply'
) RETURNS JSONB AS $$
DECLARE
  v_h public.lead_token_holds;
BEGIN
  SELECT * INTO v_h FROM public.lead_token_holds WHERE hold_id = p_hold_id FOR UPDATE;
  IF v_h.hold_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_h.status <> 'held' THEN
    -- Already consumed or released — idempotent no-op.
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_h.status);
  END IF;

  IF v_h.tokens > 0 THEN
    IF v_h.is_founder_draw THEN
      PERFORM public.consume_vendor_assets_per_voucher(
        v_h.vendor_profile_id, v_h.tokens, 'INQUIRY_UNLOCK', v_h.event_id,
        jsonb_build_object('region', v_h.region, 'band', v_h.band, 'tier', v_h.tier, 'via', 'lead_hold_consume'));
    ELSE
      PERFORM public.consume_member_purchased_tokens(
        v_h.vendor_profile_id, v_h.holder_user_id, v_h.tokens, 'INQUIRY_UNLOCK', v_h.event_id,
        jsonb_build_object('region', v_h.region, 'band', v_h.band, 'tier', v_h.tier, 'via', 'lead_hold_consume'));
    END IF;
  END IF;

  UPDATE public.lead_token_holds
     SET status = 'consumed', consumed_at = now(), consume_reason = p_reason
   WHERE hold_id = p_hold_id;

  -- Reflect the real burn on the unlock row (was 0 at hold time).
  UPDATE public.vendor_event_unlocks
     SET tokens_burned = v_h.tokens
   WHERE vendor_profile_id = v_h.vendor_profile_id AND event_id = v_h.event_id;

  RETURN jsonb_build_object('ok', true, 'consumed', true, 'tokens', v_h.tokens);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.consume_lead_token_hold(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_lead_token_hold(UUID, TEXT) TO service_role;

-- Convenience: consume by (vendor, event) — what the couple-reply hook has.
CREATE OR REPLACE FUNCTION public.consume_lead_token_hold_for(
  p_vendor_profile_id UUID,
  p_event_id          UUID,
  p_reason            TEXT DEFAULT 'couple_reply'
) RETURNS JSONB AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT hold_id INTO v_id FROM public.lead_token_holds
   WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
     AND status = 'held'
   LIMIT 1;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'no_hold', true);
  END IF;
  RETURN public.consume_lead_token_hold(v_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.consume_lead_token_hold_for(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_lead_token_hold_for(UUID, UUID, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. release_lead_token_hold — the couple ghosted → return the token (no debit
--    ever happened, so "return" = drop it from the held sum). Idempotent.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_lead_token_hold(
  p_hold_id UUID,
  p_reason  TEXT DEFAULT 'ghost_no_reply'
) RETURNS JSONB AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.lead_token_holds WHERE hold_id = p_hold_id FOR UPDATE;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_status <> 'held' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_status);
  END IF;
  UPDATE public.lead_token_holds
     SET status = 'released', released_at = now(), release_reason = p_reason
   WHERE hold_id = p_hold_id;
  RETURN jsonb_build_object('ok', true, 'released', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.release_lead_token_hold(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_lead_token_hold(UUID, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. sweep_ghosted_lead_holds — batch-release every hold still 'held' past the
--    ghost window. A hold flips to 'consumed' the instant the couple replies, so
--    anything still 'held' after the window = the couple never replied = a ghost.
--    Called by the lead-hold-sweep cron. Returns the released set for notify.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_ghosted_lead_holds(
  p_older_than INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS TABLE (hold_id UUID, vendor_profile_id UUID, event_id UUID, tokens INT) AS $$
BEGIN
  -- UPDATE ... RETURNING must be wrapped in a CTE for RETURN QUERY (PL/pgSQL
  -- does not accept a bare data-modifying statement after RETURN QUERY).
  RETURN QUERY
  WITH released AS (
    UPDATE public.lead_token_holds h
       SET status = 'released', released_at = now(), release_reason = 'ghost_no_reply'
     WHERE h.status = 'held'
       AND h.held_at < now() - p_older_than
    RETURNING h.hold_id, h.vendor_profile_id, h.event_id, h.tokens
  )
  SELECT r.hold_id, r.vendor_profile_id, r.event_id, r.tokens FROM released r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.sweep_ghosted_lead_holds(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_ghosted_lead_holds(INTERVAL) TO service_role;
