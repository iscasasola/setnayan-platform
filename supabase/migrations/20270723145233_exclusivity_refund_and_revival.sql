-- ============================================================================
-- Exclusivity fairness — token REFUND on displacement + inquiry REVIVAL on
-- un-lock. Companion substrate for the two server-side features added to
-- finalizeVendor (exclusivity block) + revertVendorToConsidering. Both features
-- ship behind NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED (isPaymentGatedLockEnabled)
-- exactly like the exclusivity block they extend — this migration is inert until
-- that flag flips.
--
-- WHY (the two fairness gaps in the shipped exclusivity flow #3091):
--   1. When a couple LOCKS a hard-single pick, the OTHER inquired vendors' open
--      threads are displaced. A vendor whose thread was 'accepted' had already
--      BURNED 1-3 tokens (unlock_vendor_event) to answer that inquiry. Losing
--      the booking to a rival they never got to compete against and eating the
--      token cost is unfair → REFUND those tokens.
--   2. 'displaced' is documented (20261126000000) as a REVIVABLE state, but the
--      shipped displace does NOT store the PRIOR status, so an un-lock cannot
--      restore it. Add a minimal recovery column so revertVendorToConsidering
--      can revive what its lock displaced.
--
-- DESIGN — additive + idempotent, RLS UNCHANGED:
--   • vendor_event_unlocks gains refunded_at / refunded_tokens / refund_reason.
--     The unlock row (the token-spend record, UNIQUE per vendor+event) is now
--     ALSO the ledger of its own reversal. refunded_at doubles as the
--     idempotency guard — a second refund of the same unlock is a no-op.
--   • chat_threads gains displaced_from_status (nullable enum). Stamped when the
--     exclusivity block displaces a thread; read back + cleared on revival.
--   • refund_displaced_inquiry_unlock() — SECURITY DEFINER cross-party credit.
--     The ACTOR is the COUPLE (they locked a rival); the CREDITED party is the
--     losing VENDOR (no couple RLS reaches vendor wallets), so DEFINER is
--     required. Auth is couple-scoped via current_couple_event_ids() — the same
--     helper chat_threads_member_write uses — so a couple can only refund a
--     vendor on THEIR OWN event. Mirrors the burn's holder branch: founder →
--     store wallet (vendor_wallets), member → personal wallet
--     (vendor_member_token_wallets), resolved from the INQUIRY_UNLOCK redemption
--     row's metadata.holder_user_id.
--
-- REFUND ↔ REVIVAL interaction (documented decision): the refund is PERMANENT
-- and revival NEVER re-charges. A refunded unlock row is left in place (only
-- stamped refunded_at), so the vendor RETAINS event access; if the couple later
-- un-locks and the 'accepted' thread revives, the vendor answers the revived
-- inquiry WITHOUT a new burn. A displace→revive flip-flop is the couple's
-- indecision and must never bill the vendor twice nor double-refund them — the
-- refunded_at guard makes every subsequent displace/refund of the same unlock a
-- no-op.
--
-- Crediting choice: refunds land as PURCHASED tokens (non-expiring). Precise
-- earned-voucher restoration is fragile (vouchers expire / may be fully drained
-- by later burns); crediting purchased is the simplest reversible credit that is
-- never vendor-adverse (matches approve_vendor_token_purchase). The vendor keeps
-- the same token COUNT, in a non-expiring bucket.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_event_unlocks — refund audit + idempotency guard columns.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_event_unlocks
  ADD COLUMN IF NOT EXISTS refunded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_tokens INT,
  ADD COLUMN IF NOT EXISTS refund_reason   TEXT;

COMMENT ON COLUMN public.vendor_event_unlocks.refunded_at IS
  'Set by refund_displaced_inquiry_unlock() when the couple booked a rival and this vendor''s accepted inquiry was displaced. Doubles as the refund idempotency guard (WHERE refunded_at IS NULL). The unlock row is NOT deleted — the vendor keeps event access; revival never re-charges.';

-- ----------------------------------------------------------------------------
-- 2. chat_threads — prior-status recovery column for displaced→revive.
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS displaced_from_status public.chat_inquiry_status;

COMMENT ON COLUMN public.chat_threads.displaced_from_status IS
  'The inquiry_status a thread held immediately before the exclusivity block moved it to ''displaced'' (only ''pending'' or ''accepted'' are ever stamped). Read back + cleared to NULL on revival when the couple un-locks the hard-single pick that displaced it. NULL = not displaced / already revived.';

COMMIT;

-- ----------------------------------------------------------------------------
-- 3. refund_displaced_inquiry_unlock — couple-authorized cross-party credit.
--    SECURITY DEFINER (the couple has no RLS reach into vendor wallets).
--    Idempotent, fail-soft-friendly, never double-refunds.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_displaced_inquiry_unlock(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlock  public.vendor_event_unlocks;
  v_founder UUID;
  v_holder  UUID;
  v_tokens  INT;
BEGIN
  -- AUTH: the caller must be a COUPLE member of this event. This is the
  -- couple-authorized reversal — they locked a rival, releasing (and refunding)
  -- this vendor. current_couple_event_ids() is the canonical couple-scoping
  -- helper (SECURITY DEFINER over event_members), the same one
  -- chat_threads_member_write uses; auth.uid() still resolves to the caller's
  -- JWT inside a DEFINER function.
  IF p_event_id IS NULL
     OR NOT (p_event_id IN (SELECT public.current_couple_event_ids())) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not a couple member of this event';
  END IF;

  -- Lock the token-spend record. No row → the vendor never paid to answer
  -- (free path / never accepted) → nothing to refund (idempotent no-op).
  SELECT * INTO v_unlock
    FROM public.vendor_event_unlocks
   WHERE vendor_profile_id = p_vendor_profile_id
     AND event_id = p_event_id
   FOR UPDATE;

  IF v_unlock.unlock_id IS NULL THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_unlock', 'tokens', 0);
  END IF;

  -- Already refunded → no-op. Guards double-fire + displace→revive→displace
  -- loops (the second displace's refund must not credit again).
  IF v_unlock.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'already_refunded', 'tokens', 0);
  END IF;

  v_tokens := COALESCE(v_unlock.tokens_burned, 0);

  -- Zero-token unlock (verified-in-cap legacy / free-band edge) → nothing to
  -- credit, but stamp refunded so the guard stays stable + accounting is clear.
  IF v_tokens <= 0 THEN
    UPDATE public.vendor_event_unlocks
       SET refunded_at = NOW(),
           refunded_tokens = 0,
           refund_reason = 'displaced — couple booked another vendor'
     WHERE unlock_id = v_unlock.unlock_id;
    RETURN jsonb_build_object('refunded', true, 'tokens', 0);
  END IF;

  -- Resolve WHO paid, to credit the right wallet. The burn debited either the
  -- founder's store wallet (consume_vendor_assets_per_voucher · no holder in
  -- metadata) or an answering member's personal wallet
  -- (consume_member_purchased_tokens · stamps metadata.holder_user_id). Mirror
  -- that branch off the INQUIRY_UNLOCK redemption row.
  SELECT user_id INTO v_founder
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  SELECT (metadata->>'holder_user_id')::uuid INTO v_holder
    FROM public.token_redemptions_log
   WHERE vendor_id = p_vendor_profile_id
     AND related_event_id = p_event_id
     AND service_code = 'INQUIRY_UNLOCK'
     AND metadata ? 'holder_user_id'
   ORDER BY redeemed_at DESC
   LIMIT 1;

  -- Credit the tokens back as PURCHASED (non-expiring). Founder / unknown-holder
  -- → store wallet; a specific member → their personal wallet.
  IF v_holder IS NULL OR v_holder = v_founder THEN
    INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
    VALUES (p_vendor_profile_id, v_tokens, 0)
    ON CONFLICT (vendor_id) DO UPDATE
      SET purchased_tokens = vendor_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
          updated_at = NOW();
  ELSE
    INSERT INTO public.vendor_member_token_wallets (vendor_id, user_id, purchased_tokens)
    VALUES (p_vendor_profile_id, v_holder, v_tokens)
    ON CONFLICT (vendor_id, user_id) DO UPDATE
      SET purchased_tokens = vendor_member_token_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
          updated_at = NOW();
  END IF;

  -- Stamp the unlock row: idempotency guard + the ledger record of the reversal.
  UPDATE public.vendor_event_unlocks
     SET refunded_at = NOW(),
         refunded_tokens = v_tokens,
         refund_reason = 'displaced — couple booked another vendor'
   WHERE unlock_id = v_unlock.unlock_id;

  RETURN jsonb_build_object(
    'refunded', true,
    'tokens', v_tokens,
    'holder', COALESCE(v_holder, v_founder));
END;
$$;

COMMENT ON FUNCTION public.refund_displaced_inquiry_unlock(UUID, UUID) IS
  'Exclusivity fairness refund. Couple-authorized (current_couple_event_ids) cross-party token credit: when a couple locks a rival and this vendor''s accepted inquiry is displaced, credits the burned tokens back (as purchased/non-expiring) to whoever paid — founder store wallet or answering member''s personal wallet. Idempotent via vendor_event_unlocks.refunded_at; never double-refunds; leaves the unlock row so revival never re-charges. Best-effort caller (fail-soft — never rolls back the lock).';

REVOKE ALL ON FUNCTION public.refund_displaced_inquiry_unlock(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_displaced_inquiry_unlock(UUID, UUID) TO authenticated;
