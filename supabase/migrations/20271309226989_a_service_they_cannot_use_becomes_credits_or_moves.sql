-- a_service_they_cannot_use_becomes_credits_or_moves
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 💳 WHAT THE PUBLIC REFUND PAGE PROMISES, BUILT (owner 2026-11-05: "yes to refund").
--
-- `app/(shell)/refunds/page.tsx` tells a buyer that a paid service they cannot use
-- "becomes Papic credits for your event", and that an unused one "can wait for your
-- next event instead". Until this migration nothing could do either: the only admin
-- tool was `refundOrder`, which records money sent BACK (order_refunds).
--
-- Rulings (DECISION_LOG, Setnayan-specs):
--   • 2026-10-08 "NO REFUNDS — A SERVICE THEY CANNOT USE BECOMES VIRTUAL CREDITS,
--     CONVERTED TO PAPIC" — and its open question: the pesos → credits rate "must
--     come from the catalogue price of a credit, never a typed constant".
--   • 2026-10-08 "MOVE AN UNUSED SERVICE TO THE USER'S NEXT EVENT (job 22)" — the
--     next event CREATED is the pre-picked, only choice; no next event → it waits;
--     a partly used Papic pass does not move.
--   • 2026-10-22 "NO REFUNDS STANDS" — credits "worth what you paid", NO RATE STATED;
--     the move is "done by hand by the team".
--   • 2026-11-05 "THE 15 'ACT FIRST' ITEMS" (1) — build the conversion and the move.
--
-- ⚖ OWNER 2026-11-05 (three answers in chat): (1) credits = what they paid at the
-- BEST-VALUE Papic pack on sale, read live — no rate is typed anywhere; (2) "switch
-- it off": the converted order goes to 'lapsed' (ended, not refunded); (3) one
-- admin is enough.
--
-- RULE 0 — what this REUSES:
--   • THE POT. Converted credits land as ONE `papic_event_point_grants` row,
--     seat_id NULL, source 'admin' — the same ledger `papic_event_pool_status`
--     already sums. No second pot.
--   • THE OFF SWITCH is the existing 'lapsed' status, which every ownership check
--     already reads as "not owned". No new status.
--   • THE MOVE re-points `orders.event_id` and this order's own shared-pot grants.
--     Ownership of every orders-backed service follows `orders.event_id` already.
--
-- What it ADDS: one ledger table (one row per action: who, why, from, to) and two
-- service-role-only functions that do each action in ONE transaction under a row
-- lock on the order, so a double click cannot apply twice.

-- ── 1) The ledger ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_service_remedies (
  remedy_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE RESTRICT,
  kind            TEXT NOT NULL CHECK (kind IN ('papic_credits', 'next_event')),
  -- The event the service was on when the admin acted. SET NULL so deleting an
  -- event never deletes the record that something was done.
  from_event_id   UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  to_event_id     UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  papic_credits   INTEGER CHECK (papic_credits IS NULL OR papic_credits > 0),
  grant_id        UUID REFERENCES public.papic_event_point_grants(grant_id) ON DELETE SET NULL,
  -- What the buyer had paid on the order (sum of MATCHED payments) at the moment
  -- of the action. A snapshot for the paper trail; nothing reads it as a price.
  paid_php        NUMERIC(12, 2) NOT NULL CHECK (paid_php > 0),
  reason          TEXT NOT NULL CHECK (length(btrim(reason)) >= 20 AND length(reason) <= 2000),
  -- SET NULL, never RESTRICT: `order_refunds` is the one deliberate account-delete
  -- refusal left (lib/user-delete-blockers.ts) and this must not add a second.
  admin_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_service_remedies_shape CHECK (
    (kind = 'papic_credits' AND papic_credits IS NOT NULL AND to_event_id IS NULL)
    OR (kind = 'next_event' AND papic_credits IS NULL AND grant_id IS NULL)
  )
);

-- One conversion per order, ever: the value can become credits once.
CREATE UNIQUE INDEX IF NOT EXISTS order_service_remedies_one_conversion
  ON public.order_service_remedies (order_id) WHERE kind = 'papic_credits';
-- One move OUT of each event per order. A → B → C stays possible (B can be called
-- off too); the same A → B twice cannot.
CREATE UNIQUE INDEX IF NOT EXISTS order_service_remedies_one_move_per_event
  ON public.order_service_remedies (order_id, from_event_id) WHERE kind = 'next_event';
CREATE INDEX IF NOT EXISTS order_service_remedies_order_idx
  ON public.order_service_remedies (order_id, created_at DESC);

ALTER TABLE public.order_service_remedies ENABLE ROW LEVEL SECURITY;
-- No policies: written only by the two functions below and read only by the admin
-- console through the service-role client.
REVOKE ALL ON TABLE public.order_service_remedies FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_service_remedies TO service_role;

COMMENT ON TABLE public.order_service_remedies IS
  'What Admin › Payments did with a paid service the buyer could not use (owner 2026-11-05 "yes to refund"; '
  'refund page /refunds). kind papic_credits = its value became Papic credits on the event (one per order); '
  'kind next_event = it moved to the buyer''s next event (one move out of each event per order). Not a refund: '
  'no money moves. Written only by admin_convert_order_to_papic_credits / admin_move_order_to_next_event.';
COMMENT ON COLUMN public.order_service_remedies.papic_credits IS
  'Credits granted: what was paid, at the best-value Papic pack on sale at that moment (owner 2026-11-05), computed by orders_papic_credit_value.';

-- ── 2) The buyer's next event ───────────────────────────────────────────────
-- Job 22: "their next immediate event created". The earliest event created AFTER
-- the order's current one, on which the buyer is a host (member_type 'couple'),
-- not archived and not a sample. NULL = none yet → the service waits.
-- ONE definition, read by both the admin page (to show it) and the move (to
-- enforce it), so the two cannot disagree.
CREATE OR REPLACE FUNCTION public.orders_next_event(p_order_ids UUID[])
RETURNS TABLE (order_id UUID, next_event_id UUID, next_event_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT o.order_id, nx.event_id, nx.display_name
    FROM public.orders o
    JOIN public.events cur ON cur.event_id = o.event_id
    LEFT JOIN LATERAL (
      SELECT e.event_id, e.display_name
        FROM public.events e
       WHERE e.event_id <> cur.event_id
         AND e.created_at > cur.created_at
         AND e.archived IS NOT TRUE
         AND e.is_sample IS NOT TRUE
         AND EXISTS (
           SELECT 1 FROM public.event_members m
            WHERE m.event_id = e.event_id
              AND m.user_id = o.user_id
              AND m.member_type = 'couple'
         )
       ORDER BY e.created_at ASC, e.event_id ASC
       LIMIT 1
    ) nx ON TRUE
   WHERE o.order_id = ANY (p_order_ids)
     AND o.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.orders_next_event(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_next_event(UUID[]) TO service_role;

-- ── 3) The checks both actions share ────────────────────────────────────────
-- Returns NULL when the order may be acted on, else a refusal code. Caller holds
-- the row lock. Paid amount is the sum of MATCHED payments — a free or granted
-- order paid nothing, so there is nothing to convert or move (the refund page's
-- "Free & granted orders" section).
CREATE OR REPLACE FUNCTION public.order_remedy_refusal(
  p_status TEXT,
  p_vendor_profile_id UUID,
  p_user_id UUID,
  p_event_id UUID,
  p_paid_php NUMERIC
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_status IS NULL OR p_status NOT IN ('paid', 'fulfilled') THEN 'not_paid'
    -- A supplier's own bill (booking fee, plan, add-on): its value is not the
    -- couple's, and no ruling says where it would go.
    WHEN p_vendor_profile_id IS NOT NULL THEN 'supplier_bill'
    WHEN p_user_id IS NULL THEN 'no_account'
    WHEN p_event_id IS NULL THEN 'no_event'
    WHEN p_paid_php IS NULL OR p_paid_php <= 0 THEN 'nothing_paid'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.order_remedy_refusal(TEXT, UUID, UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_remedy_refusal(TEXT, UUID, UUID, UUID, NUMERIC) TO service_role;

-- ── 4) What an order is worth in Papic credits ─────────────────────────────
-- ⚖ OWNER 2026-11-05: credits = what they paid, at the BEST-VALUE Papic pack on
-- sale (he was shown "₱999 = 3,000 credits, about 3 per peso" and answered "yes.
-- different prices different packs"). So: of every sellable pack — an active,
-- unretired PAPIC_GUEST* catalogue row at its REGULAR price, with an active,
-- non-top-up tier row — the one that gives the most credits per peso, and then
-- floor(paid × its credits ÷ its price).
-- ⚠ NO NUMBER IS TYPED HERE. The packs and their prices are read at call time
-- from platform_retail_catalog_v2 (admin-managed, the only price a customer is
-- charged) × papic_pass_tiers. ONE definition, read by the admin page (to show the
-- figure) and by the conversion (to grant it), so the two cannot disagree.
-- credits NULL = no pack is on sale, so nothing can be converted.
CREATE OR REPLACE FUNCTION public.orders_papic_credit_value(p_order_ids UUID[])
RETURNS TABLE (
  order_id UUID,
  paid_php NUMERIC,
  credits INTEGER,
  pack_credits INTEGER,
  pack_price_php NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH best AS (
    SELECT t.points::BIGINT AS pts, c.retail_price_php AS php
      FROM public.platform_retail_catalog_v2 c
      JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
     WHERE left(c.service_code, 11) = 'PAPIC_GUEST'
       AND c.is_active IS TRUE
       AND c.retired_at IS NULL
       AND c.retail_price_php > 0
       AND t.is_active IS TRUE
       AND t.is_topup IS NOT TRUE
       AND t.points > 0
     -- most credits per peso; on a tie, the cheaper pack (an arbitrary but fixed pick)
     ORDER BY (t.points::NUMERIC / c.retail_price_php) DESC, c.retail_price_php ASC, c.service_code ASC
     LIMIT 1
  ),
  paid AS (
    SELECT o.order_id,
           COALESCE((SELECT sum(p.amount_php) FROM public.payments p
                      WHERE p.order_id = o.order_id AND p.status::text = 'matched'), 0)::NUMERIC AS php
      FROM public.orders o
     WHERE o.order_id = ANY (p_order_ids)
  )
  SELECT paid.order_id,
         paid.php,
         CASE WHEN best.pts IS NULL THEN NULL
              ELSE floor(round(paid.php * 100) * best.pts / round(best.php * 100))::INTEGER END,
         best.pts::INTEGER,
         best.php
    FROM paid
    LEFT JOIN best ON TRUE;
$$;

REVOKE ALL ON FUNCTION public.orders_papic_credit_value(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_papic_credit_value(UUID[]) TO service_role;

-- ── 5) Convert to Papic credits ─────────────────────────────────────────────
-- The number is COMPUTED (section 4), never posted. The admin's page posts the
-- figure it SHOWED; if prices changed in between, this refuses ('prices_changed')
-- rather than grant a number nobody looked at.
-- ⚖ OWNER 2026-11-05: "switch it off" — the service they could not use stops being
-- theirs. The order goes paid|fulfilled → 'lapsed' (the existing terminal status:
-- ended, NOT refunded — the money stays with Setnayan). Every ownership check
-- already treats lapsed as not owned.
-- The grant carries NO order_id on purpose: the reversal path deletes grants by
-- order_id, and these credits replace the order — they are not part of it. The
-- ledger row links them (grant_id).
-- Returns { ok, applied, refusal?, remedy_id?, grant_id?, event_id?, credits?, paid_php? }.
-- applied=false + ok=true = it was already converted (a double click) — nothing new.
DROP FUNCTION IF EXISTS public.admin_convert_order_to_papic_credits(UUID, INTEGER, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.admin_convert_order_to_papic_credits(
  p_order_id UUID,
  p_expected_credits INTEGER,
  p_reason TEXT,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order    RECORD;
  v_value    RECORD;
  v_refusal  TEXT;
  v_existing RECORD;
  v_grant_id UUID;
  v_remedy   UUID;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'short_reason');
  END IF;

  -- 🔒 The row lock is the idempotency: a second press waits here, then sees the
  -- first press's ledger row below.
  SELECT o.order_id, o.status::text AS status, o.vendor_profile_id, o.user_id, o.event_id, o.public_id
    INTO v_order
    FROM public.orders o
   WHERE o.order_id = p_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'not_found');
  END IF;

  SELECT r.remedy_id, r.grant_id, r.papic_credits, r.from_event_id
    INTO v_existing
    FROM public.order_service_remedies r
   WHERE r.order_id = p_order_id AND r.kind = 'papic_credits';
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'applied', false,
      'remedy_id', v_existing.remedy_id, 'grant_id', v_existing.grant_id,
      'credits', v_existing.papic_credits, 'event_id', v_existing.from_event_id
    );
  END IF;

  SELECT * INTO v_value FROM public.orders_papic_credit_value(ARRAY[p_order_id]);

  v_refusal := public.order_remedy_refusal(
    v_order.status, v_order.vendor_profile_id, v_order.user_id, v_order.event_id, v_value.paid_php
  );
  IF v_refusal IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'refusal', v_refusal);
  END IF;

  -- A Papic pack (or a basket holding one) is already Papic credits on this event.
  IF EXISTS (SELECT 1 FROM public.papic_event_point_grants g WHERE g.order_id = p_order_id) THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'already_papic');
  END IF;

  IF v_value.credits IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'no_prices');
  END IF;
  IF v_value.credits <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'too_small');
  END IF;
  IF p_expected_credits IS DISTINCT FROM v_value.credits THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'prices_changed', 'credits', v_value.credits);
  END IF;

  -- Switch the service off: ended, not refunded.
  UPDATE public.orders
     SET status = 'lapsed', updated_at = NOW()
   WHERE order_id = p_order_id AND status::text IN ('paid', 'fulfilled');

  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (
    v_order.event_id, v_value.credits, 'admin',
    'Converted from order ' || v_order.public_id || ' (a service they could not use)'
  )
  RETURNING grant_id INTO v_grant_id;

  INSERT INTO public.order_service_remedies (
    order_id, kind, from_event_id, papic_credits, grant_id, paid_php, reason, admin_user_id
  ) VALUES (
    p_order_id, 'papic_credits', v_order.event_id, v_value.credits, v_grant_id, v_value.paid_php,
    btrim(p_reason), p_admin_user_id
  )
  RETURNING remedy_id INTO v_remedy;

  RETURN jsonb_build_object(
    'ok', true, 'applied', true,
    'remedy_id', v_remedy, 'grant_id', v_grant_id,
    'credits', v_value.credits, 'event_id', v_order.event_id, 'paid_php', v_value.paid_php,
    'status_before', v_order.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_convert_order_to_papic_credits(UUID, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_convert_order_to_papic_credits(UUID, INTEGER, TEXT, UUID) TO service_role;

-- ── 6) Move to the buyer's next event ───────────────────────────────────────
-- Returns { ok, applied, refusal?, remedy_id?, from_event_id?, to_event_id?, grants_moved? }.
CREATE OR REPLACE FUNCTION public.admin_move_order_to_next_event(
  p_order_id UUID,
  p_to_event_id UUID,
  p_reason TEXT,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order    RECORD;
  v_paid     NUMERIC(12, 2);
  v_refusal  TEXT;
  v_next     UUID;
  v_used     INTEGER;
  v_moved    INTEGER;
  v_remedy   UUID;
  v_prior    UUID;
BEGIN
  IF p_to_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'no_target');
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'short_reason');
  END IF;

  SELECT o.order_id, o.status::text AS status, o.vendor_profile_id, o.user_id, o.event_id
    INTO v_order
    FROM public.orders o
   WHERE o.order_id = p_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'not_found');
  END IF;

  -- Already there: the first press of a double click moved it. Nothing new.
  IF v_order.event_id = p_to_event_id THEN
    SELECT r.remedy_id INTO v_prior
      FROM public.order_service_remedies r
     WHERE r.order_id = p_order_id AND r.kind = 'next_event' AND r.to_event_id = p_to_event_id
     ORDER BY r.created_at DESC
     LIMIT 1;
    IF v_prior IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'applied', false, 'remedy_id', v_prior,
                                'to_event_id', p_to_event_id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'refusal', 'same_event');
  END IF;

  -- Its value already became credits; it cannot also move.
  IF EXISTS (SELECT 1 FROM public.order_service_remedies r
              WHERE r.order_id = p_order_id AND r.kind = 'papic_credits') THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'already_converted');
  END IF;

  SELECT COALESCE(sum(p.amount_php), 0) INTO v_paid
    FROM public.payments p
   WHERE p.order_id = p_order_id AND p.status::text = 'matched';

  v_refusal := public.order_remedy_refusal(
    v_order.status, v_order.vendor_profile_id, v_order.user_id, v_order.event_id, v_paid
  );
  IF v_refusal IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'refusal', v_refusal);
  END IF;

  -- 🔒 The buyer must be a host of the target. Checked on its own, before "is it
  -- the next one", so a move to someone else's event is refused by name.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = p_to_event_id
       AND m.user_id = v_order.user_id
       AND m.member_type = 'couple'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'not_owner');
  END IF;

  -- Job 22: the next event created is the only choice. No admin pick.
  SELECT n.next_event_id INTO v_next FROM public.orders_next_event(ARRAY[p_order_id]) n;
  IF v_next IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'no_next_event');
  END IF;
  IF v_next <> p_to_event_id THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'not_next_event');
  END IF;

  -- Papic credits bought for ONE camera belong to that camera's seat on this event.
  IF EXISTS (SELECT 1 FROM public.papic_event_point_grants g
              WHERE g.order_id = p_order_id AND g.seat_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'camera_credits');
  END IF;

  -- Job 22: a partly used Papic pass does not move. The pot's use is counted per
  -- event, so ANY use of this event's shared credits counts as used.
  IF EXISTS (SELECT 1 FROM public.papic_event_point_grants g
              WHERE g.order_id = p_order_id AND g.seat_id IS NULL) THEN
    SELECT COALESCE(u.points_used, 0) INTO v_used
      FROM public.papic_event_pool_usage u
     WHERE u.event_id = v_order.event_id;
    IF COALESCE(v_used, 0) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'refusal', 'credits_used');
    END IF;
  END IF;

  UPDATE public.orders
     SET event_id = p_to_event_id, updated_at = NOW()
   WHERE order_id = p_order_id;

  UPDATE public.papic_event_point_grants
     SET event_id = p_to_event_id
   WHERE order_id = p_order_id AND seat_id IS NULL;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  INSERT INTO public.order_service_remedies (
    order_id, kind, from_event_id, to_event_id, paid_php, reason, admin_user_id
  ) VALUES (
    p_order_id, 'next_event', v_order.event_id, p_to_event_id, v_paid, btrim(p_reason), p_admin_user_id
  )
  RETURNING remedy_id INTO v_remedy;

  RETURN jsonb_build_object(
    'ok', true, 'applied', true, 'remedy_id', v_remedy,
    'from_event_id', v_order.event_id, 'to_event_id', p_to_event_id,
    'grants_moved', v_moved, 'paid_php', v_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_move_order_to_next_event(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_move_order_to_next_event(UUID, UUID, TEXT, UUID) TO service_role;
