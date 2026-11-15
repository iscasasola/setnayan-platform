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
-- RULE 0 — WHAT THIS REUSES:
--   • the bill: `booking_fee_charges.gift_centavos` already rides beside the fee and the order is fee +
--     gift (`booking_fee_upsert_vendor_order`, the TS mint). A pick sets those columns.
--   • bought Papic: `booking_fee_grant_setnayan_gift` already lands `gift_credits` in the event's shared
--     pot when the fee order is paid. A pick's bought Papic credits ARE `gift_credits`.
--   • stock: the shop gift ledger (`shop_gift_stock_entries`), its two status readers and its two
--     delivery doors. An agree-time stock pick is one more HOLD, given by the same doors.
--   • a bought plan lands as a `bought` (+1) / `given` (−1, `unlocks_sku`) pair in that same ledger, so
--     the entitlement chain that already reads given unlocks sees it with no change.
--
-- ADD / LOOSEN ONLY: one new table (RLS at CREATE), three new functions, and six functions re-created
-- from their latest bodies with additions (named at each).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · one row per gift picked at the yes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_gift_lines (
  line_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_vendor_id   UUID NOT NULL
                      REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The booking-fee charge a BOUGHT line rides on (NULL for a stock line).
  charge_id         UUID
                      REFERENCES public.booking_fee_charges(charge_id) ON DELETE SET NULL,
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
  -- A bought PLAN line, once it landed on the event (or went to the shop's stock).
  given_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_gift_lines_bought_rides_a_bill CHECK (from_stock OR charge_id IS NOT NULL),
  CONSTRAINT booking_gift_lines_plan_is_one CHECK (gift_kind = 'papic' OR credits = 1)
);

CREATE INDEX IF NOT EXISTS booking_gift_lines_booking_idx
  ON public.booking_gift_lines (event_vendor_id);
CREATE INDEX IF NOT EXISTS booking_gift_lines_charge_idx
  ON public.booking_gift_lines (charge_id) WHERE charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_gift_lines_shop_idx
  ON public.booking_gift_lines (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.booking_gift_lines IS
  'The gifts a supplier picked for the couple''s event when they agreed to the booking (owner 2026-11-15, '
  'gift for services): one row per Papic pack or plan, its list price frozen at the yes. from_stock = taken '
  'from the shop''s gift stock (held until the couple''s first payment, then given by the shop gift doors); '
  'otherwise bought on the booking-fee bill (charge_id) and given when that bill is paid. Written only by '
  'booking_gift_pick.';

ALTER TABLE public.booking_gift_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_gift_lines_read ON public.booking_gift_lines;
CREATE POLICY booking_gift_lines_read
  ON public.booking_gift_lines
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR event_id IN (SELECT public.current_event_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.booking_gift_lines FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.booking_gift_lines FROM authenticated;

-- ── 2 · what the gift adds to a bill, in words ──────────────────────────────
-- " ₱1,203.50 + your Setnayan gift for your couple: 2 × Papic 150 · Event Pro, ₱5,388"
-- Picked lines first; a bill that still carries the retired photo gift keeps its old clause;
-- otherwise ''. One source for the TS mint (rpc) and the SQL re-pricer below.
CREATE OR REPLACE FUNCTION public.booking_gift_bill_clause(p_charge_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge RECORD;
  v_items  TEXT;
BEGIN
  SELECT amount_charged_centavos, gift_credits, gift_centavos
    INTO v_charge
    FROM public.booking_fee_charges
   WHERE charge_id = p_charge_id;
  IF NOT FOUND OR COALESCE(v_charge.gift_centavos, 0) <= 0 THEN
    RETURN '';
  END IF;
  SELECT string_agg(x.item, ' · ' ORDER BY x.ord, x.item) INTO v_items
    FROM (
      SELECT CASE WHEN l.gift_kind = 'papic'
                  THEN to_char(COUNT(*), 'FM999,990') || ' × ' || l.title
                  ELSE l.title END AS item,
             CASE l.gift_kind WHEN 'papic' THEN 0 WHEN 'event_plus' THEN 1
                              WHEN 'event_pro' THEN 2 ELSE 3 END AS ord
        FROM public.booking_gift_lines l
       WHERE l.charge_id = p_charge_id
         AND NOT l.from_stock
       GROUP BY l.gift_kind, l.title
    ) x;
  IF v_items IS NULL THEN
    -- No picked line: a bill that still carries the retired photo gift keeps its words.
    IF COALESCE(v_charge.gift_credits, 0) > 0 THEN
      RETURN public.setnayan_gift_bill_clause(v_charge.amount_charged_centavos,
                                              v_charge.gift_credits, v_charge.gift_centavos);
    END IF;
    RETURN '';
  END IF;
  RETURN ' ' || public.booking_fee_php_text(v_charge.amount_charged_centavos / 100.0)
      || ' + your Setnayan gift for your couple: ' || v_items || ', '
      || public.booking_fee_php_text(v_charge.gift_centavos / 100.0);
END;
$$;

REVOKE ALL ON FUNCTION public.booking_gift_bill_clause(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_gift_bill_clause(UUID) TO service_role;

-- ── 3 · the charge sizes its gift from the picks; the photo gift retires ────
-- Re-created from 20271308555594. ADDED: (a) a NEW charge is never offered the retired photo gift
-- (setnayan_gift_offered := FALSE on INSERT; a charge already offered keeps its snapshot, so a bill
-- already raised is untouched); (b) a pending charge with BOUGHT picks carries exactly their list
-- prices and their Papic credits. Everything else is the old body.
CREATE OR REPLACE FUNCTION public.booking_fee_charges_size_the_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift  RECORD;
  v_stamp RECORD;
  v_picks RECORD;
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

  -- 🎁 PICKED AT THE YES: the bill carries what was bought, at the list price frozen on each line.
  IF TG_OP = 'UPDATE' AND NEW.status = 'pending'
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN
    SELECT COALESCE(SUM(l.price_centavos), 0)::BIGINT AS centavos,
           COALESCE(SUM(l.credits) FILTER (WHERE l.gift_kind = 'papic'), 0)::INTEGER AS credits,
           COUNT(*)::INTEGER AS n
      INTO v_picks
      FROM public.booking_gift_lines l
     WHERE l.charge_id = NEW.charge_id
       AND NOT l.from_stock;
    IF v_picks.n > 0 THEN
      NEW.gift_credits  := v_picks.credits;
      NEW.gift_centavos := v_picks.centavos;
      RETURN NEW;
    END IF;
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

-- ── 4 · the bill re-pricer names the picked gift ────────────────────────────
-- Re-created from 20271234849476. CHANGED ONLY: the gift clause comes from booking_gift_bill_clause
-- (picked items, else the retired photo clause), and the description is rewritten whenever the bill
-- carries any gift (a plan-only gift has no credits). Amounts, voiding and the one-bill-per-charge
-- insert are the old body.
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

  v_svc := 'vendor_booking_fee__' || p_charge_id::text;
  SELECT order_id, status, requested_total_php, description
    INTO v_order
    FROM public.orders
    WHERE service_key = v_svc
    LIMIT 1;

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
    IF v_order.status IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN RETURN; END IF;
    IF v_order.requested_total_php IS DISTINCT FROM v_amount_php THEN
      v_desc := v_order.description;
      IF COALESCE(v_charge.gift_centavos, 0) > 0
         OR position(' + your Setnayan gift for your couple: ' IN COALESCE(v_desc, '')) > 0 THEN
        v_desc := 'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
          || public.booking_gift_bill_clause(p_charge_id)
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
     'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
       || public.booking_gift_bill_clause(p_charge_id)
       || ' — amended booking, up for verification within 24 hrs',
     v_amount_php, 'submitted', v_ref)
  ON CONFLICT (service_key) WHERE service_key LIKE 'vendor\_booking\_fee\_\_%' DO NOTHING
  RETURNING order_id INTO v_order_id;
  IF v_order_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.payments
    (order_id, user_id, amount_php, channel, paid_at)
  VALUES
    (v_order_id, v_payer, v_amount_php, 'manual', CURRENT_DATE);
END;
$$;

-- ── 5 · the pick — judged here, whatever the screen drew ────────────────────
-- p_codes: one entry per pack / plan (two Papic 1000 ⇒ the code twice). p_event_has: what the couple's
-- event already holds (none|plus|pro|ultra), from the app's entitlement chain. Picks are made ONCE per
-- booking; a repeat answers 'already' and changes nothing. Nothing is written on any refusal.
CREATE OR REPLACE FUNCTION public.booking_gift_pick(
  p_event_vendor_id UUID,
  p_codes           TEXT[],
  p_event_has       TEXT
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
  v_bought    BIGINT := 0;
  v_n         INTEGER;
  v_stock     INTEGER := 0;
  v_free      INTEGER;
  v_order     RECORD;
  v_amount    NUMERIC(12, 2);
  c           RECORD;
BEGIN
  IF p_event_vendor_id IS NULL OR p_event_has IS NULL
     OR p_event_has NOT IN ('none', 'plus', 'pro', 'ultra') THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  v_n := COALESCE(cardinality(p_codes), 0);
  IF v_n = 0 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  IF v_n > 40 THEN
    RETURN jsonb_build_object('status', 'too_many');
  END IF;

  SELECT ev.vendor_id, ev.event_id, ev.marketplace_vendor_id, ev.lock_agreed_at
    INTO v_ev
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF NOT FOUND OR v_ev.event_id IS NULL OR v_ev.marketplace_vendor_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;
  IF v_ev.lock_agreed_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_agreed');
  END IF;

  -- The same per-shop lock as the shop gift doors: a pick and a delivery never race over stock.
  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || v_ev.marketplace_vendor_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.booking_gift_lines l WHERE l.event_vendor_id = p_event_vendor_id) THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- The gift is sized on THIS booking's billed fee. No bill (a free booking, a waived fee) ⇒ no gift
  -- ("no fee, no gift", 2026-09-09): nothing to add a bought gift to and nothing to size by.
  SELECT bc.charge_id, bc.amount_charged_centavos, bc.status
    INTO v_charge
    FROM public.booking_fee_charges bc
   WHERE bc.event_vendor_id = p_event_vendor_id
     AND bc.kind = 'primary'
     AND bc.source = 'lock'
   ORDER BY bc.created_at DESC
   LIMIT 1;
  IF NOT FOUND OR v_charge.status <> 'pending' OR COALESCE(v_charge.amount_charged_centavos, 0) <= 0 THEN
    RETURN jsonb_build_object('status', 'no_bill');
  END IF;

  v_pct := COALESCE((SELECT s.gift_limit_pct::BIGINT FROM public.platform_settings s WHERE s.id = 1), 40);
  v_limit := floor((v_charge.amount_charged_centavos * v_pct) / 100.0)::BIGINT;
  SELECT sp.service_code INTO v_smallest FROM public.shop_gift_smallest_papic_pack() sp;

  -- Every code, priced from the catalogue NOW (list price); Papic credits from its tier.
  CREATE TEMP TABLE IF NOT EXISTS _gift_pick (
    ord BIGINT, code TEXT, kind TEXT, credits INTEGER, price BIGINT, title TEXT, from_stock BOOLEAN
  ) ON COMMIT DROP;
  TRUNCATE pg_temp._gift_pick;
  INSERT INTO pg_temp._gift_pick (ord, code, kind, credits, price, title, from_stock)
  SELECT u.ord, u.code,
         CASE WHEN left(u.code, 11) = 'PAPIC_GUEST' AND t.points IS NOT NULL THEN 'papic'
              WHEN u.code = 'EVENT_PLUS' THEN 'event_plus'
              WHEN u.code = 'COUPLE_WEBSITE_PRO' THEN 'event_pro'
              WHEN u.code = 'EVENT_ULTRA' THEN 'event_ultra' END,
         CASE WHEN left(u.code, 11) = 'PAPIC_GUEST' THEN t.points ELSE 1 END,
         round(cat.retail_price_php * 100)::BIGINT,
         COALESCE(cat.title, u.code),
         FALSE
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
  -- At most one plan gift (pick 3, 14 Nov: "at most one plan gift … the rest Papic"); Plus + Pro
  -- never make Ultra (pick 2), so a second plan would be paid for and land as nothing.
  IF (SELECT COUNT(*) FROM pg_temp._gift_pick g WHERE g.kind <> 'papic') > 1 THEN
    RETURN jsonb_build_object('status', 'one_plan');
  END IF;

  SELECT COALESCE(SUM(g.price), 0)::BIGINT INTO v_value FROM pg_temp._gift_pick g;
  -- The limit, at the price couples pay — stock lines included. Only the smallest Papic pack, alone,
  -- always fits ("they can always give the lowest gift at any price").
  IF v_value > v_limit
     AND NOT (v_n = 1 AND (SELECT g.code FROM pg_temp._gift_pick g LIMIT 1) = v_smallest) THEN
    RETURN jsonb_build_object('status', 'over_limit', 'limit_centavos', v_limit, 'value_centavos', v_value);
  END IF;

  -- STOCK FIRST. Free to offer = balance − what live quotes and earlier agree picks hold, across every
  -- event (this event's own quote holds are already promised to it).
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

  INSERT INTO public.booking_gift_lines
    (event_vendor_id, event_id, vendor_profile_id, charge_id, service_code, gift_kind,
     credits, price_centavos, title, from_stock)
  SELECT p_event_vendor_id, v_ev.event_id, v_ev.marketplace_vendor_id,
         CASE WHEN g.from_stock THEN NULL ELSE v_charge.charge_id END,
         g.code, g.kind, g.credits, g.price, g.title, g.from_stock
    FROM pg_temp._gift_pick g
   ORDER BY g.ord;

  SELECT COALESCE(SUM(g.price), 0)::BIGINT INTO v_bought FROM pg_temp._gift_pick g WHERE NOT g.from_stock;

  IF v_bought > 0 THEN
    -- The charge re-sizes its gift from the bought lines (trigger), then its bill follows.
    UPDATE public.booking_fee_charges
       SET updated_at = NOW()
     WHERE charge_id = v_charge.charge_id;
    SELECT o.order_id, o.status INTO v_order
      FROM public.orders o
     WHERE o.service_key = 'vendor_booking_fee__' || v_charge.charge_id::text
     LIMIT 1;
    IF FOUND AND v_order.status NOT IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN
      v_amount := round(v_charge.amount_charged_centavos + v_bought)::numeric / 100.0;
      UPDATE public.orders
         SET requested_total_php = v_amount,
             description = 'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
               || public.booking_gift_bill_clause(v_charge.charge_id)
               || ' — up for verification, confirmation within 24 hrs',
             updated_at = NOW()
       WHERE order_id = v_order.order_id;
      UPDATE public.payments
         SET amount_php = v_amount
       WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'lines', v_n,
    'from_stock', v_stock,
    'value_centavos', v_value,
    'bought_centavos', v_bought,
    'limit_centavos', v_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.booking_gift_pick(UUID, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_gift_pick(UUID, TEXT[], TEXT) TO service_role;

COMMENT ON FUNCTION public.booking_gift_pick(UUID, TEXT[], TEXT) IS
  'Gift for services (owner 2026-11-15): the gifts a supplier picked when agreeing to a booking. Prices every '
  'code at the list price from platform_retail_catalog_v2, refuses a plan the event already holds and more than '
  'one plan, caps the total at gift_limit_pct of the booking''s billed fee (stock lines included; the smallest '
  'Papic pack alone always fits), takes from the shop''s gift stock first, and adds the rest to the booking-fee '
  'bill. Once per booking. Service-role only (vendorAgreeToLock, after the yes).';

-- ── 6 · stock readers count agree-time stock picks as held ──────────────────
-- Re-created from 20271346218077 (packs) and 20271345709071 (kinds). ADDED: a stock line picked at a yes
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
       AND b.from_stock
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
       AND b.from_stock
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

-- ── 7 · the two stock doors also give the agree-time stock picks ────────────
-- Re-created from 20271346218077 (Papic) and 20271345709071 (plans). ADDED: the booking's own
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
           WHERE b.event_vendor_id = p_event_vendor_id AND b.from_stock AND b.gift_kind = 'papic')
    INTO v_lines;
  IF v_lines <= 0 THEN
    IF v_proposal IS NULL THEN
      RETURN jsonb_build_object('status', 'no_accepted_quote');
    END IF;
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_gift_stock:' || v_shop::text, 0));

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
             AND b.from_stock
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
       AND b.from_stock
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
             WHERE b.event_vendor_id = p_event_vendor_id AND b.from_stock AND b.gift_kind = v_kind)
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

-- ── 8 · a BOUGHT plan reaches the event when the supplier's bill is paid ────
-- Bought Papic needs nothing new: its credits are the charge's gift_credits, granted by
-- booking_fee_grant_setnayan_gift. A bought plan lands as a bought (+1) / given (−1, unlocks_sku) pair in
-- the shop's gift ledger — the row the entitlement chain already reads for a stock gift — netting the
-- shop's stock to zero. A plan the event already holds by then (the couple bought it meanwhile) is NOT
-- lost: only its bought (+1) row is written, so the shop keeps it to give again. Once per line (given_at).
CREATE OR REPLACE FUNCTION public.booking_gift_give_bought_plans(
  p_charge_id UUID,
  p_order_id  UUID,
  p_event_has TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_charge   RECORD;
  v_has      TEXT := p_event_has;
  v_name     TEXT;
  v_sku      TEXT;
  v_included INTEGER;
  v_held     INTEGER;
  v_grant    UUID;
  v_out      jsonb := '[]'::jsonb;
  v_kept     INTEGER := 0;
  r          RECORD;
BEGIN
  IF p_charge_id IS NULL OR v_has IS NULL OR v_has NOT IN ('none', 'plus', 'pro', 'ultra') THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT charge_id, event_id, vendor_profile_id, status
    INTO v_charge
    FROM public.booking_fee_charges
   WHERE charge_id = p_charge_id;
  IF NOT FOUND OR v_charge.event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_charge');
  END IF;
  IF v_charge.status <> 'paid' THEN
    RETURN jsonb_build_object('status', 'not_cleared');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.order_id = p_order_id
       AND o.service_key = 'vendor_booking_fee__' || p_charge_id::text
       AND o.status IN ('paid', 'fulfilled')
  ) THEN
    RETURN jsonb_build_object('status', 'order_not_paid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || v_charge.vendor_profile_id::text, 0));

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_charge.vendor_profile_id;

  FOR r IN
    SELECT l.line_id, l.gift_kind
      FROM public.booking_gift_lines l
     WHERE l.charge_id = p_charge_id
       AND NOT l.from_stock
       AND l.gift_kind IN ('event_plus', 'event_pro', 'event_ultra')
       AND l.given_at IS NULL
     ORDER BY CASE l.gift_kind WHEN 'event_ultra' THEN 0 WHEN 'event_pro' THEN 1 ELSE 2 END
     FOR UPDATE
  LOOP
    UPDATE public.booking_gift_lines SET given_at = NOW() WHERE line_id = r.line_id;
    -- It was bought: it is the shop's first.
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, event_id, note)
    VALUES
      (v_charge.vendor_profile_id, r.gift_kind, 1, 'bought', v_charge.event_id,
       'Bought on the booking-fee bill as a gift for this booking');
    IF v_has = 'ultra' OR (v_has = 'pro' AND r.gift_kind <> 'event_ultra') THEN
      v_kept := v_kept + 1;   -- the event already holds it: it stays in the shop's stock
      CONTINUE;
    END IF;
    v_sku := CASE
               WHEN r.gift_kind = 'event_ultra' THEN 'EVENT_ULTRA'
               WHEN r.gift_kind = 'event_pro' THEN 'COUPLE_WEBSITE_PRO'
               WHEN v_has = 'plus' THEN 'COUPLE_WEBSITE_PRO'
               ELSE 'EVENT_PLUS'
             END;
    UPDATE public.events SET setnayan_ai_active = TRUE
     WHERE event_id = v_charge.event_id AND setnayan_ai_active IS DISTINCT FROM TRUE;
    v_grant := NULL;
    SELECT c.included_papic_credits INTO v_included
      FROM public.platform_retail_catalog_v2 c
     WHERE c.service_code = v_sku;
    SELECT COALESCE(SUM(g.points), 0)::INTEGER INTO v_held
      FROM public.papic_event_point_grants g
     WHERE g.event_id = v_charge.event_id
       AND g.source = 'plan_included';
    IF COALESCE(v_included, 0) > v_held THEN
      INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
      VALUES (v_charge.event_id, v_included - v_held, 'plan_included',
              'Included with ' || v_sku || ' · gift from '
                || COALESCE(NULLIF(btrim(v_name), ''), 'your supplier'))
      RETURNING grant_id INTO v_grant;
    END IF;
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, event_id, pool_grant_id, unlocks_sku, note)
    VALUES
      (v_charge.vendor_profile_id, r.gift_kind, -1, 'given', v_charge.event_id, v_grant, v_sku,
       'Given when the supplier''s booking-fee bill was paid');
    v_out := v_out || jsonb_build_array(jsonb_build_object('gift_kind', r.gift_kind, 'unlocks_sku', v_sku));
    v_has := CASE WHEN v_sku = 'EVENT_ULTRA' THEN 'ultra' WHEN v_sku = 'COUPLE_WEBSITE_PRO' THEN 'pro' ELSE 'plus' END;
  END LOOP;

  RETURN jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(v_out) > 0 THEN 'ok'
                   WHEN v_kept > 0 THEN 'kept_in_stock' ELSE 'nothing_to_give' END,
    'given', v_out, 'kept_in_stock', v_kept);
END;
$$;

REVOKE ALL ON FUNCTION public.booking_gift_give_bought_plans(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_gift_give_bought_plans(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.booking_gift_give_bought_plans(UUID, UUID, TEXT) IS
  'Gift for services: the Event Plus / Pro / Ultra a supplier bought on a booking-fee bill reach the couple''s '
  'event when that bill is paid (owner 2026-11-15). Written as a bought/given pair in shop_gift_stock_entries '
  'so the entitlement chain reads it like a stock gift; a plan the event already holds stays in the shop''s '
  'stock. Ultra first; a second Plus becomes Pro. Once per line. Service-role only (payment approval).';
