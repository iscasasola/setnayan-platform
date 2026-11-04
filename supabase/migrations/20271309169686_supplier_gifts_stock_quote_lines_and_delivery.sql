-- supplier_gifts_stock_quote_lines_and_delivery
-- ============================================================================
-- SUPPLIER GIFTS · SLICE 1 — Papic gifts, end to end (owner, 2026-11-04).
--
-- ⚖ DECISION_LOG 2026-11-04 (newest wins on a conflict):
--   · "SUPPLIER GIFTS: BOUGHT IN QUANTITY, KEPT AS STOCK, OFFERED ONLY ON SERVICE
--     CARDS AND QUOTES, AND ONLY WHILE IN STOCK" — Your gifts = stock (Papic
--     credits as a credit balance), what is promised on sent quotes, a Bought
--     list; Buy asks which gift and how many; out of stock = cannot be offered;
--     (4) "Gifts leave the stock when that couple's first payment clears."
--   · "GIFT PRICES" — a Verified-and-up shop pays `gift_price_php`, Free pays the
--     list price (the column + `vendor_pays_gift_price` are #7262's; this file
--     only READS them, at purchase time, in the app).
--   · "A SUPPLIER'S GIFTS ON ONE BOOKING ARE CAPPED AT 40% OF THAT BOOKING'S FEE
--     … PAPIC 150 IS ALWAYS ALLOWED" — enforced where the quote is written
--     (lib/shop-gifts.ts, reusing GIFT_SHARE_OF_FEE_PCT); not re-typed here.
--
-- FOUR parts, all Papic-only in this slice (Event Plus / Event Pro gifts are the
-- next slice — the kind CHECKs below say 'papic' and nothing else, on purpose):
--   1. `shop_gift_purchases` — what one gift ORDER bought (pack, how many, the
--      unit price and whether it was the gift or the list price). `orders` has
--      no quantity, so this row is what approval reads. Written by the buy
--      action, before payment.
--   2. `shop_gift_stock_entries` — the shop's gift STOCK: an append-only, SIGNED
--      ledger (credits). A paid purchase lands as +; a gift given to an event
--      leaves as −; a refunded purchase is taken back as a − reversal. Stock =
--      SUM(delta). Kept apart from `shop_papic_wallet_entries` on purpose: the
--      wallet is the shop's OWN credits (portfolio, its own capture); gift stock
--      can only ever reach a couple's event (28 Oct ruling: the shop's own
--      credits are not for gifting).
--   3. `vendor_proposal_shop_gifts` — the gift LINES on a quote: one row per
--      pack the supplier added (its credits and its price-couples-pay frozen at
--      send). Sent quotes HOLD stock; nothing leaves it until the first payment.
--   4. `shop_gift_deliver_for_booking(event_vendor_id)` — the ONE door a gift
--      takes out of stock and into the couple's event. Called by
--      lib/deposit-acknowledged-effects.server.ts (every door that clears the
--      couple's first payment). It gives only what that event has NOT already
--      received from that shop, so an updated quote, a re-run or a repair sweep
--      can never give twice; it refuses (writes nothing) when stock is short.
--      The credits land in `papic_event_point_grants` as a SHARED grant
--      (seat_id NULL, source 'shop_gift') — exactly where a couple's own pack
--      lands, so every Papic screen counts it with no change.
--
-- KEEP IDEMPOTENT: IF NOT EXISTS / IF EXISTS / CREATE OR REPLACE everywhere.
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 1 · what a gift order bought ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_gift_purchases (
  order_id          UUID PRIMARY KEY
                      REFERENCES public.orders(order_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The couple product gifted (a `platform_retail_catalog_v2.service_code`).
  service_code      TEXT NOT NULL
                      CONSTRAINT shop_gift_purchases_service_code_shape
                      CHECK (length(btrim(service_code)) > 0),
  gift_kind         TEXT NOT NULL
                      CONSTRAINT shop_gift_purchases_gift_kind_allowed
                      CHECK (gift_kind IN ('papic')),
  quantity          INTEGER NOT NULL
                      CONSTRAINT shop_gift_purchases_quantity_positive
                      CHECK (quantity > 0 AND quantity <= 100),
  -- Papic credits ONE pack adds to stock (`papic_pass_tiers.points` at purchase).
  credits_each      INTEGER NOT NULL
                      CONSTRAINT shop_gift_purchases_credits_each_positive
                      CHECK (credits_each > 0),
  -- What the shop paid for ONE pack, read from the catalogue at purchase.
  unit_price_php    NUMERIC(12,2) NOT NULL
                      CONSTRAINT shop_gift_purchases_unit_price_positive
                      CHECK (unit_price_php > 0),
  -- 'gift' = Verified-and-up paid gift_price_php; 'list' = Free paid retail_price_php.
  price_basis       TEXT NOT NULL
                      CONSTRAINT shop_gift_purchases_price_basis_allowed
                      CHECK (price_basis IN ('gift', 'list')),
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_gift_purchases_shop_idx
  ON public.shop_gift_purchases (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.shop_gift_purchases IS
  'One supplier gift ORDER (owner 2026-11-04 "Buy asks which gift and how many"): '
  'the pack, how many, the unit price read from the catalogue, and whether it was the '
  'gift price (Verified-and-up) or the list price (Free). orders has no quantity, so '
  'approval (lib/sku-activation.ts, vendor_gift__<code>) reads this row to land the '
  'credits in shop_gift_stock_entries. Written only by the buy action.';

ALTER TABLE public.shop_gift_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_gift_purchases_vendor_read ON public.shop_gift_purchases;
CREATE POLICY shop_gift_purchases_vendor_read
  ON public.shop_gift_purchases
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.shop_gift_purchases FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_gift_purchases FROM authenticated;

-- ── 2 · the gift stock ledger ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_gift_stock_entries (
  entry_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  gift_kind         TEXT NOT NULL
                      CONSTRAINT shop_gift_stock_entries_gift_kind_allowed
                      CHECK (gift_kind IN ('papic')),
  delta             INTEGER NOT NULL
                      CONSTRAINT shop_gift_stock_entries_delta_nonzero
                      CHECK (delta <> 0),
  -- No DEFAULT on purpose: a default is a write nobody made.
  kind              TEXT NOT NULL
                      CONSTRAINT shop_gift_stock_entries_kind_allowed
                      CHECK (kind IN ('bought', 'given', 'reversal')),
  -- What came in comes in; what went out goes out.
  CONSTRAINT shop_gift_stock_entries_sign_matches_kind CHECK (
    (kind = 'bought' AND delta > 0)
    OR (kind IN ('given', 'reversal') AND delta < 0)
  ),
  -- A purchase row names its order and a gift names its event — by the writers,
  -- NOT by a CHECK: both references are ON DELETE SET NULL, and a CHECK on them
  -- would refuse an event's or account's erasure.
  order_id         UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  event_id          UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  proposal_id       UUID REFERENCES public.vendor_proposals(proposal_id) ON DELETE SET NULL,
  -- The shared pool row this gift became (kind 'given'): the admin ledger's
  -- "landed" proof, and what a later return would take back.
  pool_grant_id     UUID REFERENCES public.papic_event_point_grants(grant_id) ON DELETE SET NULL,
  note              TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_gift_stock_entries_shop_idx
  ON public.shop_gift_stock_entries (vendor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shop_gift_stock_entries_event_idx
  ON public.shop_gift_stock_entries (event_id)
  WHERE event_id IS NOT NULL;

-- One bought (or reversal) row per (order, kind): a re-approved order cannot
-- land twice and a re-run refund cannot take it back twice.
CREATE UNIQUE INDEX IF NOT EXISTS shop_gift_stock_entries_order_kind_unique
  ON public.shop_gift_stock_entries (order_id, kind)
  WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.shop_gift_stock_entries IS
  'A supplier''s GIFT STOCK (owner 2026-11-04): one signed, append-only ledger of '
  'Papic credits per shop. bought (+, a paid shop_gift_purchases order) · given (−, '
  'into a couple''s event when their first payment clears, through '
  'shop_gift_deliver_for_booking) · reversal (−, a refunded purchase). Stock = '
  'SUM(delta). Separate from shop_papic_wallet_entries: gift stock only ever reaches '
  'a couple''s event.';

ALTER TABLE public.shop_gift_stock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_gift_stock_entries_vendor_read ON public.shop_gift_stock_entries;
CREATE POLICY shop_gift_stock_entries_vendor_read
  ON public.shop_gift_stock_entries
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.shop_gift_stock_entries FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_gift_stock_entries FROM authenticated;

-- ── 3 · the gift lines on a quote ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_proposal_shop_gifts (
  gift_line_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID NOT NULL
                      REFERENCES public.vendor_proposals(proposal_id) ON DELETE CASCADE,
  -- The quote's shop, kept on the line so the supplier's read needs no join.
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  service_code      TEXT NOT NULL
                      CONSTRAINT vendor_proposal_shop_gifts_service_code_shape
                      CHECK (length(btrim(service_code)) > 0),
  gift_kind         TEXT NOT NULL
                      CONSTRAINT vendor_proposal_shop_gifts_gift_kind_allowed
                      CHECK (gift_kind IN ('papic')),
  -- Papic credits this line gives (the pack's points when the quote was sent).
  credits           INTEGER NOT NULL
                      CONSTRAINT vendor_proposal_shop_gifts_credits_positive
                      CHECK (credits > 0),
  -- The price couples pay for this pack when the quote was sent — what the 40%
  -- limit was measured in. Frozen so a later reprice cannot move a sent quote.
  srp_php           NUMERIC(12,2) NOT NULL
                      CONSTRAINT vendor_proposal_shop_gifts_srp_positive
                      CHECK (srp_php > 0),
  title             TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_proposal_shop_gifts_proposal_idx
  ON public.vendor_proposal_shop_gifts (proposal_id);
CREATE INDEX IF NOT EXISTS vendor_proposal_shop_gifts_shop_idx
  ON public.vendor_proposal_shop_gifts (vendor_profile_id);

COMMENT ON TABLE public.vendor_proposal_shop_gifts IS
  'The supplier''s own gifts on a quote (owner 2026-11-04: "gifts can only be added on '
  'service cards and quotes"): one row per Papic pack added, its credits and its '
  'price-couples-pay frozen at send. A live quote HOLDS stock; the credits leave the '
  'stock and reach the event only when the couple''s first payment clears '
  '(shop_gift_deliver_for_booking). Written only by the server at send.';

ALTER TABLE public.vendor_proposal_shop_gifts ENABLE ROW LEVEL SECURITY;

-- The shop reads its own lines; whoever may read the QUOTE reads its lines (the
-- subquery runs under the caller's own vendor_proposals policies — couple,
-- moderators, the shop); admin reads all. No write policy.
DROP POLICY IF EXISTS vendor_proposal_shop_gifts_read ON public.vendor_proposal_shop_gifts;
CREATE POLICY vendor_proposal_shop_gifts_read
  ON public.vendor_proposal_shop_gifts
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR proposal_id IN (SELECT p.proposal_id FROM public.vendor_proposals p)
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.vendor_proposal_shop_gifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_proposal_shop_gifts FROM authenticated;

-- ── 4 · a gift is its own pool source ────────────────────────────────────────
-- Copied from 20271308555594_the_final_price_sheet.sql; the ONLY change is
-- 'shop_gift' at the end.
ALTER TABLE public.papic_event_point_grants
  DROP CONSTRAINT IF EXISTS papic_event_point_grants_source_check;
ALTER TABLE public.papic_event_point_grants
  ADD CONSTRAINT papic_event_point_grants_source_check
  CHECK (source IN ('admin','topup_order','comp','migration','free_grant','camera_grant','plan_included','shop_gift'));

-- ── 5 · the stock, as numbers ────────────────────────────────────────────────
-- balance = SUM(delta). held = what live quotes promise and the event has not
-- received yet: per quote, its lines' credits minus what that shop already gave
-- that event, never below zero. A live quote is accepted, or sent/viewed and
-- still within its "good until" day (PH). `p_except_event` leaves one event out
-- — a new quote replaces every live quote of that shop for that event
-- (supersede_prior_vendor_proposals), so its old hold must not block the new one.
-- SECURITY INVOKER: RLS decides what the caller can count; the app asks about
-- the caller's own shop, or uses the service role after its own gate.
CREATE OR REPLACE FUNCTION public.shop_gift_stock_status(
  p_vendor_profile_id UUID,
  p_except_event_id   UUID DEFAULT NULL
)
 RETURNS TABLE (gift_kind TEXT, balance INTEGER, held INTEGER)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH live AS (
    SELECT p.proposal_id, p.event_id
      FROM public.vendor_proposals p
     WHERE p.vendor_profile_id = p_vendor_profile_id
       AND p.event_id IS NOT NULL
       AND (p_except_event_id IS NULL OR p.event_id <> p_except_event_id)
       AND (
         p.status = 'accepted'
         OR (p.status IN ('sent', 'viewed')
             AND (p.valid_until IS NULL
                  OR p.valid_until >= (NOW() AT TIME ZONE 'Asia/Manila')::date))
       )
  ),
  promised AS (
    SELECT l.event_id, l.proposal_id, SUM(g.credits)::INTEGER AS credits
      FROM live l
      JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = l.proposal_id
     WHERE g.gift_kind = 'papic'
     GROUP BY l.event_id, l.proposal_id
  ),
  given AS (
    SELECT e.event_id, (-SUM(e.delta))::INTEGER AS credits
      FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = p_vendor_profile_id
       AND e.gift_kind = 'papic'
       AND e.kind = 'given'
       AND e.event_id IS NOT NULL
     GROUP BY e.event_id
  )
  SELECT 'papic'::TEXT,
         COALESCE((SELECT SUM(e.delta) FROM public.shop_gift_stock_entries e
                    WHERE e.vendor_profile_id = p_vendor_profile_id
                      AND e.gift_kind = 'papic'), 0)::INTEGER,
         COALESCE((SELECT SUM(GREATEST(0, pr.credits - COALESCE(gv.credits, 0)))
                     FROM promised pr
                     LEFT JOIN given gv ON gv.event_id = pr.event_id), 0)::INTEGER;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_stock_status(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.shop_gift_stock_status(UUID, UUID) IS
  'A shop''s gift stock: balance (SUM of shop_gift_stock_entries) and held (what live '
  'quotes promise that the event has not received yet). Free to offer = balance − held. '
  'p_except_event_id leaves out the event a new quote is replacing.';

-- ── 6 · the ONE door a gift takes to the couple ──────────────────────────────
-- Returns jsonb:
--   {status:'ok',         credits, entry_id, grant_id}  — given now
--   {status:'already',    credits}                      — the event already has it
--   {status:'short',      wanted, balance}              — not enough stock; nothing written
--   {status:'no_gift'} · {status:'no_accepted_quote'} · {status:'not_paid'} · {status:'no_booking'}
-- Gives (accepted quote's credits − what this shop already gave this event),
-- under a per-shop lock, so two doors clearing one payment at once give once.
CREATE OR REPLACE FUNCTION public.shop_gift_deliver_for_booking(p_event_vendor_id UUID)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event    UUID;
  v_shop     UUID;
  v_ack      TIMESTAMPTZ;
  v_proposal UUID;
  v_wanted   INTEGER;
  v_given    INTEGER;
  v_delta    INTEGER;
  v_balance  INTEGER;
  v_name     TEXT;
  v_grant    UUID;
  v_entry    UUID;
BEGIN
  IF p_event_vendor_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;

  SELECT ev.event_id, ev.marketplace_vendor_id, ev.deposit_acknowledged_at
    INTO v_event, v_shop, v_ack
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF NOT FOUND OR v_event IS NULL OR v_shop IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;
  -- "Gifts leave the stock when that couple's first payment clears."
  IF v_ack IS NULL THEN
    RETURN jsonb_build_object('status', 'not_paid');
  END IF;

  SELECT p.proposal_id INTO v_proposal
    FROM public.vendor_proposals p
   WHERE p.event_id = v_event
     AND p.vendor_profile_id = v_shop
     AND p.status = 'accepted'
   ORDER BY p.resolved_at DESC NULLS LAST, p.created_at DESC
   LIMIT 1;
  IF v_proposal IS NULL THEN
    RETURN jsonb_build_object('status', 'no_accepted_quote');
  END IF;

  SELECT COALESCE(SUM(g.credits), 0)::INTEGER INTO v_wanted
    FROM public.vendor_proposal_shop_gifts g
   WHERE g.proposal_id = v_proposal
     AND g.gift_kind = 'papic';
  IF v_wanted <= 0 THEN
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_gift_stock:' || v_shop::text, 0));

  SELECT COALESCE(-SUM(e.delta), 0)::INTEGER INTO v_given
    FROM public.shop_gift_stock_entries e
   WHERE e.vendor_profile_id = v_shop
     AND e.event_id = v_event
     AND e.gift_kind = 'papic'
     AND e.kind = 'given';
  v_delta := v_wanted - v_given;
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object('status', 'already', 'credits', v_given);
  END IF;

  SELECT COALESCE(SUM(e.delta), 0)::INTEGER INTO v_balance
    FROM public.shop_gift_stock_entries e
   WHERE e.vendor_profile_id = v_shop
     AND e.gift_kind = 'papic';
  IF v_balance < v_delta THEN
    RETURN jsonb_build_object('status', 'short', 'wanted', v_delta, 'balance', v_balance);
  END IF;

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;

  -- SHARED (seat_id NULL): the couple's pool, counted by papic_event_pool_status
  -- like a pack they bought themselves.
  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (v_event, v_delta, 'shop_gift',
          'Gift from ' || COALESCE(NULLIF(btrim(v_name), ''), 'your supplier') || ' · Papic credits')
  RETURNING grant_id INTO v_grant;

  INSERT INTO public.shop_gift_stock_entries
    (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id, pool_grant_id, note)
  VALUES
    (v_shop, 'papic', -v_delta, 'given', v_event, v_proposal, v_grant,
     'Given when the couple''s first payment cleared')
  RETURNING entry_id INTO v_entry;

  RETURN jsonb_build_object('status', 'ok', 'credits', v_delta,
                            'entry_id', v_entry, 'grant_id', v_grant);
END;
$function$;

COMMENT ON FUNCTION public.shop_gift_deliver_for_booking(UUID) IS
  'The only door a supplier gift takes into a couple''s event (owner 2026-11-04: gifts '
  'leave the stock when the couple''s first payment clears). Reads the booking''s '
  'accepted quote, gives what that event has not already received from that shop into '
  'the SHARED Papic pool (source shop_gift), under a per-shop lock; refuses and writes '
  'nothing when stock is short. Idempotent. Service-role only.';

REVOKE ALL ON FUNCTION public.shop_gift_deliver_for_booking(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_deliver_for_booking(UUID) TO service_role;

COMMIT;
