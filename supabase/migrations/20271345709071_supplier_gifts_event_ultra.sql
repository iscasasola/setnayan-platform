-- supplier_gifts_event_ultra
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- SUPPLIER GIFTS · EVENT ULTRA (owner, 2026-11-13: "Gifting Ultra: yes, add it to shop gifts and badge rewards";
-- an Ultra gift reaching an event that already holds Plus or Pro "Gives full Ultra").
--
-- Extends 20271319497337 (Plus/Pro gifts) and 20271323363853 (badge rewards) with a fourth kind, 'event_ultra',
-- re-drawing nothing — each function below is copied from its latest definition; the ONLY changes are marked 💎:
--   1. 'event_ultra' is accepted by the three gift tables, the given-unlock shape and the badge reward kind.
--   2. shop_gift_stock_status / shop_gift_reward_stock_status answer one more row.
--   3. shop_gift_deliver_unlocks_for_booking gives Ultra lines first; an Ultra line reaching a Plus or Pro event
--      gives full Ultra (EVENT_ULTRA); an event that already holds Ultra takes nothing (the unit stays in stock).
--      AI on + the row's included_papic_credits topped up, exactly as buying it does.
--   4. event_has_comp_for_sku / event_comp_active_skus: a gifted Ultra also answers for what Ultra grants
--      (COUPLE_WEBSITE_PRO, LIVE_STUDIO, PATIKTOK_COMPILER — lib/event-ultra.ts EVENT_ULTRA_GRANTS; the app's
--      ownership aliases read ORDERS only, so the gift door must say it here).
--   5. papic_events_past_fullres_clock: a GIFTED plan's fullres_extra_keep_days counts like a bought one.
-- No badge step pays Ultra yet (owner: "Ultra kind, no step yet") — that is lib/badge-rewards.ts, not SQL.
-- No price is typed: what a shop pays for an Ultra gift is the EVENT_ULTRA row's LIST price (retail_price_php) —
-- one price per gift, owner 2026-11-14 ("we only have the 10+1"); gift_price_php is not a price anywhere.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 1 · four kinds ──────────────────────────────────────────────────────────
ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_gift_kind_allowed;
ALTER TABLE public.shop_gift_purchases
  ADD CONSTRAINT shop_gift_purchases_gift_kind_allowed
  CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro', 'event_ultra'));

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_gift_kind_allowed;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_gift_kind_allowed
  CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro', 'event_ultra'));

ALTER TABLE public.vendor_proposal_shop_gifts
  DROP CONSTRAINT IF EXISTS vendor_proposal_shop_gifts_gift_kind_allowed;
ALTER TABLE public.vendor_proposal_shop_gifts
  ADD CONSTRAINT vendor_proposal_shop_gifts_gift_kind_allowed
  CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro', 'event_ultra'));

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_unlocks_sku_shape;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_unlocks_sku_shape
  CHECK (
    unlocks_sku IS NULL
    OR (kind = 'given'
        AND gift_kind IN ('event_plus', 'event_pro', 'event_ultra')
        AND unlocks_sku IN ('EVENT_PLUS', 'COUPLE_WEBSITE_PRO', 'EVENT_ULTRA'))
  );

ALTER TABLE public.shop_badge_rewards
  DROP CONSTRAINT IF EXISTS shop_badge_rewards_reward_kind_allowed;
ALTER TABLE public.shop_badge_rewards
  ADD CONSTRAINT shop_badge_rewards_reward_kind_allowed
  CHECK (reward_kind IN ('papic', 'event_plus', 'event_pro', 'event_ultra', 'fee_waiver'));

-- ── 2 · the stock, one row per kind (💎 + event_ultra) ──────────────────────
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

CREATE OR REPLACE FUNCTION public.shop_gift_reward_stock_status(
  p_vendor_profile_id UUID,
  p_except_event_id   UUID DEFAULT NULL
)
 RETURNS TABLE (gift_kind TEXT, earned INTEGER, used INTEGER)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH kinds(gift_kind) AS (
    VALUES ('papic'::TEXT), ('event_plus'::TEXT), ('event_pro'::TEXT), ('event_ultra'::TEXT)
  ),
  lines AS (
    SELECT g.gift_kind, g.credits, g.proposal_id, p.event_id, p.status, p.valid_until,
           EXISTS (
             SELECT 1 FROM public.event_vendors ev
              WHERE ev.event_id = p.event_id
                AND ev.marketplace_vendor_id = p_vendor_profile_id
                AND ev.deposit_acknowledged_at IS NOT NULL
           ) AS paid,
           EXISTS (
             SELECT 1 FROM public.shop_gift_stock_entries e
              WHERE e.vendor_profile_id = p_vendor_profile_id
                AND e.proposal_id = g.proposal_id
                AND e.gift_kind = g.gift_kind
                AND e.kind = 'given'
           ) AS delivered
      FROM public.vendor_proposal_shop_gifts g
      JOIN public.vendor_proposals p ON p.proposal_id = g.proposal_id
     WHERE g.vendor_profile_id = p_vendor_profile_id
       AND g.from_badge_reward
  )
  SELECT k.gift_kind,
         COALESCE((SELECT SUM(e.delta) FROM public.shop_gift_stock_entries e
                    WHERE e.vendor_profile_id = p_vendor_profile_id
                      AND e.gift_kind = k.gift_kind
                      AND e.kind = 'badge_reward'), 0)::INTEGER,
         COALESCE((SELECT SUM(l.credits) FROM lines l
                    WHERE l.gift_kind = k.gift_kind
                      AND (
                        l.delivered
                        OR (
                          l.event_id IS NOT NULL
                          AND (p_except_event_id IS NULL OR l.event_id <> p_except_event_id)
                          AND (l.gift_kind = 'papic' OR NOT l.paid)
                          AND (
                            l.status = 'accepted'
                            OR (l.status IN ('sent', 'viewed')
                                AND (l.valid_until IS NULL
                                     OR l.valid_until >= (NOW() AT TIME ZONE 'Asia/Manila')::date))
                          )
                        )
                      )), 0)::INTEGER
    FROM kinds k;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_reward_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_reward_stock_status(UUID, UUID) TO authenticated, service_role;

-- ── 3 · the door an unlock gift takes (💎 Ultra lines first; full Ultra on a Plus/Pro event) ──
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
  IF v_proposal IS NULL THEN
    RETURN jsonb_build_object('status', 'no_accepted_quote');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_proposal_shop_gifts g
     WHERE g.proposal_id = v_proposal
       AND g.gift_kind IN ('event_plus', 'event_pro', 'event_ultra')
  ) THEN
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  -- The same per-shop lock as the Papic door: two doors clearing one payment give once.
  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || v_shop::text, 0));

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;

  FOREACH v_kind IN ARRAY ARRAY['event_ultra', 'event_pro', 'event_plus'] LOOP
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
      -- 💎 Ultra holds everything; Pro holds everything but Ultra. An Ultra gift reaching a Plus or Pro event
      -- gives full Ultra (owner 2026-11-13: "Gives full Ultra").
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

COMMENT ON FUNCTION public.shop_gift_deliver_unlocks_for_booking(UUID, TEXT) IS
  'The door an Event Plus / Event Pro / Event Ultra supplier gift takes into a couple''s event, at their first '
  'payment, beside shop_gift_deliver_for_booking (Papic). p_event_has (none|plus|pro|ultra) is what the event '
  'already holds, from the app''s entitlement chain. Ultra lines first: an Ultra gift on a Plus or Pro event gives '
  'full Ultra (owner 2026-11-13); a second Plus becomes Pro (owner 2026-11-05). An event that already holds the '
  'gifted plan or a higher one takes nothing and the unit stays in stock. Turns Setnayan AI on and tops up the '
  'included Papic credits, as buying it does. Service-role only.';

-- ── 4 · the badge reward door (💎 + event_ultra) ────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_badge_reward_grant(
  p_vendor_profile_id UUID,
  p_reward_key        TEXT,
  p_badge             TEXT,
  p_reward_kind       TEXT,
  p_units             INTEGER,
  p_credits_each      INTEGER,
  p_note              TEXT DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_reward UUID;
  v_delta  INTEGER;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_reward_key IS NULL OR btrim(p_reward_key) = ''
     OR p_badge IS NULL OR btrim(p_badge) = ''
     OR p_reward_kind IS NULL OR p_reward_kind NOT IN ('papic', 'event_plus', 'event_pro', 'event_ultra', 'fee_waiver')
     OR p_units IS NULL OR p_units < 1 OR p_units > 10 THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  IF p_reward_kind = 'fee_waiver' THEN
    IF p_units <> 1 THEN RETURN jsonb_build_object('status', 'bad_input'); END IF;
    v_delta := 0;
  ELSIF p_reward_kind = 'papic' THEN
    -- The smallest pack's credits, read by the app from the catalogue. Never typed.
    IF p_credits_each IS NULL OR p_credits_each < 1 THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_delta := p_units * p_credits_each;
  ELSE
    v_delta := p_units;   -- one unlock each
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || p_vendor_profile_id::text, 0));

  INSERT INTO public.shop_badge_rewards
    (vendor_profile_id, reward_key, badge, reward_kind, units, stock_delta, note)
  VALUES
    (p_vendor_profile_id, btrim(p_reward_key), btrim(p_badge), p_reward_kind, p_units, v_delta, p_note)
  ON CONFLICT (vendor_profile_id, reward_key) DO NOTHING
  RETURNING reward_id INTO v_reward;

  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  IF p_reward_kind <> 'fee_waiver' THEN
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, badge_reward_id, note)
    VALUES
      (p_vendor_profile_id, p_reward_kind, v_delta, 'badge_reward', v_reward,
       COALESCE(p_note, 'Badge reward'));
  END IF;

  RETURN jsonb_build_object('status', 'granted', 'reward_id', v_reward);
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_badge_reward_grant(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_badge_reward_grant(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT)
  TO service_role;

-- ── 5 · the gifted-access readers (💎 a gifted Ultra brings what Ultra grants) ──
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
  -- 🎁 A supplier's Event Plus / Event Pro / Event Ultra gift, given to THIS event (20271319497337). 💎 A gifted
  -- Ultra also answers for what Ultra grants (lib/event-ultra.ts EVENT_ULTRA_GRANTS — the app's aliases cover ORDERS
  -- only, so the gift door must say it here; `event-ultra-gift-grants-match.test.ts` holds the two lists equal).
  OR EXISTS (
    SELECT 1
      FROM public.shop_gift_stock_entries e
     WHERE e.event_id = p_event_id
       AND e.kind = 'given'
       AND (
            e.unlocks_sku = p_service_key
         OR (e.unlocks_sku = 'EVENT_ULTRA'
             AND p_service_key = ANY (ARRAY['COUPLE_WEBSITE_PRO', 'LIVE_STUDIO', 'PATIKTOK_COMPILER']))
       )
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
  -- 💎 A gifted Ultra also brings what Ultra grants (EVENT_ULTRA_GRANTS, lib/event-ultra.ts).
  SELECT array_agg(DISTINCT s) INTO v_gifted
    FROM (
      SELECT e.unlocks_sku AS s
        FROM public.shop_gift_stock_entries e
       WHERE e.event_id = p_event_id
         AND e.kind = 'given'
         AND e.unlocks_sku IS NOT NULL
      UNION
      SELECT g.s
        FROM public.shop_gift_stock_entries e
        CROSS JOIN LATERAL unnest(ARRAY['COUPLE_WEBSITE_PRO', 'LIVE_STUDIO', 'PATIKTOK_COMPILER']) AS g(s)
       WHERE e.event_id = p_event_id
         AND e.kind = 'given'
         AND e.unlocks_sku = 'EVENT_ULTRA'
    ) x;
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

-- ── 6 · originals kept for a GIFTED plan too (💎) ────────────────────────────
CREATE OR REPLACE FUNCTION public.papic_events_past_fullres_clock(
  p_retention_days  INTEGER,
  p_post_event_days INTEGER
) RETURNS TABLE (event_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_use AS (
    SELECT e.event_id,
           LEAST(
             COALESCE((SELECT MIN(p.captured_at) FROM public.papic_photos p
                        WHERE p.event_id = e.event_id), 'infinity'::timestamptz),
             COALESCE((SELECT MIN(g.captured_at) FROM public.papic_guest_captures g
                        WHERE g.event_id = e.event_id), 'infinity'::timestamptz)
           ) AS started_at,
           GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date) AS event_last_day,
           -- 💎 Event Ultra (owner 2026-11-13): a paid plan may hold originals longer.
           -- 🎁 …and so does a plan a supplier GAVE the event (20271345709071): a gifted Ultra keeps originals
           -- exactly as long as a bought one.
           COALESCE((
             SELECT MAX(GREATEST(c.fullres_extra_keep_days, 0))
               FROM (
                 SELECT o.service_key AS code
                   FROM public.orders o
                  WHERE o.event_id = e.event_id
                    AND o.status IN ('paid', 'fulfilled')
                 UNION ALL
                 SELECT g.unlocks_sku
                   FROM public.shop_gift_stock_entries g
                  WHERE g.event_id = e.event_id
                    AND g.kind = 'given'
                    AND g.unlocks_sku IS NOT NULL
               ) held
               JOIN public.platform_retail_catalog_v2 c ON c.service_code = held.code
           ), 0) AS extra_keep_days
      FROM public.events e
  )
  SELECT f.event_id
    FROM first_use f
   WHERE f.started_at <> 'infinity'::timestamptz
     AND NOW() >= f.started_at + make_interval(days => GREATEST(p_retention_days, 0))
     AND (
       f.event_last_day IS NULL
       OR NOW() >= (f.event_last_day::timestamptz
                    + make_interval(days => GREATEST(p_post_event_days, 0) + f.extra_keep_days))
     );
$$;

REVOKE ALL ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  TO service_role;

COMMIT;
