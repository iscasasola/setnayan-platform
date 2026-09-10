-- ═══════════════════════════════════════════════════════════════════════════
-- THE SETNAYAN GIFT IS OPTIONAL — a service card may publish without one.
--
-- Owner ruling 2026-09-09, verbatim: "exclusive setnayan gift then should be
-- optional."
--
-- 🔴 WHY THIS IS A MIGRATION AND NOT A ONE-LINE TYPESCRIPT CHANGE.
-- `vendor_services` carries a PERMISSIVE `FOR ALL` policy on "this row is
-- yours" and `authenticated` holds UPDATE on all 40 columns, so a shop can
-- PATCH `is_active` straight through PostgREST and never meet any TypeScript
-- in this repo. That is exactly why `enforce_service_publish_gate` exists.
-- ⇒ Removing the requirement from `PUBLISH_REQUIREMENTS` alone would have left
-- the app saying yes and the DATABASE saying no: the shop presses Publish and
-- reads a raw Postgres sentence in a banner. Both halves move together, here.
--
-- ⚖ WHY OPTIONAL, recorded because the reason is a rate and not a preference.
-- The gift is 40% of the booking fee and is charged ON TOP of it, so a
-- COMPULSORY gift is fee + 0.4 × fee = 1.4 × fee — taking what a shop pays us
-- from 5% to 7% of the first PHP 100,000 (measured: PHP 20k booking →
-- PHP 1,400; PHP 50k → PHP 3,500; PHP 100k → PHP 7,000, all exactly 7.00%).
-- Setnayan sells against 25%-commission rivals with "we only charge 5% and
-- 1%". Optional keeps that sentence true, and the 7% only ever applies to a
-- shop that chose it.
--
-- 🔒 THE PRICE REQUIREMENT IS UNTOUCHED, and so is every other line of this
-- function: the draft escape hatch, the "judge only the act of publishing"
-- rule, and the exact refusal wording all stay byte-identical. This migration
-- removes ONE check and nothing else.
--
-- 🔢 SAFE BY ARITHMETIC AT THE APPLY. Production holds 2 service cards, both
-- active, and BOTH already carry `exclusive_perk_text` — so nothing is
-- published by this change that was not published before, and no existing card
-- loses anything. It only stops REFUSING a card that has no gift.
--
-- ⛔ DO NOT put the check back without the owner. `exclusive_perk_text` stays
-- on the table and stays displayed — a card that already promises something
-- keeps promising it. What is retired is the REQUIREMENT, not the field.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_service_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_priced  boolean;
  v_judging boolean;
BEGIN
  -- A draft is nobody's business. Every card is born one.
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Judge only the act of publishing, or of emptying what publishing required.
  --
  -- ⚠ `exclusive_perk_text` is deliberately GONE from this test as well as
  -- from the check below. Leaving it here would re-judge a live card every
  -- time its gift text changed and refuse it for a missing PRICE it never had
  -- — a refusal triggered by editing an unrelated, now-optional field.
  IF TG_OP = 'INSERT' THEN
    v_judging := TRUE;
  ELSE
    v_judging := (OLD.is_active IS NOT TRUE)
              OR (NEW.starting_price_php IS DISTINCT FROM OLD.starting_price_php);
  END IF;

  IF NOT v_judging THEN
    RETURN NEW;
  END IF;

  v_priced := NEW.starting_price_php IS NOT NULL AND NEW.starting_price_php > 0;

  IF NOT v_priced THEN
    RAISE EXCEPTION
      'Set a starting price before you publish this card — it is how couples planning a budget find you. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_service_publish_gate() IS
  'Refuses to publish a vendor_services row without a starting price. The '
  'Setnayan gift was a second requirement until 2026-09-09, when the owner '
  'ruled it optional; a compulsory gift would have raised what a shop pays us '
  'from 5% to 7% of the first PHP 100,000, because the gift is 40% of the '
  'booking fee charged on top of it. Mirrored in TypeScript by '
  'PUBLISH_REQUIREMENTS in apps/web/lib/service-publish-gate.ts — keep the two '
  'in step; the db test service-publish-gate.db.test.ts fails if this stops '
  'refusing an unpriced publish.';
