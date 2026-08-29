-- ============================================================================
-- A 100,000-CREDIT RUNG, AND THE SEED CAUGHT UP WITH PRODUCTION
--
-- ⚖ OWNER 2026-08-29, given as an instruction with the number in it: *"place an
--   editable row like 50,000 and make the value 24000 php."* So 100,000 joins
--   the five rungs the owner TYPES a price into, rather than the eleven that
--   compute — a computed one would have inherited the 50,000 rate and landed at
--   ₱30,000, which is exactly two lots of 50,000 and therefore a rung nobody
--   could rationally choose. That is the same trap he removed 40,000 for.
--
--   ₱24,000 is ₱0.24 a credit against 50,000's ₱0.30 — a real saving, and it
--   keeps the ladder's rule that buying more never costs more per credit.
--
-- 🔑 WHY THIS MIGRATION ALSO REWRITES SIXTEEN PRICES IT DID NOT COME HERE TO
--    CHANGE — and why that is a no-op in production.
--
--    The admin pricing screen writes STRAIGHT TO THE CATALOG. So production has
--    been repriced repeatedly with no migration behind it, and the migration
--    seed drifted into a different (older, internally consistent) ladder:
--    100 → ₱50 and 50,000 → ₱11,200, against production's ₱70 and ₱15,000.
--
--    That divergence is invisible until something new is added. `papic-rungs-
--    are-fundable.db.test.ts` replays MIGRATIONS and enforces that the rate per
--    credit never rises. Against production, ₱24,000 is ₱0.24 and the rung is
--    fine. Against the stale seed, 50,000 sits at ₱0.224 and ₱0.24 would read as
--    a RISE — the guard would have failed, correctly, on a price that is right.
--
--    So the honest fix is to make the seed tell the truth rather than to price
--    the new rung against a fiction. Every UPDATE below sets the value
--    PRODUCTION ALREADY HOLDS (read out of it on 2026-08-29), so this changes
--    nothing for any customer and everything for the replay.
--
-- ⚠ IF THESE NUMBERS LOOK STALE TO YOU, THEY PROBABLY ARE. The screen can move
--   them again tomorrow without a migration. This file is a snapshot that
--   un-drifted the seed once; it is not, and cannot be, the source of truth.
--   The catalog is.
--
-- 🚨 A RUNG LIVES IN THREE PLACES AND THIS FILE IS ONLY ONE OF THEM. The other
--    two are `lib/sku-activation.ts` (without an entry the rung is fully
--    purchasable and grants NOTHING — no throw, no log) and `lib/llms-txt.ts`.
--    All three land in the same commit as this file, plus the anchor list and
--    the db fixture. Do not split them.
-- ============================================================================

BEGIN;

-- ── 1 · THE SEED CATCHES UP WITH PRODUCTION ────────────────────────────────
-- Idempotent by construction: every value is what production already holds.
--
-- 🛑 GUARDED BY THE OLD VALUE, AND THAT GUARD IS THE WHOLE SAFETY OF THIS BLOCK.
--    An unconditional UPDATE would be a no-op today and a REVERT tomorrow: the
--    admin screen can reprice at any moment, and if it does so between this file
--    being written and being deployed, an unguarded write would silently put the
--    old numbers back. Matching on the OLD seed price means the row is only
--    touched where it still holds the drifted value — which is true in the
--    replay and false in production, exactly where each outcome is wanted.
--
--    Consequence, stated so nobody reads silence as success: in production this
--    updates ZERO rows, on purpose. It is a repair to the seed, not a reprice.
UPDATE public.platform_retail_catalog_v2 AS c
SET retail_price_php     = v.retail,
    onboarding_price_php = v.signup
FROM (VALUES
  -- code,            was,      now,      sign-up now
  ('PAPIC_GUEST_100',    50.00,    70.00,    49.00),
  ('PAPIC_GUEST_200',   100.00,   140.00,    98.00),
  ('PAPIC_GUEST_300',   150.00,   210.00,   147.00),
  ('PAPIC_GUEST_400',   200.00,   280.00,   196.00),
  ('PAPIC_GUEST_500',   250.00,   350.00,   245.00),
  ('PAPIC_GUEST_1K',    500.00,   700.00,   490.00),
  ('PAPIC_GUEST_2K',   1000.00,  1400.00,   980.00),
  ('PAPIC_GUEST',      1200.00,  1680.00,  1176.00),
  ('PAPIC_GUEST_4K',   1600.00,  2240.00,  1568.00),
  ('PAPIC_GUEST_5K',   2000.00,  2800.00,  1960.00),
  ('PAPIC_GUEST_6K',   2400.00,  3360.00,  2352.00),
  ('PAPIC_GUEST_7K',   2800.00,  3920.00,  2744.00),
  ('PAPIC_GUEST_10K',  3200.00,  4500.00,  3150.00),
  ('PAPIC_GUEST_20K',  5000.00,  7200.00,  5040.00),
  ('PAPIC_GUEST_30K',  7500.00, 10800.00,  7560.00),
  ('PAPIC_GUEST_50K', 11200.00, 15000.00, 10500.00)
) AS v(code, was, retail, signup)
WHERE c.service_code = v.code
  AND c.retail_price_php = v.was;

-- ── 2 · THE NEW RUNG, IN THE CATALOG ───────────────────────────────────────
-- ₱24,000 regular · ₱16,800 at sign-up, which is the 30% the owner set on
-- `platform_settings.papic_signup_discount_pct` applied to 24,000. Written out
-- rather than computed here because this table stores the charged value; the
-- percentage is how the admin screen COMPUTES it on save, not a second source.
--
-- 🪤 `saas_overhead_cost_php` IS NOT NULL WITH NO DEFAULT, and the first draft of
--    this migration omitted it. The PGlite replay would have accepted the row;
--    PRODUCTION refused it with 23502. Caught by dry-running this file against
--    prod inside a rolled-back transaction, exactly as the schema-drift audit
--    says to — never by reading the CREATE TABLE.
--    ₱2,400 continues the siblings' own rate: 20K→480, 30K→720, 50K→1,200, i.e.
--    ₱0.024 a credit.
--
-- ⚠ THE COPY SAYS "shots", NOT "credits", DELIBERATELY. Every one of the
--    sixteen sibling rows says shots, and one row using the new word would read
--    as a different product on /pricing. The rename is real and is tracked
--    separately; a half-done rename is worse than either state.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, onboarding_price_php,
   saas_overhead_cost_php, billing_period, is_pax_priced, description, is_active)
VALUES
  ('PAPIC_GUEST_100K', 'Papic — add 100,000 shots', 24000.00, 16800.00,
   2400.00, 'one_time', FALSE,
   'Adds 100,000 shots to the celebration''s shared pot. Added on top of whatever is already there, and repeatable.',
   TRUE)
ON CONFLICT (service_code) DO UPDATE
  SET title                  = EXCLUDED.title,
      retail_price_php       = EXCLUDED.retail_price_php,
      onboarding_price_php   = EXCLUDED.onboarding_price_php,
      saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
      billing_period         = EXCLUDED.billing_period,
      is_pax_priced          = EXCLUDED.is_pax_priced,
      description            = EXCLUDED.description,
      is_active              = TRUE;

-- ── 3 · THE NEW RUNG, IN THE TIER TABLE ────────────────────────────────────
-- This is what `papicPassPointsForSku` reads to decide how many credits the
-- grant is worth. The catalog row alone would take the money and grant nothing.
INSERT INTO public.papic_pass_tiers (service_code, points, is_topup, sort_order, is_active)
VALUES ('PAPIC_GUEST_100K', 100000, FALSE, 170, TRUE)
ON CONFLICT (service_code) DO UPDATE
  SET points     = EXCLUDED.points,
      is_topup   = EXCLUDED.is_topup,
      sort_order = EXCLUDED.sort_order,
      is_active  = TRUE;

-- ── 4 · POST-CONDITION — refuse to ship a rung that cannot be funded ───────
-- The ladder's own rule, asserted here so a bad edit fails the deploy rather
-- than the customer: no rung above ₱1 a credit, and the rate never rises.
DO $$
DECLARE
  prev_rate numeric := NULL;
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.points, c.retail_price_php AS php
    FROM public.papic_pass_tiers t
    JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
    WHERE t.is_active AND c.is_active AND NOT t.is_topup
    ORDER BY t.points
  LOOP
    IF r.php > r.points THEN
      RAISE EXCEPTION 'Papic rung % costs %, above P1 a credit', r.points, r.php;
    END IF;
    IF prev_rate IS NOT NULL AND (r.php / r.points) > prev_rate THEN
      RAISE EXCEPTION 'Papic rung % costs %/credit, worse than the rung below it',
        r.points, round(r.php / r.points, 4);
    END IF;
    prev_rate := r.php / r.points;
  END LOOP;
END $$;

COMMIT;
