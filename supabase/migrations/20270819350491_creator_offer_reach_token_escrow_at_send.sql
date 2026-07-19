-- ============================================================================
-- 20270819350491_creator_offer_reach_token_escrow_at_send.sql
-- Creator Economy P1 — reach-token integrity fix: ESCROW AT SEND.
--
-- Closes the CONFIRMED revenue leak + two reservation-integrity flaws from the
-- readiness council (Creator_Economy_Readiness_Council_Verdict_2026-07-16.md
-- § 3 B1–B3), superseding the RPCs in 20270817214733 (never mutate a merged
-- migration — CREATE OR REPLACE in a newer file wins). Council-preferred,
-- owner-ratified design: the send DEBITS ("hard-reserve / escrow-decrement")
-- instead of soft-holding, so the consume is always satisfiable and can never
-- be swallowed.
--
--   B1 (the leak) — respond_creator_offer wrapped the token debit in
--     `EXCEPTION WHEN OTHERS THEN RAISE NOTICE` and still flipped the offer
--     accepted/declined, then reported `tokens_consumed` as charged. Any
--     consume failure (chiefly INSUFFICIENT_WALLET_BALANCES) = free accepted
--     collab + a lying return value. FIX: the debit moves to the SEND
--     (offer_creator_reach_hold) where it is authoritative — raise-and-rollback,
--     never swallowed. respond no longer consumes anything: accept AND decline
--     just SETTLE the already-spent token (owner lock: "token settles on
--     reply" — a creator saying no still costs the vendor the outreach).
--   B2 (cross-ledger double-reserve) — the reach-hold ledger (pending offer
--     rows) and lead_token_holds were mutually blind: unlock_vendor_event_hold
--     (20270726988829 → 20270727563372 → 20270818135217) subtracts only lead
--     holds, so the same token could back a reach hold AND a lead hold.
--     FIX (structural, post-escrow): a pending offer's tokens have already
--     LEFT the wallet balance, so every other spend path — unlock_vendor_event,
--     unlock_vendor_event_hold, consume_lead_token_hold, and a second
--     offer_creator_reach_hold — sees the reduced balance with no cross-ledger
--     subtraction needed. offer_creator_reach_hold correspondingly stops
--     counting pending offers as "held" (they are debited, not reserved) while
--     STILL subtracting outstanding lead holds (those remain soft reservations).
--     unlock_vendor_event_hold needs NO change — its balance − lead-holds math
--     is now correct by construction. Verified against the latest definition
--     (20270818135217 founder_seats), which is left untouched.
--   B3 (missing wallet-row lock) — offer_creator_reach_hold read the wallet
--     with no FOR UPDATE; two concurrent sends could both pass the availability
--     check and over-reserve (then over-consume via B1). FIX: the reservation
--     read now locks the wallet row FOR UPDATE, mirroring the hardened lead
--     path (20270727563372 FIX 1). consume_* re-locks the same row inside the
--     same transaction, which is a no-op.
--   Also fixed: respond_creator_offer never checked expires_at — a creator
--     could accept/decline a stale offer after the vendor's window. Responding
--     past expires_at now raises OFFER_EXPIRED; the sweep settles the row.
--
-- REFUND ON EXPIRY — sweep_expired_creator_offers now REFUNDS the escrow when
-- a pending offer ages out (no response = the outreach never landed). Mirrors
-- the house refund precedent (refund_displaced_inquiry_unlock, 20270723145233):
-- credit back as PURCHASED (non-expiring) tokens to whoever paid — founder draw
-- → the store wallet (vendor_wallets), member draw → their personal wallet
-- (vendor_member_token_wallets; store wallet if the holder account is gone) —
-- with `refunded_at` on the offer row as the exactly-once guard and the ledger
-- of its own reversal. PER-VOUCHER RESTORE IS IMPRACTICAL BY DESIGN (same call
-- as 20270723145233): the FIFO burn may have spanned several earned vouchers
-- whose tokens_remaining have since moved; a purchased-token credit is
-- value-equivalent (neither pool expires — 20270406637718) and vendor-favorable.
--
-- INFLUENCER-SPEND TAG (owner requirement — stamp at spend time; unrecoverable
-- later): token consumption is recorded in token_redemptions_log (written by
-- consume_vendor_assets_per_voucher / consume_member_purchased_tokens). This
-- migration adds a `spend_source` column to that EXISTING ledger (smallest
-- honest mechanism — no new registry table; RLS already vendor-own-read +
-- admin) and tags every reach-token debit `spend_source = 'creator_offer'` in
-- the SAME transaction as the debit (the send RPC stamps the row it just wrote
-- via the unique metadata.offer_id). Historical CREATOR_REACH rows are
-- backfilled. PR-C adds 'lead_unlock'.
--
-- LEGACY PENDING OFFERS (one-time backfill, § 6): rows created under the old
-- held-not-debited semantics are converted to escrow — their tokens are debited
-- now. If a vendor's balance can no longer cover an old hold (they overspent
-- elsewhere — exactly the B1 leak window), the offer is EXPIRED instead (the
-- honest resolution: under old code that accept would have been a free reach).
-- After the backfill the invariant is total: status='pending' ⇒ escrowed.
-- respond keeps a defensive settle branch for a row created by the OLD send
-- racing this deploy: it debits raise-and-rollback style — never swallowed.
--
-- WALKTHROUGHS (the four required proofs)
--   (a) Wallet drains / voucher moves mid-window → accept just settles, no
--       leak. The send debited the token at escrow time; wallet events between
--       send and response are irrelevant. respond_creator_offer touches no
--       wallet — it flips status and reports tokens_settled = what was ACTUALLY
--       debited at send. No consume at respond ⇒ nothing to fail ⇒ nothing to
--       swallow.
--   (b) Concurrent sends with 1 token → second REFUSED at reserve. Both sends
--       hit the same wallet row; FOR UPDATE serializes them. The first debits
--       the token (balance 1 → 0) and commits; the second then reads balance 0
--       (post-lock), fails the availability check, and raises
--       INSUFFICIENT_WALLET_BALANCES — its offer row rolls back with it.
--   (c) Expiry → exactly-once refund. The sweep selects pending rows past
--       expires_at FOR UPDATE SKIP LOCKED, flips each to 'expired' and stamps
--       refunded_at under that same row lock, then credits the wallet in the
--       same transaction. A racing sweep (or a racing respond) blocks on /
--       skips the row lock and then sees status <> 'pending' → no second flip,
--       no second credit. refunded_at additionally guards any manual replay.
--   (d) Respond after expiry → OFFER_EXPIRED. respond_creator_offer loads the
--       row FOR UPDATE and raises OFFER_EXPIRED when expires_at < now() while
--       still pending; if the sweep already flipped it, the status<>'pending'
--       idempotent no-op path reports {already:true, status:'expired'}. Either
--       way a stale response cannot resolve the offer and the refund stands.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Escrow bookkeeping on the offer row + the influencer-spend tag on the
--    token ledger.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_creator_offers
  ADD COLUMN IF NOT EXISTS escrowed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_creator_offers.escrowed_at IS
  'When the reach tokens were actually DEBITED (escrow-at-send, migration 20270819350491). Invariant post-backfill: status=pending ⇒ escrowed_at IS NOT NULL. NULL on legacy resolved rows whose debit (if any) happened at respond time under the old semantics.';
COMMENT ON COLUMN public.vendor_creator_offers.refunded_at IS
  'When the expiry sweep credited the escrowed tokens back (as purchased/non-expiring) to the payer wallet. Exactly-once guard + the ledger of the reversal, mirroring vendor_event_unlocks.refunded_at (20270723145233).';

COMMENT ON TABLE public.vendor_creator_offers IS
  'Vendor→creator discount-offer collab (Creator Economy P1). ESCROW AT SEND (20270819350491): status=pending == the reach token was already DEBITED via the existing per-voucher burn (consume_vendor_assets_per_voucher / consume_member_purchased_tokens) at offer-send; accept AND decline merely SETTLE the spent token (the vendor paid to initiate contact); expiry past expires_at REFUNDS it as purchased tokens. Written only by the SECURITY DEFINER RPCs. Setnayan records the collab + gates outreach with a token; the discount itself settles off-platform.';

-- The influencer-spend tag lives on the EXISTING burn ledger — no new registry.
ALTER TABLE public.token_redemptions_log
  ADD COLUMN IF NOT EXISTS spend_source TEXT;

COMMENT ON COLUMN public.token_redemptions_log.spend_source IS
  'Owner-required spend-time tag (unrecoverable later). ''creator_offer'' = an influencer/creator-economy reach-token debit (offer_id in metadata); PR-C adds ''lead_unlock''. NULL = untagged legacy/other spend. Stamped in the same transaction as the debit.';

CREATE INDEX IF NOT EXISTS token_redemptions_log_spend_source_idx
  ON public.token_redemptions_log (spend_source, redeemed_at DESC)
  WHERE spend_source IS NOT NULL;

-- Backfill: every historical creator-reach debit is influencer spend.
UPDATE public.token_redemptions_log
   SET spend_source = 'creator_offer'
 WHERE service_code = 'CREATOR_REACH'
   AND spend_source IS NULL;

-- ----------------------------------------------------------------------------
-- 2. offer_creator_reach_hold — the send now ESCROWS (debits) the reach token.
--    B3: wallet row locked FOR UPDATE. B2: pending offers no longer counted as
--    "held" (they are debited); outstanding LEAD holds are still subtracted
--    (those remain soft reservations against the same balance).
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

  -- Free vendors can't spend tokens (mirrors the inquiry-unlock tier gate).
  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_REACH: free vendors cannot spend reach tokens';
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
-- 3. respond_creator_offer — accept/decline SETTLE the already-escrowed token.
--    No consume, no swallowed exception (B1 FIX). Expiry is now checked
--    (OFFER_EXPIRED). Return value is honest: tokens_settled = what was
--    actually debited at send.
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
  UPDATE public.vendor_creator_offers
     SET status = p_response,
         responded_at = now(),
         deliverable_chapter_id = COALESCE(v_chapter, deliverable_chapter_id)
   WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object(
    'ok', true, 'status', p_response, 'vendor_id', v_o.vendor_id,
    'tokens_settled', v_o.reach_tokens_held);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.respond_creator_offer(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_creator_offer(UUID, TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. sweep_expired_creator_offers — pending past the window → 'expired' AND the
--    escrow is REFUNDED (credited back as purchased/non-expiring tokens to the
--    payer wallet). Exactly-once via the row lock + status re-check +
--    refunded_at stamp. Same signature/return shape as before.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_creator_offers()
RETURNS TABLE (offer_id UUID, vendor_id UUID, holder_user_id UUID, tokens INT) AS $$
DECLARE
  v_o       public.vendor_creator_offers;
  v_founder UUID;
BEGIN
  FOR v_o IN
    SELECT * FROM public.vendor_creator_offers o
     WHERE o.status = 'pending'
       AND o.expires_at < now()
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Flip + stamp under the row lock we already hold. The WHERE
    -- status='pending' re-check is belt-and-braces; the lock guarantees it.
    UPDATE public.vendor_creator_offers o
       SET status = 'expired',
           responded_at = now(),
           refunded_at = CASE
             WHEN o.escrowed_at IS NOT NULL
              AND o.reach_tokens_held > 0
              AND o.refunded_at IS NULL
             THEN now() ELSE o.refunded_at END
     WHERE o.id = v_o.id
       AND o.status = 'pending';

    -- REFUND the escrow (walkthrough (c)): only if tokens were actually debited
    -- at send (escrowed) and never refunded. Credited back as PURCHASED
    -- (non-expiring) — per-voucher restore is impractical (the FIFO burn spanned
    -- vouchers whose balances have since moved; see header + 20270723145233).
    IF v_o.escrowed_at IS NOT NULL
       AND v_o.reach_tokens_held > 0
       AND v_o.refunded_at IS NULL THEN
      SELECT vp.user_id INTO v_founder
        FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = v_o.vendor_id;

      IF v_o.is_founder_draw
         OR v_o.holder_user_id IS NULL
         OR v_o.holder_user_id = v_founder THEN
        INSERT INTO public.vendor_wallets AS vw (vendor_id, purchased_tokens, earned_tokens)
        VALUES (v_o.vendor_id, v_o.reach_tokens_held, 0)
        ON CONFLICT (vendor_id) DO UPDATE
          SET purchased_tokens = vw.purchased_tokens + EXCLUDED.purchased_tokens,
              updated_at = now();
      ELSE
        INSERT INTO public.vendor_member_token_wallets AS vm (vendor_id, user_id, purchased_tokens)
        VALUES (v_o.vendor_id, v_o.holder_user_id, v_o.reach_tokens_held)
        ON CONFLICT (vendor_id, user_id) DO UPDATE
          SET purchased_tokens = vm.purchased_tokens + EXCLUDED.purchased_tokens,
              updated_at = now();
      END IF;
    END IF;

    offer_id       := v_o.offer_id;
    vendor_id      := v_o.vendor_id;
    holder_user_id := v_o.holder_user_id;
    tokens         := v_o.reach_tokens_held;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.sweep_expired_creator_offers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_expired_creator_offers() TO service_role;

-- ----------------------------------------------------------------------------
-- 5. (B2 closure record — no DDL.) unlock_vendor_event_hold (latest definition:
--    20270818135217) subtracts only lead_token_holds from the balance; that is
--    now CORRECT because pending creator offers are debited, not reserved —
--    the balance the lead path reads already excludes them. Symmetrically, § 2
--    above stopped subtracting pending offers. No spend path is blind to
--    another: every reservation is either a debit (creator offers) or a lead
--    hold (subtracted by both reserving paths).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 6. One-time backfill — convert legacy held-not-debited PENDING offers to
--    escrow. Debit each now; a vendor whose balance can no longer cover the old
--    soft hold gets the offer EXPIRED instead (nothing was ever debited, so
--    there is nothing to refund — and under the old code that accept would have
--    been the B1 free-reach leak). Idempotent: only rows with escrowed_at IS
--    NULL are touched; a re-run finds none.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.vendor_creator_offers
     WHERE status = 'pending'
       AND escrowed_at IS NULL
     FOR UPDATE
  LOOP
    IF r.reach_tokens_held <= 0 THEN
      UPDATE public.vendor_creator_offers
         SET escrowed_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;

    BEGIN
      IF r.is_founder_draw THEN
        PERFORM public.consume_vendor_assets_per_voucher(
          r.vendor_id, r.reach_tokens_held, 'CREATOR_REACH', NULL,
          jsonb_build_object('offer_id', r.offer_id, 'via', 'creator_offer_escrow_backfill'));
      ELSE
        PERFORM public.consume_member_purchased_tokens(
          r.vendor_id, r.holder_user_id, r.reach_tokens_held, 'CREATOR_REACH', NULL,
          jsonb_build_object('offer_id', r.offer_id, 'via', 'creator_offer_escrow_backfill'));
      END IF;

      UPDATE public.token_redemptions_log
         SET spend_source = 'creator_offer'
       WHERE vendor_id = r.vendor_id
         AND service_code = 'CREATOR_REACH'
         AND spend_source IS NULL
         AND metadata->>'offer_id' = r.offer_id::text;

      UPDATE public.vendor_creator_offers
         SET escrowed_at = now(),
             reach_token_ref = 'ESCROW:' || r.offer_id::text
       WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      -- Balance can't cover the legacy soft hold → void the outreach. This is
      -- a one-time conversion rule, NOT the B1 swallow: no state resolves as
      -- paid here — the offer is cancelled and no debit ever lands.
      UPDATE public.vendor_creator_offers
         SET status = 'expired', responded_at = now()
       WHERE id = r.id;
      RAISE NOTICE 'creator-offer escrow backfill: offer % voided (balance no longer covers the legacy hold): %',
        r.offer_id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
