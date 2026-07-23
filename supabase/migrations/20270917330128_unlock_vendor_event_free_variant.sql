-- Booking Fee · PR-1 — the FREE inquiry-answer variant.
--
-- unlock_vendor_event_free is a VERBATIM copy of the live unlock_vendor_event
-- (20270909586177) with EXACTLY TWO blocks removed: the TIER_FREE_NO_INAPP raise
-- (free tier blocked) and the VERIFIED_WEEKLY_LIMIT raise (10/rolling-week). Every
-- other gate + invariant is preserved identically — answering-member (FORBIDDEN),
-- idempotent per-(vendor,event), founder-seat comp, the unlock-row insert (at 0
-- tokens), and the dead-but-retained burn block.
--
-- WHY a separate function (not a param on the original): the live
-- unlock_vendor_event stays BYTE-IDENTICAL, so the default (flag-off) accept path
-- for every vendor is provably unchanged. acceptInquiry routes here ONLY when
-- NEXT_PUBLIC_FREE_INQUIRY_ACCEPT_ENABLED is on (default off, owner launch flag).
-- If this copy ever drifts, only the flagged path is affected, never today's.

CREATE OR REPLACE FUNCTION public.unlock_vendor_event_free(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_region     TEXT;
  v_tokens     INT;
  v_band       SMALLINT;
  v_tier       TEXT;
  v_already    BOOLEAN;
  v_rowcount   INT;
  v_paid       BOOLEAN;
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_seat_comp  BOOLEAN;
BEGIN
  -- (a) Answering member gate — UNCHANGED from unlock_vendor_event.
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

  -- ↓↓↓ REMOVED vs unlock_vendor_event: the TIER_FREE_NO_INAPP raise. A free
  -- vendor is allowed to answer here (that is the whole point of this variant).

  -- Founder-seat comp — UNCHANGED.
  v_seat_comp := public.event_host_holds_founder_seat(p_event_id);

  -- ↓↓↓ REMOVED vs unlock_vendor_event: the VERIFIED_WEEKLY_LIMIT block. No
  -- 10/rolling-week cap on the free-answer path ("free unlimited inquiries").

  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
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

  -- Answering is FREE (packs retired) — force the burn to zero for every tier,
  -- exactly as unlock_vendor_event does.
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

  -- Burn path retained but unreachable (v_tokens is always 0) — kept identical to
  -- unlock_vendor_event so the two stay in lock-step.
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

COMMENT ON FUNCTION public.unlock_vendor_event_free(UUID, UUID) IS
  'Booking-Fee PR-1 free-answer variant of unlock_vendor_event: identical EXCEPT '
  'the TIER_FREE_NO_INAPP + VERIFIED_WEEKLY_LIMIT raises are removed. Routed to '
  'only when NEXT_PUBLIC_FREE_INQUIRY_ACCEPT_ENABLED is on (default off). Keeps '
  'FORBIDDEN, idempotency, founder comp, the 0-token unlock row.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event_free(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event_free(UUID, UUID) TO authenticated;
