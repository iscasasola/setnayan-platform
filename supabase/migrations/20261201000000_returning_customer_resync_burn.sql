-- ============================================================================
-- 20261201000000_returning_customer_resync_burn.sql
-- Returning-customer resync burn (FLAT 1 token) + returning-client badge RPC.
--
-- Owner-locked 2026-06-12 (DECISION_LOG.md "Returning-customer resync burn" +
-- "Returning-client badge" rows). Owner verbatim: "if the customer inquires to
-- them again, but on a different event, the charge will just be 1 token since
-- this is just resyncing them to their old customer."
--
-- TWO deliberately DIFFERENT predicates (per the locked rows):
--   • RESYNC BURN keys on a prior UNLOCK — any vendor_event_unlocks row for
--     this vendor on a DIFFERENT event that shares a couple-type
--     event_members member with the inquiry's event. A prior unlock is the
--     paid connection (the flat-claim precedent in
--     20261019000000_vendor_claim_flat_token_burn.sql uses the same record).
--   • The BADGE keys on a prior LOCK — a CONFIRMED event_vendors booking
--     ('contracted' / 'deposit_paid' / 'delivered' / 'complete', mirroring
--     CONFIRMED_VENDOR_STATUSES in apps/web/lib/events.ts) — stricter than
--     the burn predicate.
--
-- (1) CREATE OR REPLACE unlock_vendor_event — copied from the LATEST shipped
--     definition (20261013000000_founder_vendor_overrides.sql) with the resync
--     check woven in for PAID tiers. All existing gates unchanged: FREE still
--     raises TIER_FREE_NO_INAPP; FREE-VERIFIED's ≤10/rolling-week unlocks stay
--     FREE (a resync never makes a free path cost tokens); founder bypass
--     unchanged; idempotent re-accept unchanged; error strings unchanged
--     (chat-actions.ts regex-matches TIER_FREE_NO_INAPP /
--     VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES).
--
--     Resync stamp convention: the unlock row records tokens_burned=1,
--     band=NULL, region_slug='__resync__'. Rationale: the flat-claim
--     precedent stamps region_slug/band NULL for non-banded burns; resync
--     must stay DISTINGUISHABLE from a claim unlock, and region_slug is
--     free-text with an existing '__default__' sentinel convention, so a
--     '__resync__' sentinel fits. The wedding's real region is preserved in
--     the token-ledger metadata jsonb on the consume call.
--
-- (2) get_returning_client_flags — SECURITY DEFINER lookup powering the
--     vendor-inbox "Returning client" badge. Vendors CANNOT read the couple's
--     other-event event_members rows under RLS (member_reads_membership only
--     grants self + own-event couple reads), so a direct client query would
--     silently return empty. The RPC is ownership-checked (auth.uid() must
--     own the vendor profile) and returns ONLY what the vendor is entitled
--     to: booleans + the display_name/date of events the vendor was itself
--     CONFIRMED on (their own client history).
--
-- Idempotent (CREATE OR REPLACE throughout). NOT applied to prod here — the
-- orchestrating session applies migrations sequentially after merge.
-- NOTE: filename is 20261201000000 (not 20261129000000) because
-- 20261129000000 is already taken by reception_refinement_main_photo and CI
-- enforces unique 14-digit timestamp prefixes.
-- ============================================================================

BEGIN;

-- ── 1 · unlock_vendor_event with the returning-customer resync flat burn ────
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
  v_is_founder BOOLEAN;
  v_resync     BOOLEAN := false;
  v_row_region TEXT;
BEGIN
  -- Ownership check (SECURITY DEFINER + granted to authenticated → mandatory).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  -- Idempotent re-accept → free + un-gated.
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Tier gate + founder override.
  SELECT tier_state, COALESCE(is_founder, false)
    INTO v_tier, v_is_founder
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- Founder bypass (owner 2026-06-09): unlimited free unlocks — no tier gate,
  -- no weekly cap, no burn. Record the unlock at 0 tokens for idempotency.
  IF v_is_founder THEN
    SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
    INSERT INTO public.vendor_event_unlocks
      (vendor_profile_id, event_id, tokens_burned, region_slug, band)
    VALUES (p_vendor_profile_id, p_event_id, 0, v_region, NULL)
    ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;
    RETURN jsonb_build_object('charged', false, 'already', false,
                              'founder', true, 'tokens', 0);
  END IF;

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

  v_paid := (v_tier IN ('pro', 'enterprise'));

  -- Resolve region for context; only PAID tiers compute a token cost.
  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    -- Returning-customer resync check (owner-locked 2026-06-12): has this
    -- vendor ANY prior unlock (paid connection) on a DIFFERENT event sharing
    -- a couple-type member with this one? If yes → this inquiry is the same
    -- customer on a new event; the charge is FLAT 1 token, not the band.
    -- Owner verbatim: "if the customer inquires to them again, but on a
    -- different event, the charge will just be 1 token since this is just
    -- resyncing them to their old customer."
    SELECT EXISTS (
      SELECT 1
      FROM public.event_members cur_m
      JOIN public.event_members prior_m
        ON prior_m.user_id = cur_m.user_id
       AND prior_m.member_type = 'couple'
       AND prior_m.event_id <> cur_m.event_id
      JOIN public.vendor_event_unlocks prior_u
        ON prior_u.event_id = prior_m.event_id
       AND prior_u.vendor_profile_id = p_vendor_profile_id
      WHERE cur_m.event_id = p_event_id
        AND cur_m.member_type = 'couple'
    ) INTO v_resync;

    IF v_resync THEN
      -- FLAT 1 token (band NULL · region_slug '__resync__' sentinel so the
      -- row is distinguishable from a banded burn AND from a flat claim
      -- unlock's NULL/NULL — see header comment). Real region kept in the
      -- ledger metadata below.
      v_tokens := 1;
      v_band := NULL;
      v_row_region := '__resync__';
    ELSE
      SELECT band, tokens INTO v_band, v_tokens
        FROM public.token_burn_bands
       WHERE region_slug = COALESCE(NULLIF(v_region, ''), '__default__');
      IF v_tokens IS NULL THEN
        SELECT band, tokens INTO v_band, v_tokens
          FROM public.token_burn_bands WHERE region_slug = '__default__';
      END IF;
      IF v_tokens IS NULL THEN
        v_tokens := 1; v_band := 1;
      END IF;
      v_row_region := v_region;
    END IF;
  ELSE
    -- Verified: FREE unlock — recorded (for the 10/week count + idempotency)
    -- at 0 tokens. A resync never makes the free path cost anything, so the
    -- resync check is skipped entirely here.
    v_tokens := 0;
    v_band := NULL;
    v_row_region := v_region;
  END IF;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_row_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Only PAID tiers burn. Insufficient balance RAISES → whole tx rolls back.
  IF v_paid THEN
    PERFORM public.consume_vendor_assets_per_voucher(
      p_vendor_profile_id, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
      jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier,
                         'resync', v_resync)
    );
  END IF;

  RETURN jsonb_build_object(
    'charged', v_paid, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier, 'resync', v_resync);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.unlock_vendor_event(UUID, UUID) IS
  'Tier-gated burn-on-answer: FREE blocked · FREE-VERIFIED <=10 new unlocks/rolling-week FREE (0 tokens) · PRO/ENTERPRISE unlimited + burns 1-3 region-banded tokens — EXCEPT a returning customer (any prior unlock for this vendor on a different event sharing a couple-type event_members member) costs FLAT 1 token (resync · owner-locked 2026-06-12; row stamped region_slug=''__resync__'', band NULL). FOUNDER (is_founder=true) bypasses ALL gating — owner 2026-06-09. Idempotent per (vendor,event); ownership-checked. RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;

-- ── 2 · Returning-client badge lookup (vendor inbox) ────────────────────────
-- Owner verbatim (2026-06-12): "when an inquiry from an old locked client, we
-- want to notify that this is coming from a client they previously locked."
--
-- Batched: one call covers ALL of the vendor's pending inquiry events (no
-- N+1). For each input event that has at least one prior CONFIRMED booking
-- (event_vendors.status in the locked ladder, marketplace_vendor_id = this
-- vendor) on a DIFFERENT event sharing a couple-type member, returns one row:
-- the most recent such prior event's display_name + date (the vendor's own
-- client history — safe to expose to that vendor), plus resync_flat = whether
-- the LOOSER burn predicate (any prior unlock) also holds, so the UI can
-- truthfully say "accepting costs just 1 token" only where it's true.
--
-- SECURITY DEFINER because RLS on event_members (member_reads_membership)
-- only grants self-reads + own-event couple reads — a vendor session cannot
-- see the couple's OTHER events, so a direct query would silently render no
-- badge. Ownership-checked like unlock_vendor_event.
CREATE OR REPLACE FUNCTION public.get_returning_client_flags(
  p_vendor_profile_id UUID,
  p_event_ids         UUID[]
) RETURNS TABLE (
  event_id                 UUID,
  prior_event_display_name TEXT,
  prior_event_date         DATE,
  resync_flat              BOOLEAN
) AS $$
BEGIN
  -- Ownership check (SECURITY DEFINER + granted to authenticated → mandatory).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  RETURN QUERY
  WITH cur AS (
    -- Couple-type members of the inquiry events being asked about.
    SELECT em.event_id AS cur_event_id, em.user_id
    FROM public.event_members em
    WHERE em.event_id = ANY (p_event_ids)
      AND em.member_type = 'couple'
  ),
  locked AS (
    -- Badge predicate: prior CONFIRMED booking of THIS vendor on a different
    -- event of the same couple member. Most recent prior event wins.
    SELECT DISTINCT ON (c.cur_event_id)
           c.cur_event_id,
           e.display_name,
           e.event_date
    FROM cur c
    JOIN public.event_members pm
      ON pm.user_id = c.user_id
     AND pm.member_type = 'couple'
     AND pm.event_id <> c.cur_event_id
    JOIN public.event_vendors ev
      ON ev.event_id = pm.event_id
     AND ev.marketplace_vendor_id = p_vendor_profile_id
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    JOIN public.events e
      ON e.event_id = pm.event_id
    ORDER BY c.cur_event_id, e.event_date DESC NULLS LAST, e.event_id
  )
  SELECT l.cur_event_id,
         l.display_name,
         l.event_date,
         EXISTS (
           -- Resync (burn) predicate — looser: ANY prior unlock.
           SELECT 1
           FROM cur c2
           JOIN public.event_members pm2
             ON pm2.user_id = c2.user_id
            AND pm2.member_type = 'couple'
            AND pm2.event_id <> c2.cur_event_id
           JOIN public.vendor_event_unlocks pu
             ON pu.event_id = pm2.event_id
            AND pu.vendor_profile_id = p_vendor_profile_id
           WHERE c2.cur_event_id = l.cur_event_id
         ) AS resync_flat
  FROM locked l;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_returning_client_flags(UUID, UUID[]) IS
  'Vendor-inbox "Returning client" badge lookup (owner-locked 2026-06-12). Batched over inquiry event_ids: returns a row per event whose couple-type member previously CONFIRMED-booked this vendor (event_vendors contracted/deposit_paid/delivered/complete via marketplace_vendor_id) on a different event — with that prior event''s display_name/date (the vendor''s own client history) and resync_flat = the looser prior-unlock predicate that makes the accept burn FLAT 1 token. SECURITY DEFINER because vendor RLS cannot read the couple''s other-event event_members rows; ownership-checked via auth.uid().';

REVOKE ALL ON FUNCTION public.get_returning_client_flags(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_returning_client_flags(UUID, UUID[]) TO authenticated;

COMMIT;
