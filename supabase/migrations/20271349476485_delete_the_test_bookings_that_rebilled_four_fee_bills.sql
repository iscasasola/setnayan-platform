-- delete_the_test_bookings_that_rebilled_four_fee_bills
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ════════════════════════════════════════════════════════════════════════════
-- DELETE THE TEST BOOKINGS THAT RE-BILLED FOUR BOOKING-FEE BILLS
-- (owner 16 Nov 2026 "yes delete them"; follows DECISION_LOG 8983dc52 — every transaction so far was a test)
-- ════════════════════════════════════════════════════════════════════════════
-- 20271348457307 (#7842) deleted every order, payment, fee bill and fee ledger row — but not the BOOKINGS behind
-- them. `maybeCatchUpHandshakesWithoutFee` (lib/booking-fee-mint.server.ts, fired from the supplier dashboard
-- layout) finds every booking of the signed-in shop with `lock_request_state = 'agreed'`, a booked status and no
-- live charge, and mints the fee again. The test shop testnayanw1lights opened its dashboard at 04:22Z on 16 Nov
-- and four pending fee bills came back: S89O-GGDS99RD7F ₱1,337.50 · S89O-K9F4CNCSVV ₱1,818.90 ·
-- S89O-AF3XVQJ2YC ₱2,087.50 · S89O-C4YDW7PWKX ₱437.50 (all `submitted`, unpaid).
--
-- Measured 16 Nov (SELECT only), the rows this removes:
--   4 event_vendors (the test bookings; agreed, contracted, on test-* events whose only couple is a test account)
--     cascades: 4 booking_fee_charges (pending) · 3 papic_missions
--   4 orders  → cascades 4 payments (no receipts, order ledger, refunds or remedies)
--   4 booking_fee_ledger rows (one per bill)
--   4 notifications that point at those bills
--
-- Found by JOINS (shop slug → its agreed bookings on test-* events → their pending lock charge → the unpaid order
-- billed under `vendor_booking_fee__<charge>`), never by a typed id. The four order numbers are used only as the
-- refusal: anything selected that is not one of them, or any of them left behind, rolls the whole thing back.
--
-- Untouched on purpose: the shop's three ₱0 waived charges (debut-18 · test-w1-fee-walk · test-own-link-14-nov) and
-- their bookings — they bill nothing and the mint skips them. cale-ice (keeps its credits) and maria-and-jose are
-- fingerprinted and must not move. No real shop is reachable: the selection starts from the test shop's slug.
-- NEVER RUN BY HAND — it reaches prod only through merge → deploy-prod db push.

BEGIN;

DO $purge$
DECLARE
  c_shop CONSTANT TEXT := 'testnayanw1lights';
  c_four CONSTANT TEXT[] := ARRAY['S89O-GGDS99RD7F', 'S89O-K9F4CNCSVV', 'S89O-AF3XVQJ2YC', 'S89O-C4YDW7PWKX'];
  v_stray       TEXT;
  v_left        BIGINT;
  v_n_book      BIGINT;
  v_n_order     BIGINT;
  v_n_pay       BIGINT;
  v_n_charge    BIGINT;
  v_n_ledger    BIGINT;
  b_ev BIGINT; b_or BIGINT; b_pa BIGINT; b_ch BIGINT; b_le BIGINT;
  a_ev BIGINT; a_or BIGINT; a_pa BIGINT; a_ch BIGINT; a_le BIGINT;
  v_keep_before TEXT;
  v_keep_after  TEXT;
BEGIN
  -- ── 0 · the rows, found by joins ────────────────────────────────────────────
  CREATE TEMP TABLE _rebilled ON COMMIT DROP AS
  SELECT ev.vendor_id, c.charge_id, c.ledger_id, o.order_id, o.public_id
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev       ON ev.marketplace_vendor_id = vp.vendor_profile_id
    JOIN public.events e               ON e.event_id = ev.event_id
    JOIN public.booking_fee_charges c  ON c.event_vendor_id = ev.vendor_id AND c.status = 'pending'
    JOIN public.orders o               ON o.service_key = 'vendor_booking_fee__' || c.charge_id::text
                                      AND o.status::text <> 'paid'
   WHERE vp.business_slug = c_shop
     AND ev.lock_request_state::text = 'agreed'
     AND e.slug LIKE 'test-%'
     AND e.slug NOT IN ('cale-ice', 'maria-and-jose')
     AND NOT EXISTS (SELECT 1 FROM public.event_members m JOIN public.users u ON u.user_id = m.user_id
                      WHERE m.event_id = e.event_id AND u.is_internal);

  SELECT string_agg(r.public_id, ', ') INTO v_stray FROM _rebilled r WHERE r.public_id <> ALL (c_four);
  IF v_stray IS NOT NULL THEN
    RAISE EXCEPTION 'test-booking delete refused: selected a bill outside the four: %', v_stray;
  END IF;

  -- What each delete is allowed to take, decided before anything moves.
  SELECT count(DISTINCT vendor_id), count(DISTINCT order_id), count(DISTINCT ledger_id)
    INTO v_n_book, v_n_order, v_n_ledger FROM _rebilled;
  SELECT count(*) INTO v_n_pay FROM public.payments p WHERE p.order_id IN (SELECT order_id FROM _rebilled);
  SELECT count(*) INTO v_n_charge FROM public.booking_fee_charges c
   WHERE c.event_vendor_id IN (SELECT vendor_id FROM _rebilled)
      OR c.ledger_id IN (SELECT ledger_id FROM _rebilled);
  IF v_n_charge <> (SELECT count(DISTINCT charge_id) FROM _rebilled) THEN
    RAISE EXCEPTION 'test-booking delete refused: these bookings/ledgers hold % charges, expected %',
      v_n_charge, (SELECT count(DISTINCT charge_id) FROM _rebilled);
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o
              WHERE o.order_id NOT IN (SELECT order_id FROM _rebilled)
                AND o.service_key IN (SELECT 'vendor_booking_fee__' || charge_id::text FROM _rebilled)) THEN
    RAISE EXCEPTION 'test-booking delete refused: another order bills one of these charges';
  END IF;

  SELECT (SELECT count(*) FROM public.event_vendors), (SELECT count(*) FROM public.orders),
         (SELECT count(*) FROM public.payments), (SELECT count(*) FROM public.booking_fee_charges),
         (SELECT count(*) FROM public.booking_fee_ledger)
    INTO b_ev, b_or, b_pa, b_ch, b_le;

  -- cale-ice and maria-and-jose, fingerprinted.
  SELECT md5(concat_ws('|',
           (SELECT string_agg(row_to_json(x)::text, ',' ORDER BY x.vendor_id) FROM public.event_vendors x
             JOIN public.events e ON e.event_id = x.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose')),
           (SELECT string_agg(row_to_json(x)::text, ',' ORDER BY x.charge_id) FROM public.booking_fee_charges x
             JOIN public.events e ON e.event_id = x.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose')),
           (SELECT string_agg(row_to_json(x)::text, ',' ORDER BY x.order_id) FROM public.orders x
             JOIN public.events e ON e.event_id = x.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose')),
           (SELECT COALESCE(sum(g.points), 0)::text FROM public.papic_event_point_grants g
             JOIN public.events e ON e.event_id = g.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose'))))
    INTO v_keep_before;

  -- ── 1 · the notices that point at these bills ───────────────────────────────
  DELETE FROM public.notifications n
   WHERE EXISTS (SELECT 1 FROM _rebilled r
                  WHERE COALESCE(n.related_url, '') LIKE '%' || r.order_id::text || '%'
                     OR COALESCE(n.related_url, '') LIKE '%' || r.charge_id::text || '%'
                     OR concat_ws(' ', n.title, n.body) LIKE '%' || r.public_id || '%');

  -- ── 2 · the four orders (cascade: payments → payment_receipt_reads, receipts, order_ledger, …) ─
  DELETE FROM public.order_refunds          WHERE order_id IN (SELECT order_id FROM _rebilled);
  DELETE FROM public.order_service_remedies WHERE order_id IN (SELECT order_id FROM _rebilled);
  DELETE FROM public.orders WHERE order_id IN (SELECT order_id FROM _rebilled);

  -- ── 3 · the test bookings (cascade: their fee charges → disputes, papic_missions, …) ─
  DELETE FROM public.event_vendors WHERE vendor_id IN (SELECT vendor_id FROM _rebilled);

  -- ── 4 · the fee ledger rows those bills sat on ──────────────────────────────
  DELETE FROM public.booking_fee_ledger WHERE ledger_id IN (SELECT ledger_id FROM _rebilled);

  -- ── the refusals: a mistake rolls everything back instead of landing ────────
  SELECT count(*) INTO v_left FROM public.orders o WHERE o.public_id = ANY (c_four);
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'test-booking delete refused: % of the four fee bills remain', v_left;
  END IF;

  SELECT (SELECT count(*) FROM public.event_vendors), (SELECT count(*) FROM public.orders),
         (SELECT count(*) FROM public.payments), (SELECT count(*) FROM public.booking_fee_charges),
         (SELECT count(*) FROM public.booking_fee_ledger)
    INTO a_ev, a_or, a_pa, a_ch, a_le;
  IF (b_ev - a_ev, b_or - a_or, b_pa - a_pa, b_ch - a_ch, b_le - a_le)
     IS DISTINCT FROM (v_n_book, v_n_order, v_n_pay, v_n_charge, v_n_ledger) THEN
    RAISE EXCEPTION 'test-booking delete refused: removed (bookings %, orders %, payments %, charges %, ledger %) '
                    'expected (%, %, %, %, %)',
      b_ev - a_ev, b_or - a_or, b_pa - a_pa, b_ch - a_ch, b_le - a_le,
      v_n_book, v_n_order, v_n_pay, v_n_charge, v_n_ledger;
  END IF;

  SELECT md5(concat_ws('|',
           (SELECT string_agg(row_to_json(x)::text, ',' ORDER BY x.vendor_id) FROM public.event_vendors x
             JOIN public.events e ON e.event_id = x.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose')),
           (SELECT string_agg(row_to_json(x)::text, ',' ORDER BY x.charge_id) FROM public.booking_fee_charges x
             JOIN public.events e ON e.event_id = x.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose')),
           (SELECT string_agg(row_to_json(x)::text, ',' ORDER BY x.order_id) FROM public.orders x
             JOIN public.events e ON e.event_id = x.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose')),
           (SELECT COALESCE(sum(g.points), 0)::text FROM public.papic_event_point_grants g
             JOIN public.events e ON e.event_id = g.event_id WHERE e.slug IN ('cale-ice', 'maria-and-jose'))))
    INTO v_keep_after;
  IF v_keep_after IS DISTINCT FROM v_keep_before THEN
    RAISE EXCEPTION 'test-booking delete refused: cale-ice or maria-and-jose moved';
  END IF;

  -- Nothing left for the mint to re-bill: the shop has no agreed, booked, unarchived booking without a live charge.
  SELECT count(*) INTO v_left
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev ON ev.marketplace_vendor_id = vp.vendor_profile_id
   WHERE vp.business_slug = c_shop
     AND ev.lock_request_state::text = 'agreed'
     AND ev.status::text IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL
     AND (ev.package_role IS NULL OR ev.package_role::text <> 'covered')
     AND NOT EXISTS (SELECT 1 FROM public.booking_fee_charges c
                      WHERE c.event_vendor_id = ev.vendor_id
                        AND c.status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch'));
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'test-booking delete refused: % bookings of % would be billed again', v_left, c_shop;
  END IF;
END
$purge$;

COMMIT;
