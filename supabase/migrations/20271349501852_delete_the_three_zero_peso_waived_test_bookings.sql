-- delete_the_three_zero_peso_waived_test_bookings
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ════════════════════════════════════════════════════════════════════════════
-- DELETE THE THREE ₱0 WAIVED TEST BOOKINGS ON THE W1 TEST SHOP
-- (owner ruling 16 Nov 2026 (21); follows DECISION_LOG 8983dc52 — every transaction so far was a test)
-- ════════════════════════════════════════════════════════════════════════════
-- 20271349476485 (#7877) deleted the four test bookings that had re-billed fee bills and deliberately KEPT the test
-- shop testnayanw1lights' three ₱0 waived bookings (debut-18 · test-w1-fee-walk · test-own-link-14-nov), because they
-- bill nothing and the mint skips them. The owner has now ruled they go too: they are test bookings, and a waived
-- ₱0 charge still counts on the shop's books (free-five slots, booking counts, the supplier's own lists).
--
-- What this removes (same shape as #7877, scoped to those three):
--   the shop's bookings on exactly those three event slugs
--     cascades: their waived fee charges · papic_missions · event_vendor_payments / refunds (FK ON DELETE CASCADE)
--   any UNPAID order billing one of those charges (→ payments) — expected none, a ₱0 charge raises no bill
--   the fee ledger rows those charges sat on
--   the notices that point at those bookings, charges or orders
--
-- Found by JOINS (shop slug → its bookings → their event's slug, one of the three named → their waived charge),
-- never by a typed id. The refusals roll the whole thing back instead of landing:
--   · a selected charge that is not waived, or not ₱0 (a real bill is never swept up as a "₱0 test");
--   · a ledger row that also holds a charge outside the three bookings;
--   · a PAID order billing one of the charges;
--   · any of the shop's bookings left on the three slugs afterwards;
--   · a removed count other than what was decided before anything moved;
--   · cale-ice (keeps its credits) or maria-and-jose moving (fingerprinted);
--   · a booking the mint (`maybeCatchUpHandshakesWithoutFee`) would bill again.
-- No real shop is reachable: the selection starts from the test shop's slug. A second run selects nothing and
-- changes nothing.
-- NEVER RUN BY HAND — it reaches prod only through merge → deploy-prod db push.

BEGIN;

DO $purge$
DECLARE
  c_shop  CONSTANT TEXT   := 'testnayanw1lights';
  c_three CONSTANT TEXT[] := ARRAY['debut-18', 'test-w1-fee-walk', 'test-own-link-14-nov'];
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
  CREATE TEMP TABLE _waived ON COMMIT DROP AS
  SELECT ev.vendor_id, e.slug AS event_slug, c.charge_id, c.ledger_id, c.status::text AS charge_status,
         c.amount_charged_centavos
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev            ON ev.marketplace_vendor_id = vp.vendor_profile_id
    JOIN public.events e                    ON e.event_id = ev.event_id
    LEFT JOIN public.booking_fee_charges c  ON c.event_vendor_id = ev.vendor_id
   WHERE vp.business_slug = c_shop
     AND e.slug = ANY (c_three)
     AND e.slug NOT IN ('cale-ice', 'maria-and-jose');

  SELECT string_agg(DISTINCT w.event_slug || ' (' || COALESCE(w.charge_status, 'no charge') || ' '
                    || COALESCE(w.amount_charged_centavos::text, '-') || ')', ', ')
    INTO v_stray
    FROM _waived w
   WHERE w.charge_id IS NOT NULL
     AND (w.charge_status NOT LIKE 'waived%' OR COALESCE(w.amount_charged_centavos, 0) <> 0);
  IF v_stray IS NOT NULL THEN
    RAISE EXCEPTION 'waived-test-booking delete refused: selected a charge that is not a ₱0 waiver: %', v_stray;
  END IF;

  CREATE TEMP TABLE _waived_orders ON COMMIT DROP AS
  SELECT o.order_id, o.status::text AS status
    FROM public.orders o
   WHERE o.service_key IN (SELECT 'vendor_booking_fee__' || w.charge_id::text FROM _waived w WHERE w.charge_id IS NOT NULL);
  IF EXISTS (SELECT 1 FROM _waived_orders WHERE status = 'paid') THEN
    RAISE EXCEPTION 'waived-test-booking delete refused: a PAID order bills one of these ₱0 charges';
  END IF;

  -- What each delete is allowed to take, decided before anything moves.
  SELECT count(DISTINCT vendor_id), count(DISTINCT ledger_id) INTO v_n_book, v_n_ledger FROM _waived;
  SELECT count(*) INTO v_n_order FROM _waived_orders;
  SELECT count(*) INTO v_n_pay FROM public.payments p WHERE p.order_id IN (SELECT order_id FROM _waived_orders);
  SELECT count(*) INTO v_n_charge FROM public.booking_fee_charges c
   WHERE c.event_vendor_id IN (SELECT vendor_id FROM _waived)
      OR c.ledger_id IN (SELECT ledger_id FROM _waived WHERE ledger_id IS NOT NULL);
  IF v_n_charge <> (SELECT count(DISTINCT charge_id) FROM _waived) THEN
    RAISE EXCEPTION 'waived-test-booking delete refused: these bookings/ledgers hold % charges, expected %',
      v_n_charge, (SELECT count(DISTINCT charge_id) FROM _waived);
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

  -- ── 1 · the notices that point at these bookings, charges or orders ─────────
  DELETE FROM public.notifications n
   WHERE EXISTS (SELECT 1 FROM _waived w
                  WHERE COALESCE(n.related_url, '') LIKE '%' || w.vendor_id::text || '%'
                     OR (w.charge_id IS NOT NULL AND COALESCE(n.related_url, '') LIKE '%' || w.charge_id::text || '%'))
      OR EXISTS (SELECT 1 FROM _waived_orders o
                  WHERE COALESCE(n.related_url, '') LIKE '%' || o.order_id::text || '%');

  -- ── 2 · any unpaid order billing these charges (cascade: payments → receipts, order_ledger, …) ─
  DELETE FROM public.order_refunds          WHERE order_id IN (SELECT order_id FROM _waived_orders);
  DELETE FROM public.order_service_remedies WHERE order_id IN (SELECT order_id FROM _waived_orders);
  DELETE FROM public.orders WHERE order_id IN (SELECT order_id FROM _waived_orders);

  -- ── 3 · the three test bookings (cascade: their waived fee charges → disputes, papic_missions, …) ─
  DELETE FROM public.event_vendors WHERE vendor_id IN (SELECT vendor_id FROM _waived);

  -- ── 4 · the fee ledger rows those charges sat on ────────────────────────────
  DELETE FROM public.booking_fee_ledger WHERE ledger_id IN (SELECT ledger_id FROM _waived WHERE ledger_id IS NOT NULL);

  -- ── the refusals: a mistake rolls everything back instead of landing ────────
  SELECT count(*) INTO v_left
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev ON ev.marketplace_vendor_id = vp.vendor_profile_id
    JOIN public.events e         ON e.event_id = ev.event_id
   WHERE vp.business_slug = c_shop AND e.slug = ANY (c_three);
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'waived-test-booking delete refused: % of the shop''s bookings on the three events remain', v_left;
  END IF;

  SELECT (SELECT count(*) FROM public.event_vendors), (SELECT count(*) FROM public.orders),
         (SELECT count(*) FROM public.payments), (SELECT count(*) FROM public.booking_fee_charges),
         (SELECT count(*) FROM public.booking_fee_ledger)
    INTO a_ev, a_or, a_pa, a_ch, a_le;
  IF (b_ev - a_ev, b_or - a_or, b_pa - a_pa, b_ch - a_ch, b_le - a_le)
     IS DISTINCT FROM (v_n_book, v_n_order, v_n_pay, v_n_charge, v_n_ledger) THEN
    RAISE EXCEPTION 'waived-test-booking delete refused: removed (bookings %, orders %, payments %, charges %, ledger %) '
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
    RAISE EXCEPTION 'waived-test-booking delete refused: cale-ice or maria-and-jose moved';
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
    RAISE EXCEPTION 'waived-test-booking delete refused: % bookings of % would be billed again', v_left, c_shop;
  END IF;
END
$purge$;

COMMIT;
