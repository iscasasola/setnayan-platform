-- ============================================================================
-- PAPIC IS THREE PACKS — ₱90 = 150 · ₱490 = 1,000 · ₱990 = 3,000 CREDITS
-- AND NO SIGN-UP (−40%) PRICE ON ANYTHING
-- ============================================================================
--
-- ⚖ OWNER 2026-11-03 (DECISION_LOG "PAPIC IS THREE PACKS"), verbatim:
--   *"we want 3000 credits at 990"* · *"490 @ 1000 credits / 90 @ 150 credits"*
--   · *"lets just have those prices"* · *"drop the 40% on all then"*.
--   Trigger: a competitor sells ₱999 / 3,000; ours was ₱2,214.
--
-- ── 1 · THE THREE PACKS ─────────────────────────────────────────────────────
--   PAPIC_GUEST_150   150 credits   ₱90    (new row)
--   PAPIC_GUEST_1K  1,000 credits   ₱490   (was ₱929)
--   PAPIC_GUEST     3,000 credits   ₱990   (was ₱2,214 — this code IS the 3,000 rung)
--   Repeatable and stacking, like every rung since 20271019231590. Same price on
--   web and in the app (the App Store products are named in lib/iap/products.ts).
--   Per credit: ₱0.60 · ₱0.49 · ₱0.33 — buying more never costs more per credit.
--
-- ── 2 · EVERY OTHER RUNG COMES OFF SALE ─────────────────────────────────────
--   Deactivated (is_active = FALSE, retired_at stamped), NEVER deleted. Balances
--   people already hold are untouched: they live in the pool ledger, not here.
--   Activation hooks in lib/sku-activation.ts STAY, so an order minted before
--   today still converts to credits on approval.
--
-- ── 3 · NO SIGN-UP PRICE ────────────────────────────────────────────────────
--   The one house dial goes to 0 (the two retired twins with it), its column
--   default goes to 0, and every per-row `onboarding_price_php` is cleared — so
--   `setupPricePhp` returns the regular price for every product, the welcome
--   price has nothing to discount, and the Setnayan AI comeback offer (half of
--   a stored sign-up saving) fails closed to "no offer", as it was built to.
--   The dial and the column are KEPT (Rule 0.3: a value, not a schema change);
--   an admin can still set one later, and that would be a new owner decision.
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _packs (service_code TEXT, credits INTEGER, php NUMERIC, sort_order INTEGER) ON COMMIT DROP;
INSERT INTO _packs (service_code, credits, php, sort_order) VALUES
  ('PAPIC_GUEST_150',  150,  90.00, 3),
  ('PAPIC_GUEST_1K',  1000, 490.00, 30),
  ('PAPIC_GUEST',     3000, 990.00, 40);

-- ── 1a · the catalog rows (the price) ───────────────────────────────────────
-- `saas_overhead_cost_php` is NOT NULL with no default; ₱0.024 a credit is the
-- rate every sibling row already carries.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, onboarding_price_php,
   saas_overhead_cost_php, description, is_active, billing_period,
   is_pax_priced, is_token_able)
SELECT
  p.service_code,
  'Papic — add ' || to_char(p.credits, 'FM999,999') || ' credits',
  p.php,
  NULL,
  ROUND(p.credits * 0.024, 2),
  'Adds ' || to_char(p.credits, 'FM999,999') ||
    ' credits to the event''s shared pot. Added on top of whatever is already there, and repeatable.',
  TRUE, 'one_time', FALSE, FALSE
FROM _packs p
ON CONFLICT (service_code) DO UPDATE
   SET retail_price_php       = EXCLUDED.retail_price_php,
       onboarding_price_php   = NULL,
       saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
       is_active              = TRUE,
       retired_at             = NULL,
       billing_period         = 'one_time',
       is_pax_priced          = FALSE,
       updated_at             = NOW();

-- ── 1b · the tier rows (how many credits each pack grants) ──────────────────
INSERT INTO public.papic_pass_tiers (service_code, points, is_topup, sort_order, is_active)
SELECT p.service_code, p.credits, FALSE, p.sort_order, TRUE FROM _packs p
ON CONFLICT (service_code) DO UPDATE
   SET points     = EXCLUDED.points,
       is_topup   = FALSE,
       sort_order = EXCLUDED.sort_order,
       is_active  = TRUE;

-- ── 2 · every other rung off sale — deactivated, never deleted ──────────────
UPDATE public.papic_pass_tiers
   SET is_active = FALSE
 WHERE service_code LIKE 'PAPIC_GUEST%'
   AND service_code NOT IN (SELECT service_code FROM _packs)
   AND is_active;

UPDATE public.platform_retail_catalog_v2
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         'Owner 2026-11-03: Papic is three packs (150 · 1,000 · 3,000). Balances kept.'),
       updated_at        = NOW()
 WHERE service_code LIKE 'PAPIC_GUEST%'
   AND service_code NOT IN (SELECT service_code FROM _packs)
   AND is_active;

-- ── 3 · no sign-up price, on anything ───────────────────────────────────────
ALTER TABLE public.platform_settings
  ALTER COLUMN onboarding_discount_pct SET DEFAULT 0;

UPDATE public.platform_settings
   SET onboarding_discount_pct   = 0,
       papic_signup_discount_pct = 0,
       ai_signup_discount_pct    = 0,
       updated_at = NOW()
 WHERE id = 1
   AND (onboarding_discount_pct   IS DISTINCT FROM 0
     OR papic_signup_discount_pct IS DISTINCT FROM 0
     OR ai_signup_discount_pct    IS DISTINCT FROM 0);

UPDATE public.platform_retail_catalog_v2
   SET onboarding_price_php = NULL,
       updated_at = NOW()
 WHERE onboarding_price_php IS NOT NULL;

COMMENT ON COLUMN public.platform_settings.onboarding_discount_pct IS
  'The sign-up discount. 0 since 2026-11-03 (owner: "drop the 40% on all then") — there is no sign-up or welcome price on any product. Kept as a dial; setting it above 0 is a new owner decision.';


-- ── 3b · the Setnayan gift stops at the top pack on sale ────────────────────
-- The supplier "Exclusive" gift (owner 2026-09-09) was priced off the 50,000
-- rung and refused to price without it. That rung is off sale above, so every
-- gift would silently become zero. It now caps at the largest live rung (never
-- above 50,000), priced from that rung — today 3,000 credits for ₱990. The same
-- change lands in apps/web/lib/setnayan-gift.ts (`giftCapRung`); the db test
-- the-gift-reaches-the-couple asserts the two agree. Owner to confirm (PR body).
CREATE OR REPLACE FUNCTION public.setnayan_gift_for_fee(p_fee_centavos BIGINT)
RETURNS TABLE (credits INTEGER, charge_centavos BIGINT, capped BOOLEAN)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  -- The owner's two RULES. Mirrored in apps/web/lib/setnayan-gift.ts
  -- (GIFT_SHARE_OF_FEE_PCT · GIFT_CAP_CREDITS); a db test asserts they agree.
  c_share_pct CONSTANT BIGINT := 40;
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

  -- 40% of the fee, FLOORED to the centavo — a ceiling, never exceeded.
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
  'The Setnayan gift a booking fee (centavos) buys: 40% of it, floored, spent '
  'proportionally along the LIVE PAPIC_GUEST* ladder (regular price), capped at '
  'the top pack on sale (never above 50,000 credits) with the charge capped at that pack''s price; 0 below the '
  'smallest rung. Mirror of setnayanGiftForFee in apps/web/lib/setnayan-gift.ts.';

-- ── 4 · read it back, or refuse ─────────────────────────────────────────────
DO $$
DECLARE
  v_bad TEXT;
  v_on  INTEGER;
  v_pct NUMERIC;
  v_ovr INTEGER;
BEGIN
  SELECT string_agg(p.service_code, ', ') INTO v_bad
    FROM _packs p
    LEFT JOIN public.platform_retail_catalog_v2 c
      ON c.service_code = p.service_code AND c.is_active AND c.retail_price_php = p.php
    LEFT JOIN public.papic_pass_tiers t
      ON t.service_code = p.service_code AND t.is_active AND t.points = p.credits
   WHERE c.service_code IS NULL OR t.service_code IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'papic_is_three_packs: these packs did not land as specified — %', v_bad;
  END IF;

  SELECT count(*) INTO v_on FROM public.papic_pass_tiers
   WHERE is_active AND service_code LIKE 'PAPIC_GUEST%';
  IF v_on <> 3 THEN
    RAISE EXCEPTION 'papic_is_three_packs: % pool rungs on sale, expected 3', v_on;
  END IF;

  SELECT count(*) INTO v_on FROM public.platform_retail_catalog_v2
   WHERE is_active AND service_code LIKE 'PAPIC_GUEST%';
  IF v_on <> 3 THEN
    RAISE EXCEPTION 'papic_is_three_packs: % Papic catalog rows on sale, expected 3', v_on;
  END IF;

  SELECT onboarding_discount_pct INTO v_pct FROM public.platform_settings WHERE id = 1;
  IF v_pct IS NOT NULL AND v_pct <> 0 THEN
    RAISE EXCEPTION 'papic_is_three_packs: onboarding_discount_pct is %, want 0', v_pct;
  END IF;

  SELECT count(*) INTO v_ovr FROM public.platform_retail_catalog_v2
   WHERE onboarding_price_php IS NOT NULL;
  IF v_ovr <> 0 THEN
    RAISE EXCEPTION 'papic_is_three_packs: % rows still carry a sign-up price', v_ovr;
  END IF;
END $$;

COMMIT;
