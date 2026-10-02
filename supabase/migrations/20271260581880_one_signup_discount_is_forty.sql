-- one_signup_discount_is_forty
-- Created via `pnpm migration:new`. Idempotent: every statement is a SET to a
-- fixed or derived value, so a re-run writes the same values.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 40% OFF EVERYTHING BOUGHT DURING SIGN-UP — ONE ADMIN NUMBER
--
-- ⚖ OWNER, tracker d18 (2026-10-02): *"40% off everything bought during
-- sign-up"*, one admin-set number — the unused
-- `platform_settings.onboarding_discount_pct` becomes that number, set to 40.
--
-- HISTORY OF THIS SETTING (read before changing it):
--   • 2026-08-28 — added (20271176771940) as the house rule, 10%, editable.
--   • 2026-08-28 — per-family boxes added (20271178693019): papic_signup_
--     discount_pct (10, later 30) and ai_signup_discount_pct (40).
--   • 2026-08-29 — the house box was taken OFF the admin screen ("onboarding
--     discounts are already placed for setnayan AI and Papic"); the column and
--     its readers were kept as a live fallback.
--   • 2026-10-02 — THIS: the house number is THE number again, and the two
--     per-family boxes leave the screen. The app no longer reads
--     papic_signup_discount_pct / ai_signup_discount_pct.
--
-- WHAT MOVES (measured on prod 2026-10-02 before writing this):
--   • onboarding_discount_pct 10 → 40 (and its column DEFAULT 10 → 40).
--   • The 16 Papic rungs' stored sign-up price: 30% off → 40% off. (The card
--     and the charge already take the CHEAPER of the stored price and the house
--     number via `setupPricePhp`, so this only makes the stored copy agree with
--     what is charged — and lets the number turn back DOWN later.)
--   • Setnayan AI bands: re-derived at 40% — 1499 / 899 / 539 / 119, i.e. NO
--     change (they already sit at 40%).
--   • The two retired per-family columns are set to 40 so nothing that reads
--     them by hand (an old migration re-run, a person in the SQL editor) can
--     see a number that contradicts the one in force.
--
-- WHAT DOES NOT MOVE: Event Hub Pro (COUPLE_WEBSITE_PRO) keeps its own
-- owner-set ₱3,000 sign-up price (= 40% of ₱5,000), per the build brief and
-- `event-hub-pro-signup-price.test.ts`. SETNAYAN_AI_RENEW never gains one.
--
-- ROUNDING: nearest whole peso, ties DOWN — identical to the TypeScript
-- `signupPriceFor` (lib/onboarding-family-discount.ts) that the admin save uses.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.platform_settings
  ALTER COLUMN onboarding_discount_pct SET DEFAULT 40;

UPDATE public.platform_settings
   SET onboarding_discount_pct   = 40,
       papic_signup_discount_pct = 40,
       ai_signup_discount_pct    = 40,
       updated_at = NOW()
 WHERE id = 1
   AND (onboarding_discount_pct   IS DISTINCT FROM 40
     OR papic_signup_discount_pct IS DISTINCT FROM 40
     OR ai_signup_discount_pct    IS DISTINCT FROM 40);

COMMENT ON COLUMN public.platform_settings.onboarding_discount_pct IS
  'THE sign-up discount (owner tracker d18, 2026-10-02): percent off everything bought during sign-up. One admin number, edited on /admin/pricing. Prices every sign-up purchase live via setupPricePhp (card and charge); the Papic rungs and Setnayan AI bands also store a derived copy in onboarding_price_php, re-derived whenever this is saved.';
COMMENT ON COLUMN public.platform_settings.papic_signup_discount_pct IS
  'RETIRED 2026-10-02 (owner d18) — no longer read. onboarding_discount_pct is the one sign-up number. Kept equal to it so nothing reads a contradicting figure.';
COMMENT ON COLUMN public.platform_settings.ai_signup_discount_pct IS
  'RETIRED 2026-10-02 (owner d18) — no longer read. onboarding_discount_pct is the one sign-up number. Kept equal to it so nothing reads a contradicting figure.';

UPDATE public.platform_retail_catalog_v2 c
   SET onboarding_price_php = d.signup,
       updated_at = NOW()
  FROM (
    SELECT service_code,
           CASE
             WHEN (retail_price_php * 0.6) - FLOOR(retail_price_php * 0.6) = 0.5
               THEN FLOOR(retail_price_php * 0.6)
             ELSE ROUND(retail_price_php * 0.6, 0)
           END AS signup
      FROM public.platform_retail_catalog_v2
     WHERE (service_code LIKE 'PAPIC_GUEST%'
            OR service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D'))
       AND retail_price_php > 0
  ) d
 WHERE c.service_code = d.service_code
   AND c.onboarding_price_php IS DISTINCT FROM d.signup;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- POST-CONDITIONS — refuse to stand if the number or the copies disagree.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_pct    NUMERIC;
  v_bad    INT;
  v_pro    NUMERIC;
  v_renew  NUMERIC;
BEGIN
  SELECT onboarding_discount_pct INTO v_pct FROM public.platform_settings WHERE id = 1;
  IF v_pct IS DISTINCT FROM 40 THEN
    RAISE EXCEPTION 'one_signup_discount_is_forty: onboarding_discount_pct is %, want 40', v_pct;
  END IF;

  -- Every derived sign-up price is a whole peso, below regular, and at 40% off
  -- to the peso.
  SELECT count(*) INTO v_bad
    FROM public.platform_retail_catalog_v2
   WHERE (service_code LIKE 'PAPIC_GUEST%'
          OR service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D'))
     AND retail_price_php > 0
     AND (onboarding_price_php IS NULL
          OR onboarding_price_php <> ROUND(onboarding_price_php, 0)
          OR onboarding_price_php >= retail_price_php
          OR ABS(onboarding_price_php - retail_price_php * 0.6) > 0.5);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'one_signup_discount_is_forty: % derived sign-up price(s) are not 40%% off to the peso', v_bad;
  END IF;

  -- The live, charged planner row did not move.
  IF EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'SETNAYAN_AI' AND retail_price_php = 2499
       AND onboarding_price_php IS DISTINCT FROM 1499
  ) THEN
    RAISE EXCEPTION 'one_signup_discount_is_forty: SETNAYAN_AI sign-up price moved off 1499';
  END IF;

  -- Event Hub Pro is NOT this migration's to touch.
  SELECT onboarding_price_php INTO v_pro
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO';
  IF FOUND AND v_pro IS DISTINCT FROM 3000 THEN
    RAISE EXCEPTION 'one_signup_discount_is_forty: COUPLE_WEBSITE_PRO sign-up price is %, want 3000 (untouched)', v_pro;
  END IF;

  -- A renewal never gains a sign-up price.
  SELECT onboarding_price_php INTO v_renew
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'SETNAYAN_AI_RENEW';
  IF v_renew IS NOT NULL THEN
    RAISE EXCEPTION 'one_signup_discount_is_forty: SETNAYAN_AI_RENEW gained a sign-up price';
  END IF;
END $$;
