-- onboarding_discount_is_a_setting
--
-- ⚖ OWNER, 2026-08-28: *"I want to be able to change 10% anytime. so I can set
-- discount on onboarding today and change it tomorrow. or anytime i want."*
--
-- 🔴 WHAT WAS WRONG WITH THE FIRST ANSWER. The 10% shipped as sixteen per-row
-- prices, written once by a migration. That is a SNAPSHOT, not a rule: it does
-- not follow a reprice, an admin cannot see what the discount currently IS, and
-- lowering it is impossible — a stored 10%-off price is always cheaper than a
-- 5%-off calculation, so the cheapest-wins rule would pin it there forever. He
-- asked for a dial and got a stamp.
--
-- ⇒ THE PERCENTAGE BECOMES THE STORED RULE, AND THE PRICES DERIVE FROM IT.
-- One number, on the settings singleton, beside `setnayan_pay_fee_pct` which is
-- the same shape and the reason this table already knows how to hold a
-- percentage. Change it today, change it tomorrow; every set-up price moves in
-- the same instant, with nothing to sweep and nothing to re-run.
--
-- 🔑 AND THE SIXTEEN STAMPED VALUES MUST GO, OR THE DIAL ONLY TURNS ONE WAY.
-- They are cleared back to NULL here. `onboarding_price_php` keeps its meaning
-- and its job — a DELIBERATE per-row override, which is what Setnayan AI's 40%
-- has always been — but a row that merely follows the house rule must not carry
-- a copy of it. **A stored copy of a derived value is the thing that stops the
-- rule being editable.**
--
-- ⛔ SETNAYAN_AI IS NOT CLEARED. Its sign-up prices are decisions somebody made,
-- not this rule applied: ₱2,499→₱1,499 is 40%, and it predates the rule by
-- months. Clearing them would silently RAISE four prices — the same failure the
-- 10% migration was written to avoid, one week later and in the other direction.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS onboarding_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_onboarding_discount_pct_chk'
  ) THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_onboarding_discount_pct_chk
      -- 90 is the same ceiling the admin form enforces. A 100% discount is not a
      -- discount, it is giving the product away, and it must not be one typo.
      CHECK (onboarding_discount_pct >= 0 AND onboarding_discount_pct <= 90);
  END IF;
END $$;

COMMENT ON COLUMN public.platform_settings.onboarding_discount_pct IS
  'The house set-up discount: how much off anything bought DURING the create '
  'flow. Owner 2026-08-28 — editable at any time, and every set-up price derives '
  'from it. A catalog row with its own onboarding_price_php keeps that price '
  'when it is the cheaper of the two; that column is a deliberate per-row '
  'override, never a stored copy of this rule.';

-- The stamped copies of the rule. Cleared so the dial turns both ways.
UPDATE public.platform_retail_catalog_v2
   SET onboarding_price_php = NULL,
       updated_at = NOW()
 WHERE service_code LIKE 'PAPIC_GUEST%'
   AND onboarding_price_php IS NOT NULL;

DO $$
DECLARE
  v_stamped int;
  v_ai int;
BEGIN
  SELECT count(*) INTO v_stamped
    FROM public.platform_retail_catalog_v2
   WHERE service_code LIKE 'PAPIC_GUEST%' AND onboarding_price_php IS NOT NULL;
  IF v_stamped > 0 THEN
    RAISE EXCEPTION 'onboarding_discount: % rung(s) still carry a stamped price', v_stamped;
  END IF;

  -- The deliberate overrides must survive, or four prices just went UP.
  SELECT count(*) INTO v_ai
    FROM public.platform_retail_catalog_v2
   WHERE service_code IN ('SETNAYAN_AI','SETNAYAN_AI_B','SETNAYAN_AI_C','SETNAYAN_AI_D')
     AND onboarding_price_php IS NOT NULL;
  IF v_ai <> 4 THEN
    RAISE EXCEPTION 'onboarding_discount: expected 4 AI overrides intact, found %', v_ai;
  END IF;
END $$;
