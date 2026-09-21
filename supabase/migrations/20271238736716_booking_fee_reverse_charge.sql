-- booking_fee_reverse_charge — a refunded fee order gives the money back.
--
-- ── THE DEFECT, measured 2026-09-22 against origin/main ──────────────────────
-- `activateOrderSku` settles a booking-fee charge (`booking_fee_settle_charge`),
-- rolls the amount into `booking_fee_ledger.fee_paid_total_centavos`, and may
-- stamp `cap_reached_at`. `deactivateOrderSku` had NO booking-fee branch at all.
--
-- So: refund a fee order and the charge stays 'paid', the ledger still counts
-- the money as collected, and the cap may stay reached. Revenue is overstated
-- and the supplier's ledger says they paid us for something we gave back.
--
-- ── WHY AN RPC AND NOT TWO TYPESCRIPT WRITES ────────────────────────────────
-- The settle is an RPC because the charge row and the ledger roll-up must move
-- together. The reversal has exactly the same requirement, and the same failure
-- mode if it does not: a decrement that lands without its status change (or the
-- reverse) leaves the two disagreeing about the same peso, which is the state
-- this function exists to prevent. Mirrors `booking_fee_settle_charge`
-- (20270916909942) line for line, in the opposite direction.
--
-- ── 🛑 WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────
-- ⓵ IT DOES NOT RELEASE `booking_fee_ledger.booking_ordinal`, although the
--    CTRL-B1 brief asked for exactly that. The column's own COMMENT, set in
--    20270927120000, reads: *"Immutable once set so a re-lock never shifts
--    it."* Releasing it on a refund would let a supplier refund their way back
--    down the free-5 ladder and take another free booking — a worse defect than
--    the one being fixed, and a silent reversal of a documented rule. Surfaced
--    for the owner rather than built.
-- ⓶ IT DOES NOT INVENT A 'refunded' STATUS. The status CHECK has none, and the
--    original migration says why: *"No 'void', no 'refunded' — refund-on-walk-
--    away resolved to NO REFUND (positioning doc 2026-07-22)."* That ruling is
--    about a COUPLE walking away, not about an admin un-approving a supplier's
--    payment — so this reverses to 'pending', which is already in the
--    vocabulary and is the literal truth: the bill is open again.
--
-- Idempotent: a charge that is not 'paid' is a no-op and reports its status, so
-- a re-run (or a double refund) can never decrement the ledger twice.

CREATE OR REPLACE FUNCTION public.booking_fee_reverse_charge(
  p_charge_id UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge RECORD;
BEGIN
  -- Only a PAID charge can be reversed. The WHERE is the idempotency guard:
  -- a second call finds nothing and returns reversed=false with the real status.
  UPDATE public.booking_fee_charges
     SET status       = 'pending',
         paid_at      = NULL,
         gateway      = NULL,
         payment_ref  = NULL,
         failed_reason = p_reason,
         updated_at   = NOW()
   WHERE charge_id = p_charge_id AND status = 'paid'
  RETURNING * INTO v_charge;

  IF NOT FOUND THEN
    SELECT status INTO v_charge FROM public.booking_fee_charges WHERE charge_id = p_charge_id;
    RETURN jsonb_build_object('charge_id', p_charge_id,
      'status', COALESCE(v_charge.status, 'unknown'), 'reversed', false);
  END IF;

  -- Take the money back out of the roll-up. GREATEST(...,0) because the column
  -- carries a >= 0 CHECK: a ledger that somehow holds less than this charge must
  -- floor at zero rather than abort the reversal and strand the charge.
  --
  -- `cap_reached_at` is re-derived, not merely left: the cap is what makes later
  -- bookings free, so a cap reached ONLY by money we gave back must un-reach, or
  -- the supplier keeps a benefit they paid for and were refunded. 400000 is the
  -- same literal `booking_fee_settle_charge` compares against.
  UPDATE public.booking_fee_ledger
     SET fee_paid_total_centavos = GREATEST(fee_paid_total_centavos - v_charge.amount_charged_centavos, 0),
         cap_reached_at = CASE
           WHEN GREATEST(fee_paid_total_centavos - v_charge.amount_charged_centavos, 0) < 400000
             THEN NULL
           ELSE cap_reached_at END,
         updated_at = NOW()
   WHERE ledger_id = v_charge.ledger_id;

  RETURN jsonb_build_object('charge_id', p_charge_id, 'status', 'pending', 'reversed', true,
                            'amount_centavos', v_charge.amount_charged_centavos);
END;
$$;

COMMENT ON FUNCTION public.booking_fee_reverse_charge(UUID, TEXT) IS
  'Reverse a PAID Booking-Fee charge when its order is refunded/un-approved: '
  'status -> pending, roll the amount back out of the ledger, un-reach the cap '
  'if it was only reached by that money. service_role-only; idempotent '
  '(non-paid -> no-op). Does NOT touch booking_ordinal (immutable by design) '
  'and does NOT introduce a refunded status (positioning doc 2026-07-22).';

REVOKE ALL ON FUNCTION public.booking_fee_reverse_charge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_reverse_charge(UUID, TEXT) TO service_role;
