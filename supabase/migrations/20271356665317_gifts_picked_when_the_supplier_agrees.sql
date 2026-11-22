-- gifts_picked_when_the_supplier_agrees
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ═══════════════════════════════════════════════════════════════════════════
-- GIFT FOR SERVICES — THE SUPPLIER PICKS THE COUPLE'S GIFT WHEN THEY AGREE
--
-- Owner rulings, DECISION_LOG 2026-11-15 ("GIFT FOR SERVICES DESIGN — DECISIONS",
-- setnayan_gift_services_2026-11-14_fable), on top of the 14 Nov gift rows:
--   • when a supplier agrees to a booking they may pick gifts for the couple's event — Papic packs,
--     Event Plus, Event Pro, Event Ultra; a plan gift and Papic may be combined;
--   • everything picked together is capped at the gift limit (platform_settings.gift_limit_pct, 40 by
--     default) of THAT booking's fee, counted at the price couples pay (the LIST price — "one price
--     per gift", 14 Nov); Event Ultra counts at its list price;
--   • the smallest Papic pack ("Papic 150") is always allowed;
--   • STOCK FIRST: a pick the shop already holds in its gift stock costs nothing more, but still counts
--     toward the limit; anything else is BOUGHT at list price on the supplier's booking-fee bill;
--   • a bought gift reaches the couple when that bill (fee + gift) is paid; a stock gift lands at the
--     couple's first payment, as stock gifts always have;
--   • the old automatic "N free Papic photos" gift RETIRES for new bookings — a gift already on a bill
--     or already given stays exactly as it is.
--
-- ⚖ SUPERSEDED IN PART — what this migration now builds (owner 2026-11-16 → 21 Nov, DECISION_LOG):
--   • ee10c425 (16 Nov): gifts are ALWAYS bought as stock first, NEVER on a booking-fee bill — so nothing here
--     touches a bill: no bought line, no bill clause, no re-priced order. A bill that already carries a gift
--     keeps it, untouched (a stored money row is never rewritten).
--   • 20 Nov "EVERY BOOKING CARRIES AT LEAST ONE SETNAYAN GIFT — NO EXCEPTIONS": found, imported, free-fee and
--     paid-fee bookings alike. The pick refuses ZERO gifts (`none`), and a booking with no fee still takes a gift
--     (the smallest Papic pack alone always fits) — there is no `no_fee` refusal any more.
--   • 21 Nov "OUT OF GIFTS STILL MEANS THEY CAN BUY" + "JUMP TO THE BUY PAGE, THEN BACK": a gift the shop has none
--     of is bought in the "Your gifts" store (its own bill, #7923) and the supplier comes back to Agree.
--   • 21 Nov "A GIFT BOUGHT BY BDO COUNTS ONCE THE PAYMENT IS SENT": a store order line whose payment was SENT
--     ("Waiting for approval") covers ONE pick (gift_order_line_id, one live pick per line); it becomes a stock
--     hold when the admin approves (stock lands), and the pick is CLEARED (cleared_at) if that payment is refused
--     or refunded — the booking then reads "Needs at least 1 gift. Buy one ›".
--
-- RULE 0 — WHAT THIS REUSES:
--   • stock: the shop gift ledger (`shop_gift_stock_entries`), its two status readers and its two
--     delivery doors. An agree-time stock pick is one more HOLD, given by the same doors.
--   • buying: the "Your gifts" store (#7923) — its order (`vendor_gift__GIFT_CART`), its lines
--     (`shop_gift_order_lines`), its approval (`shop_gift_grant_order_lines`). Nothing new is billed here.
--   • telling the supplier: the shipped `payment_rejected` / `payment_refunded` notifications.
--
-- ADD / LOOSEN ONLY: one new table (RLS at CREATE), six new functions (the pick, the smallest-pack reader, the
-- sent-order reader, the store-order follower and its two trigger bodies), two triggers, and five functions re-created from their latest
-- bodies with additions (named at each).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · one row per gift picked at the yes ──────────────────────────────────
BEGIN;

-- A busy table: wait at most 5 s for its lock, then fail and let the pipeline retry, never queue every query behind it.
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.booking_gift_lines (
  line_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_vendor_id   UUID NOT NULL
                      REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- 🎁 A pick covered by a gift-store order line whose payment was SENT, not yet approved (owner 21 Nov). NULL for
  -- a pick taken from stock at the yes. Kept after the stock lands (the line is then a stock hold, from_stock).
  gift_order_line_id UUID
                      REFERENCES public.shop_gift_order_lines(line_id) ON DELETE SET NULL,
  service_code      TEXT NOT NULL
                      CONSTRAINT booking_gift_lines_service_code_shape
                      CHECK (length(btrim(service_code)) > 0),
  gift_kind         TEXT NOT NULL
                      CONSTRAINT booking_gift_lines_gift_kind_allowed
                      CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro', 'event_ultra')),
  -- Papic credits in ONE pack, or 1 for a plan.
  credits           INTEGER NOT NULL
                      CONSTRAINT booking_gift_lines_credits_positive CHECK (credits > 0),
  -- The list price couples pay, read from the catalogue at the yes and frozen.
  price_centavos    BIGINT NOT NULL
                      CONSTRAINT booking_gift_lines_price_positive CHECK (price_centavos > 0),
  title             TEXT NOT NULL,
  from_stock        BOOLEAN NOT NULL,
  -- Set when the store payment that covered this pick was refused or refunded before the gift reached the couple.
  -- A cleared line holds nothing and gives nothing; the booking needs a gift again.
  cleared_at        TIMESTAMPTZ,
  cleared_reason    TEXT
                      CONSTRAINT booking_gift_lines_cleared_reason_allowed
                      CHECK (cleared_reason IS NULL OR cleared_reason IN ('refused', 'refunded')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Never bought on a booking-fee bill (16 Nov ee10c425): from stock, or covered by a SENT store order line.
  CONSTRAINT booking_gift_lines_stock_or_sent CHECK (from_stock OR gift_order_line_id IS NOT NULL),
  CONSTRAINT booking_gift_lines_cleared_has_reason CHECK ((cleared_at IS NULL) = (cleared_reason IS NULL)),
  CONSTRAINT booking_gift_lines_plan_is_one CHECK (gift_kind = 'papic' OR credits = 1)
);

CREATE INDEX IF NOT EXISTS booking_gift_lines_booking_idx
  ON public.booking_gift_lines (event_vendor_id);
-- One store order line covers ONE live pick, never two (controller 21 Nov, guard 4).
CREATE UNIQUE INDEX IF NOT EXISTS booking_gift_lines_one_pick_per_order_line
  ON public.booking_gift_lines (gift_order_line_id)
  WHERE gift_order_line_id IS NOT NULL AND cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS booking_gift_lines_shop_idx
  ON public.booking_gift_lines (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.booking_gift_lines IS
  'The gifts a supplier picked for the couple''s event when they agreed to the booking (owner 2026-11-15, gift for '
  'services; every booking carries at least one — 20 Nov). One row per Papic pack or plan, its list price frozen at '
  'the yes. from_stock = held from the shop''s gift stock until the couple''s first payment, then given by the shop '
  'gift doors. Otherwise covered by a gift-store order line whose payment was sent (gift_order_line_id); it becomes a '
  'stock hold when that payment is approved, and is cleared (cleared_at) if it is refused or refunded. Never on a '
  'booking-fee bill. Written only by booking_gift_pick and the two triggers below.';

ALTER TABLE public.booking_gift_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_gift_lines_read ON public.booking_gift_lines;
CREATE POLICY booking_gift_lines_read
  ON public.booking_gift_lines
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    -- Hosts only (the couple), never a coordinator or delegate: a line carries what the supplier paid for the gift
    -- (price_centavos), and a masked coordinator reads no amount by any route
    -- (tests/db/a-masked-coordinator-reads-no-amount-by-any-route.db.test.ts).
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.booking_gift_lines FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.booking_gift_lines FROM authenticated;

-- ── 2 · the photo gift retires for a new charge ────────────────────────────
-- Re-created from 20271308555594 (still its latest body). ADDED ONLY: a NEW charge is never offered the retired
-- photo gift (setnayan_gift_offered := FALSE on INSERT); a charge already offered keeps its snapshot, so a bill
-- already raised is untouched. Gifts picked at the yes never reach a bill (16 Nov ee10c425). Everything else is the
-- old body.
CREATE OR REPLACE FUNCTION public.booking_fee_charges_size_the_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift  RECORD;
  v_stamp RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 🎁 RETIRED 2026-11-15 ("the old N free Papic photos gift retires; gifts already given stay").
    NEW.setnayan_gift_offered = FALSE;
  ELSE
    NEW.setnayan_gift_offered = OLD.setnayan_gift_offered;
  END IF;

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

  IF NEW.status = 'pending'
     AND NEW.setnayan_gift_offered
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN
    IF NEW.event_vendor_id IS NOT NULL THEN
      SELECT ev.setnayan_gift_locked_at,
             ev.setnayan_gift_credits_at_lock,
             ev.setnayan_gift_centavos_at_lock
        INTO v_stamp
        FROM public.event_vendors ev
       WHERE ev.vendor_id = NEW.event_vendor_id;
      IF v_stamp.setnayan_gift_locked_at IS NOT NULL
         AND COALESCE(v_stamp.setnayan_gift_credits_at_lock, 0) > 0 THEN
        NEW.gift_credits  := v_stamp.setnayan_gift_credits_at_lock;
        NEW.gift_centavos := COALESCE(v_stamp.setnayan_gift_centavos_at_lock, 0);
        RETURN NEW;
      END IF;
    END IF;
    SELECT g.credits, g.charge_centavos INTO v_gift
      FROM public.setnayan_gift_for_fee(NEW.amount_charged_centavos, NEW.vendor_profile_id) g;
    NEW.gift_credits  := COALESCE(v_gift.credits, 0);
    NEW.gift_centavos := COALESCE(v_gift.charge_centavos, 0);
    RETURN NEW;
  END IF;

  NEW.gift_credits  := 0;
  NEW.gift_centavos := 0;
  RETURN NEW;
END;
$$;

-- The smallest Papic pack on sale — the one that "always fits" under the gift limit (owner rule) — derived from the
-- live catalogue, never typed. Moved here unchanged from the unapplied 20271346218077: #7678's re-allocated bundles
-- migration (20271351048946) no longer needs it, so this booking door, its only caller, now carries it.
CREATE OR REPLACE FUNCTION public.shop_gift_smallest_papic_pack()
 RETURNS TABLE (service_code TEXT, points INTEGER)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT c.service_code, t.points::INTEGER
    FROM public.platform_retail_catalog_v2 c
    JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
   WHERE left(c.service_code, 11) = 'PAPIC_GUEST'
     AND c.is_active IS TRUE
     AND c.retired_at IS NULL
     AND c.retail_price_php > 0
     AND t.points > 0
   ORDER BY t.points ASC, c.service_code ASC
   LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.shop_gift_smallest_papic_pack() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_smallest_papic_pack() TO service_role;

-- ── 3 · what a SENT store order still covers ─────────────────────────────────
-- ONE definition of "bought, payment sent, waiting for approval, not picked yet" (21 Nov, controller), read by the pick
-- below and by the Agree step (`fetchAgreeGiftBasis`): this shop's "Your gifts" store line (#7923) whose order is still
-- open, whose payment is PENDING and carries a bank reference or a screenshot (what the store's history calls "Waiting
-- for approval"), whose stock has not landed or been reversed, and which no live pick already names.
CREATE OR REPLACE FUNCTION public.shop_gift_sent_order_lines(p_vendor_profile_id UUID)
RETURNS TABLE (line_id UUID, service_code TEXT, line_no SMALLINT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ol.line_id, ol.service_code, ol.line_no, ol.created_at
    FROM public.shop_gift_order_lines ol
    JOIN public.orders o ON o.order_id = ol.order_id
   WHERE ol.vendor_profile_id = p_vendor_profile_id
     AND o.status NOT IN ('cancelled', 'refunded', 'lapsed', 'paid', 'fulfilled')
     AND EXISTS (SELECT 1 FROM public.payments p
                  WHERE p.order_id = o.order_id
                    AND p.status = 'pending'
                    AND (btrim(COALESCE(p.reference_number, '')) <> ''
                         OR btrim(COALESCE(p.screenshot_url, '')) <> ''))
     AND NOT EXISTS (SELECT 1 FROM public.shop_gift_stock_entries e
                      WHERE e.order_id = o.order_id
                        AND e.kind IN ('bought', 'reversal'))
     AND NOT EXISTS (SELECT 1 FROM public.booking_gift_lines b
                      WHERE b.gift_order_line_id = ol.line_id AND b.cleared_at IS NULL);
$function$;
REVOKE ALL ON FUNCTION public.shop_gift_sent_order_lines(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_sent_order_lines(UUID) TO service_role;

-- ── 3b · the pick — judged here, whatever the screen drew ───────────────────
-- p_codes: one entry per pack / plan (two Papic 1000 ⇒ the code twice). p_event_has: what the couple's event already
-- holds (none|plus|pro|ultra), from the app's entitlement chain. p_dry_run: judge only, write nothing — what the yes
-- asks BEFORE it books, so Agree is refused with nothing booked (20 Nov: every booking carries ≥1 gift). Picks are
-- made once per booking (a live pick answers 'already'); a booking whose pick was CLEARED (its store payment refused
-- or refunded) picks again. Nothing is written on any refusal.
--
-- Where each line comes from, in order: the shop's free STOCK, then a gift-store order line whose payment was SENT
-- and is not approved yet ("Waiting for approval" — one order line covers one pick). A line with neither answers
-- 'needs_stock' with its codes: the supplier buys it in the "Your gifts" store and comes back (owner 21 Nov).
-- Nothing is ever bought on the booking-fee bill (16 Nov ee10c425).
CREATE OR REPLACE FUNCTION public.booking_gift_pick(
  p_event_vendor_id UUID,
  p_codes           TEXT[],
  p_event_has       TEXT,
  p_dry_run         BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ev        RECORD;
  v_charge    RECORD;
  v_pct       BIGINT;
  v_limit     BIGINT;
  v_smallest  TEXT;
  v_value     BIGINT := 0;
  v_n         INTEGER;
  v_stock     INTEGER := 0;
  v_sent      INTEGER := 0;
  v_free      INTEGER;
  v_fee       BIGINT;
  v_line      UUID;
  v_missing   TEXT[];
  c           RECORD;
  r           RECORD;
BEGIN
  IF p_event_vendor_id IS NULL OR p_event_has IS NULL
     OR p_event_has NOT IN ('none', 'plus', 'pro', 'ultra') THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  v_n := COALESCE(cardinality(p_codes), 0);
  -- 🎁 Every booking needs at least 1 gift (owner 20 Nov, no exceptions).
  IF v_n = 0 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  IF v_n > 40 THEN
    RETURN jsonb_build_object('status', 'too_many');
  END IF;

  SELECT ev.vendor_id, ev.event_id, ev.marketplace_vendor_id, ev.lock_agreed_at, ev.total_cost_php
    INTO v_ev
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF NOT FOUND OR v_ev.event_id IS NULL OR v_ev.marketplace_vendor_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;
  IF NOT COALESCE(p_dry_run, FALSE) AND v_ev.lock_agreed_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_agreed');
  END IF;

  -- The same per-shop lock as the shop gift doors: a pick and a delivery never race over stock.
  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || v_ev.marketplace_vendor_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.booking_gift_lines l
              WHERE l.event_vendor_id = p_event_vendor_id AND l.cleared_at IS NULL) THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- The limit is sized on THIS booking's fee: the billed fee, else the fee it would have carried (a free, promo,
  -- badge-paid or imported booking — 16 Nov 03e465e1), else the live schedule on its total. A booking with no fee at
  -- all still takes a gift: the smallest Papic pack alone always fits (20 Nov: "no exceptions for gift").
  SELECT bc.amount_charged_centavos, bc.computed_fee_centavos, bc.status
    INTO v_charge
    FROM public.booking_fee_charges bc
   WHERE bc.event_vendor_id = p_event_vendor_id
     AND bc.kind = 'primary'
     AND bc.source = 'lock'
   ORDER BY bc.created_at DESC
   LIMIT 1;
  IF FOUND AND v_charge.status = 'pending' AND COALESCE(v_charge.amount_charged_centavos, 0) > 0 THEN
    v_fee := v_charge.amount_charged_centavos;
  ELSIF FOUND AND COALESCE(v_charge.computed_fee_centavos, 0) > 0 THEN
    v_fee := v_charge.computed_fee_centavos;
  ELSE
    v_fee := public.booking_fee_centavos(round(COALESCE(v_ev.total_cost_php, 0) * 100)::BIGINT);
  END IF;
  v_fee := GREATEST(COALESCE(v_fee, 0), 0);

  v_pct := COALESCE((SELECT s.gift_limit_pct::BIGINT FROM public.platform_settings s WHERE s.id = 1), 40);
  v_limit := floor((v_fee * v_pct) / 100.0)::BIGINT;
  SELECT sp.service_code INTO v_smallest FROM public.shop_gift_smallest_papic_pack() sp;

  -- Every code, priced from the catalogue NOW (list price); Papic credits from its tier.
  CREATE TEMP TABLE IF NOT EXISTS _gift_pick (
    ord BIGINT, code TEXT, kind TEXT, credits INTEGER, price BIGINT, title TEXT, from_stock BOOLEAN, order_line UUID
  ) ON COMMIT DROP;
  TRUNCATE pg_temp._gift_pick;
  INSERT INTO pg_temp._gift_pick (ord, code, kind, credits, price, title, from_stock, order_line)
  SELECT u.ord, u.code,
         CASE WHEN left(u.code, 11) = 'PAPIC_GUEST' AND t.points IS NOT NULL THEN 'papic'
              WHEN u.code = 'EVENT_PLUS' THEN 'event_plus'
              WHEN u.code = 'COUPLE_WEBSITE_PRO' THEN 'event_pro'
              WHEN u.code = 'EVENT_ULTRA' THEN 'event_ultra' END,
         CASE WHEN left(u.code, 11) = 'PAPIC_GUEST' THEN t.points ELSE 1 END,
         round(cat.retail_price_php * 100)::BIGINT,
         COALESCE(cat.title, u.code),
         FALSE,
         NULL
    FROM unnest(p_codes) WITH ORDINALITY AS u(code, ord)
    LEFT JOIN public.platform_retail_catalog_v2 cat
      ON cat.service_code = u.code
     AND cat.is_active IS TRUE
     AND cat.retired_at IS NULL
     AND cat.retail_price_php > 0
    LEFT JOIN public.papic_pass_tiers t
      ON t.service_code = u.code
     AND t.is_active IS TRUE
     AND t.is_topup IS NOT TRUE
     AND t.points > 0;

  IF EXISTS (SELECT 1 FROM pg_temp._gift_pick g
              WHERE g.kind IS NULL OR g.price IS NULL OR g.credits IS NULL) THEN
    RETURN jsonb_build_object('status', 'unknown_pack');
  END IF;
  -- A plan never lands on an event that holds it or more — except Ultra on a Plus / Pro event
  -- (owner 2026-11-13: "Gives full Ultra").
  IF EXISTS (SELECT 1 FROM pg_temp._gift_pick g
              WHERE g.kind <> 'papic'
                AND (p_event_has = 'ultra'
                     OR (p_event_has = 'pro' AND g.kind <> 'event_ultra'))) THEN
    RETURN jsonb_build_object('status', 'already_has');
  END IF;
  -- At most one plan gift (pick 3, 14 Nov); Plus + Pro never make Ultra (pick 2).
  IF (SELECT COUNT(*) FROM pg_temp._gift_pick g WHERE g.kind <> 'papic') > 1 THEN
    RETURN jsonb_build_object('status', 'one_plan');
  END IF;

  SELECT COALESCE(SUM(g.price), 0)::BIGINT INTO v_value FROM pg_temp._gift_pick g;
  -- The limit, at the price couples pay. Only the smallest Papic pack, alone, always fits.
  IF v_value > v_limit
     AND NOT (v_n = 1 AND (SELECT g.code FROM pg_temp._gift_pick g LIMIT 1) = v_smallest) THEN
    RETURN jsonb_build_object('status', 'over_limit', 'limit_centavos', v_limit, 'value_centavos', v_value);
  END IF;

  -- 1 · STOCK FIRST. Free to offer = balance − what live quotes and earlier agree picks hold, across every event.
  FOR c IN SELECT g.code, g.kind, COUNT(*)::INTEGER AS want
             FROM pg_temp._gift_pick g GROUP BY g.code, g.kind LOOP
    v_free := NULL;
    IF c.kind = 'papic' THEN
      SELECT GREATEST(0, COALESCE(s.balance, 0) - COALESCE(s.held, 0))::INTEGER INTO v_free
        FROM public.shop_gift_pack_stock_status(v_ev.marketplace_vendor_id, NULL) s
       WHERE s.pack_code = c.code;
    ELSE
      SELECT GREATEST(0, COALESCE(s.balance, 0) - COALESCE(s.held, 0))::INTEGER INTO v_free
        FROM public.shop_gift_stock_status(v_ev.marketplace_vendor_id, NULL) s
       WHERE s.gift_kind = c.kind;
    END IF;
    v_free := LEAST(COALESCE(v_free, 0), c.want);
    IF v_free > 0 THEN
      UPDATE pg_temp._gift_pick g SET from_stock = TRUE
       WHERE g.ord IN (SELECT g2.ord FROM pg_temp._gift_pick g2
                        WHERE g2.code = c.code ORDER BY g2.ord LIMIT v_free);
      v_stock := v_stock + v_free;
    END IF;
  END LOOP;

  -- 2 · A SENT STORE ORDER LINE covers one pick each (21 Nov) — `shop_gift_sent_order_lines`, the one definition the
  -- Agree step's reader uses too. An unsent order counts for nothing.
  FOR r IN SELECT g.ord, g.code FROM pg_temp._gift_pick g WHERE NOT g.from_stock ORDER BY g.ord LOOP
    SELECT x.line_id INTO v_line
      FROM public.shop_gift_sent_order_lines(v_ev.marketplace_vendor_id) x
     WHERE x.service_code = r.code
       AND NOT EXISTS (SELECT 1 FROM pg_temp._gift_pick g2 WHERE g2.order_line = x.line_id)
     ORDER BY x.created_at, x.line_no
     LIMIT 1;
    IF v_line IS NOT NULL THEN
      UPDATE pg_temp._gift_pick g SET order_line = v_line WHERE g.ord = r.ord;
      v_sent := v_sent + 1;
    END IF;
  END LOOP;

  -- 3 · Neither: the supplier buys it in the "Your gifts" store first, then comes back ("0 left · Buy more ›").
  SELECT array_agg(DISTINCT g.code ORDER BY g.code) INTO v_missing
    FROM pg_temp._gift_pick g WHERE NOT g.from_stock AND g.order_line IS NULL;
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'needs_stock', 'codes', to_jsonb(v_missing),
                              'from_stock', v_stock, 'sent', v_sent, 'lines', v_n);
  END IF;

  IF COALESCE(p_dry_run, FALSE) THEN
    RETURN jsonb_build_object('status', 'ok', 'dry_run', TRUE, 'lines', v_n, 'from_stock', v_stock,
                              'sent', v_sent, 'value_centavos', v_value, 'limit_centavos', v_limit);
  END IF;

  INSERT INTO public.booking_gift_lines
    (event_vendor_id, event_id, vendor_profile_id, gift_order_line_id, service_code, gift_kind,
     credits, price_centavos, title, from_stock)
  SELECT p_event_vendor_id, v_ev.event_id, v_ev.marketplace_vendor_id,
         g.order_line, g.code, g.kind, g.credits, g.price, g.title, g.from_stock
    FROM pg_temp._gift_pick g
   ORDER BY g.ord;

  RETURN jsonb_build_object(
    'status', 'ok',
    'lines', v_n,
    'from_stock', v_stock,
    'sent', v_sent,
    'value_centavos', v_value,
    'limit_centavos', v_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.booking_gift_pick(UUID, TEXT[], TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_gift_pick(UUID, TEXT[], TEXT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.booking_gift_pick(UUID, TEXT[], TEXT, BOOLEAN) IS
  'Gift for services: the gifts a supplier picks when agreeing to a booking — at least one, always (owner 20 Nov). '
  'Prices every code at the list price from platform_retail_catalog_v2, refuses zero gifts, a plan the event already '
  'holds and more than one plan, caps the total at gift_limit_pct of the booking''s fee (the smallest Papic pack alone '
  'always fits, fee or no fee). Each line comes from the shop''s free stock, else from a gift-store order line whose '
  'payment was sent (one line per pick); otherwise needs_stock — bought in the store first (21 Nov). Never on a '
  'booking-fee bill (16 Nov). p_dry_run judges without writing (the yes asks first). Once per booking while a pick is '
  'live. Service-role only (vendorAgreeToLock).';

-- ── 4 · stock readers count agree-time stock picks as held ──────────────────
-- Re-created from 20271351048946 (packs) and 20271348181787 (kinds, Black Diamond). ADDED: a stock line picked at a yes
-- holds stock while its booking stands, until the event received it. To add it, what an event is
-- promised is now summed PER EVENT (its live quotes' lines + its agree picks) before what that event
-- already received is taken off — the same answer as before whenever an event has one live quote.
CREATE OR REPLACE FUNCTION public.shop_gift_pack_stock_status(
  p_vendor_profile_id UUID,
  p_except_event_id   UUID DEFAULT NULL
)
 RETURNS TABLE (pack_code TEXT, balance INTEGER, held INTEGER)
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
    SELECT g.service_code AS pack_code, l.event_id, COUNT(*)::INTEGER AS packs
      FROM live l
      JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = l.proposal_id
     WHERE g.gift_kind = 'papic'
     GROUP BY g.service_code, l.event_id
    UNION ALL
    -- 🎁 picked from stock at a yes (gift for services)
    SELECT b.service_code, b.event_id, COUNT(*)::INTEGER
      FROM public.booking_gift_lines b
      JOIN public.event_vendors ev ON ev.vendor_id = b.event_vendor_id
     WHERE b.vendor_profile_id = p_vendor_profile_id
       AND b.from_stock AND b.cleared_at IS NULL
       AND b.gift_kind = 'papic'
       AND ev.archived_at IS NULL
       AND (p_except_event_id IS NULL OR b.event_id <> p_except_event_id)
     GROUP BY b.service_code, b.event_id
  ),
  per_event AS (
    SELECT pr.pack_code, pr.event_id, SUM(pr.packs)::INTEGER AS packs
      FROM promised pr
     GROUP BY pr.pack_code, pr.event_id
  ),
  given AS (
    SELECT e.pack_code, e.event_id, (-SUM(e.packs))::INTEGER AS packs
      FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = p_vendor_profile_id
       AND e.kind = 'given'
       AND e.pack_code IS NOT NULL
       AND e.event_id IS NOT NULL
     GROUP BY e.pack_code, e.event_id
  ),
  codes AS (
    SELECT e.pack_code FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = p_vendor_profile_id AND e.pack_code IS NOT NULL
    UNION
    SELECT pe.pack_code FROM per_event pe
  )
  SELECT c.pack_code,
         COALESCE((SELECT SUM(e.packs) FROM public.shop_gift_stock_entries e
                    WHERE e.vendor_profile_id = p_vendor_profile_id
                      AND e.pack_code = c.pack_code), 0)::INTEGER,
         COALESCE((SELECT SUM(GREATEST(0, pe.packs - COALESCE(gv.packs, 0)))
                     FROM per_event pe
                     LEFT JOIN given gv
                       ON gv.event_id = pe.event_id AND gv.pack_code = pe.pack_code
                    WHERE pe.pack_code = c.pack_code), 0)::INTEGER
    FROM codes c;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_pack_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_pack_stock_status(UUID, UUID) TO authenticated, service_role;

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
  WITH kinds(gift_kind) AS (
    VALUES ('papic'::TEXT), ('event_plus'::TEXT), ('event_pro'::TEXT), ('event_ultra'::TEXT)
  ),
  live AS (
    SELECT p.proposal_id, p.event_id,
           EXISTS (
             SELECT 1 FROM public.event_vendors ev
              WHERE ev.event_id = p.event_id
                AND ev.marketplace_vendor_id = p_vendor_profile_id
                AND ev.deposit_acknowledged_at IS NOT NULL
           ) AS paid
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
    SELECT g.gift_kind, l.event_id, SUM(g.credits)::INTEGER AS credits
      FROM live l
      JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = l.proposal_id
     WHERE g.gift_kind = 'papic' OR NOT l.paid
     GROUP BY g.gift_kind, l.event_id
    UNION ALL
    -- 🎁 picked from stock at a yes (gift for services): held until given; a plan's hold ends at the
    -- couple's first payment, exactly as a quote's does.
    SELECT b.gift_kind, b.event_id, SUM(b.credits)::INTEGER
      FROM public.booking_gift_lines b
      JOIN public.event_vendors ev ON ev.vendor_id = b.event_vendor_id
     WHERE b.vendor_profile_id = p_vendor_profile_id
       AND b.from_stock AND b.cleared_at IS NULL
       AND ev.archived_at IS NULL
       AND (b.gift_kind = 'papic' OR ev.deposit_acknowledged_at IS NULL)
       AND (p_except_event_id IS NULL OR b.event_id <> p_except_event_id)
     GROUP BY b.gift_kind, b.event_id
  ),
  per_event AS (
    SELECT pr.gift_kind, pr.event_id, SUM(pr.credits)::INTEGER AS credits
      FROM promised pr
     GROUP BY pr.gift_kind, pr.event_id
  ),
  given AS (
    SELECT e.gift_kind, e.event_id, (-SUM(e.delta))::INTEGER AS credits
      FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = p_vendor_profile_id
       AND e.kind = 'given'
       AND e.event_id IS NOT NULL
     GROUP BY e.gift_kind, e.event_id
  )
  SELECT k.gift_kind,
         COALESCE((SELECT SUM(e.delta) FROM public.shop_gift_stock_entries e
                    WHERE e.vendor_profile_id = p_vendor_profile_id
                      AND e.gift_kind = k.gift_kind), 0)::INTEGER,
         COALESCE((SELECT SUM(GREATEST(0, pe.credits - COALESCE(gv.credits, 0)))
                     FROM per_event pe
                     LEFT JOIN given gv
                       ON gv.event_id = pe.event_id AND gv.gift_kind = pe.gift_kind
                    WHERE pe.gift_kind = k.gift_kind), 0)::INTEGER
    FROM kinds k;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_stock_status(UUID, UUID) TO authenticated, service_role;

-- ── 5 · the two stock doors also give the agree-time stock picks ────────────
-- Re-created from 20271351048946 (Papic, with its pre-pack "never twice" guard) and 20271348181787 (plans, Black Diamond). ADDED: the booking's own
-- from-stock picks are wanted beside the accepted quote's lines, and a booking with picks but no
-- accepted quote is no longer turned away. Locks, per-pack shortness, the pool grant and the given
-- rows are the old bodies.
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
  v_lines    INTEGER;
  v_credits  INTEGER := 0;
  v_given    INTEGER;
  v_name     TEXT;
  v_grant    UUID;
  v_entry    UUID;
  v_due      jsonb;
  r          RECORD;
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

  SELECT (SELECT COUNT(*) FROM public.vendor_proposal_shop_gifts g
           WHERE v_proposal IS NOT NULL AND g.proposal_id = v_proposal AND g.gift_kind = 'papic')
       + (SELECT COUNT(*) FROM public.booking_gift_lines b
           WHERE b.event_vendor_id = p_event_vendor_id AND b.from_stock AND b.cleared_at IS NULL AND b.gift_kind = 'papic')
    INTO v_lines;
  IF v_lines <= 0 THEN
    IF v_proposal IS NULL THEN
      RETURN jsonb_build_object('status', 'no_accepted_quote');
    END IF;
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_gift_stock:' || v_shop::text, 0));

  -- A gift given BEFORE packs were counted (a 'given' row the backfill could not
  -- name a pack for) is invisible to the per-pack count below: that event already
  -- received its gift from the credit-counted door, so it is 'already' — never twice.
  SELECT COALESCE(-SUM(e.delta), 0)::INTEGER INTO v_given
    FROM public.shop_gift_stock_entries e
   WHERE e.vendor_profile_id = v_shop
     AND e.event_id = v_event
     AND e.gift_kind = 'papic'
     AND e.kind = 'given'
     AND e.pack_code IS NULL;
  IF v_given > 0 THEN
    RETURN jsonb_build_object('status', 'already', 'credits', v_given);
  END IF;

  -- Per pack: the quote's lines + the booking's stock picks − what this shop already gave this event.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'pack_code', w.pack_code,
           'packs',     w.packs - COALESCE(gv.packs, 0),
           'credits',   (w.packs - COALESCE(gv.packs, 0)) * w.credits_each)
           ORDER BY w.pack_code), '[]'::jsonb)
    INTO v_due
    FROM (
      SELECT a.pack_code, COUNT(*)::INTEGER AS packs,
             (SUM(a.credits) / COUNT(*))::INTEGER AS credits_each
        FROM (
          SELECT g.service_code AS pack_code, g.credits
            FROM public.vendor_proposal_shop_gifts g
           WHERE v_proposal IS NOT NULL
             AND g.proposal_id = v_proposal
             AND g.gift_kind = 'papic'
          UNION ALL
          SELECT b.service_code, b.credits
            FROM public.booking_gift_lines b
           WHERE b.event_vendor_id = p_event_vendor_id
             AND b.from_stock AND b.cleared_at IS NULL
             AND b.gift_kind = 'papic'
        ) a
       GROUP BY a.pack_code
    ) w
    LEFT JOIN (
      SELECT e.pack_code, (-SUM(e.packs))::INTEGER AS packs
        FROM public.shop_gift_stock_entries e
       WHERE e.vendor_profile_id = v_shop
         AND e.event_id = v_event
         AND e.kind = 'given'
         AND e.pack_code IS NOT NULL
       GROUP BY e.pack_code
    ) gv ON gv.pack_code = w.pack_code
   WHERE w.packs - COALESCE(gv.packs, 0) > 0;

  IF jsonb_array_length(v_due) = 0 THEN
    SELECT COALESCE(-SUM(e.delta), 0)::INTEGER INTO v_given
      FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = v_shop
       AND e.event_id = v_event
       AND e.gift_kind = 'papic'
       AND e.kind = 'given';
    RETURN jsonb_build_object('status', 'already', 'credits', v_given);
  END IF;

  -- Every pack still owed must be in stock AS THAT PACK.
  FOR r IN
    SELECT d.pack_code, d.packs,
           COALESCE((SELECT SUM(e.packs) FROM public.shop_gift_stock_entries e
                      WHERE e.vendor_profile_id = v_shop
                        AND e.pack_code = d.pack_code), 0)::INTEGER AS balance
      FROM jsonb_to_recordset(v_due) AS d(pack_code TEXT, packs INTEGER, credits INTEGER)
  LOOP
    IF r.balance < r.packs THEN
      RETURN jsonb_build_object('status', 'short', 'pack_code', r.pack_code,
                                'wanted', r.packs, 'balance', r.balance);
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(d.credits), 0)::INTEGER INTO v_credits
    FROM jsonb_to_recordset(v_due) AS d(pack_code TEXT, packs INTEGER, credits INTEGER);
  IF v_credits <= 0 THEN
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (v_event, v_credits, 'shop_gift',
          'Gift from ' || COALESCE(NULLIF(btrim(v_name), ''), 'your supplier') || ' · Papic credits')
  RETURNING grant_id INTO v_grant;

  FOR r IN SELECT d.pack_code, d.packs, d.credits
             FROM jsonb_to_recordset(v_due) AS d(pack_code TEXT, packs INTEGER, credits INTEGER)
            ORDER BY d.pack_code LOOP
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id, pool_grant_id, note, pack_code, packs)
    VALUES
      (v_shop, 'papic', -r.credits, 'given', v_event, v_proposal, v_grant,
       'Given when the couple''s first payment cleared', r.pack_code, -r.packs)
    RETURNING entry_id INTO v_entry;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'credits', v_credits,
                            'entry_id', v_entry, 'grant_id', v_grant);
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_deliver_for_booking(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_deliver_for_booking(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.shop_gift_deliver_unlocks_for_booking(
  p_event_vendor_id UUID,
  p_event_has       TEXT
)
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
  v_has      TEXT := p_event_has;
  v_name     TEXT;
  v_kind     TEXT;
  v_wanted   INTEGER;
  v_given    INTEGER;
  v_balance  INTEGER;
  v_sku      TEXT;
  v_entry    UUID;
  v_included INTEGER;
  v_held     INTEGER;
  v_grant    UUID;
  v_out      jsonb := '[]'::jsonb;
  v_already  INTEGER := 0;
  v_short    INTEGER := 0;
  v_any      BOOLEAN := FALSE;
  i          INTEGER;
BEGIN
  IF p_event_vendor_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;
  IF v_has IS NULL OR v_has NOT IN ('none', 'plus', 'pro', 'ultra') THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT ev.event_id, ev.marketplace_vendor_id, ev.deposit_acknowledged_at
    INTO v_event, v_shop, v_ack
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF NOT FOUND OR v_event IS NULL OR v_shop IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_proposal_shop_gifts g
     WHERE v_proposal IS NOT NULL
       AND g.proposal_id = v_proposal
       AND g.gift_kind IN ('event_plus', 'event_pro', 'event_ultra')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.booking_gift_lines b
     WHERE b.event_vendor_id = p_event_vendor_id
       AND b.from_stock AND b.cleared_at IS NULL
       AND b.gift_kind IN ('event_plus', 'event_pro', 'event_ultra')
  ) THEN
    IF v_proposal IS NULL THEN
      RETURN jsonb_build_object('status', 'no_accepted_quote');
    END IF;
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  -- The same per-shop lock as the Papic door: two doors clearing one payment give once.
  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || v_shop::text, 0));

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;

  FOREACH v_kind IN ARRAY ARRAY['event_ultra', 'event_pro', 'event_plus'] LOOP
    SELECT (SELECT COUNT(*) FROM public.vendor_proposal_shop_gifts g
             WHERE v_proposal IS NOT NULL AND g.proposal_id = v_proposal AND g.gift_kind = v_kind)
         + (SELECT COUNT(*) FROM public.booking_gift_lines b
             WHERE b.event_vendor_id = p_event_vendor_id AND b.from_stock AND b.cleared_at IS NULL AND b.gift_kind = v_kind)
      INTO v_wanted;
    SELECT COALESCE(-SUM(e.delta), 0)::INTEGER INTO v_given
      FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = v_shop
       AND e.event_id = v_event
       AND e.gift_kind = v_kind
       AND e.kind = 'given';
    FOR i IN 1 .. GREATEST(0, v_wanted - v_given) LOOP
      -- 💎 Ultra holds everything; Pro holds everything but Ultra. An Ultra gift reaching a Plus or Pro
      -- event gives full Ultra (owner 2026-11-13: "Gives full Ultra").
      IF v_has = 'ultra' OR (v_has = 'pro' AND v_kind <> 'event_ultra') THEN
        v_already := v_already + 1;
        CONTINUE;
      END IF;
      SELECT COALESCE(SUM(e.delta), 0)::INTEGER INTO v_balance
        FROM public.shop_gift_stock_entries e
       WHERE e.vendor_profile_id = v_shop
         AND e.gift_kind = v_kind;
      IF v_balance < 1 THEN
        v_short := v_short + 1;
        CONTINUE;
      END IF;
      v_sku := CASE
                 WHEN v_kind = 'event_ultra' THEN 'EVENT_ULTRA'
                 WHEN v_kind = 'event_pro' THEN 'COUPLE_WEBSITE_PRO'
                 WHEN v_has = 'plus' THEN 'COUPLE_WEBSITE_PRO'   -- rule E
                 ELSE 'EVENT_PLUS'
               END;
      UPDATE public.events SET setnayan_ai_active = TRUE
       WHERE event_id = v_event AND setnayan_ai_active IS DISTINCT FROM TRUE;
      v_grant := NULL;
      SELECT c.included_papic_credits INTO v_included
        FROM public.platform_retail_catalog_v2 c
       WHERE c.service_code = v_sku;
      SELECT COALESCE(SUM(g.points), 0)::INTEGER INTO v_held
        FROM public.papic_event_point_grants g
       WHERE g.event_id = v_event
         AND g.source = 'plan_included';
      IF COALESCE(v_included, 0) > v_held THEN
        INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
        VALUES (v_event, v_included - v_held, 'plan_included',
                'Included with ' || v_sku || ' · gift from '
                  || COALESCE(NULLIF(btrim(v_name), ''), 'your supplier'))
        RETURNING grant_id INTO v_grant;
      END IF;
      INSERT INTO public.shop_gift_stock_entries
        (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id,
         pool_grant_id, unlocks_sku, note)
      VALUES
        (v_shop, v_kind, -1, 'given', v_event, v_proposal, v_grant, v_sku,
         CASE WHEN v_kind = 'event_plus' AND v_sku = 'COUPLE_WEBSITE_PRO'
              THEN 'Given when the couple''s first payment cleared · their second Event Plus, so Event Pro'
              ELSE 'Given when the couple''s first payment cleared' END)
      RETURNING entry_id INTO v_entry;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
                 'gift_kind', v_kind, 'unlocks_sku', v_sku, 'entry_id', v_entry));
      v_any := TRUE;
      v_has := CASE WHEN v_sku = 'EVENT_ULTRA' THEN 'ultra' WHEN v_sku = 'COUPLE_WEBSITE_PRO' THEN 'pro' ELSE 'plus' END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_any THEN 'ok' ELSE 'nothing_to_give' END,
    'given', v_out, 'already_has', v_already, 'short', v_short);
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_deliver_unlocks_for_booking(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_deliver_unlocks_for_booking(UUID, TEXT) TO service_role;

-- ── 6 · a pick covered by a SENT store payment: lands with it, or clears with it ──
-- Owner 21 Nov via the controller ("A GIFT BOUGHT BY BDO COUNTS ONCE THE PAYMENT IS SENT"). A store purchase becomes
-- stock only when an admin approves its payment (`shop_gift_grant_order_lines` writes one 'bought' row per order line,
-- `purchase_line_no` = that line). From that moment the pick it covered is an ordinary stock hold (from_stock), held by
-- the readers above and given by the two doors at the couple's first payment.
-- If the payment is REFUSED (rejectPayment cancels the order) or REFUNDED (the order goes 'refunded', or a reversal row
-- lands), the pick is CLEARED — never deleted — unless that gift already reached the couple. The supplier is told by the
-- shipped `payment_rejected` / `payment_refunded` notifications (no new message, no new email); the couple is told
-- nothing; the booking reads "Needs at least 1 gift. Buy one ›" and may pick again.
CREATE OR REPLACE FUNCTION public.booking_gift_lines_follow_the_store_order(
  p_order_id UUID,
  p_line_no  SMALLINT,
  p_outcome  TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR p_outcome NOT IN ('landed', 'refused', 'refunded') THEN
    RETURN 0;
  END IF;
  IF p_outcome = 'landed' THEN
    UPDATE public.booking_gift_lines b
       SET from_stock = TRUE
      FROM public.shop_gift_order_lines ol
     WHERE b.gift_order_line_id = ol.line_id
       AND ol.order_id = p_order_id
       AND (p_line_no IS NULL OR ol.line_no = p_line_no)
       AND b.cleared_at IS NULL
       AND NOT b.from_stock;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
  END IF;
  UPDATE public.booking_gift_lines b
     SET cleared_at = NOW(), cleared_reason = p_outcome
    FROM public.shop_gift_order_lines ol
   WHERE b.gift_order_line_id = ol.line_id
     AND ol.order_id = p_order_id
     AND b.cleared_at IS NULL
     -- A gift that already reached the couple stays given.
     AND NOT EXISTS (
           SELECT 1 FROM public.shop_gift_stock_entries e
            WHERE e.vendor_profile_id = b.vendor_profile_id
              AND e.event_id = b.event_id
              AND e.kind = 'given'
              AND (e.pack_code = b.service_code
                   OR (b.gift_kind <> 'papic' AND e.gift_kind = b.gift_kind)));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_gift_lines_follow_the_store_order(UUID, SMALLINT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_gift_lines_follow_the_store_order(UUID, SMALLINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.booking_gift_lines_on_stock_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.kind = 'bought' THEN
    PERFORM public.booking_gift_lines_follow_the_store_order(NEW.order_id, NEW.purchase_line_no, 'landed');
  ELSIF NEW.kind = 'reversal' THEN
    PERFORM public.booking_gift_lines_follow_the_store_order(NEW.order_id, NULL, 'refunded');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_gift_lines_on_stock_entry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_gift_lines_on_stock_entry ON public.shop_gift_stock_entries;
CREATE TRIGGER booking_gift_lines_on_stock_entry
  AFTER INSERT ON public.shop_gift_stock_entries
  FOR EACH ROW
  WHEN (NEW.order_id IS NOT NULL AND NEW.kind IN ('bought', 'reversal'))
  EXECUTE FUNCTION public.booking_gift_lines_on_stock_entry();

CREATE OR REPLACE FUNCTION public.booking_gift_lines_on_store_order_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.booking_gift_lines_follow_the_store_order(
    NEW.order_id, NULL, CASE WHEN NEW.status = 'refunded' THEN 'refunded' ELSE 'refused' END);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_gift_lines_on_store_order_closed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_gift_lines_on_store_order_closed ON public.orders;
CREATE TRIGGER booking_gift_lines_on_store_order_closed
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IN ('cancelled', 'refunded', 'lapsed')
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.service_key = 'vendor_gift__GIFT_CART')
  EXECUTE FUNCTION public.booking_gift_lines_on_store_order_closed();

COMMIT;
