-- ten_percent_if_you_add_it_now
--
-- ⚖ OWNER RULING, 2026-08-28: *"we give them a 10% discount if they purchase
-- now. They can order later, but they will lose the 10% discount."* Then, asked
-- how wide it goes: *"10% for all purchase on onboarding"*.
--
-- 🔑 RULE 0 PAID: THE MECHANIC ALREADY EXISTS AND IS ALREADY CHARGED.
-- `platform_retail_catalog_v2.onboarding_price_php` means exactly "what this
-- costs when bought during the create flow" — populated and charged for
-- SETNAYAN_AI (₱2,499 → ₱1,499) since it was built. Nothing is invented here.
-- The sixteen Papic shot rungs simply never had one, so the create flow charged
-- them full retail. That is the whole gap.
--
-- 🔴 AND "10% FOR ALL" TAKEN LITERALLY WOULD HAVE RAISED THREE PRICES.
-- Measured in production before writing a line: every Setnayan AI tier ALREADY
-- discounts at sign-up, and by far more than a tenth —
--     SETNAYAN_AI    ₱2,499 → ₱1,499   (40.0% off)
--     SETNAYAN_AI_B  ₱1,499 →   ₱899   (40.0% off)
--     SETNAYAN_AI_C    ₱899 →   ₱499   (44.5% off)   ← the birthday tier
--     SETNAYAN_AI_D    ₱199 →    ₱99   (50.3% off)
-- Setting them to 90% of retail would have moved the flagship sign-up price
-- from ₱1,499 to ₱2,249 — **a ₱750 rise, delivered by a migration whose stated
-- purpose is a discount.** A discount ruling must never come out the other end
-- as a price increase.
--
-- ⇒ SO 10% IS WRITTEN AS A FLOOR, NOT AS AN ASSIGNMENT: everything bought during
-- onboarding is at least a tenth off, and where a better sign-up price already
-- exists the customer keeps the better one. `LEAST` is the whole ruling. It
-- satisfies "all purchases on onboarding" and it cannot raise anything, which is
-- also what makes it safe to re-run.
--
-- ⚠ THE FIGURE IS DERIVED FROM `retail_price_php`, NEVER RE-TYPED. The rung
-- ladder is owner-locked and was re-cut once already (2026-08-26); a hand-typed
-- second copy of sixteen prices is how two copies of one number come to
-- disagree. If a rung's retail price moves, re-run this — do not edit a number.
--
-- ⛔ SETNAYAN_AI_RENEW IS OUT OF SCOPE ON PURPOSE. A renewal is not an onboarding
-- purchase — nobody renews during the create flow — and it is the one row where
-- 10% lands on a fraction of a peso (₱799 → ₱719.10).

UPDATE public.platform_retail_catalog_v2
   SET onboarding_price_php = LEAST(
         COALESCE(onboarding_price_php, retail_price_php),
         ROUND(retail_price_php * 0.90, 2)
       ),
       updated_at = NOW()
 WHERE retail_price_php > 0
   AND (
         (service_code LIKE 'PAPIC_GUEST%' AND is_active)
         -- The AI tier rows are price SOURCES, not sellable cards, so is_active
         -- is deliberately not asked of them (same reading as the resolver).
         OR service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D')
       )
   AND onboarding_price_php IS DISTINCT FROM LEAST(
         COALESCE(onboarding_price_php, retail_price_php),
         ROUND(retail_price_php * 0.90, 2)
       );

DO $$
DECLARE
  v_undiscounted int;
  v_fractional int;
  v_raised int;
BEGIN
  -- Every rung a person can buy in the create flow must now carry a discount.
  SELECT count(*) INTO v_undiscounted
    FROM public.platform_retail_catalog_v2
   WHERE service_code LIKE 'PAPIC_GUEST%' AND is_active
     AND (onboarding_price_php IS NULL OR onboarding_price_php > retail_price_php * 0.90);
  IF v_undiscounted > 0 THEN
    RAISE EXCEPTION 'ten_percent: % active Papic rung(s) are not at least 10%% off', v_undiscounted;
  END IF;

  -- A price the checkout cannot render exactly is a price somebody disputes.
  SELECT count(*) INTO v_fractional
    FROM public.platform_retail_catalog_v2
   WHERE (service_code LIKE 'PAPIC_GUEST%' OR service_code LIKE 'SETNAYAN_AI%')
     AND onboarding_price_php IS NOT NULL
     AND onboarding_price_php <> ROUND(onboarding_price_php, 0);
  IF v_fractional > 0 THEN
    RAISE EXCEPTION 'ten_percent: % row(s) priced in fractions of a peso', v_fractional;
  END IF;

  -- THE ONE THAT MATTERS: a discount migration must never leave a sign-up price
  -- ABOVE what it already was. The four AI tiers must be untouched.
  SELECT count(*) INTO v_raised
    FROM public.platform_retail_catalog_v2
   WHERE service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D')
     AND onboarding_price_php IS NOT NULL
     AND onboarding_price_php > retail_price_php * 0.90;
  IF v_raised > 0 THEN
    RAISE EXCEPTION 'ten_percent: % AI tier(s) ended up costing MORE at sign-up', v_raised;
  END IF;
END $$;

COMMENT ON COLUMN public.platform_retail_catalog_v2.onboarding_price_php IS
  'What this costs when bought DURING the create flow. NULL = no sign-up '
  'discount on this row; retail_price_php is charged. Owner 2026-08-28: every '
  'purchase made in onboarding is at least 10% off, and a row already carrying a '
  'deeper sign-up price (the Setnayan AI tiers, 40-50%) keeps it. Order later '
  'and you pay retail.';
