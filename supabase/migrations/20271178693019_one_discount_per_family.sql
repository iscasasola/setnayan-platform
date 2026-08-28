-- ════════════════════════════════════════════════════════════════════════════
-- ONE SIGN-UP DISCOUNT PER FAMILY — and the owner's 40% for Setnayan AI
--
-- ⚖ OWNER RULING 2026-08-28: *"setnayan AI will have a single discount saving
-- for all Setnayan AI instead of each row having their own discount. Papic will
-- also have that 1 discount savings instead of each row."*
-- Then, shown the arithmetic and told two sign-up prices would move: **40%**.
--
-- Each row keeps ONE typed price (the regular one). The sign-up price is now
-- DERIVED from its family's single discount.
--
-- 🔑 `onboarding_price_php` IS NOT RETIRED AND MUST NOT BE. It stays the stored,
-- charged value that every existing reader reads (the checkout, the create-flow
-- services step, the public pricing page, the AI tier resolver). The discount is
-- how that value is COMPUTED on save — never a second place to read a price
-- from. There is still exactly ONE price per row, in the catalog, afterwards.
--
-- ⚠ WHOLE PESOS ARE A RULE HERE, NOT A ROUNDING PREFERENCE — and this is the
-- single most important line in the file.
--   • Migration 20271176315255 ships a post-condition that RAISES if any
--     PAPIC_GUEST% / SETNAYAN_AI% sign-up price is fractional: *"a price the
--     checkout cannot render exactly is a price somebody disputes."*
--   • That migration is explicitly written to be RE-RUN when a rung's retail
--     price moves.
--   • All 66 priced catalog rows are whole pesos today. Not one is fractional.
-- 40% of ₱2,499 is ₱1,499.40. Storing that would break the rule AND make a
-- shipped migration fail the next time anybody re-ran it. So the discount is
-- applied and ROUNDED TO THE NEAREST PESO, ties DOWN — the direction that can
-- only ever make the customer's effective discount deeper than advertised,
-- never shallower.
--
-- 🔑 WHAT THAT ROUNDING ACTUALLY DOES, and it is the reassuring part:
--   band A  ₱2,499 → ₱1,499.40 → **₱1,499  — UNCHANGED**
--   band B  ₱1,499 →   ₱899.40 → **₱899    — UNCHANGED**
--   band C    ₱899 →   ₱539.40 → ₱539      — moves +₱40  (was ₱499)
--   band D    ₱199 →   ₱119.40 → ₱119      — moves +₱20  (was ₱99)
-- ⇒ THE ONE LIVE, CHARGED ROW DOES NOT MOVE. `SETNAYAN_AI` (band A) is the only
-- `is_active` row of the four and the only one that has ever taken money; at
-- whole-peso rounding its sign-up price is byte-identical. The two rows that do
-- move (C and D) are both `is_active = false` price-source rows. They are still
-- REAL — a birthday couple resolves to band C — so this is not inert, and it is
-- flagged in the changelog rather than allowed to ride along invisibly.
--
-- 🔒 PAPIC MOVES NOTHING. All sixteen rungs already sit at exactly 10% off, so a
-- single 10% Papic discount reproduces all sixteen stored values exactly.
-- Verified rung by rung below.
--
-- 🔒 THE FLOOR IS PAPIC-ONLY (owner, same day: *"we will use the discount
-- created for Papic Service Only instead of both"*). Setnayan AI is exempt — its
-- band discount is deeper than any floor and answers to nobody's.
-- ⚠ The floor is still NOT ENFORCED anywhere at write time; it never has been.
-- It is a data fact plus a warning on the screen. Making a save REFUSE is a
-- behaviour change and is deliberately not built here.
--
-- Idempotent. Safe to re-run: the UPDATEs are derived from retail_price_php and
-- from the settings, so re-running recomputes the same values.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) The two numbers ──────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS papic_signup_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.00
    CHECK (papic_signup_discount_pct >= 0 AND papic_signup_discount_pct < 100);

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS ai_signup_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 40.00
    CHECK (ai_signup_discount_pct >= 0 AND ai_signup_discount_pct < 100);

COMMENT ON COLUMN public.platform_settings.papic_signup_discount_pct IS
  'The ONE sign-up discount covering all sixteen Papic shot rungs (owner 2026-08-28). Their onboarding_price_php is DERIVED from it, rounded to the nearest peso with ties down. Default 10.00 == what all sixteen already carried, so the single-discount shape moved no Papic price. The 10%% FLOOR applies to this family only; it is a warning on /admin/pricing, not a write-time refusal.';

COMMENT ON COLUMN public.platform_settings.ai_signup_discount_pct IS
  'The ONE sign-up discount covering all four Setnayan AI bands (owner 2026-08-28, set to 40 with the arithmetic in front of him). Their onboarding_price_php is DERIVED from it, rounded to the nearest peso with ties down. Replaces four per-band discounts that had drifted apart (40.02/40.03/44.49/50.25). At 40%% bands A and B are unchanged; C and D rise by PHP 40 and PHP 20. The Papic 10%% floor does NOT apply to this family.';

-- ── 2) Derive every sign-up price in both families from its family discount ──
-- ⚠ ROUND(x, 0) is the whole-peso rule. Postgres ROUND on NUMERIC is
-- half-away-from-zero; every value here has a .40 tail, so it rounds DOWN and
-- agrees with the TypeScript `signupPriceFor` (nearest, ties down). The two are
-- pinned against each other by tests/db/family-discount-matches-the-catalog.db.test.ts.
UPDATE public.platform_retail_catalog_v2 c
   SET onboarding_price_php = ROUND(
         c.retail_price_php
         * (1 - COALESCE((SELECT papic_signup_discount_pct FROM public.platform_settings WHERE id = 1), 10.00) / 100.0),
         0),
       updated_at = NOW()
 WHERE c.service_code LIKE 'PAPIC_GUEST%'
   AND c.is_active
   AND c.retail_price_php > 0
   AND c.onboarding_price_php IS DISTINCT FROM ROUND(
         c.retail_price_php
         * (1 - COALESCE((SELECT papic_signup_discount_pct FROM public.platform_settings WHERE id = 1), 10.00) / 100.0),
         0);

-- ⚠ SETNAYAN_AI_RENEW IS EXCLUDED, same as in 20271176315255 and for the same
-- reason: a renewal is not an onboarding purchase — nobody renews during the
-- create flow — so it carries no sign-up price at all and must not gain one.
UPDATE public.platform_retail_catalog_v2 c
   SET onboarding_price_php = ROUND(
         c.retail_price_php
         * (1 - COALESCE((SELECT ai_signup_discount_pct FROM public.platform_settings WHERE id = 1), 40.00) / 100.0),
         0),
       updated_at = NOW()
 WHERE c.service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D')
   AND c.retail_price_php > 0
   AND c.onboarding_price_php IS DISTINCT FROM ROUND(
         c.retail_price_php
         * (1 - COALESCE((SELECT ai_signup_discount_pct FROM public.platform_settings WHERE id = 1), 40.00) / 100.0),
         0);

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- POST-CONDITIONS
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  bad          TEXT[] := ARRAY[]::TEXT[];
  v_papic_pct  NUMERIC;
  v_ai_pct     NUMERIC;
  v_frac       INT;
  v_inverted   INT;
  v_papic_off  INT;
  r            RECORD;
BEGIN
  SELECT papic_signup_discount_pct, ai_signup_discount_pct
    INTO v_papic_pct, v_ai_pct
    FROM public.platform_settings WHERE id = 1;

  -- ── A. THE RULE THAT MADE THE ROUNDING NECESSARY ─────────────────────────
  -- Not one sign-up price in either family may be a fraction of a peso. This is
  -- the same assertion 20271176315255 makes; it is repeated here because THIS
  -- migration is the one that could newly break it.
  SELECT count(*) INTO v_frac
    FROM public.platform_retail_catalog_v2
   WHERE (service_code LIKE 'PAPIC_GUEST%' OR service_code LIKE 'SETNAYAN_AI%')
     AND onboarding_price_php IS NOT NULL
     AND onboarding_price_php <> ROUND(onboarding_price_php, 0);
  IF v_frac > 0 THEN
    bad := array_append(bad, format('%s row(s) priced in fractions of a peso', v_frac));
  END IF;

  -- ── B. THE NONSENSE GUARD, BOTH FAMILIES ─────────────────────────────────
  -- A sign-up price at or above the regular price punishes buying early.
  SELECT count(*) INTO v_inverted
    FROM public.platform_retail_catalog_v2
   WHERE (service_code LIKE 'PAPIC_GUEST%' OR service_code LIKE 'SETNAYAN_AI%')
     AND onboarding_price_php IS NOT NULL
     AND retail_price_php > 0
     AND onboarding_price_php >= retail_price_php;
  IF v_inverted > 0 THEN
    bad := array_append(bad, format('%s row(s) cost as much or MORE at sign-up', v_inverted));
  END IF;

  -- ── C. PAPIC MOVED NOTHING ───────────────────────────────────────────────
  -- Asserted as VALUES, not as a count of changed rows: at 10% every rung must
  -- still read exactly what it read before this migration ran.
  IF v_papic_pct = 10.00 THEN
    FOR r IN
      SELECT * FROM (VALUES
        ('PAPIC_GUEST_100',45),('PAPIC_GUEST_200',90),('PAPIC_GUEST_300',135),
        ('PAPIC_GUEST_400',180),('PAPIC_GUEST_500',225),('PAPIC_GUEST_1K',450),
        ('PAPIC_GUEST_2K',900),('PAPIC_GUEST',1080),('PAPIC_GUEST_4K',1440),
        ('PAPIC_GUEST_5K',1800),('PAPIC_GUEST_6K',2160),('PAPIC_GUEST_7K',2520),
        ('PAPIC_GUEST_10K',2880),('PAPIC_GUEST_20K',4500),('PAPIC_GUEST_30K',6750),
        ('PAPIC_GUEST_50K',10080)
      ) AS s(code, php)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.platform_retail_catalog_v2
         WHERE service_code = r.code AND onboarding_price_php = r.php
      ) THEN
        bad := array_append(bad, format('%s: papic sign-up price MOVED (want %s)', r.code, r.php));
      END IF;
    END LOOP;
  END IF;

  -- ── D. THE AI BANDS LANDED EXACTLY WHERE THE OWNER WAS TOLD THEY WOULD ────
  -- ⚠ Band A is the live, charged row. It must be UNCHANGED at 40%.
  IF v_ai_pct = 40.00 THEN
    FOR r IN
      SELECT * FROM (VALUES
        ('SETNAYAN_AI',   1499),   -- UNCHANGED — the live, charged row
        ('SETNAYAN_AI_B',  899),   -- UNCHANGED
        ('SETNAYAN_AI_C',  539),   -- was 499 · +PHP 40
        ('SETNAYAN_AI_D',  119)    -- was  99 · +PHP 20
      ) AS s(code, php)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.platform_retail_catalog_v2
         WHERE service_code = r.code AND onboarding_price_php = r.php
      ) THEN
        bad := array_append(bad, format('%s: sign-up price is not %s', r.code, r.php));
      END IF;
    END LOOP;

    -- The one that would be a real regression: the charged row must not move.
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_retail_catalog_v2
       WHERE service_code = 'SETNAYAN_AI' AND onboarding_price_php = 1499
    ) THEN
      bad := array_append(bad,
        'the LIVE charged Setnayan AI sign-up price moved off PHP 1,499');
    END IF;
  END IF;

  -- ── E. SETNAYAN_AI_RENEW STILL CARRIES NO SIGN-UP PRICE ──────────────────
  IF EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'SETNAYAN_AI_RENEW' AND onboarding_price_php IS NOT NULL
  ) THEN
    bad := array_append(bad, 'SETNAYAN_AI_RENEW gained a sign-up price — a renewal is not an onboarding purchase');
  END IF;

  -- ── F. THE PAPIC FLOOR STILL HOLDS AS DATA ───────────────────────────────
  SELECT count(*) INTO v_papic_off
    FROM public.platform_retail_catalog_v2
   WHERE service_code LIKE 'PAPIC_GUEST%' AND is_active
     AND (onboarding_price_php IS NULL
          OR onboarding_price_php > ROUND(retail_price_php * 0.90, 0));
  IF v_papic_off > 0 THEN
    bad := array_append(bad, format('%s active Papic rung(s) are not at least 10%% off', v_papic_off));
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'one discount per family post-condition failed: %',
      array_to_string(bad, ' | ');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION:
--   SELECT papic_signup_discount_pct, ai_signup_discount_pct
--     FROM public.platform_settings WHERE id = 1;             -- → 10.00 · 40.00
--   SELECT service_code, retail_price_php, onboarding_price_php
--     FROM public.platform_retail_catalog_v2
--    WHERE service_code LIKE 'SETNAYAN_AI%' ORDER BY service_code;
--     -- → AI 2499/1499 · _B 1499/899 · _C 899/539 · _D 199/119 · _RENEW 799/NULL
-- ════════════════════════════════════════════════════════════════════════════
