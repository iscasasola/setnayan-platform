-- Sending a creator a discount offer is FREE. It used to cost a reach token.
--
-- Owner, 2026-08-07: "tokens are already retired." The currency was removed in
-- #4220 / #4222; this removes the last thing that still SPENT one.
--
-- WHY THIS IS A BUG, NOT JUST TIDYING
--   `offer_creator_reach_hold` debited a reach token at send. With token packs
--   retired there is no way to acquire one, so the first Pro vendor to press
--   "send offer" would have been told:
--       "Not enough reach tokens available. Top up your tokens and try again."
--   — pointed at a shop that no longer exists. Nobody hit it, because the
--   feature is unreachable today (prod: 0 vendors at Pro or above, 0 offers,
--   0 creator chapters); it would have broken for whoever upgraded first.
--
-- WHAT CHANGES: only the money. EVERY gate is preserved byte-for-byte —
--   answering-member check · creator-rate terms required · PRO-AND-UP tier gate
--   · self-offer guard · published-chapter-on-public-profile eligibility ·
--   creator solicitation opt-out (RA 10173) · one-outstanding-offer-per-pair.
-- Removed: the wallet availability check, the FOR UPDATE reservation, the
-- consume_* debit, and the token_redemptions_log spend tagging.
--
-- 🔑 THE TWO SIBLING FUNCTIONS NEED NO CHANGE — VERIFIED, NOT ASSUMED.
--   `sweep_expired_creator_offers` refunds only when
--       escrowed_at IS NOT NULL AND reach_tokens_held > 0
--   and `respond_creator_offer`'s legacy-settle fires only when
--       escrowed_at IS NULL AND reach_tokens_held > 0.
--   This function now leaves escrowed_at NULL and writes reach_tokens_held = 0,
--   so BOTH guards are false and both paths skip. Nothing refunds nothing, and
--   nothing settles a debt that was never taken. Had either been guarded on
--   `escrowed_at IS NULL` alone, this migration would have silently started
--   charging on accept instead.
--
-- `reach_tokens_held` and `escrowed_at` are KEPT on the table: they are the only
-- record of what past offers cost, and prod has zero rows to migrate.
--
-- Signature is unchanged (p_reach_tokens is retained and ignored) — PostgREST
-- resolves an RPC by its exact set of NAMED arguments, and the app still names
-- the first four. Changing the argument list would fail every call, silently.
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.offer_creator_reach_hold(
  p_vendor_profile_id uuid,
  p_creator_user_id uuid,
  p_creator_rate_terms text,
  p_audience_rate_terms text DEFAULT NULL::text,
  p_reach_tokens integer DEFAULT 1,
  p_expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_is_founder BOOLEAN;
  v_tier       TEXT;
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

  -- PRO-AND-UP (owner-ratified 2026-07-16, Market Intel precedent). KEPT: the
  -- send is free, but it is still a paid-tier capability.
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

  -- Creator solicitation opt-out (RA-10173 must-plan). The browse hides
  -- opted-out creators; this is the server-side floor beneath it.
  IF EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.user_id = p_creator_user_id
       AND u.creator_accepts_offers = FALSE
  ) THEN
    RAISE EXCEPTION 'CREATOR_OFFERS_OFF: this creator is not accepting vendor offers';
  END IF;

  -- One outstanding offer at a time (also enforced by the partial unique index).
  -- ⚠ THIS IS NOW THE ONLY THING RATIONING SENDS. The token cost used to be the
  -- economic brake; with the send free, this guard and the Pro-and-up gate are
  -- what stop a vendor blanketing every creator. Do not relax either.
  IF EXISTS (
    SELECT 1 FROM public.vendor_creator_offers
     WHERE vendor_id = p_vendor_profile_id
       AND creator_user_id = p_creator_user_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'OFFER_PENDING: you already have an outstanding offer to this creator';
  END IF;

  -- Open the offer. reach_tokens_held = 0 and escrowed_at stays NULL: nothing
  -- was charged, so the sweep must not refund and respond must not settle.
  INSERT INTO public.vendor_creator_offers
    (vendor_id, creator_user_id, creator_rate_terms, audience_rate_terms,
     status, reach_tokens_held, holder_user_id, is_founder_draw, expires_at)
  VALUES
    (p_vendor_profile_id, p_creator_user_id, v_terms,
     NULLIF(btrim(COALESCE(p_audience_rate_terms, '')), ''),
     'pending', 0, v_actor, v_is_founder, p_expires_at)
  RETURNING vendor_creator_offers.offer_id INTO v_offer_id;

  RETURN jsonb_build_object(
    'ok', true, 'escrowed', false, 'offer_id', v_offer_id,
    'tokens_charged', 0, 'creator_user_id', p_creator_user_id);
END;
$function$;

COMMENT ON FUNCTION public.offer_creator_reach_hold(uuid, uuid, text, text, integer, timestamptz) IS
  'Send a vendor->creator discount offer. FREE since 2026-08-07 (token retirement) - all eligibility, tier, opt-out and one-outstanding gates kept; only the reach-token debit was removed. Writes reach_tokens_held=0 and leaves escrowed_at NULL so the expiry sweep and respond-settle both skip.';
