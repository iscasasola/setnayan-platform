-- papic_share_weight() must know a Ninong and a Ninang are principal sponsors.
--
-- ── WHAT WAS WRONG, MEASURED IN PRODUCTION 2026-09-15 ────────────────────────
-- The 2026-09-14 split of `principal_sponsor` into `principal_sponsor_ninong`
-- and `principal_sponsor_ninang` never reached this function. It matched the
-- plain value only, so every ninong and ninang fell to the ELSE branch and
-- weighed 1 -- an ordinary guest.
--
-- On the owner's own wedding that was not a shortfall but an INVERSION:
--
--     principal_sponsor_ninong   21 guests   weight 1
--     principal_sponsor_ninang   17 guests   weight 1
--     cord/veil/coin/candle       6 guests   weight 2   <-- outranked them
--
-- The couple's godparents ranked BELOW the secondary sponsors in the Papic
-- photo division, and since `papic_share_weight` counts an un-named sponsor as
-- that many heads AND hands them that many shares, the error compounds on both
-- sides of the division.
--
-- ── WHY NO TEST CAUGHT IT, WHICH IS THE PART WORTH REMEMBERING ───────────────
-- 🔑 This function and `SPONSOR_GUEST_ROLES` in lib/papic-guest-allotments.ts
-- are ONE RULE WRITTEN TWICE, and they are deliberately held together by
-- tests/db/papic-sponsors-get-a-bigger-share.db.test.ts. That test stayed GREEN
-- through the whole defect -- because the split missed BOTH halves identically,
-- and a test that compares two mechanisms TO EACH OTHER cannot see an omission
-- they share. Two mechanisms in perfect agreement can both be wrong.
-- CONSISTENCY IS NOT CORRECTNESS.
--
-- ── THE RETIRED VALUE STAYS MATCHED, DELIBERATELY ───────────────────────────
-- The owner retired the plain `principal_sponsor` on 2026-09-15, but Postgres
-- has no `ALTER TYPE ... DROP VALUE`: the value outlives the ruling and rows on
-- other events still hold it. It is offered by nothing and understood by
-- everything, so it keeps its weight of 3 here. Dropping it would silently
-- demote every pre-ruling sponsor to an ordinary guest -- the same defect this
-- migration exists to fix, pointed the other way.
--
-- Idempotent: CREATE OR REPLACE, no data written. Every weight and every other
-- branch is byte-identical to the deployed definition; the ONLY change is the
-- two added role values.

CREATE OR REPLACE FUNCTION public.papic_share_weight(
  p_role guest_role,
  p_extra_roles guest_role[]
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_role IN (
           'principal_sponsor',
           'principal_sponsor_ninong',
           'principal_sponsor_ninang'
         )
      OR COALESCE(p_extra_roles, '{}')
         && ARRAY[
              'principal_sponsor',
              'principal_sponsor_ninong',
              'principal_sponsor_ninang'
            ]::public.guest_role[]
      THEN 3
    WHEN p_role IN ('cord_sponsor', 'veil_sponsor', 'coin_sponsor', 'candle_sponsor')
      OR COALESCE(p_extra_roles, '{}')
         && ARRAY['cord_sponsor', 'veil_sponsor', 'coin_sponsor', 'candle_sponsor']::public.guest_role[]
      THEN 2
    ELSE 1
  END;
$function$;

COMMENT ON FUNCTION public.papic_share_weight(guest_role, guest_role[]) IS
  'Papic share multiplier by guest role. Principal sponsors (plain, ninong and '
  'ninang -- all three, see 2026-09-15) weigh 3; the four secondary sponsor '
  'tiers weigh 2; everyone else 1. Mirrors SPONSOR_GUEST_ROLES + ROLE_MULTIPLIER '
  'in apps/web/lib/papic-guest-allotments.ts -- one rule written twice. Note '
  'that the db test holding them together compares them to EACH OTHER, so it '
  'cannot catch a role value they both omit; the vocabulary-level guard in '
  'apps/web/lib/a-split-role-keeps-its-standing.test.ts is what covers that.';
