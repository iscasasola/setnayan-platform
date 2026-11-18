-- delete_every_test_purchase_cale_ice_keeps_its_credits
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ════════════════════════════════════════════════════════════════════════════
-- DELETE EVERY TEST PURCHASE RECORD — CALE-ICE KEEPS ITS CREDITS
-- (owner 16 Nov 2026, DECISION_LOG 8983dc52; supersedes b0509c94's "no data is deleted")
-- ════════════════════════════════════════════════════════════════════════════
-- Owner: "all transactions registered on setnayan from users and suppliers were all test purchases" · "delete now" ·
-- "yes delete those records but keep the credits on cale-ice". Measured 16 Nov (SELECT): 16 orders · 14 payments ·
-- 10 receipts · 32 order-ledger lines · 6 booking-fee bills · 6 booking-fee ledger rows · 21 App Store purchases.
--
-- ONE transaction. In order:
--   0. Read cale-ice's Papic credit total and its Setnayan AI switch (found by SLUG; its host by a JOIN).
--   1. Record what cale-ice's paid orders unlocked as ONE comp grant (source owner_internal), keyed by
--      reason + event so a re-run adds nothing. cale-ice is a §10a internal event, so every SKU is already on for it
--      (eventSkuActive); the grant is the record that replaces the deleted orders.
--   2. cale-ice's two bought Papic credit lines become comp lines IN PLACE (points unchanged, order link cleared).
--      The balance is the SUM of papic_event_point_grants; no balance reader joins orders. The only SQL readers of
--      source 'comp' match `order_id IS NOT NULL` (the booking-fee gift), so these lines are never read as a gift.
--   3. RESTRICT children of orders (order_refunds, order_service_remedies).
--   4. Every other Papic credit line bought by an order (test accounts' — ruling (3): their entitlements end).
--   5. Supplier Papic portfolio credits bought by an order or a fee bill.
--   6. Purchase notices (order / payment / fee-bill links, or an S89O- order id in the text) — they point at nothing.
--   7. App Store purchases (all test; 6 on cale-ice granted no credits).
--   8. Orders (cascades: payments → payment_receipt_reads, receipts, order_ledger, onboarding_order_items, …;
--      SET NULL links on comp_grants, paparazzi_seats, gift stock, … keep their rows), then any payment left.
--   9. Booking-fee bills (cascade: booking_fee_disputes; SET NULL: shop_badge_rewards).
--  10. Booking-fee ledger (each supplier's fee totals and booking number — all test bookings).
--  11. A test event whose Setnayan AI switch came only from a deleted purchase is switched off (ruling (3)).
--      Measured 16 Nov: only cale-ice has the switch on, so this changes 0 rows today.
-- Then it REFUSES TO COMMIT (RAISE → the whole transaction rolls back) if cale-ice's credit total or AI switch moved,
-- or if any order, payment or booking-fee bill is left.
--
-- Untouched: vendor_subscriptions (2 rows, setnaprod; tier_source admin_comp; no order or payment names them),
-- the badge-reward gift stock, and every other event. Idempotent: a second run finds nothing to do.
-- NEVER RUN BY HAND — it reaches prod only through merge → deploy-prod db push.

BEGIN;

DO $purge$
DECLARE
  c_reason CONSTANT TEXT := 'Owner 16 Nov 2026: test purchases deleted; cale-ice keeps what they unlocked';
  v_cale       UUID;
  v_host       UUID;
  v_sum_before BIGINT;
  v_ai_before  BOOLEAN;
  v_sum_after  BIGINT;
  v_ai_after   BOOLEAN;
  v_value      BIGINT;
  v_left       BIGINT;
BEGIN
  -- ── 0 · cale-ice, before anything moves ──────────────────────────────────────
  SELECT e.event_id INTO v_cale FROM public.events e WHERE e.slug = 'cale-ice';
  IF v_cale IS NOT NULL THEN
    SELECT COALESCE(sum(g.points), 0) INTO v_sum_before
      FROM public.papic_event_point_grants g WHERE g.event_id = v_cale;
    SELECT e.setnayan_ai_active INTO v_ai_before FROM public.events e WHERE e.event_id = v_cale;

    -- The host: whoever paid cale-ice's orders, else its internal couple member. A join, never a typed id.
    SELECT o.user_id INTO v_host
      FROM public.orders o
     WHERE o.event_id = v_cale AND o.status = 'paid' AND o.user_id IS NOT NULL
     ORDER BY (o.service_key = 'SETNAYAN_AI') DESC, o.created_at
     LIMIT 1;
    IF v_host IS NULL THEN
      SELECT m.user_id INTO v_host
        FROM public.event_members m JOIN public.users u ON u.user_id = m.user_id
       WHERE m.event_id = v_cale AND m.member_type::text = 'couple' AND u.is_internal
       ORDER BY m.joined_at NULLS LAST, m.user_id
       LIMIT 1;
    END IF;

    -- ── 1 · the comp grant that replaces the paid orders ──────────────────────
    IF NOT EXISTS (SELECT 1 FROM public.comp_grants cg WHERE cg.event_id = v_cale AND cg.reason = c_reason) THEN
      SELECT COALESCE(sum(round(COALESCE(o.confirmed_total_php, o.requested_total_php) * 100)), 0)::BIGINT
        INTO v_value
        FROM public.orders o WHERE o.event_id = v_cale AND o.status = 'paid';
      INSERT INTO public.comp_grants
        (source, scope, scoped_skus, event_id, user_id, granted_by, created_by_user_id,
         reason, rationale, retail_value_centavos)
      SELECT 'owner_internal', 'specific_skus',
             COALESCE(
               (SELECT array_agg(DISTINCT o.service_key ORDER BY o.service_key)
                  FROM public.orders o WHERE o.event_id = v_cale AND o.status = 'paid'),
               ARRAY['SETNAYAN_AI', 'PAPIC_GUEST_100K', 'PAPIC_GUEST_100']),
             v_cale, v_host, v_host, v_host,
             c_reason,
             'Every purchase on Setnayan so far was a test (owner 16 Nov 2026, DECISION_LOG 8983dc52). The records '
             || 'are deleted; the founders'' wedding keeps what its paid orders unlocked.',
             LEAST(v_value, 2147483647)::INTEGER;
    END IF;

    -- ── 2 · cale-ice's bought Papic credits become comp credits, points unchanged ─
    UPDATE public.papic_event_point_grants g
       SET source   = 'comp',
           note     = concat_ws(' · ', NULLIF(g.note, ''),
                        'Re-granted as comp (owner 16 Nov 2026) when test purchase ' || o.public_id || ' was deleted'),
           order_id = NULL
      FROM public.orders o
     WHERE g.order_id = o.order_id
       AND g.event_id = v_cale;
  END IF;

  -- ── 3 · RESTRICT children of orders ──────────────────────────────────────────
  DELETE FROM public.order_refunds;
  DELETE FROM public.order_service_remedies;

  -- ── 4 · every other Papic credit line an order bought ───────────────────────
  DELETE FROM public.papic_event_point_grants WHERE order_id IS NOT NULL;

  -- ── 5 · supplier Papic portfolio credits bought by an order or a fee bill ────
  DELETE FROM public.vendor_papic_portfolio_credit_grants
   WHERE order_id IS NOT NULL OR booking_fee_charge_id IS NOT NULL;

  -- ── 6 · purchase notices ─────────────────────────────────────────────────────
  DELETE FROM public.notifications n
   WHERE COALESCE(n.related_url, '') ~ '/orders/[0-9a-f-]{36}'
      OR COALESCE(n.related_url, '') ~ '/booking-fees/[0-9a-f-]{36}'
      OR COALESCE(n.related_url, '') ~ '^/admin/payments'
      OR concat_ws(' ', n.title, n.body) ~ 'S89O-[0-9A-Z]{10}';

  -- ── 11 (decided here, applied below) · test events whose AI came only from a purchase ─
  CREATE TEMP TABLE _ai_off ON COMMIT DROP AS
  SELECT e.event_id
    FROM public.events e
   WHERE e.setnayan_ai_active
     AND e.event_id IS DISTINCT FROM v_cale
     AND (   EXISTS (SELECT 1 FROM public.orders o
                      WHERE o.event_id = e.event_id AND o.service_key = 'SETNAYAN_AI')
          OR EXISTS (SELECT 1 FROM public.app_store_purchases a
                      WHERE a.event_id = e.event_id AND a.service_key = 'SETNAYAN_AI'))
     AND NOT EXISTS (SELECT 1 FROM public.comp_grants cg
                      WHERE cg.event_id = e.event_id AND cg.revoked_at IS NULL
                        AND (cg.scope = 'all_services' OR 'SETNAYAN_AI' = ANY (cg.scoped_skus)))
     AND NOT EXISTS (SELECT 1 FROM public.event_members m JOIN public.users u ON u.user_id = m.user_id
                      WHERE m.event_id = e.event_id AND m.member_type::text = 'couple' AND u.is_internal);

  -- ── 7 · App Store purchases ──────────────────────────────────────────────────
  DELETE FROM public.app_store_purchases;

  -- ── 8 · orders (and everything that cascades), then any payment left ─────────
  DELETE FROM public.orders;
  DELETE FROM public.payments;

  -- ── 9 · booking-fee bills ────────────────────────────────────────────────────
  DELETE FROM public.booking_fee_charges;

  -- ── 10 · booking-fee ledger ──────────────────────────────────────────────────
  DELETE FROM public.booking_fee_ledger;

  -- ── 11 · test events' AI switch ──────────────────────────────────────────────
  UPDATE public.events e SET setnayan_ai_active = FALSE
   WHERE e.event_id IN (SELECT event_id FROM _ai_off);

  -- ── the refusals: a mistake rolls everything back instead of landing ────────
  IF v_cale IS NOT NULL THEN
    SELECT COALESCE(sum(g.points), 0) INTO v_sum_after
      FROM public.papic_event_point_grants g WHERE g.event_id = v_cale;
    SELECT e.setnayan_ai_active INTO v_ai_after FROM public.events e WHERE e.event_id = v_cale;
    IF v_sum_after IS DISTINCT FROM v_sum_before THEN
      RAISE EXCEPTION 'test-purchase delete refused: cale-ice Papic credits moved % -> %', v_sum_before, v_sum_after;
    END IF;
    IF v_ai_after IS DISTINCT FROM v_ai_before THEN
      RAISE EXCEPTION 'test-purchase delete refused: cale-ice Setnayan AI moved % -> %', v_ai_before, v_ai_after;
    END IF;
  END IF;

  SELECT (SELECT count(*) FROM public.orders)
       + (SELECT count(*) FROM public.payments)
       + (SELECT count(*) FROM public.booking_fee_charges)
    INTO v_left;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'test-purchase delete refused: % order/payment/fee-bill rows remain', v_left;
  END IF;
END
$purge$;

COMMIT;
