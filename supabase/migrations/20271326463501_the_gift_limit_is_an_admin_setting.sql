-- the_gift_limit_is_an_admin_setting
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- THE GIFT LIMIT IS AN ADMIN SETTING — THE ONE BUILD, lane C2 (owner v112
-- answer, 8 Nov 2026: "Gift limit · % of the booking fee", default 40, set in
-- Admin › Gifts; it replaces GIFT_SHARE_OF_FEE_PCT and applies to the
-- Setnayan gift AND to a shop's bought gifts on a quote; badge rewards stay
-- outside it). Spec plans/supplier_one_build_2026-11-08 §5.3, B2 §3.1.
--
--   1. platform_settings.gift_limit_pct SMALLINT NOT NULL DEFAULT 40,
--      CHECK 0–100. platform_settings already has RLS + its read-all policy;
--      the only writer is Admin › Gifts (saveGiftLimitPct, service role,
--      audited). No new policy, no new grant.
--   2. setnayan_gift_for_fee(BIGINT) re-created from its LATEST body
--      (20271303683629) byte for byte, with ONE change: the 40 constant is a
--      read of that column (falling back to the ruled 40 only if the singleton
--      row is absent). CREATE OR REPLACE keeps the shipped REVOKE/GRANT
--      (service_role only, 20271222508050). The 2-arg wrapper
--      (20271308555594) calls this one, so it follows with no change.
--
-- Already-locked gifts do not move (event_vendors.setnayan_gift_*_at_lock,
-- 20271229508655). A change applies to the sizing of new quotes and locks.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS gift_limit_pct SMALLINT NOT NULL DEFAULT 40;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_gift_limit_pct_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_gift_limit_pct_range
  CHECK (gift_limit_pct BETWEEN 0 AND 100);

COMMENT ON COLUMN public.platform_settings.gift_limit_pct IS
  'Gift limit · % of the booking fee (owner 2026-11-08, default 40). Sizes the Setnayan gift (setnayan_gift_for_fee) '
  'and caps a shop''s bought gifts on one quote (apps/web/lib/shop-gifts.ts). Badge rewards are outside it. Written '
  'only from Admin › Gifts (saveGiftLimitPct, audited as gift_limit_pct_edit).';

CREATE OR REPLACE FUNCTION public.setnayan_gift_for_fee(p_fee_centavos BIGINT)
RETURNS TABLE (credits INTEGER, charge_centavos BIGINT, capped BOOLEAN)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  -- The owner's two RULES. The share is the ADMIN SETTING
  -- platform_settings.gift_limit_pct (owner 8 Nov 2026; default 40, the
  -- ruled default, used only if the singleton row is missing). Mirrored in
  -- apps/web/lib/setnayan-gift.ts (GIFT_LIMIT_PCT_DEFAULT + opts.limitPct ·
  -- GIFT_CAP_CREDITS); a db test asserts SQL and TS agree at 40 and at 25.
  c_share_pct BIGINT := COALESCE(
    (SELECT s.gift_limit_pct::BIGINT FROM public.platform_settings s WHERE s.id = 1), 40);
  c_cap       CONSTANT BIGINT := 50000;
  v_c         BIGINT[];
  v_p         BIGINT[];
  v_n         INTEGER;
  v_cap_price BIGINT;
  v_budget    BIGINT;
  v_charge    BIGINT;
  i           INTEGER;
BEGIN
  IF p_fee_centavos IS NULL OR p_fee_centavos <= 0 THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;

  -- The GIFT ladder: every active, unretired PAPIC_GUEST* rung with an active,
  -- non-top-up tier row, at or below the cap. REGULAR price, never onboarding.
  SELECT array_agg(t.points::BIGINT ORDER BY t.points),
         array_agg(round(c.retail_price_php * 100)::BIGINT ORDER BY t.points)
    INTO v_c, v_p
    FROM public.platform_retail_catalog_v2 c
    JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
   WHERE left(c.service_code, 11) = 'PAPIC_GUEST'
     AND c.is_active IS TRUE
     AND c.retired_at IS NULL
     AND c.retail_price_php > 0
     AND t.is_active IS TRUE
     AND t.is_topup IS NOT TRUE
     AND t.points > 0
     AND t.points <= c_cap;

  v_n := COALESCE(array_length(v_c, 1), 0);
  IF v_n = 0 THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;

  -- A ladder whose price does not rise with its credits cannot be interpolated;
  -- refuse it (no gift, nothing billed) rather than guess.
  FOR i IN 2 .. v_n LOOP
    IF v_c[i] = v_c[i - 1] OR v_p[i] <= v_p[i - 1] THEN
      RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
      RETURN;
    END IF;
  END LOOP;

  -- THE CAP IS THE TOP PACK ON SALE (2026-11-03), never above c_cap; its price
  -- is read off that live rung, so nothing is extrapolated. (Was: the 50,000
  -- rung exactly — off sale since Papic became three packs, which would have
  -- returned no gift for every booking.)
  v_cap_price := v_p[v_n];

  -- The gift limit % of the fee, FLOORED to the centavo — a ceiling, never exceeded.
  v_budget := (p_fee_centavos * c_share_pct) / 100;
  v_charge := LEAST(v_budget, v_cap_price);

  -- THE FLOOR: below the smallest rung the promise would produce nothing.
  IF v_charge < v_p[1] THEN
    RETURN QUERY SELECT 0, 0::BIGINT, FALSE;
    RETURN;
  END IF;

  IF v_budget >= v_cap_price THEN
    RETURN QUERY SELECT v_c[v_n]::INTEGER, v_cap_price, TRUE;
    RETURN;
  END IF;

  -- PROPORTIONAL: interpolate between the two rungs that bracket the charge,
  -- rounding the photo count half up — floor((2n + d) / 2d), exactly as the TS.
  FOR i IN 1 .. v_n LOOP
    IF v_charge = v_p[i] OR i = v_n THEN
      RETURN QUERY SELECT v_c[i]::INTEGER, v_charge, FALSE;
      RETURN;
    END IF;
    IF v_charge < v_p[i + 1] THEN
      RETURN QUERY SELECT
        (v_c[i] + (2 * (v_charge - v_p[i]) * (v_c[i + 1] - v_c[i]) + (v_p[i + 1] - v_p[i]))
                  / (2 * (v_p[i + 1] - v_p[i])))::INTEGER,
        v_charge,
        FALSE;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT 0, 0::BIGINT, FALSE; -- unreachable
END;
$$;

COMMENT ON FUNCTION public.setnayan_gift_for_fee(BIGINT) IS
  'The Setnayan gift a booking fee (centavos) buys: platform_settings.gift_limit_pct of it (default 40), floored, spent '
  'proportionally along the LIVE PAPIC_GUEST* ladder (regular price), capped at '
  'the top pack on sale (never above 50,000 credits) with the charge capped at that pack''s price; 0 below the '
  'smallest rung. Mirror of setnayanGiftForFee in apps/web/lib/setnayan-gift.ts.';

COMMIT;
