-- gift_bundles_and_papic_packs
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- SUPPLIER GIFTS · G1 — BUY 10, GET 1 FREE BUNDLES · PAPIC COUNTED IN PACKS ·
-- ONE PRICE PER GIFT (owner, DECISION_LOG 2026-11-14):
--   · "BUY 10, GET 1 FREE" — 11 × Papic 150 ₱990 · 11 × Papic 1000 ₱4,990 ·
--     11 × Papic 3000 ₱9,990, admin-managed catalogue rows; the app reads them.
--   · "COUNTED IN PACKS" — a shop holds so many Papic 150 / 1000 / 3000, one row
--     per size; badge-reward Papic rows become Papic 150 packs.
--   · "THE ONLY GIFT DISCOUNT IS THE 10+1" — gift_price_php is not a price
--     anywhere: every single gift is at retail_price_php, from stock or on the
--     booking fee. The column is KEPT (never dropped); nothing reads it as a price.
--   · "GIFT DESIGN APPROVED — WITH FABLE'S EIGHT PICKS" — (4) every shop may buy
--     bundles; (5) a bundle only fills stock, each pack goes on a quote one at a
--     time at list price.
--
-- ADD / LOOSEN ONLY:
--   1. platform_retail_catalog_v2 + bundle_of_service_code, bundle_quantity
--      (customer-facing → SELECT-granted like the rest of the catalogue), and the
--      three bundle rows (ON CONFLICT DO NOTHING: the admin owns them after this).
--   2. shop_gift_purchases + packs_each, bundle_code; price_basis also 'bundle'.
--   3. shop_gift_stock_entries + pack_code, packs (Papic rows: how many of WHICH
--      pack this row moves; `delta` stays the credits, so every existing reader
--      of the credit balance is unchanged). Badge-reward Papic rows are filled in
--      (Papic 150 packs) by a BEFORE INSERT trigger and backfilled once below.
--   4. shop_gift_pack_stock_status — the stock per pack: balance and held, in packs.
--   5. shop_gift_deliver_for_booking — re-created from its latest body
--      (20271309169686); it now gives per pack and writes pack_code/packs on
--      its 'given' rows, and refuses when THAT pack is short.
--   6. vendor_pays_gift_price — answers FALSE: nobody pays a gift price any more,
--      so setnayan_gift_for_fee(BIGINT, UUID) charges every shop the list price
--      (its body is untouched; it already falls back to list on FALSE).
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 1 · bundles are catalogue rows ──────────────────────────────────────────
ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS bundle_of_service_code TEXT;
ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS bundle_quantity INTEGER;

ALTER TABLE public.platform_retail_catalog_v2
  DROP CONSTRAINT IF EXISTS platform_retail_catalog_v2_bundle_shape;
ALTER TABLE public.platform_retail_catalog_v2
  ADD CONSTRAINT platform_retail_catalog_v2_bundle_shape CHECK (
    (bundle_of_service_code IS NULL AND bundle_quantity IS NULL)
    OR (bundle_of_service_code IS NOT NULL
        AND length(btrim(bundle_of_service_code)) > 0
        AND bundle_of_service_code <> service_code
        AND bundle_quantity BETWEEN 2 AND 1000)
  );

COMMENT ON COLUMN public.platform_retail_catalog_v2.bundle_of_service_code IS
  'On a GIFT BUNDLE row (owner 2026-11-14 "buy 10, get 1 free"): the pack this bundle holds '
  '(a PAPIC_GUEST* service_code). NULL on every other row. Read by lib/shop-gifts.ts '
  'shopGiftBundlesFrom — the pack and the count are never typed in code.';
COMMENT ON COLUMN public.platform_retail_catalog_v2.bundle_quantity IS
  'On a GIFT BUNDLE row: how many of bundle_of_service_code one bundle lands in a shop''s '
  'gift stock (11 = buy 10, get 1 free). NULL on every other row.';

-- Customer-facing (a supplier reads what a bundle holds) — granted like the rest
-- of the catalogue's public columns (20271201188010 maintenance note).
GRANT SELECT (bundle_of_service_code, bundle_quantity)
  ON public.platform_retail_catalog_v2 TO anon, authenticated;

-- The three bundles at the owner's figures (DECISION_LOG 2026-11-14). Seeded once;
-- after this the admin owns them (Admin › Pricing), so a re-apply never resets them.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, onboarding_price_php,
   saas_overhead_cost_php, description, is_active, billing_period,
   is_pax_priced, is_token_able, bundle_of_service_code, bundle_quantity)
VALUES
  ('GIFT_BUNDLE_PAPIC_150', '11 × Papic 150', 990.00, NULL, 0,
   'Buy 10, get 1 free: eleven Papic 150 gifts for your couples.',
   TRUE, 'one_time', FALSE, FALSE, 'PAPIC_GUEST_150', 11),
  ('GIFT_BUNDLE_PAPIC_1K', '11 × Papic 1000', 4990.00, NULL, 0,
   'Buy 10, get 1 free: eleven Papic 1000 gifts for your couples.',
   TRUE, 'one_time', FALSE, FALSE, 'PAPIC_GUEST_1K', 11),
  ('GIFT_BUNDLE_PAPIC_3000', '11 × Papic 3000', 9990.00, NULL, 0,
   'Buy 10, get 1 free: eleven Papic 3000 gifts for your couples.',
   TRUE, 'one_time', FALSE, FALSE, 'PAPIC_GUEST', 11)
ON CONFLICT (service_code) DO NOTHING;

-- ── 2 · what a gift order bought: packs per unit, and a bundle ──────────────
ALTER TABLE public.shop_gift_purchases
  ADD COLUMN IF NOT EXISTS packs_each INTEGER;
ALTER TABLE public.shop_gift_purchases
  ADD COLUMN IF NOT EXISTS bundle_code TEXT;

ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_packs_each_positive;
ALTER TABLE public.shop_gift_purchases
  ADD CONSTRAINT shop_gift_purchases_packs_each_positive
  CHECK (packs_each IS NULL OR (packs_each >= 1 AND packs_each <= 1000));

-- Loosened: 'bundle' = a buy-10-get-1 bundle at its catalogue price.
ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_price_basis_allowed;
ALTER TABLE public.shop_gift_purchases
  ADD CONSTRAINT shop_gift_purchases_price_basis_allowed
  CHECK (price_basis IN ('gift', 'list', 'bundle'));

COMMENT ON COLUMN public.shop_gift_purchases.packs_each IS
  'How many packs of service_code ONE unit of this order lands (11 for a buy-10-get-1 '
  'bundle, read from the catalogue''s bundle_quantity at purchase). NULL = 1.';
COMMENT ON COLUMN public.shop_gift_purchases.bundle_code IS
  'The bundle''s own catalogue service_code (GIFT_BUNDLE_*) when this order bought a bundle.';

-- ── 3 · the stock ledger knows WHICH pack a Papic row moves ─────────────────
ALTER TABLE public.shop_gift_stock_entries
  ADD COLUMN IF NOT EXISTS pack_code TEXT;
ALTER TABLE public.shop_gift_stock_entries
  ADD COLUMN IF NOT EXISTS packs INTEGER;

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_packs_shape;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_packs_shape CHECK (
    (pack_code IS NULL AND packs IS NULL)
    OR (gift_kind = 'papic' AND pack_code IS NOT NULL AND packs IS NOT NULL
        AND packs <> 0 AND sign(packs) = sign(delta))
  );

CREATE INDEX IF NOT EXISTS shop_gift_stock_entries_pack_idx
  ON public.shop_gift_stock_entries (vendor_profile_id, pack_code)
  WHERE pack_code IS NOT NULL;

COMMENT ON COLUMN public.shop_gift_stock_entries.pack_code IS
  'On a Papic row (owner 2026-11-14 "counted in packs"): which pack this row moves '
  '(a PAPIC_GUEST* service_code). delta stays the credits; packs is the count.';
COMMENT ON COLUMN public.shop_gift_stock_entries.packs IS
  'On a Papic row: how many packs of pack_code this row moves, signed like delta.';

-- The smallest pack on sale — "the lowest gift", the one a badge reward gives.
-- Derived from the live catalogue, never typed.
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

-- Read only by the badge-reward trigger and the backfill below (both run as the owner): no session calls it.
REVOKE ALL ON FUNCTION public.shop_gift_smallest_papic_pack() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_smallest_papic_pack() TO service_role;

-- A badge reward's Papic is Papic 150 packs (DECISION_LOG 2026-11-14): fill the
-- pack on the way in, so shop_badge_reward_grant needs no change.
CREATE OR REPLACE FUNCTION public.tg_shop_gift_stock_entries_badge_pack()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code  TEXT;
  v_units INTEGER;
BEGIN
  IF NEW.gift_kind = 'papic' AND NEW.kind = 'badge_reward' AND NEW.pack_code IS NULL THEN
    SELECT s.service_code INTO v_code FROM public.shop_gift_smallest_papic_pack() s;
    SELECT r.units INTO v_units FROM public.shop_badge_rewards r WHERE r.reward_id = NEW.badge_reward_id;
    IF v_code IS NOT NULL AND COALESCE(v_units, 0) > 0 THEN
      NEW.pack_code := v_code;
      NEW.packs := v_units;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- A trigger function is never called directly: nobody but the trigger may EXECUTE it.
REVOKE ALL ON FUNCTION public.tg_shop_gift_stock_entries_badge_pack() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS shop_gift_stock_entries_badge_pack ON public.shop_gift_stock_entries;
CREATE TRIGGER shop_gift_stock_entries_badge_pack
  BEFORE INSERT ON public.shop_gift_stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_gift_stock_entries_badge_pack();

-- Backfill (fills NULL columns only — nothing that was written is changed).
-- Measured 2026-11-14: the only Papic rows in prod are 5 badge rewards of 150.
UPDATE public.shop_gift_stock_entries e
   SET pack_code = s.service_code,
       packs     = r.units
  FROM public.shop_badge_rewards r,
       public.shop_gift_smallest_papic_pack() s
 WHERE e.gift_kind = 'papic'
   AND e.kind = 'badge_reward'
   AND e.pack_code IS NULL
   AND r.reward_id = e.badge_reward_id
   AND r.units > 0;

UPDATE public.shop_gift_stock_entries e
   SET pack_code = p.service_code,
       packs     = sign(e.delta)::INTEGER * p.quantity * COALESCE(p.packs_each, 1)
  FROM public.shop_gift_purchases p
 WHERE e.gift_kind = 'papic'
   AND e.kind IN ('bought', 'reversal')
   AND e.pack_code IS NULL
   AND p.order_id = e.order_id
   AND p.gift_kind = 'papic';

-- ── 4 · the stock per pack ──────────────────────────────────────────────────
-- balance = SUM(packs) per pack. held = per live quote, its lines of that pack
-- (one row per pack) minus what that shop already gave that event of that pack,
-- never below zero. "Live" is shop_gift_stock_status's test, unchanged. Papic
-- holds even after the first payment (like the credit status): delivery is what
-- releases it. SECURITY INVOKER, like shop_gift_stock_status.
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
    SELECT g.service_code AS pack_code, l.event_id, l.proposal_id, COUNT(*)::INTEGER AS packs
      FROM live l
      JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = l.proposal_id
     WHERE g.gift_kind = 'papic'
     GROUP BY g.service_code, l.event_id, l.proposal_id
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
    SELECT pr.pack_code FROM promised pr
  )
  SELECT c.pack_code,
         COALESCE((SELECT SUM(e.packs) FROM public.shop_gift_stock_entries e
                    WHERE e.vendor_profile_id = p_vendor_profile_id
                      AND e.pack_code = c.pack_code), 0)::INTEGER,
         COALESCE((SELECT SUM(GREATEST(0, pr.packs - COALESCE(gv.packs, 0)))
                     FROM promised pr
                     LEFT JOIN given gv
                       ON gv.event_id = pr.event_id AND gv.pack_code = pr.pack_code
                    WHERE pr.pack_code = c.pack_code), 0)::INTEGER
    FROM codes c;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_pack_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_pack_stock_status(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.shop_gift_pack_stock_status(UUID, UUID) IS
  'A shop''s Papic gift stock COUNTED IN PACKS (owner 2026-11-14): one row per pack held '
  'or promised — balance (SUM of packs) and held (packs live quotes promise that the '
  'event has not received). Free to offer = balance − held. p_except_event_id as in '
  'shop_gift_stock_status.';

-- ── 5 · the one door, per pack ──────────────────────────────────────────────
-- Re-created from 20271309169686. 🔢 CHANGED: wanted and given are counted PER
-- PACK (a quote line is one pack); a pack this event lacks must be in stock as
-- that pack, else 'short' and nothing is written; one 'given' row per pack with
-- pack_code + packs, all pointing at the one pool grant. The pool still receives
-- CREDITS (the lines' frozen credits), exactly where a couple's own pack lands.
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
  IF v_proposal IS NULL THEN
    RETURN jsonb_build_object('status', 'no_accepted_quote');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_lines
    FROM public.vendor_proposal_shop_gifts g
   WHERE g.proposal_id = v_proposal
     AND g.gift_kind = 'papic';
  IF v_lines <= 0 THEN
    RETURN jsonb_build_object('status', 'no_gift');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_gift_stock:' || v_shop::text, 0));

  -- Per pack: the quote's lines − what this shop already gave this event of it.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'pack_code', w.pack_code,
           'packs',     w.packs - COALESCE(gv.packs, 0),
           -- the credits of the lines still owed: the pack's frozen credits per line
           'credits',   (w.packs - COALESCE(gv.packs, 0)) * w.credits_each)
           ORDER BY w.pack_code), '[]'::jsonb)
    INTO v_due
    FROM (
      SELECT g.service_code AS pack_code, COUNT(*)::INTEGER AS packs,
             (SUM(g.credits) / COUNT(*))::INTEGER AS credits_each
        FROM public.vendor_proposal_shop_gifts g
       WHERE g.proposal_id = v_proposal
         AND g.gift_kind = 'papic'
       GROUP BY g.service_code
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

  -- SHARED (seat_id NULL): the couple's pool, counted by papic_event_pool_status
  -- like a pack they bought themselves.
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

COMMENT ON FUNCTION public.shop_gift_deliver_for_booking(UUID) IS
  'The only door a supplier''s Papic gift takes into a couple''s event (owner 2026-11-04: '
  'gifts leave the stock when the couple''s first payment clears). Since 2026-11-14 counted '
  'PER PACK: gives each pack the event has not already received from that shop, refusing '
  '(writing nothing) when that pack is short; the credits land in the SHARED Papic pool '
  '(source shop_gift), under a per-shop lock. Idempotent. Service-role only.';

REVOKE ALL ON FUNCTION public.shop_gift_deliver_for_booking(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_deliver_for_booking(UUID) TO service_role;

-- ── 6 · nobody pays a gift price ────────────────────────────────────────────
-- "gift_price_php is not a price anywhere" (DECISION_LOG 2026-11-14). FALSE makes
-- setnayan_gift_for_fee(BIGINT, UUID) return the list charge for every shop — its
-- own documented fallback — with its body untouched. The app's mirror
-- (setnayanGiftForFee) no longer takes a gift-price option.
CREATE OR REPLACE FUNCTION public.vendor_pays_gift_price(p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT FALSE;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_pays_gift_price(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vendor_pays_gift_price(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.vendor_pays_gift_price(UUID) TO service_role;

COMMENT ON FUNCTION public.vendor_pays_gift_price(UUID) IS
  'Retired as a price rule 2026-11-14 (owner: the only gift discount is the buy-10-get-1 '
  'Papic bundle). Always FALSE, so every shop is charged the list price. Kept so its '
  'callers need no change.';

COMMIT;
