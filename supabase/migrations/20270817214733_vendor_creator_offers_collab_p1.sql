-- ============================================================================
-- 20270817214733_vendor_creator_offers_collab_p1.sql
-- Creator Economy — vendor↔creator DISCOUNT COLLAB loop (P1).
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md  (P1)
--
-- The three-party money engine's FIRST rung: a vendor spends a REACH TOKEN to
-- send a discount OFFER to a creator (a user with >=1 published Adventure
-- Chapter on a public profile). The creator accepts/declines; the deliverable
-- is a published Chapter crediting the vendor. Setnayan holds NO money — the
-- discount settles off-platform; Setnayan only records the collab + gates the
-- outreach with a token.
--
-- REUSE, DON'T FORK (owner red line): the token spend is the EXISTING per-voucher
-- burn (`consume_vendor_assets_per_voucher` for a founder draw ·
-- `consume_member_purchased_tokens` for a member draw) fronted by the SAME
-- HOLD-AND-RELEASE shape as fake-inquiry protection (20270726988829): the send
-- RESERVES the token (offer.status='pending' == held); accept/decline CONSUMES it
-- (the vendor pays to initiate contact, reply-or-not, mirroring settle-on-view);
-- an unanswered offer past `expires_at` RELEASES it (no debit ever happened).
-- No new wallet, no new balance primitive, no new token type — the offer ROW is
-- its own hold ledger (as lead_token_holds is for inquiries), and the reservation
-- reads the SAME balance sources the burn draws from.
--
-- RLS (canonical patterns + 4 helpers ONLY — 02_Specifications/RLS_Policy_Pattern.md):
--   • vendor_creator_offers SELECT → vendor owns via current_vendor_ids('viewer')
--     OR the addressed creator (creator_user_id = auth.uid()) OR admin. No public
--     read (the offer graph + terms never leave the two parties). No INSERT/UPDATE
--     policy — every mutation goes through the SECURITY DEFINER RPCs below (mirrors
--     lead_token_holds / vendor_member_token_wallets).
--
-- Canonical-ID note: like lead_token_holds + user_follows, this is backend
-- plumbing surfaced only inside the two parties' dashboards, so it carries a
-- hidden bigserial PK + an opaque UUID app handle — no S89… public_id (the
-- generator is unchanged; red line "no entity-ID change" honored).
--
-- Cron-free: expiry release rides vendor traffic via an after() hook +
-- sweep_expired_creator_offers() (mirrors maybeSweepGhostedLeadHolds).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Notification enum values — the offer inbox + the vendor's status update.
--    House pattern (20270815640306): ADD VALUE only here; no INSERT references
--    the new value in this file, so it is committed before any runtime code
--    emits it.
-- ----------------------------------------------------------------------------
ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'creator_offer_received';
ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'creator_offer_responded';

COMMIT;

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_creator_offers — the discount inquiry/collab + its own token hold.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_creator_offers (
  id                    BIGSERIAL PRIMARY KEY,
  offer_id              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- The offering vendor. Ownership is via current_vendor_ids() (team-aware).
  vendor_id             UUID NOT NULL
                          REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,

  -- The addressed creator (a user with >=1 published chapter on a public profile).
  creator_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The two discount rates, as free-text terms (the vendor's cost, settled
  -- off-platform). creator_rate = the creator's OWN booking; audience_rate =
  -- the promo the creator's viewers get (optional). Setnayan records, never charges.
  creator_rate_terms    TEXT NOT NULL,
  audience_rate_terms   TEXT,

  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

  -- Hold bookkeeping (the offer row IS the hold ledger — no separate table).
  -- reach_tokens_held  = tokens RESERVED at send; still-outstanding while pending.
  -- holder_user_id     = the member who pays (founder → store wallet; else personal).
  -- is_founder_draw    = which wallet the CONSUME debits.
  -- reach_token_ref    = opaque handle for the reservation (audit / spec field).
  reach_tokens_held     INT NOT NULL DEFAULT 0 CHECK (reach_tokens_held >= 0),
  holder_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_founder_draw       BOOLEAN NOT NULL DEFAULT FALSE,
  reach_token_ref       TEXT,

  -- The deliverable: a published Chapter crediting the vendor. Linked on/after
  -- accept (simple linkage in P1). SET NULL if the chapter is later deleted.
  deliverable_chapter_id UUID REFERENCES public.creator_chapters(chapter_id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.vendor_creator_offers IS
  'Vendor→creator discount-offer collab (Creator Economy P1). The row is its OWN token hold ledger: status=pending == a reach token HELD (reserved via the existing per-voucher balance sources); accept/decline CONSUMES it (consume_vendor_assets_per_voucher / consume_member_purchased_tokens); expiry past expires_at RELEASES it (no debit). Written only by the SECURITY DEFINER RPCs. Setnayan records the collab + gates outreach with a token; the discount itself settles off-platform.';

-- One OUTSTANDING (pending) offer per (vendor, creator) at a time — a vendor
-- can't spray reach tokens at the same creator; a resolved (accepted/declined/
-- expired) offer doesn't block a fresh one.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_creator_offers_one_pending_idx
  ON public.vendor_creator_offers (vendor_id, creator_user_id)
  WHERE status = 'pending';

-- Vendor's sent-offers list (newest first) + the creator's inbox.
CREATE INDEX IF NOT EXISTS vendor_creator_offers_vendor_idx
  ON public.vendor_creator_offers (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_creator_offers_creator_idx
  ON public.vendor_creator_offers (creator_user_id, created_at DESC);
-- Accepted-partnership aggregate for the profile "influence" block.
CREATE INDEX IF NOT EXISTS vendor_creator_offers_accepted_idx
  ON public.vendor_creator_offers (creator_user_id)
  WHERE status = 'accepted';
-- Expiry sweep (still-held past window) + per-holder reservation sum.
CREATE INDEX IF NOT EXISTS vendor_creator_offers_expiry_idx
  ON public.vendor_creator_offers (status, expires_at);
CREATE INDEX IF NOT EXISTS vendor_creator_offers_holder_idx
  ON public.vendor_creator_offers (holder_user_id, status);

ALTER TABLE public.vendor_creator_offers ENABLE ROW LEVEL SECURITY;

-- SELECT — the offering vendor's team OR the addressed creator OR admin. No
-- public read: the offer terms + the offer graph never leave the two parties.
DROP POLICY IF EXISTS vendor_creator_offers_read ON public.vendor_creator_offers;
CREATE POLICY vendor_creator_offers_read
  ON public.vendor_creator_offers FOR SELECT TO authenticated
  USING (
    vendor_id IN (SELECT public.current_vendor_ids('viewer'))
    OR creator_user_id = auth.uid()
    OR public.is_admin()
  );

-- Admin override (read + write any row) for support/moderation — canonical.
DROP POLICY IF EXISTS vendor_creator_offers_admin_all ON public.vendor_creator_offers;
CREATE POLICY vendor_creator_offers_admin_all
  ON public.vendor_creator_offers FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No INSERT/UPDATE policy for the two parties: sends + responses go through the
-- SECURITY DEFINER RPCs below (they touch wallets, so RLS can't be the gate).

-- ----------------------------------------------------------------------------
-- 2. offer_creator_reach_hold — the vendor spends a REACH TOKEN to send an offer.
--    Mirrors unlock_vendor_event_hold's gates + reservation, then HOLDS the token
--    by opening the offer row (status='pending'). No debit yet.
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

  -- Reservation — available (SAME sources the burn draws from) MINUS this actor's
  -- outstanding holds (BOTH lead holds AND creator-offer holds) must cover it.
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

  SELECT
    COALESCE((SELECT SUM(tokens) FROM public.lead_token_holds
               WHERE vendor_profile_id = p_vendor_profile_id
                 AND holder_user_id = v_actor AND status = 'held'), 0)
    +
    COALESCE((SELECT SUM(reach_tokens_held) FROM public.vendor_creator_offers
               WHERE vendor_id = p_vendor_profile_id
                 AND holder_user_id = v_actor AND status = 'pending'), 0)
    INTO v_held;

  IF (v_avail - v_held) < v_tokens THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: need % reach tokens · available % · % already held',
      v_tokens, v_avail, v_held;
  END IF;

  -- Open the offer (HOLD — no debit). reach_token_ref is a stable opaque handle.
  INSERT INTO public.vendor_creator_offers
    (vendor_id, creator_user_id, creator_rate_terms, audience_rate_terms,
     status, reach_tokens_held, holder_user_id, is_founder_draw, expires_at)
  VALUES
    (p_vendor_profile_id, p_creator_user_id, v_terms,
     NULLIF(btrim(COALESCE(p_audience_rate_terms, '')), ''),
     'pending', v_tokens, v_actor, v_is_founder, p_expires_at)
  RETURNING offer_id INTO v_offer_id;

  UPDATE public.vendor_creator_offers
     SET reach_token_ref = 'HOLD:' || v_offer_id::text
   WHERE offer_id = v_offer_id;

  RETURN jsonb_build_object(
    'ok', true, 'held', true, 'offer_id', v_offer_id, 'tokens', v_tokens,
    'creator_user_id', p_creator_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.offer_creator_reach_hold(UUID, UUID, TEXT, TEXT, INT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_creator_reach_hold(UUID, UUID, TEXT, TEXT, INT, TIMESTAMPTZ) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. respond_creator_offer — the creator accepts/declines. Both CONSUME the held
--    token (the vendor paid to initiate contact — reply-or-not, mirroring
--    settle-on-view); only expiry (never a response) refunds. Debits via the SAME
--    consume_* the burn would have used. Gated to the addressed creator.
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
    -- Already resolved — idempotent no-op.
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_o.status);
  END IF;

  -- Deliverable linkage (accept only): a PUBLISHED chapter the creator owns.
  IF p_response = 'accepted' AND p_deliverable_chapter_id IS NOT NULL THEN
    SELECT chapter_id INTO v_chapter FROM public.creator_chapters
     WHERE chapter_id = p_deliverable_chapter_id
       AND user_id = v_actor
       AND status = 'published';
    -- A bad/foreign/draft chapter id just leaves the linkage NULL (P1: simple).
  END IF;

  -- CONSUME the held reach token (both accept and decline — the vendor paid to
  -- reach out). Free-tier holds are 0 tokens and no-op the debit. BEST-EFFORT:
  -- the reservation is SOFT (same as lead_token_holds — available = balance −
  -- held is only checked when placing new holds), so if the vendor overspent
  -- their balance elsewhere between send and response, the debit may raise
  -- INSUFFICIENT_WALLET_BALANCES. We swallow that so the creator's accept/decline
  -- NEVER fails on the vendor's overspend — the outreach already happened.
  IF v_o.reach_tokens_held > 0 THEN
    BEGIN
      IF v_o.is_founder_draw THEN
        PERFORM public.consume_vendor_assets_per_voucher(
          v_o.vendor_id, v_o.reach_tokens_held, 'CREATOR_REACH', NULL,
          jsonb_build_object('offer_id', v_o.offer_id, 'response', p_response, 'via', 'creator_offer_respond'));
      ELSE
        PERFORM public.consume_member_purchased_tokens(
          v_o.vendor_id, v_o.holder_user_id, v_o.reach_tokens_held, 'CREATOR_REACH', NULL,
          jsonb_build_object('offer_id', v_o.offer_id, 'response', p_response, 'via', 'creator_offer_respond'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'creator-offer consume skipped for offer % (%): %', v_o.offer_id, SQLERRM, SQLSTATE;
    END;
  END IF;

  UPDATE public.vendor_creator_offers
     SET status = p_response,
         responded_at = now(),
         deliverable_chapter_id = COALESCE(v_chapter, deliverable_chapter_id)
   WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object('ok', true, 'status', p_response, 'vendor_id', v_o.vendor_id,
    'tokens_consumed', v_o.reach_tokens_held);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.respond_creator_offer(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_creator_offer(UUID, TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. link_creator_offer_deliverable — attach a published Chapter to an ACCEPTED
--    offer after the fact (the creator may publish the crediting chapter later).
--    Gated to the addressed creator; the chapter must be theirs + published.
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
     SET deliverable_chapter_id = v_chapter
   WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object('ok', true, 'offer_id', p_offer_id, 'chapter_id', v_chapter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.link_creator_offer_deliverable(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_creator_offer_deliverable(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. sweep_expired_creator_offers — batch-RELEASE every offer still 'pending'
--    past its window. An offer flips to accepted/declined the instant the creator
--    responds, so anything still 'pending' past expires_at = no response = a
--    refund (drop it from the held sum — no debit ever happened). Called by the
--    cron-free after() hook. Returns the released set for notify.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_creator_offers()
RETURNS TABLE (offer_id UUID, vendor_id UUID, holder_user_id UUID, tokens INT) AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE public.vendor_creator_offers o
       SET status = 'expired', responded_at = now()
     WHERE o.status = 'pending'
       AND o.expires_at < now()
    RETURNING o.offer_id, o.vendor_id, o.holder_user_id, o.reach_tokens_held
  )
  SELECT e.offer_id, e.vendor_id, e.holder_user_id, e.reach_tokens_held FROM expired e;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.sweep_expired_creator_offers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_expired_creator_offers() TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Durable watermark for the cron-free daily claim (mirrors
--    lead_hold_sweep_last_run_at) — one row on the platform_settings singleton.
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS creator_offer_sweep_last_run_at TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.creator_offer_sweep_last_run_at IS
  'Deploy-surviving watermark for the cron-free expired-creator-offer sweep. Compare-and-swapped from vendor-dashboard after() traffic (lib/creator-offers maybeSweepExpiredCreatorOffers) so the release RPC runs ~once/day across the lambda fleet.';

COMMIT;
