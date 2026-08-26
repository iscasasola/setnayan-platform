-- ============================================================================
-- THE PAPIC LADDER BECOMES A SCROLLABLE LIST — 16 RUNGS, PRICED OFF ₱1/CREDIT
-- ============================================================================
--
-- Owner 2026-08-26, given as a table and then as the rule behind it:
-- *"if they were to add a number of shots, and we have a scrollable amount it
-- would be something like this if compared to 1 peso = 1 credit."*
--
-- So there are two numbers on every rung and only ONE of them is stored:
--
--   · REGULAR price  = the credits themselves. ₱1 buys 1 shot. It is not a
--     column and must never become one — it is `points`, and a stored second
--     copy of a rule is how prices drift.
--   · BUNDLE price   = what the couple actually pays. This is the catalog row.
--   · DISCOUNT       = 1 − bundle ÷ credits. Derived, for the same reason.
--
--   credits   bundle    regular   off
--       100      ₱50       ₱100   50%
--       200     ₱100       ₱200   50%
--       300     ₱150       ₱300   50%
--       400     ₱200       ₱400   50%
--       500     ₱250       ₱500   50%
--     1 000     ₱500     ₱1 000   50%
--     2 000   ₱1 000     ₱2 000   50%
--     3 000   ₱1 200     ₱3 000   60%
--     4 000   ₱1 600     ₱4 000   60%
--     5 000   ₱2 000     ₱5 000   60%
--     6 000   ₱2 400     ₱6 000   60%
--     7 000   ₱2 800     ₱7 000   60%
--    10 000   ₱3 200    ₱10 000   68%
--    20 000   ₱5 000    ₱20 000   75%
--    30 000   ₱7 500    ₱30 000   75%
--    50 000  ₱10 000    ₱50 000   80%
--
-- ⚖ THE 40 000 RUNG IS DELIBERATELY ABSENT. It was in the owner's first table at
-- ₱10 000 — the same price as 50 000 — which made it a row nobody could ever
-- rationally choose, with 10 000 free shots sitting immediately below it. That
-- was surfaced rather than silently "corrected", because a price is his call,
-- and he removed it: *"remove the 40,000"* (2026-08-26). Do not re-add it
-- without a price of its own.
--
-- ⚖ THE FREE 50 IS UNTOUCHED. Every event still starts with 50 shots it did not
-- pay for — a grant, not a catalog row. Cameras remain free and unlimited.
--
-- ⚠ NOBODY IS AFFECTED. Production has taken exactly ONE order in its life and
-- it was not a Papic rung. This is a list change, not a repricing of anything
-- anybody holds.
--
-- ── WHY A RUNG IS THREE PLACES, NOT ONE ─────────────────────────────────────
--
-- 🚨 A RUNG ON SALE THAT NOTHING FUNDS TAKES THE MONEY AND GRANTS ZERO SHOTS.
-- `activateOrderSku` dispatches on an EXACT service_key map and ends
-- `if (!hook) return; // default no-op`, so a row live in the catalog and in
-- `papic_pass_tiers` but absent from that map is fully purchasable and silently
-- grants nothing: no throw, no log, an empty pool and a paid order. It came
-- within one commit of shipping when the ladder last grew.
-- `papic-rungs-are-fundable.db.test.ts` spans the gap — replayed migrations for
-- what is SELLABLE, module source for what is FUNDED — and fails the build if
-- this migration lands without its eleven new lines in lib/sku-activation.ts.
--
-- ── THE FOUR RUNGS THAT LEAVE ───────────────────────────────────────────────
-- 13 000 · 16 000 · 23 000 · 26 000 are not on the new list and are deactivated,
-- never deleted. Their activation hooks STAY: an order minted before today must
-- still convert on approval, and a deactivated tier row makes that conversion
-- resolve against the row's own points rather than nothing.
-- ============================================================================

BEGIN;

-- ── 1 · the ladder, as data ─────────────────────────────────────────────────
-- Written once, as rows, so the seventeen prices exist in exactly one place in
-- this file. `saas_overhead_cost_php` is DERIVED at ₱0.024 a shot — the rate the
-- existing 100 / 10 000 / 20 000 / 30 000 rows already carry (2.40 / 240 / 480 /
-- 720). The 3 000 rung's ₱174 was off that curve and joins it here; it is a cost
-- line the margin view reads, not a price anybody is quoted.
CREATE TEMP TABLE _ladder (service_code TEXT, credits INTEGER, php NUMERIC, sort_order INTEGER) ON COMMIT DROP;
INSERT INTO _ladder (service_code, credits, php, sort_order) VALUES
  ('PAPIC_GUEST_100',   100,     50.00,   5),
  ('PAPIC_GUEST_200',   200,    100.00,  10),
  ('PAPIC_GUEST_300',   300,    150.00,  15),
  ('PAPIC_GUEST_400',   400,    200.00,  20),
  ('PAPIC_GUEST_500',   500,    250.00,  25),
  ('PAPIC_GUEST_1K',   1000,    500.00,  30),
  ('PAPIC_GUEST_2K',   2000,   1000.00,  35),
  ('PAPIC_GUEST',      3000,   1200.00,  40),
  ('PAPIC_GUEST_4K',   4000,   1600.00,  45),
  ('PAPIC_GUEST_5K',   5000,   2000.00,  50),
  ('PAPIC_GUEST_6K',   6000,   2400.00,  55),
  ('PAPIC_GUEST_7K',   7000,   2800.00,  60),
  ('PAPIC_GUEST_10K', 10000,   3200.00,  65),
  ('PAPIC_GUEST_20K', 20000,   5000.00,  70),
  ('PAPIC_GUEST_30K', 30000,   7500.00,  75),
  ('PAPIC_GUEST_50K', 50000,  10000.00,  85);

-- ── 2 · the catalog rows ────────────────────────────────────────────────────
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   description, is_active, billing_period, is_pax_priced, is_token_able)
SELECT
  l.service_code,
  'Papic — add ' || to_char(l.credits, 'FM999,999') || ' shots',
  l.php,
  ROUND(l.credits * 0.024, 2),
  'Adds ' || to_char(l.credits, 'FM999,999') ||
    ' shots to the celebration''s shared pot. Added on top of whatever is already there, and repeatable.',
  TRUE, 'one_time', FALSE, FALSE
FROM _ladder l
ON CONFLICT (service_code) DO UPDATE
   SET title                  = EXCLUDED.title,
       retail_price_php       = EXCLUDED.retail_price_php,
       saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
       description            = EXCLUDED.description,
       is_active              = TRUE,
       billing_period         = 'one_time',
       is_pax_priced          = FALSE,
       updated_at             = NOW();

-- ── 3 · the tier rows (how many shots each rung grants) ─────────────────────
INSERT INTO public.papic_pass_tiers (service_code, points, is_topup, sort_order, is_active)
SELECT l.service_code, l.credits, FALSE, l.sort_order, TRUE FROM _ladder l
ON CONFLICT (service_code) DO UPDATE
   SET points     = EXCLUDED.points,
       is_topup   = FALSE,
       sort_order = EXCLUDED.sort_order,
       is_active  = TRUE;

-- ── 4 · everything not on the list comes off sale ───────────────────────────
-- Deactivated, never deleted, and their hooks stay wired.
UPDATE public.papic_pass_tiers
   SET is_active = FALSE
 WHERE service_code LIKE 'PAPIC_GUEST%'
   AND service_code NOT IN (SELECT service_code FROM _ladder);

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE, updated_at = NOW()
 WHERE service_code LIKE 'PAPIC_GUEST%'
   AND service_code NOT IN (SELECT service_code FROM _ladder);

-- ── 5 · refuse to apply if any of it did not take ───────────────────────────
-- 🔑 A MIGRATION THAT SILENTLY MATCHED NOTHING IS THE SHAPE THIS PROJECT KEEPS
-- PAYING FOR: an UPDATE naming a renamed code matches zero rows, commits
-- cleanly, and leaves the old price on sale. So every rung is read back.
DO $$
DECLARE
  v_bad TEXT;
  v_on  INTEGER;
BEGIN
  SELECT string_agg(format('%s: catalog %s / tier %s', l.service_code, c.retail_price_php, t.points), ', ')
    INTO v_bad
  FROM _ladder l
  LEFT JOIN public.platform_retail_catalog_v2 c
    ON c.service_code = l.service_code AND c.is_active AND c.retail_price_php = l.php
  LEFT JOIN public.papic_pass_tiers t
    ON t.service_code = l.service_code AND t.is_active AND t.points = l.credits
  WHERE c.service_code IS NULL OR t.service_code IS NULL;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: these rungs did not land as specified — %', v_bad;
  END IF;

  SELECT count(*) INTO v_on
  FROM public.papic_pass_tiers
  WHERE is_active AND service_code LIKE 'PAPIC_GUEST%';

  IF v_on <> 16 THEN
    RAISE EXCEPTION 'refusing to apply: % pool rungs are on sale, expected 16', v_on;
  END IF;
END $$;

COMMIT;
