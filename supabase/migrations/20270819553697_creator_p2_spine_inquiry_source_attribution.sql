-- ============================================================================
-- 20270819553697_creator_p2_spine_inquiry_source_attribution.sql
-- Creator Economy PR-C — the P2 spine: chapter→inquiry ATTRIBUTION + the
-- owner's INQUIRY-SOURCE taxonomy + the 'lead_unlock' influencer-spend tag.
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md
--           (§ OWNER RATIFICATION · § Inquiry-source taxonomy · P2)
--       + Creator_Economy_Simplest_Approach_Council_Verdict_2026-07-16.md
--           (§5 step 4 — PR-C, one migration · §6 ratified copy)
--
-- Paper locks in force (owner-signed 2026-07-16):
--   • Attribution = CTA-CLICK: the chapter whose Book CTA STARTED the thread
--     gets the credit. No windows, no multi-touch — the column is stamped once,
--     at thread creation, and never overwritten on a resumed thread.
--   • Public read path whitelists audience_rate_terms ONLY (creator_rate_terms
--     never renders publicly). Attribution + source live on the PRIVATE thread;
--     public surfaces get aggregate-only counters ("inquiries driven").
--   • Collab outcome = fulfilled/unfulfilled state + the discount↔chapter link.
--     NO clawback machinery — fulfilled_at is a timestamp, not a lever.
--   • Metric word = "inquiries driven" (never "bookings").
--
-- What this migration does:
--   1. chat_threads.referring_chapter_id  — the CTA-click attribution column.
--      chat_threads.inquiry_source        — the owner's source taxonomy
--                                           (NULL = Website Inquiry default).
--      chat_threads.is_returning          — companion flag; combines with any
--                                           origin, never overwrites it.
--   2. vendor_creator_offers.fulfilled_at — the deliverable-linked timestamp.
--      users.creator_accepts_offers       — creator solicitation opt-out
--                                           (RA-10173 must-plan item; default ON).
--   3. unlock_vendor_event + consume_lead_token_hold — CREATE OR REPLACE (never
--      mutate a merged migration) adding the spend_source='lead_unlock' stamp
--      when the unlocked (vendor,event) pair has an ATTRIBUTED thread. BOTH
--      unlock paths are tagged, so attributed unlocks are counted regardless of
--      which flag-path (direct burn vs hold-and-release) the vendor is on.
--   4. offer_creator_reach_hold — CREATE OR REPLACE adding (a) the creator
--      opt-out check and (b) the owner-ratified PRO-AND-UP tighten (decision #4,
--      2026-07-16: overrides the council's all-paid-tiers resolution; matches
--      the Market Intel precedent — supersedes P1's tier != 'free').
--   5. link_creator_offer_deliverable + respond_creator_offer — CREATE OR
--      REPLACE stamping fulfilled_at when the crediting chapter is linked.
--
-- CORRECTION to 20270819350491 § 5 (comment-only; that migration is merged and
-- immutable): its closing line "No spend path is blind to another" is
-- OVERSTATED. The LEGACY direct-burn unlock_vendor_event (live whenever the
-- lead-hold flag is OFF — apps/web/lib/chat-actions.ts) debits the wallet
-- without subtracting outstanding lead_token_holds, so a held token can still
-- be double-spent by the direct path. Escrowed creator offers ARE immune (their
-- tokens already left the balance); the residual blind spot is direct-burn vs
-- lead-holds only, and only while both paths are live. Not fixed here (out of
-- scope for PR-C); recorded so nobody reasons from the overstated claim.
--
-- Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Notification enum value — the creator's payoff loop ("your chapter drove
--    an inquiry", emitted from app code on unlock of an attributed thread).
--    House pattern (20270815640306): ADD VALUE in its own committed transaction;
--    nothing in this file references the value.
-- ----------------------------------------------------------------------------
BEGIN;
ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'chapter_drove_inquiry';
COMMIT;

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. chat_threads — attribution + the inquiry-source taxonomy.
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS referring_chapter_id UUID
    REFERENCES public.creator_chapters(chapter_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inquiry_source TEXT
    CHECK (inquiry_source IN
      ('shortlist', 'first_pick', 'favorites', 'influencer', 'website',
       'editorial', 'auto_build', 'degree')),
  ADD COLUMN IF NOT EXISTS is_returning BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.chat_threads.referring_chapter_id IS
  'CTA-click attribution (Creator Economy PR-C, owner paper-lock 2026-07-16): the published chapter whose Book CTA started this thread. Stamped ONCE at thread creation (app-validated: chapter published + owner profile public + substrate credits this vendor); never overwritten on a resumed thread — no windows, no multi-touch. PRIVATE to the thread parties; public surfaces read only the aggregate "inquiries driven" count.';

COMMENT ON COLUMN public.chat_threads.inquiry_source IS
  'Owner''s inquiry-source taxonomy (2026-07-17 — "tell the vendor what type of customer sent an inquiry"). Stamped once at inquiry creation, CTA-click/last-touch. NULL = Website Inquiry (the default). Values: shortlist (couple''s vendor shortlist/saved-workspace) · first_pick (match/best-fit recommendation, e.g. the dashboard "Unlock more categories" best-fit) · favorites (saved-vendors list) · influencer (chapter Book CTA; referring_chapter_id NOT NULL) · website (explicit /v microsite stamp; equivalent to NULL) · editorial (arrived via a /realstories editorial credit chip) · auto_build (automated best-match fan-out, e.g. onboarding "reach my best matches") · degree (see below). PRIVATE to the vendor — never public. DEGREE (enum value only — UNWIRED in PR-C): "Degree Recommendation" = the vendor was surfaced because someone within 5 degrees of the inquirer''s connection tree has USED or FAVORITED the vendor; FRIENDS count as FIRST-DEGREE connections (the tree = the full People/connections graph, family + friends). Both signals are cross-person disclosures (a booking = transaction data; a favorite = preference data — see the standing guest_saved_vendors consent-gate finding), so the trigger surface stays People-layer + counsel-gated (NEXT_PUBLIC_DEPENDENT_PEOPLE). The surface must NEVER identify who used/favorited the vendor — copy says only "vendors used around your circle" (no names, no relationship labels, no degree number) — and wiring requires a minimum-circle/k-anonymity threshold (suppress the rec when the circle/signal count is small enough that the person is inferable). No stamping until that surface ships.';

COMMENT ON COLUMN public.chat_threads.is_returning IS
  'Companion flag to inquiry_source (never overwrites the origin): TRUE when, at inquiry creation, the inquiring couple had a prior unlocked connection with THIS vendor on a different event — the same returning=1-token signal the token bands used (vendor_event_unlocks on another event of the same couple member; see get_returning_client_flags, 20261201000000). Vendor-private "Returning Customer" chip.';

-- Attributed threads are the rare case — partial index for the per-chapter and
-- per-creator "inquiries driven" aggregations.
CREATE INDEX IF NOT EXISTS chat_threads_referring_chapter_idx
  ON public.chat_threads (referring_chapter_id)
  WHERE referring_chapter_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Offer fulfillment stamp + creator solicitation opt-out.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_creator_offers
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_creator_offers.fulfilled_at IS
  'When the creator linked the crediting PUBLISHED chapter as the deliverable (Creator Economy PR-C). fulfilled = accepted + deliverable_chapter_id linked. A state + the discount↔chapter link ONLY — there is NO clawback machinery (owner paper-lock 2026-07-16): an unfulfilled collab is visible to the vendor, who simply doesn''t offer again (plus the report route).';

-- Creator "accept vendor offers" toggle (RA-10173 must-plan: an unsolicited
-- offers inbox is the fastest way to make a user feel farmed). Default ON;
-- enforced server-side in offer_creator_reach_hold + hidden from browse in app
-- code. The one schema addition beyond the PR-C plan's item-1 list — the
-- enforcement the plan requires needs storage, and none existed (verified
-- 2026-07-17: no accepts_offers/opt-out column anywhere).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS creator_accepts_offers BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.users.creator_accepts_offers IS
  'Creator solicitation opt-out (Creator Economy PR-C). FALSE = this creator does not receive vendor discount offers: offer_creator_reach_hold raises CREATOR_OFFERS_OFF and the vendor Creators browse hides them. Default TRUE (toggle on the creator dashboard).';

-- ----------------------------------------------------------------------------
-- 3a. unlock_vendor_event — VERBATIM live body (20270818135217 founder_seats)
--     + the influencer-spend tag: when the unlocked (vendor,event) pair has an
--     ATTRIBUTED thread, stamp spend_source='lead_unlock' on the ledger row this
--     debit just wrote, in the SAME transaction (capture-or-lose, same rule as
--     the 'creator_offer' tag in 20270819350491). Comped/zero-token unlocks
--     write no ledger row — nothing to tag.
-- ----------------------------------------------------------------------------
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
  -- (a) Answering member gate: founder + co-admins + assigned agents may answer
  -- and burn; viewers / non-members are blocked.
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
    -- Region → burn_band single source (regions, alias-resolved). Unchanged.
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

  IF v_paid AND v_tokens > 0 THEN
    -- (b) Debit the ANSWERING member's own balance. Founder draws from the
    -- store wallet (earned vouchers FIFO → purchased); any other member draws
    -- from their personal purchased balance. Founder-seat comps never reach
    -- here (v_tokens = 0).
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

    -- Influencer-spend tag (Creator Economy PR-C — owner req #4, stamp at spend
    -- time): an unlock of a chapter-ATTRIBUTED thread is influencer-driven lead
    -- spend. Stamp the ledger row(s) this debit just wrote — same transaction,
    -- keyed by (vendor, INQUIRY_UNLOCK, this event, untagged), which is unique
    -- per unlock because the unlock itself is idempotent per (vendor, event).
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

-- ----------------------------------------------------------------------------
-- 3b. consume_lead_token_hold — VERBATIM live body (20270726988829, search_path
--     pinned per 20270730363797) + the SAME attributed-thread lead_unlock stamp.
--     This is where the hold path's deferred ledger row is actually written, so
--     the tag lands at true spend time on that path too.
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

    -- Influencer-spend tag (Creator Economy PR-C) — see unlock_vendor_event.
    -- Same-transaction stamp of the row the debit above just wrote.
    IF EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.vendor_profile_id = v_h.vendor_profile_id
         AND t.event_id = v_h.event_id
         AND t.referring_chapter_id IS NOT NULL
    ) THEN
      UPDATE public.token_redemptions_log
         SET spend_source = 'lead_unlock'
       WHERE vendor_id = v_h.vendor_profile_id
         AND service_code = 'INQUIRY_UNLOCK'
         AND related_event_id = v_h.event_id
         AND spend_source IS NULL;
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.consume_lead_token_hold(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_lead_token_hold(UUID, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. offer_creator_reach_hold — VERBATIM escrow body (20270819350491) with two
--    additions:
--      (a) creator opt-out: creator_accepts_offers=FALSE → CREATOR_OFFERS_OFF
--          (server-side enforcement of the toggle; browse also hides them).
--      (b) PRO-AND-UP tighten (owner ratification decision #4, 2026-07-16):
--          the vendor Creators surface + reach spend require pro/enterprise/
--          custom — supersedes P1's tier != 'free' (TIER_FREE_NO_REACH becomes
--          TIER_BELOW_PRO_NO_REACH, raised for free/verified/solo too).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offer_creator_reach_hold(
  p_vendor_profile_id   UUID,
  p_creator_user_id     UUID,
  p_creator_rate_terms  TEXT,
  p_audience_rate_terms TEXT DEFAULT NULL,
  p_reach_tokens        INT DEFAULT 1,
  p_expires_at          TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days')
) RETURNS JSONB AS $$
DECLARE
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_is_founder BOOLEAN;
  v_tier       TEXT;
  v_tokens     INT := GREATEST(COALESCE(p_reach_tokens, 1), 1);
  v_avail      INT;
  v_held       INT;
  v_offer_id   UUID;
  v_terms      TEXT := NULLIF(btrim(COALESCE(p_creator_rate_terms, '')), '');
BEGIN
  -- Answering-member gate (identical shape to unlock_vendor_event_hold).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = p_vendor_profile_id
      AND tm.user_id = v_actor
      AND tm.role IN ('owner', 'admin', 'agent')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member of this vendor';
  END IF;

  IF v_terms IS NULL THEN
    RAISE EXCEPTION 'MISSING_TERMS: a creator-rate discount is required';
  END IF;

  SELECT user_id, tier_state INTO v_founder, v_tier
    FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_profile_id;
  v_is_founder := (v_actor = v_founder);

  -- PRO-AND-UP (owner-ratified 2026-07-16, Market Intel precedent). Supersedes
  -- the P1 free-only gate (TIER_FREE_NO_REACH).
  IF v_tier IS NULL OR v_tier NOT IN ('pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'TIER_BELOW_PRO_NO_REACH: creator offers are a Pro-and-up feature';
  END IF;

  -- Self-offer guard: a vendor founder can't offer to their own creator profile.
  IF p_creator_user_id = v_founder THEN
    RAISE EXCEPTION 'SELF_OFFER: you cannot send a discount offer to yourself';
  END IF;

  -- Eligibility: the target is a creator (>=1 PUBLISHED chapter) on a PUBLIC
  -- profile. Derived, user-native definition (no is_creator flag).
  IF NOT EXISTS (
    SELECT 1
      FROM public.creator_chapters c
      JOIN public.users u ON u.user_id = c.user_id
     WHERE c.user_id = p_creator_user_id
       AND c.status = 'published'
       AND u.public_profile_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'NOT_A_CREATOR: target has no published chapter on a public profile';
  END IF;

  -- Creator solicitation opt-out (PR-C; RA-10173 must-plan). The browse hides
  -- opted-out creators; this is the server-side floor beneath it.
  IF EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.user_id = p_creator_user_id
       AND u.creator_accepts_offers = FALSE
  ) THEN
    RAISE EXCEPTION 'CREATOR_OFFERS_OFF: this creator is not accepting vendor offers';
  END IF;

  -- One outstanding offer at a time (also enforced by the partial unique index).
  IF EXISTS (
    SELECT 1 FROM public.vendor_creator_offers
     WHERE vendor_id = p_vendor_profile_id
       AND creator_user_id = p_creator_user_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'OFFER_PENDING: you already have an outstanding offer to this creator';
  END IF;

  -- Reservation — B3 FIX: lock the wallet row FOR UPDATE so a concurrent send
  -- (or a concurrent lead accept) by the same holder serializes here, mirroring
  -- unlock_vendor_event_hold (20270727563372 FIX 1). B2 FIX: only outstanding
  -- LEAD holds are subtracted — pending creator offers are already DEBITED under
  -- escrow-at-send, so the balance itself reflects them.
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
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: need % reach tokens · available % · % already held',
      v_tokens, v_avail, v_held;
  END IF;

  -- Open the offer row first (its offer_id keys the debit's audit metadata).
  INSERT INTO public.vendor_creator_offers
    (vendor_id, creator_user_id, creator_rate_terms, audience_rate_terms,
     status, reach_tokens_held, holder_user_id, is_founder_draw, expires_at)
  VALUES
    (p_vendor_profile_id, p_creator_user_id, v_terms,
     NULLIF(btrim(COALESCE(p_audience_rate_terms, '')), ''),
     'pending', v_tokens, v_actor, v_is_founder, p_expires_at)
  RETURNING vendor_creator_offers.offer_id INTO v_offer_id;

  -- ESCROW: debit NOW via the same consume_* the burn path uses. Authoritative —
  -- any failure RAISES and rolls back the offer row above (B1 FIX: the debit can
  -- never be swallowed, and an offer can never exist unpaid). The availability
  -- check above makes this satisfiable; consume_* re-locks the same wallet row
  -- inside this transaction (a no-op re-lock, not a deadlock).
  IF v_is_founder THEN
    PERFORM public.consume_vendor_assets_per_voucher(
      p_vendor_profile_id, v_tokens, 'CREATOR_REACH', NULL,
      jsonb_build_object('offer_id', v_offer_id, 'via', 'creator_offer_send'));
  ELSE
    PERFORM public.consume_member_purchased_tokens(
      p_vendor_profile_id, v_actor, v_tokens, 'CREATOR_REACH', NULL,
      jsonb_build_object('offer_id', v_offer_id, 'via', 'creator_offer_send'));
  END IF;

  -- Influencer-spend tag — stamp the ledger row this debit just wrote, in the
  -- same transaction (offer_id is unique; one debit per offer).
  UPDATE public.token_redemptions_log
     SET spend_source = 'creator_offer'
   WHERE vendor_id = p_vendor_profile_id
     AND service_code = 'CREATOR_REACH'
     AND spend_source IS NULL
     AND metadata->>'offer_id' = v_offer_id::text;

  UPDATE public.vendor_creator_offers
     SET escrowed_at = now(),
         reach_token_ref = 'ESCROW:' || v_offer_id::text
   WHERE vendor_creator_offers.offer_id = v_offer_id;

  RETURN jsonb_build_object(
    'ok', true, 'escrowed', true, 'offer_id', v_offer_id,
    'tokens_charged', v_tokens, 'creator_user_id', p_creator_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.offer_creator_reach_hold(UUID, UUID, TEXT, TEXT, INT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_creator_reach_hold(UUID, UUID, TEXT, TEXT, INT, TIMESTAMPTZ) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5a. link_creator_offer_deliverable — VERBATIM P1 body (20270817214733) + the
--     fulfilled_at stamp: linking the crediting chapter IS fulfillment.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_creator_offer_deliverable(
  p_offer_id   UUID,
  p_chapter_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_actor   UUID := auth.uid();
  v_o       public.vendor_creator_offers;
  v_chapter UUID;
BEGIN
  SELECT * INTO v_o FROM public.vendor_creator_offers
    WHERE offer_id = p_offer_id FOR UPDATE;
  IF v_o.offer_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: offer does not exist';
  END IF;
  IF v_o.creator_user_id <> v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN: not the addressed creator';
  END IF;
  IF v_o.status <> 'accepted' THEN
    RAISE EXCEPTION 'NOT_ACCEPTED: only an accepted offer takes a deliverable';
  END IF;

  SELECT chapter_id INTO v_chapter FROM public.creator_chapters
   WHERE chapter_id = p_chapter_id AND user_id = v_actor AND status = 'published';
  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'BAD_CHAPTER: chapter must be yours and published';
  END IF;

  UPDATE public.vendor_creator_offers
     SET deliverable_chapter_id = v_chapter,
         fulfilled_at = COALESCE(fulfilled_at, now())
   WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object('ok', true, 'offer_id', p_offer_id, 'chapter_id', v_chapter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.link_creator_offer_deliverable(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_creator_offer_deliverable(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5b. respond_creator_offer — VERBATIM escrow body (20270819350491) + the
--     fulfilled_at stamp when the creator accepts WITH a valid deliverable in
--     the same step (otherwise fulfilled_at arrives via the link RPC above).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_creator_offer(
  p_offer_id               UUID,
  p_response               TEXT,
  p_deliverable_chapter_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_actor   UUID := auth.uid();
  v_o       public.vendor_creator_offers;
  v_chapter UUID := NULL;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'INVALID_RESPONSE: must be accepted or declined';
  END IF;

  SELECT * INTO v_o FROM public.vendor_creator_offers
    WHERE offer_id = p_offer_id FOR UPDATE;
  IF v_o.offer_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: offer does not exist';
  END IF;
  IF v_o.creator_user_id <> v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN: not the addressed creator';
  END IF;
  IF v_o.status <> 'pending' THEN
    -- Already resolved (incl. swept-expired) — idempotent no-op.
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_o.status);
  END IF;

  -- A stale response cannot resolve the offer: past the window the vendor's
  -- escrow is owed back (the sweep refunds it). Walkthrough (d).
  IF v_o.expires_at < now() THEN
    RAISE EXCEPTION 'OFFER_EXPIRED: this offer expired on % — it can no longer be accepted or declined',
      v_o.expires_at;
  END IF;

  -- Deliverable linkage (accept only): a PUBLISHED chapter the creator owns.
  IF p_response = 'accepted' AND p_deliverable_chapter_id IS NOT NULL THEN
    SELECT chapter_id INTO v_chapter FROM public.creator_chapters
     WHERE chapter_id = p_deliverable_chapter_id
       AND user_id = v_actor
       AND status = 'published';
    -- A bad/foreign/draft chapter id just leaves the linkage NULL (P1: simple).
  END IF;

  -- Defensive legacy-settle: a pending row WITHOUT escrow can only be a send
  -- from the OLD RPC racing this deploy (the § 6 backfill converted everything
  -- else). Debit it now — raise-and-rollback, NEVER swallowed: if the vendor's
  -- balance can't cover it, the response fails rather than resolving unpaid.
  IF v_o.escrowed_at IS NULL AND v_o.reach_tokens_held > 0 THEN
    IF v_o.is_founder_draw THEN
      PERFORM public.consume_vendor_assets_per_voucher(
        v_o.vendor_id, v_o.reach_tokens_held, 'CREATOR_REACH', NULL,
        jsonb_build_object('offer_id', v_o.offer_id, 'response', p_response, 'via', 'creator_offer_respond_legacy_settle'));
    ELSE
      PERFORM public.consume_member_purchased_tokens(
        v_o.vendor_id, v_o.holder_user_id, v_o.reach_tokens_held, 'CREATOR_REACH', NULL,
        jsonb_build_object('offer_id', v_o.offer_id, 'response', p_response, 'via', 'creator_offer_respond_legacy_settle'));
    END IF;
    UPDATE public.token_redemptions_log
       SET spend_source = 'creator_offer'
     WHERE vendor_id = v_o.vendor_id
       AND service_code = 'CREATOR_REACH'
       AND spend_source IS NULL
       AND metadata->>'offer_id' = v_o.offer_id::text;
    UPDATE public.vendor_creator_offers
       SET escrowed_at = now()
     WHERE offer_id = p_offer_id;
  END IF;

  -- SETTLE: both accept and decline resolve the already-spent escrow (owner
  -- lock: the vendor paid to initiate contact — a "no" still costs the token).
  -- PR-C: accepting WITH a valid crediting chapter is immediate fulfillment.
  UPDATE public.vendor_creator_offers
     SET status = p_response,
         responded_at = now(),
         deliverable_chapter_id = COALESCE(v_chapter, deliverable_chapter_id),
         fulfilled_at = CASE
           WHEN p_response = 'accepted' AND v_chapter IS NOT NULL
           THEN COALESCE(fulfilled_at, now()) ELSE fulfilled_at END
   WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object(
    'ok', true, 'status', p_response, 'vendor_id', v_o.vendor_id,
    'tokens_settled', v_o.reach_tokens_held);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.respond_creator_offer(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_creator_offer(UUID, TEXT, UUID) TO authenticated;

COMMIT;
