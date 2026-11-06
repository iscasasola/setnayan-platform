-- supplier_gifts_event_plus_and_pro
-- ============================================================================
-- SUPPLIER GIFTS · SLICE 2 — Event Plus and Event Pro as gifts (owner, 2026-11-04/05).
--
-- ⚖ DECISION_LOG (newest wins on a conflict):
--   · 2026-11-04 "SUPPLIER GIFTS: BOUGHT IN QUANTITY, KEPT AS STOCK …" — Your gifts
--     shows Event Plus and Event Pro as COUNTS beside the Papic credit balance; out of
--     stock = cannot be offered; gifts leave the stock at the couple's first payment.
--   · 2026-11-04 "GIFT PRICES" — EVENT_PLUS and COUPLE_WEBSITE_PRO carry `gift_price_php`
--     (20271308555594); Free shops pay the list price. Prices are READ by the app,
--     never typed here.
--   · 2026-11-05 owner answer (E): *"yes, the second event plus will auto upgrade
--     event pro"* — a Plus gift that lands on an event already holding Plus unlocks Pro.
--
-- WHAT THIS FILE DOES (extends slice 1's 20271309169686, re-draws nothing):
--   1. The three gift tables accept two more kinds: 'event_plus', 'event_pro'. For
--      those kinds a "credit" is ONE unlock (credits_each = 1, a stock delta of ±1,
--      a quote line of 1) — the same ledger, counted in units instead of credits.
--   2. `shop_gift_stock_entries.unlocks_sku` — on a 'given' unlock row, the product
--      the event actually received (EVENT_PLUS, or COUPLE_WEBSITE_PRO when rule E
--      upgraded a second Plus). This column IS the event's entitlement.
--   3. `shop_gift_stock_status` answers one row per kind. An unlock on a quote stops
--      being held once that booking's first payment has cleared: delivery has run,
--      and it either gave it or found the event already had Event Pro.
--   4. `shop_gift_deliver_unlocks_for_booking(event_vendor_id, event_has)` — the door
--      a Plus/Pro gift takes into the event, beside slice 1's Papic door. `event_has`
--      is what the event already holds ('none' | 'plus' | 'pro'), answered by the
--      app's full entitlement chain (orders, bundles, basket, comps, internal host) —
--      the one place that knows; this function never re-implements it.
--   5. The two gifted-access readers (`event_comp_active_skus`,
--      `event_has_comp_for_sku`) also answer for supplier-gifted unlocks — so every
--      paywall, the batch reader and `event_entitlement_facts` see the gift with no
--      app change. Copied from 20271205612762; the ONLY change is the gift union.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 1 · three kinds on every gift table ─────────────────────────────────────
ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_gift_kind_allowed;
ALTER TABLE public.shop_gift_purchases
  ADD CONSTRAINT shop_gift_purchases_gift_kind_allowed
  CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro'));

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_gift_kind_allowed;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_gift_kind_allowed
  CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro'));

ALTER TABLE public.vendor_proposal_shop_gifts
  DROP CONSTRAINT IF EXISTS vendor_proposal_shop_gifts_gift_kind_allowed;
ALTER TABLE public.vendor_proposal_shop_gifts
  ADD CONSTRAINT vendor_proposal_shop_gifts_gift_kind_allowed
  CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro'));

-- An unlock is one unit: a purchase row buys `quantity` × 1, a quote line gives 1.
ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_unlock_is_one_each;
ALTER TABLE public.shop_gift_purchases
  ADD CONSTRAINT shop_gift_purchases_unlock_is_one_each
  CHECK (gift_kind = 'papic' OR credits_each = 1);
ALTER TABLE public.vendor_proposal_shop_gifts
  DROP CONSTRAINT IF EXISTS vendor_proposal_shop_gifts_unlock_is_one;
ALTER TABLE public.vendor_proposal_shop_gifts
  ADD CONSTRAINT vendor_proposal_shop_gifts_unlock_is_one
  CHECK (gift_kind = 'papic' OR credits = 1);

-- ── 2 · what a given unlock became ──────────────────────────────────────────
ALTER TABLE public.shop_gift_stock_entries
  ADD COLUMN IF NOT EXISTS unlocks_sku TEXT;
ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_unlocks_sku_shape;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_unlocks_sku_shape
  CHECK (
    unlocks_sku IS NULL
    OR (kind = 'given'
        AND gift_kind IN ('event_plus', 'event_pro')
        AND unlocks_sku IN ('EVENT_PLUS', 'COUPLE_WEBSITE_PRO'))
  );
COMMENT ON COLUMN public.shop_gift_stock_entries.unlocks_sku IS
  'On a given Event Plus / Event Pro gift: the product the EVENT received — EVENT_PLUS, or '
  'COUPLE_WEBSITE_PRO when a second Plus upgraded it (owner 2026-11-05 "the second event plus '
  'will auto upgrade event pro"). Read by event_comp_active_skus / event_has_comp_for_sku, so it '
  'is the event''s entitlement. Written only by shop_gift_deliver_unlocks_for_booking.';

CREATE INDEX IF NOT EXISTS shop_gift_stock_entries_event_unlocks_idx
  ON public.shop_gift_stock_entries (event_id)
  WHERE unlocks_sku IS NOT NULL;

-- ── 3 · the stock, one row per kind ─────────────────────────────────────────
-- Same answer as slice 1 for 'papic' (the CTEs are slice 1's, grouped by kind).
-- For an unlock kind, a quote whose booking's first payment has cleared holds
-- nothing: delivery ran then, and either gave the unlock or found the event
-- already had Event Pro — in which case the unit stays the shop's to offer again.
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
    VALUES ('papic'::TEXT), ('event_plus'::TEXT), ('event_pro'::TEXT)
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
    SELECT g.gift_kind, l.event_id, l.proposal_id, SUM(g.credits)::INTEGER AS credits
      FROM live l
      JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = l.proposal_id
     WHERE g.gift_kind = 'papic' OR NOT l.paid
     GROUP BY g.gift_kind, l.event_id, l.proposal_id
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
         COALESCE((SELECT SUM(GREATEST(0, pr.credits - COALESCE(gv.credits, 0)))
                     FROM promised pr
                     LEFT JOIN given gv
                       ON gv.event_id = pr.event_id AND gv.gift_kind = pr.gift_kind
                    WHERE pr.gift_kind = k.gift_kind), 0)::INTEGER
    FROM kinds k;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_stock_status(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.shop_gift_stock_status(UUID, UUID) IS
  'A shop''s gift stock, one row per kind (papic credits · event_plus · event_pro units): '
  'balance (SUM of shop_gift_stock_entries) and held (what live quotes promise that the event '
  'has not received yet; an unlock stops being held once that booking''s first payment has '
  'cleared). Free to offer = balance − held. p_except_event_id leaves out the event a new quote '
  'is replacing.';

-- ── 4 · the door an Event Plus / Event Pro gift takes ───────────────────────
-- Returns jsonb:
--   {status:'ok', given:[{gift_kind, unlocks_sku, entry_id}], already_has, short}
--   {status:'nothing_to_give', already_has, short}
--   {status:'no_gift'} · {status:'no_accepted_quote'} · {status:'not_paid'} · {status:'no_booking'}
--   {status:'bad_input'}
-- Pro lines first, then Plus lines, one unit at a time, from what the event holds:
--   holds Pro              → nothing to add; the unit stays in stock (already_has)
--   a Pro line             → Event Pro
--   a Plus line, holds Plus→ Event Pro (rule E)
--   a Plus line, holds none→ Event Plus
-- Each unlock also does what buying it does: Setnayan AI on, and the product's
-- included Papic credits topped up (never added twice) — the catalogue's
-- `included_papic_credits`, exactly as lib/sku-activation.ts activateEventPlan.
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
  IF v_has IS NULL OR v_has NOT IN ('none', 'plus', 'pro') THEN
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
  IF v_proposal IS NULL THEN
    RETURN jsonb_build_object('status', 'no_accepted_quote');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_proposal_shop_gifts g
     WHERE g.proposal_id = v_proposal
       AND g.gift_kind IN ('event_plus', 'event_pro')
  ) THEN
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  -- The same per-shop lock as the Papic door: two doors clearing one payment give once.
  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || v_shop::text, 0));

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;

  FOREACH v_kind IN ARRAY ARRAY['event_pro', 'event_plus'] LOOP
    SELECT COUNT(*)::INTEGER INTO v_wanted
      FROM public.vendor_proposal_shop_gifts g
     WHERE g.proposal_id = v_proposal
       AND g.gift_kind = v_kind;
    SELECT COALESCE(-SUM(e.delta), 0)::INTEGER INTO v_given
      FROM public.shop_gift_stock_entries e
     WHERE e.vendor_profile_id = v_shop
       AND e.event_id = v_event
       AND e.gift_kind = v_kind
       AND e.kind = 'given';

    FOR i IN 1 .. GREATEST(0, v_wanted - v_given) LOOP
      IF v_has = 'pro' THEN
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
                 WHEN v_kind = 'event_pro' THEN 'COUPLE_WEBSITE_PRO'
                 WHEN v_has = 'plus' THEN 'COUPLE_WEBSITE_PRO'   -- rule E
                 ELSE 'EVENT_PLUS'
               END;

      -- What buying it would do: Setnayan AI on …
      UPDATE public.events SET setnayan_ai_active = TRUE
       WHERE event_id = v_event AND setnayan_ai_active IS DISTINCT FROM TRUE;

      -- … and the included Papic credits, topped up to this product's number.
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
      v_has := CASE WHEN v_sku = 'COUPLE_WEBSITE_PRO' THEN 'pro' ELSE 'plus' END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_any THEN 'ok' ELSE 'nothing_to_give' END,
    'given', v_out, 'already_has', v_already, 'short', v_short);
END;
$function$;

COMMENT ON FUNCTION public.shop_gift_deliver_unlocks_for_booking(UUID, TEXT) IS
  'The door an Event Plus / Event Pro supplier gift takes into a couple''s event, at their first '
  'payment (owner 2026-11-04), beside shop_gift_deliver_for_booking (Papic). p_event_has is what '
  'the event already holds, from the app''s entitlement chain. A second Plus becomes Pro (owner '
  '2026-11-05). Gives what the event has not already received from that shop, under the per-shop '
  'lock; an event that already holds Pro takes nothing and the unit stays in stock. Turns '
  'Setnayan AI on and tops up the included Papic credits, as buying it does. Service-role only.';

REVOKE ALL ON FUNCTION public.shop_gift_deliver_unlocks_for_booking(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_deliver_unlocks_for_booking(UUID, TEXT) TO service_role;

-- ── 5 · the gifted-access readers also answer for supplier gifts ─────────────
-- Copied from 20271205612762_comp_grants_event_scoped.sql. The ONLY change in
-- each is the shop-gift branch: an unlock a supplier gave THIS event (a 'given'
-- row with `unlocks_sku`) is held exactly like an event-scoped comp of that SKU.
CREATE OR REPLACE FUNCTION public.event_has_comp_for_sku(
  p_event_id    UUID,
  p_service_key TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.comp_grants cg
     WHERE cg.revoked_at IS NULL
       AND (cg.expiry IS NULL OR cg.expiry > NOW())
       AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
       AND (
            cg.scope = 'all_services'
         OR (cg.scope = 'specific_skus' AND p_service_key = ANY(cg.scoped_skus))
       )
       AND cg.user_id IN (
            -- Legacy couple host.
            SELECT em.user_id
              FROM public.event_members em
             WHERE em.event_id = p_event_id
               AND em.member_type = 'couple'
            UNION
            -- Iteration 0048 primary-host moderator (accepted, not removed).
            SELECT m.user_id
              FROM public.event_moderators m
             WHERE m.event_id = p_event_id
               AND m.removed_at IS NULL
               AND m.accepted_at IS NOT NULL
               AND m.role_subtype IN (
                 'bride','groom','partner1','partner2',
                 'parent_of_bride','parent_of_groom','wedding_planner_external'
               )
       )
  )
  -- 🎁 A supplier's Event Plus / Event Pro gift, given to THIS event (20271319497337).
  OR EXISTS (
    SELECT 1
      FROM public.shop_gift_stock_entries e
     WHERE e.event_id = p_event_id
       AND e.kind = 'given'
       AND e.unlocks_sku = p_service_key
  );
$$;

CREATE OR REPLACE FUNCTION public.event_comp_active_skus(
  p_event_id UUID
) RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hosts   UUID[];
  v_has_all BOOLEAN;
  v_skus    TEXT[];
  v_gifted  TEXT[];
BEGIN
  -- 🎁 A supplier's Event Plus / Event Pro gifts to THIS event (20271319497337) —
  -- read first: they belong to the event, so they need no host.
  SELECT array_agg(DISTINCT e.unlocks_sku) INTO v_gifted
    FROM public.shop_gift_stock_entries e
   WHERE e.event_id = p_event_id
     AND e.kind = 'given'
     AND e.unlocks_sku IS NOT NULL;
  v_gifted := COALESCE(v_gifted, ARRAY[]::TEXT[]);

  SELECT array_agg(uid) INTO v_hosts
    FROM (
      SELECT em.user_id AS uid
        FROM public.event_members em
       WHERE em.event_id = p_event_id
         AND em.member_type = 'couple'
      UNION
      SELECT m.user_id
        FROM public.event_moderators m
       WHERE m.event_id = p_event_id
         AND m.removed_at IS NULL
         AND m.accepted_at IS NOT NULL
         AND m.role_subtype IN (
           'bride','groom','partner1','partner2',
           'parent_of_bride','parent_of_groom','wedding_planner_external'
         )
    ) h;

  IF v_hosts IS NULL THEN
    RETURN v_gifted;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.comp_grants cg
     WHERE cg.user_id = ANY(v_hosts)
       AND cg.revoked_at IS NULL
       AND (cg.expiry IS NULL OR cg.expiry > NOW())
       AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
       AND cg.scope = 'all_services'
  ) INTO v_has_all;

  IF v_has_all THEN
    SELECT array_agg(service_code) INTO v_skus
      FROM public.platform_retail_catalog_v2;
    RETURN COALESCE(v_skus, ARRAY[]::TEXT[]);
  END IF;

  SELECT array_agg(DISTINCT s) INTO v_skus
    FROM (
      SELECT s
        FROM public.comp_grants cg
        CROSS JOIN LATERAL unnest(cg.scoped_skus) AS s
       WHERE cg.user_id = ANY(v_hosts)
         AND cg.revoked_at IS NULL
         AND (cg.expiry IS NULL OR cg.expiry > NOW())
         AND (cg.event_id IS NULL OR cg.event_id = p_event_id)
         AND cg.scope = 'specific_skus'
      UNION
      SELECT unnest(v_gifted)
    ) x;

  RETURN COALESCE(v_skus, ARRAY[]::TEXT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.event_has_comp_for_sku(UUID, TEXT)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.event_comp_active_skus(UUID)
  TO authenticated, anon, service_role;

COMMIT;
