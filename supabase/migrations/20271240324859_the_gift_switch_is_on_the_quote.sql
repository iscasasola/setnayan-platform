-- ═══════════════════════════════════════════════════════════════════════════
-- THE SETNAYAN GIFT SWITCH IS ON THE QUOTE — the accepted quote decides, the
-- card is only the default.
--
-- ⚖ OWNER, 2026-09-22, on the approved quote-maker prototype: "per-quote
-- switch" — and, clicking the switch drawn disabled in that prototype:
-- "We want this working."
--
-- ── WHAT WAS TRUE BEFORE THIS FILE ────────────────────────────────────────
-- The yes/no for the gift lived on the SERVICE CARD only
-- (`vendor_services.includes_setnayan_gift`, migration 20271222508050), read by
-- ONE function, `setnayan_gift_offered_on(event_vendor_id)`, which BOTH doors
-- call: `setnayan_gift_quote_applies` (the quote's question) and the bill
-- trigger `booking_fee_charges_size_the_gift` (re-created in 20271229508655,
-- still calling this function by name). A quote built from TWO cards whose
-- switches disagreed had no answer at all.
--
-- ── WHAT THIS FILE CHANGES — precedence, not a parallel path ──────────────
--   1. `vendor_proposals.includes_setnayan_gift boolean` — NULLABLE, NO
--      DEFAULT. NULL means "this quote says nothing; fall back to the card".
--      A NOT NULL DEFAULT would record a decision nobody made on every
--      existing row.
--   2. `setnayan_gift_offered_on` reads the booking's ACCEPTED quote FIRST
--      and the card ONLY when no accepted quote says anything. One rule, one
--      place; both callers unchanged.
--
-- 🔒 THE SAME-SUPPLIER GUARD IS CARRIED ACROSS. The card arm joins on
-- `vs.vendor_profile_id = ev.marketplace_vendor_id` because `service_id` is a
-- column the couple's own session can write. A proposal is reachable the same
-- way (`vendor_proposals.event_id` is the couple's event), so the quote arm
-- joins on `vp.vendor_profile_id = ev.marketplace_vendor_id`: only THIS
-- supplier's own quote may switch the gift THIS supplier is billed for.
--
-- Unchanged: the 40 % ceiling, the cap, the proportional ladder
-- (`setnayan_gift_for_fee`), the freeze at lock (20271229508655), the grants.
-- No SKU, no price. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) The quote's own switch ───────────────────────────────────────────────
ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS includes_setnayan_gift BOOLEAN;

COMMENT ON COLUMN public.vendor_proposals.includes_setnayan_gift IS
  'The supplier''s yes/no to the Setnayan gift ON THIS QUOTE (owner 2026-09-22: '
  '"per-quote switch"). NULL = the quote says nothing and the booking falls back '
  'to the service card''s includes_setnayan_gift. Seeded when the quote is '
  'written (ON if any card it was built from is on); the supplier may flip it '
  'before sending. Read by setnayan_gift_offered_on for the ACCEPTED quote — so '
  'it governs the bill only once the couple has accepted it. Never a dial: the '
  'amount is still 40% of the fee, capped, proportional along the ladder.';

-- ── 2) Which switch, in which order ─────────────────────────────────────────
-- Built from the body in 20271222508050 (the only prior definition). Same
-- signature, same STABLE SECURITY DEFINER, same grants (left as granted there:
-- service_role only). Every caller keeps working unchanged.
CREATE OR REPLACE FUNCTION public.setnayan_gift_offered_on(p_event_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1 · THE QUOTE'S SWITCH — the newest ACCEPTED quote by THIS booking's own
    --     supplier on THIS event, when it says anything (NULL = says nothing).
    (
      SELECT vp.includes_setnayan_gift
        FROM public.event_vendors ev
        JOIN public.vendor_proposals vp
          ON vp.event_id = ev.event_id
         -- Only a quote of the SAME supplier. A proposal is reachable through
         -- the couple's event; without this a booking could be switched by a
         -- quote another shop wrote and bill THIS shop for a gift it never gave.
         AND vp.vendor_profile_id = ev.marketplace_vendor_id
       WHERE ev.vendor_id = p_event_vendor_id
         AND vp.status = 'accepted'
         AND vp.includes_setnayan_gift IS NOT NULL
       ORDER BY vp.resolved_at DESC NULLS LAST, vp.created_at DESC
       LIMIT 1
    ),
    -- 2 · THE CARD — the default, exactly as 20271222508050 wrote it.
    EXISTS (
      SELECT 1
        FROM public.event_vendors ev
        JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
       WHERE ev.vendor_id = p_event_vendor_id
         -- Only a card of the SAME supplier. `service_id` is a column the couple's
         -- own session can write; without this a booking could point at another
         -- shop's card and bill THIS shop for a gift it never offered.
         AND vs.vendor_profile_id = ev.marketplace_vendor_id
         AND vs.includes_setnayan_gift IS TRUE
    )
  );
$$;

COMMENT ON FUNCTION public.setnayan_gift_offered_on(UUID) IS
  'Does this booking carry the Setnayan gift? The booking''s newest ACCEPTED quote '
  'by the same supplier decides when its includes_setnayan_gift is not NULL; '
  'otherwise the supplier''s own service card (vendor_services.includes_setnayan_gift). '
  'Same-supplier guard on BOTH arms. One rule for both doors: '
  'setnayan_gift_quote_applies and the bill trigger booking_fee_charges_size_the_gift.';
