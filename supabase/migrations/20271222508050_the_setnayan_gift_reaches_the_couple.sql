-- ═══════════════════════════════════════════════════════════════════════════
-- THE SETNAYAN GIFT REACHES THE BILL, AND THE COUPLE'S POT (C1 · EX-2)
--
-- A supplier's "yes" on a service card (`vendor_services.includes_setnayan_gift`,
-- migration 20271216515644) promised free Papic photos that NOTHING computed,
-- billed or granted. This migration is the rest of the promise:
--
--   fee (booking_fee_centavos — the SQL mirror of apps/web/lib/booking-fee.ts)
--     → 40% of it, a CEILING, floored to the centavo
--     → spent PROPORTIONALLY along the LIVE Papic ladder
--       (platform_retail_catalog_v2 REGULAR price × papic_pass_tiers.points)
--     → capped at the 50,000-CREDIT rung, and the charge caps with it
--     → ADDED to the supplier's booking-fee order, never deducted from the fee
--     → granted into the event's shared Papic pot when that order is PAID.
--
-- ⚖ OWNER RULINGS, DECISION_LOG 2026-09-09 (six rows; none may be re-asked):
--   "40%" · "no. just max to 40%. nothing more." · "ok then only offer papic
--   credits" · "papic credits will be auto computed based on what they pay. it
--   will be proportionally computed to the value. (so it is either a yes or a
--   no)." · "wait. but max up to the 50000 papic credits. only." · "no fee. no
--   gift." · "all regular price will always be the price."
--
-- ⚠ NO RUNG PRICE IS TYPED ANYWHERE IN THIS FILE. The ladder is read at call
-- time. The only numbers here are the owner's two RULES — 40 (percent) and
-- 50000 (credits) — mirrored in apps/web/lib/setnayan-gift.ts and asserted
-- equal to it by tests/db/the-gift-reaches-the-couple.db.test.ts.
--
-- ───────────────────────────────────────────────────────────────────────────
-- RULE 0 — WHAT THIS REUSES, AND WHAT IT DELIBERATELY DOES NOT
--
-- • THE POT. `papic_event_pool_status` sums `papic_event_point_grants` rows with
--   seat_id IS NULL into the event's shared total, and `papic_reserve_capture_split`
--   draws a capture from a camera's own credits first and the shared pot for the
--   rest. A paid Papic rung lands as ONE such row (sku-activation.ts
--   `grantPapicPassPoints`). The gift lands the same way — one row, seat_id NULL,
--   source 'comp' (already in the CHECK since 20270826385580, never written
--   until now: prod holds 0 'comp' rows), order_id = the supplier's paid fee
--   order. No second way to put credits in a pot is invented.
-- • REVERSAL IS FREE. `deactivateOrderSku` → `reversePapicPassPoints` deletes
--   every grant carrying the reversed order's id, whatever its source — so an
--   un-approved fee order takes its gift back with it, exactly as a refunded
--   Papic rung does.
-- • NOT `comp_grants` / `vendor_self_comp`. That path comps a whole SKU to the
--   supplier's OWN celebration (lib/self-comp-authority.ts requires the caller
--   to be a couple member of the event) under a per-quarter quota. The gift is a
--   proportional credit count on a CUSTOMER's event, bought on the fee bill —
--   neither the authority rule nor the quota fits, and both would refuse it.
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHO PAYS, WHEN, AND WHAT NEVER CHANGES
--
-- • The gift is sized on the PRIMARY lock charge only, while it is PENDING, and
--   re-sized in place whenever that pending fee is re-derived (a price change
--   before payment). It FREEZES when the charge is paid. Amendment deltas and
--   credit notes carry no gift: a gift already granted cannot be clawed back
--   (the couple may have shot the photos), and a post-payment price rise does
--   not silently bill the supplier for more gift. 40% is a ceiling, so a frozen
--   gift below 40% of a later, higher fee is within the ruling.
-- • `amount_charged_centavos` STAYS THE FEE. The gift rides in its own columns,
--   so the fee ledger (`fee_paid_total_centavos`), the supplier's own 5% Papic
--   credits (sku-activation.ts reads `amount_charged_centavos`) and every fee
--   report keep meaning "the booking fee". Only the ORDER carries fee + gift.
-- • "No fee, no gift" needs no new branch: a free-5 or import booking opens a
--   WAIVED charge, never a pending one, and the gift is sized only on pending.
-- • WHICH CARD. `event_vendors.service_id` — the card the couple inquired from
--   (written by startServiceInquiry / unlockCategoryWithInquiry /
--   attachMarketplaceVendorToCategory) — and ONLY a card of the SAME supplier.
--   The yes/no is SNAPSHOTTED onto the charge when it opens (the supplier's
--   acknowledge) and never re-read, so flipping a card afterwards changes no
--   bill already raised.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) The charge carries the gift, beside the fee ──────────────────────────
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS setnayan_gift_offered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS gift_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS gift_centavos BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'booking_fee_charges_gift_non_negative'
                    AND conrelid = 'public.booking_fee_charges'::regclass) THEN
    ALTER TABLE public.booking_fee_charges
      ADD CONSTRAINT booking_fee_charges_gift_non_negative
      CHECK (gift_credits >= 0 AND gift_centavos >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.booking_fee_charges.setnayan_gift_offered IS
  'The supplier''s service card said YES to the Setnayan gift when this charge '
  'opened (snapshot; never re-read). Set by booking_fee_charges_size_the_gift.';
COMMENT ON COLUMN public.booking_fee_charges.gift_credits IS
  'Free Papic credits (= photos) this charge buys the couple: 40% of the fee, '
  'proportional along the live ladder, capped at 50,000. Granted into the '
  'event''s shared pot when the fee order is paid. 0 = no gift.';
COMMENT ON COLUMN public.booking_fee_charges.gift_centavos IS
  'What the supplier pays for gift_credits, ON TOP of amount_charged_centavos '
  '(which stays the booking fee alone). The order total is the sum of the two.';

-- ── 2) The arithmetic — one derivation, read from the live ladder ───────────
CREATE OR REPLACE FUNCTION public.setnayan_gift_for_fee(p_fee_centavos BIGINT)
RETURNS TABLE (credits INTEGER, charge_centavos BIGINT, capped BOOLEAN)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  -- The owner's two RULES. Mirrored in apps/web/lib/setnayan-gift.ts
  -- (GIFT_SHARE_OF_FEE_PCT · GIFT_CAP_CREDITS); a db test asserts they agree.
  c_share_pct CONSTANT BIGINT := 40;
  c_cap       CONSTANT BIGINT := 50000;
  v_c         BIGINT[];
  v_p         BIGINT[];
  v_n         INTEGER;
  v_cap_price BIGINT;
  v_budget    BIGINT;
  v_charge    BIGINT;
  i           INTEGER;
BEGIN
  IF p_fee_centavos IS NULL OR p_fee_centavos <= 0 THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;

  -- The GIFT ladder: every active, unretired PAPIC_GUEST* rung with an active,
  -- non-top-up tier row, at or below the cap. REGULAR price, never onboarding.
  SELECT array_agg(t.points::BIGINT ORDER BY t.points),
         array_agg(round(c.retail_price_php * 100)::BIGINT ORDER BY t.points)
    INTO v_c, v_p
    FROM public.platform_retail_catalog_v2 c
    JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
   WHERE left(c.service_code, 11) = 'PAPIC_GUEST'
     AND c.is_active IS TRUE
     AND c.retired_at IS NULL
     AND c.retail_price_php > 0
     AND t.is_active IS TRUE
     AND t.is_topup IS NOT TRUE
     AND t.points > 0
     AND t.points <= c_cap;

  v_n := COALESCE(array_length(v_c, 1), 0);
  IF v_n = 0 THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;

  -- A ladder whose price does not rise with its credits cannot be interpolated;
  -- refuse it (no gift, nothing billed) rather than guess.
  FOR i IN 2 .. v_n LOOP
    IF v_c[i] = v_c[i - 1] OR v_p[i] <= v_p[i - 1] THEN
      RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
      RETURN;
    END IF;
  END LOOP;

  -- THE CAP IS CREDITS; its price is read off the live rung. No such rung ⇒
  -- no way to price the cap ⇒ no gift (never an uncapped one).
  IF v_c[v_n] <> c_cap THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;
  v_cap_price := v_p[v_n];

  -- 40% of the fee, FLOORED to the centavo — a ceiling, never exceeded.
  v_budget := (p_fee_centavos * c_share_pct) / 100;
  v_charge := LEAST(v_budget, v_cap_price);

  -- THE FLOOR: below the smallest rung the promise would produce nothing.
  IF v_charge < v_p[1] THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;

  IF v_budget >= v_cap_price THEN
    RETURN QUERY SELECT c_cap::INTEGER, v_cap_price, TRUE;
    RETURN;
  END IF;

  -- PROPORTIONAL: interpolate between the two rungs that bracket the charge,
  -- rounding the photo count half up — floor((2n + d) / 2d), exactly as the TS.
  FOR i IN 1 .. v_n LOOP
    IF v_charge = v_p[i] OR i = v_n THEN
      RETURN QUERY SELECT v_c[i]::INTEGER, v_charge, FALSE;
      RETURN;
    END IF;
    IF v_charge < v_p[i + 1] THEN
      RETURN QUERY SELECT
        (v_c[i] + (2 * (v_charge - v_p[i]) * (v_c[i + 1] - v_c[i]) + (v_p[i + 1] - v_p[i]))
                  / (2 * (v_p[i + 1] - v_p[i])))::INTEGER,
        v_charge,
        FALSE;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT 0, 0::BIGINT, FALSE; -- unreachable
END;
$$;

COMMENT ON FUNCTION public.setnayan_gift_for_fee(BIGINT) IS
  'The Setnayan gift a booking fee (centavos) buys: 40% of it, floored, spent '
  'proportionally along the LIVE PAPIC_GUEST* ladder (regular price), capped at '
  '50,000 credits with the charge capped at that rung''s price; 0 below the '
  'smallest rung. Mirror of setnayanGiftForFee in apps/web/lib/setnayan-gift.ts.';

-- ── 3) Which card, and did it say yes ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setnayan_gift_offered_on(p_event_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
     WHERE ev.vendor_id = p_event_vendor_id
       -- Only a card of the SAME supplier. `service_id` is a column the couple's
       -- own session can write; without this a booking could point at another
       -- shop's card and bill THIS shop for a gift it never offered.
       AND vs.vendor_profile_id = ev.marketplace_vendor_id
       AND vs.includes_setnayan_gift IS TRUE
  );
$$;

-- ── 4) The charge sizes its own gift — every writer, one rule ───────────────
-- A trigger rather than an edit to each writer: `booking_fee_open_lock_charge`
-- INSERTs the primary charge and `booking_fee_rederive_lock_fee` re-derives it
-- in place on every price change before payment. Both stay byte-for-byte as
-- they are, and neither can forget the gift, because the ROW sizes it.
CREATE OR REPLACE FUNCTION public.booking_fee_charges_size_the_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift RECORD;
BEGIN
  -- The yes/no is a SNAPSHOT taken once, when the charge opens.
  IF TG_OP = 'INSERT' THEN
    NEW.setnayan_gift_offered :=
      NEW.kind = 'primary'
      AND NEW.source = 'lock'
      AND NEW.event_vendor_id IS NOT NULL
      AND public.setnayan_gift_offered_on(NEW.event_vendor_id);
  ELSE
    NEW.setnayan_gift_offered := OLD.setnayan_gift_offered;
  END IF;

  -- Once PAID with money in it, the gift is FROZEN at what was paid for.
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status = 'paid' THEN
    NEW.gift_credits  := OLD.gift_credits;
    NEW.gift_centavos := OLD.gift_centavos;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'paid'
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN
    NEW.gift_credits  := OLD.gift_credits;
    NEW.gift_centavos := OLD.gift_centavos;
    RETURN NEW;
  END IF;

  -- PENDING with a real fee on a card that said yes → size it on the fee.
  IF NEW.status = 'pending'
     AND NEW.setnayan_gift_offered
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN
    SELECT g.credits, g.charge_centavos INTO v_gift
      FROM public.setnayan_gift_for_fee(NEW.amount_charged_centavos) g;
    NEW.gift_credits  := COALESCE(v_gift.credits, 0);
    NEW.gift_centavos := COALESCE(v_gift.charge_centavos, 0);
    RETURN NEW;
  END IF;

  -- Every other state — waived (free-5 / import), cleared at ₱0, expired,
  -- failed, a delta, a credit note — carries no gift and bills none.
  NEW.gift_credits  := 0;
  NEW.gift_centavos := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_fee_charges_size_the_gift ON public.booking_fee_charges;
CREATE TRIGGER booking_fee_charges_size_the_gift
  BEFORE INSERT OR UPDATE ON public.booking_fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_charges_size_the_gift();

-- ── 5) The order the supplier pays carries fee + gift ───────────────────────
-- Reproduced from 20271013349208 § 2 (the live body, read from production with
-- pg_get_functiondef 2026-09-11 and identical to that file). The ONLY deltas:
--   • the amount is amount_charged_centavos + gift_centavos;
--   • with a gift, the description names the fee, the photos and the gift's
--     price (the same clause the TS mint writes — setnayanGiftBillClause);
--   • a re-derived pending order has its description refreshed with its total,
--     so the photo count on the bill is never stale.
-- With NO gift the description and amount are byte-identical to before.
CREATE OR REPLACE FUNCTION public.booking_fee_upsert_vendor_order(p_charge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge     RECORD;
  v_order      RECORD;
  v_svc        TEXT;
  v_amount_php NUMERIC(12, 2);
  v_payer      UUID;
  v_ref        TEXT;
  v_order_id   UUID;
  v_desc       TEXT;
BEGIN
  SELECT charge_id, event_id, vendor_profile_id, amount_charged_centavos, status, kind,
         gift_credits, gift_centavos
    INTO v_charge
    FROM public.booking_fee_charges
    WHERE charge_id = p_charge_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Mirrors bookingFeeLockServiceKey() in apps/web/lib/booking-fee-lock.ts.
  v_svc := 'vendor_booking_fee__' || p_charge_id::text;

  SELECT order_id, status, requested_total_php, description
    INTO v_order
    FROM public.orders
    WHERE service_key = v_svc
    LIMIT 1;

  -- Not collectible → make sure no OPEN order lingers.
  IF v_charge.status <> 'pending' OR COALESCE(v_charge.amount_charged_centavos, 0) <= 0 THEN
    IF v_order.order_id IS NOT NULL
       AND v_order.status NOT IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN
      UPDATE public.orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = v_order.order_id;
      UPDATE public.payments
        SET status = 'rejected',
            admin_notes = COALESCE(admin_notes || ' ', '') || '[auto-void: booking amended]'
        WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
    RETURN;
  END IF;

  v_amount_php := round(v_charge.amount_charged_centavos
                        + COALESCE(v_charge.gift_centavos, 0))::numeric / 100.0;

  IF v_order.order_id IS NOT NULL THEN
    -- Never touch a settled/cancelled order — reconciliation there is the paid
    -- branch's supplementary-charge job, not an in-place rewrite.
    IF v_order.status IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN RETURN; END IF;
    IF v_order.requested_total_php IS DISTINCT FROM v_amount_php THEN
      v_desc := v_order.description;
      -- Rebuilt when the bill carries a gift now OR carried one before (a price
      -- cut below the floor must not leave "free Papic photos" on a bill that
      -- no longer buys any). A gift-free bill keeps its description untouched.
      IF COALESCE(v_charge.gift_credits, 0) > 0
         OR position(' + your Setnayan gift for your couple: ' IN COALESCE(v_desc, '')) > 0 THEN
        v_desc := 'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
          || CASE WHEN COALESCE(v_charge.gift_credits, 0) > 0
                  THEN public.setnayan_gift_bill_clause(v_charge.amount_charged_centavos,
                                                         v_charge.gift_credits,
                                                         v_charge.gift_centavos)
                  ELSE '' END
          || ' — amended booking, up for verification within 24 hrs';
      END IF;
      UPDATE public.orders
        SET requested_total_php = v_amount_php, description = v_desc, updated_at = NOW()
        WHERE order_id = v_order.order_id;
      UPDATE public.payments
        SET amount_php = v_amount_php
        WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
    RETURN;
  END IF;

  -- No order yet → mint one (needs a claimable vendor user as payer).
  SELECT user_id INTO v_payer
    FROM public.vendor_profiles
    WHERE vendor_profile_id = v_charge.vendor_profile_id;
  IF v_payer IS NULL THEN RETURN; END IF;

  v_ref := 'SN' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  INSERT INTO public.orders
    (event_id, user_id, vendor_profile_id, service_key, description,
     requested_total_php, status, reference_code)
  VALUES
    (v_charge.event_id, v_payer, v_charge.vendor_profile_id, v_svc,
     -- DERIVED, never asserted: the fee is a taper, so a bare "(5%)" is a false
     -- statement of the rate on every booking above ₱100,000.
     'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
       || CASE WHEN COALESCE(v_charge.gift_credits, 0) > 0
               THEN public.setnayan_gift_bill_clause(v_charge.amount_charged_centavos,
                                                      v_charge.gift_credits,
                                                      v_charge.gift_centavos)
               ELSE '' END
       || ' — amended booking, up for verification within 24 hrs',
     v_amount_php, 'submitted', v_ref)
  RETURNING order_id INTO v_order_id;

  INSERT INTO public.payments
    (order_id, user_id, amount_php, channel, paid_at)
  VALUES
    (v_order_id, v_payer, v_amount_php, 'manual', CURRENT_DATE);
END;
$$;

-- The clause a supplier reads on the bill. Mirror of setnayanGiftBillClause in
-- apps/web/lib/setnayan-gift.ts (asserted equal in the db test). Pesos ARE right
-- here: this is the supplier's own bill. The couple is told only photographs.
CREATE OR REPLACE FUNCTION public.setnayan_gift_bill_clause(
  p_fee_centavos BIGINT, p_gift_credits INTEGER, p_gift_centavos BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ' ' || public.booking_fee_php_text(p_fee_centavos / 100.0)
      || ' + your Setnayan gift for your couple: '
      || to_char(p_gift_credits, 'FM999,999,990') || ' free Papic photos, '
      || public.booking_fee_php_text(p_gift_centavos / 100.0);
$$;

-- ── 6) Granted when the money CLEARS — into the event's shared pot ──────────
-- Called by the `vendor_booking_fee__` activation hook (lib/sku-activation.ts)
-- right after `booking_fee_settle_charge`, with the order the admin approved.
-- Idempotent by the partial unique index below: a re-approval lands nothing new.
CREATE UNIQUE INDEX IF NOT EXISTS papic_event_point_grants_one_setnayan_gift_per_order
  ON public.papic_event_point_grants (order_id)
  WHERE source = 'comp' AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.booking_fee_grant_setnayan_gift(
  p_charge_id UUID, p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge   RECORD;
  v_grant_id UUID;
BEGIN
  SELECT charge_id, public_id, event_id, status, kind, gift_credits
    INTO v_charge
    FROM public.booking_fee_charges
    WHERE charge_id = p_charge_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_charge');
  END IF;
  -- "When the money CLEARS" — never at lock, never on a pending bill.
  IF v_charge.status <> 'paid' THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'not_cleared');
  END IF;
  IF COALESCE(v_charge.gift_credits, 0) <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_gift');
  END IF;
  IF v_charge.event_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_event');
  END IF;
  -- The order must be THIS charge's own bill, and it must be paid.
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.order_id = p_order_id
       AND o.service_key = 'vendor_booking_fee__' || p_charge_id::text
       AND o.status IN ('paid', 'fulfilled')
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'order_not_paid');
  END IF;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id, note)
  VALUES (v_charge.event_id, v_charge.gift_credits, 'comp', p_order_id,
          'Setnayan gift from the supplier · ' || v_charge.gift_credits
            || ' photos · booking fee ' || COALESCE(v_charge.public_id, p_charge_id::text))
  ON CONFLICT (order_id) WHERE source = 'comp' AND order_id IS NOT NULL DO NOTHING
  RETURNING grant_id INTO v_grant_id;

  IF v_grant_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted',
                              'credits', v_charge.gift_credits);
  END IF;
  RETURN jsonb_build_object('granted', true, 'grant_id', v_grant_id,
                            'credits', v_charge.gift_credits, 'event_id', v_charge.event_id);
END;
$$;

-- ── 7) The QUOTE's question: will this booking's gift be real? ──────────────
-- The quote names the photo count (apps/web/lib/setnayan-gift.server.ts) only
-- when the bill will actually carry it: the card says yes AND the booking will
-- bear a fee ("no fee. no gift." — a sourced client, outside the first five).
-- Mirrors booking_fee_open_lock_charge's attribution + free-5 ordinal without
-- writing anything. Returns 'applies' or the reason it does not.
CREATE OR REPLACE FUNCTION public.setnayan_gift_quote_applies(
  p_event_id UUID, p_vendor_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev          RECORD;
  v_ledger      RECORD;
  v_attribution TEXT;
  v_ordinal     INTEGER;
BEGIN
  SELECT vendor_id, package_role INTO v_ev
    FROM public.event_vendors
   WHERE event_id = p_event_id
     AND marketplace_vendor_id = p_vendor_profile_id
     AND archived_at IS NULL
     AND package_role IS DISTINCT FROM 'covered'
   ORDER BY created_at
   LIMIT 1;
  IF NOT FOUND THEN RETURN 'no_booking'; END IF;

  IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;

  SELECT ledger_id, attribution, booking_ordinal, is_free_booking, created_at, source
    INTO v_ledger
    FROM public.booking_fee_ledger
   WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id;

  v_attribution := COALESCE(v_ledger.attribution,
                            public.booking_fee_attribution_for(p_vendor_profile_id, p_event_id));
  IF v_attribution = 'import' THEN RETURN 'not_sourced'; END IF;

  IF v_ledger.booking_ordinal IS NOT NULL THEN
    IF v_ledger.is_free_booking THEN RETURN 'free_booking'; END IF;
    RETURN 'applies';
  END IF;

  IF v_ledger.ledger_id IS NOT NULL AND v_ledger.source = 'lock' THEN
    SELECT count(*) INTO v_ordinal
      FROM public.booking_fee_ledger l2
     WHERE l2.vendor_profile_id = p_vendor_profile_id
       AND l2.source = 'lock'
       AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
  ELSE
    SELECT count(*) + 1 INTO v_ordinal
      FROM public.booking_fee_ledger l2
     WHERE l2.vendor_profile_id = p_vendor_profile_id
       AND l2.source = 'lock';
  END IF;
  IF GREATEST(v_ordinal, 1) <= 5 THEN RETURN 'free_booking'; END IF;
  RETURN 'applies';
END;
$$;

-- ── 8) Grants — every new function is server-only ───────────────────────────
REVOKE ALL ON FUNCTION public.setnayan_gift_for_fee(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_for_fee(BIGINT) TO service_role;
REVOKE ALL ON FUNCTION public.setnayan_gift_offered_on(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_offered_on(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_charges_size_the_gift() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setnayan_gift_bill_clause(BIGINT, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_bill_clause(BIGINT, INTEGER, BIGINT) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_grant_setnayan_gift(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_grant_setnayan_gift(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) TO service_role;
-- CREATE OR REPLACE keeps grants, re-issued anyway so the file states them.
REVOKE ALL ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) TO service_role;
