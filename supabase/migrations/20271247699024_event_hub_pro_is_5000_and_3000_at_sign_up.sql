-- event_hub_pro_is_5000_and_3000_at_sign_up
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner ruling, 2026-09-25, verbatim: "make it 5000 with 40% off becoming
-- 3000 on onboarding."
--
-- Event Hub Pro (COUPLE_WEBSITE_PRO) goes ₱3,500 → ₱5,000 regular, REPLACING
-- the ₱3,500 that `20271245494068_event_hub_pro_is_3500_and_2100_at_sign_up.sql`
-- settled earlier the same day. Its sign-up price moves ₱2,100 → ₱3,000, so
-- the discount stays 40% of the NEW regular ((5000 − 3000) / 5000 = 0.4) —
-- the same 40% the owner named for the previous pair, carried forward onto
-- the new numbers rather than left to drift.
--
-- ── WHERE THE SIGN-UP PRICE LIVES — THE MECHANISM ALREADY EXISTS ────────────
-- `onboarding_price_php` IS the per-SKU sign-up price (migration
-- 20271139128584, where Setnayan AI got its own). Every reader already reads it:
--   • the services step card  → setupPricePhp(retail, onboarding_price_php, house %)
--   • the onboarding mint     → the same function, re-reading the row at commit
--   • /admin/pricing          → the per-row sign-up card edits it after this
-- `setupPricePhp` charges the CHEAPER of this row's own price and the house
-- percentage (10% today), so ₱3,000 wins over ₱4,500 and the couple is charged
-- ₱3,000 — the house rule stays a floor, exactly as it is for the planner.
-- Nothing is generalised: Papic's family discount and Setnayan AI's family
-- discount are separate rows and are not touched by this file.
--
-- 🔑 EVERYWHERE ELSE PAYS REGULAR. The studio buy page, the Event Hub
-- controller offer and the editor's unlock button all price through the
-- catalog's `retail_price_php` (via `formatV2Sku` / the order-charge authority
-- in its default 'regular' context), so they read ₱5,000 after this runs.
--
-- ⚠ IN PRODUCTION THIS IS A REAL CHANGE, NOT A NO-OP. It reaches prod only
-- through `deploy-prod`'s `supabase db push --include-all`.
-- ⛔ Price is admin-managed after this. Do not re-derive it from here.

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php     = 5000,
       onboarding_price_php = 3000,
       updated_at           = now()
WHERE  service_code = 'COUPLE_WEBSITE_PRO'
  AND  (retail_price_php IS DISTINCT FROM 5000
        OR onboarding_price_php IS DISTINCT FROM 3000);

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT retail_price_php, onboarding_price_php, is_active INTO r
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO';
  IF NOT FOUND THEN RAISE EXCEPTION 'COUPLE_WEBSITE_PRO missing'; END IF;
  IF r.retail_price_php <> 5000.00
     OR r.onboarding_price_php IS DISTINCT FROM 3000.00
     OR NOT r.is_active THEN
    RAISE EXCEPTION 'COUPLE_WEBSITE_PRO did not settle (regular %, sign-up %, active %)',
      r.retail_price_php, r.onboarding_price_php, r.is_active;
  END IF;
  -- The sign-up price must be a whole peso strictly below regular — the same
  -- post-condition every family-priced row answers to (20271178693019).
  IF r.onboarding_price_php <> ROUND(r.onboarding_price_php, 0)
     OR r.onboarding_price_php >= r.retail_price_php THEN
    RAISE EXCEPTION 'COUPLE_WEBSITE_PRO sign-up price is not a whole peso below regular';
  END IF;
END
$$;
