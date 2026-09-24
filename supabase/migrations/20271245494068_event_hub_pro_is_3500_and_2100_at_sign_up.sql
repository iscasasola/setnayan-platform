-- event_hub_pro_is_3500_and_2100_at_sign_up
-- Created via `pnpm migration:new`. Data-only and idempotent.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner rulings, 2026-09-25, verbatim:
--   "Regular Price is 3500 40% off when purchased on onboarding at 2100."
--   "so our regular price is 3500 to unlock pro"
--   "we will change every location of the price of Event Hub Pro"
--
-- Event Hub Pro (COUPLE_WEBSITE_PRO) goes ₱2,000 → ₱3,500 regular, REPLACING the
-- ₱2,000 that `20271245395425_event_hub_pro_settles_at_2000.sql` settled two days
-- ago. And it gains its own sign-up price, ₱2,100 — the price during the create
-- flow only, where the onboarding services step now sells it beside Papic and
-- Setnayan AI.
--
-- ── WHERE THE SIGN-UP PRICE LIVES — THE MECHANISM ALREADY EXISTS ────────────
-- `onboarding_price_php` IS the per-SKU sign-up price (migration
-- 20271139128584, where Setnayan AI got its own). Every reader already reads it:
--   • the services step card  → setupPricePhp(retail, onboarding_price_php, house %)
--   • the onboarding mint     → the same function, re-reading the row at commit
--   • /admin/pricing          → the per-row sign-up card edits it after this
-- `setupPricePhp` charges the CHEAPER of this row's own price and the house
-- percentage (10% today), so ₱2,100 wins over ₱3,150 and the couple is charged
-- ₱2,100 — the house rule stays a floor, exactly as it is for the planner.
-- Nothing is generalised: Papic's family discount and Setnayan AI's family
-- discount are separate rows and are not touched by this file.
--
-- 🔑 EVERYWHERE ELSE PAYS REGULAR. The studio buy page, the Event Hub
-- controller offer and the editor's unlock button all price through the
-- catalog's `retail_price_php` (via `formatV2Sku` / the order-charge authority
-- in its default 'regular' context), so they read ₱3,500 after this runs.
--
-- ⚠ IN PRODUCTION THIS IS A REAL CHANGE, NOT A NO-OP (unlike its predecessor).
-- It reaches prod only through `deploy-prod`'s `supabase db push --include-all`.
-- ⛔ Price is admin-managed after this. Do not re-derive it from here.

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php     = 3500,
       onboarding_price_php = 2100,
       updated_at           = now()
WHERE  service_code = 'COUPLE_WEBSITE_PRO'
  AND  (retail_price_php IS DISTINCT FROM 3500
        OR onboarding_price_php IS DISTINCT FROM 2100);

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT retail_price_php, onboarding_price_php, is_active INTO r
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'COUPLE_WEBSITE_PRO';
  IF NOT FOUND THEN RAISE EXCEPTION 'COUPLE_WEBSITE_PRO missing'; END IF;
  IF r.retail_price_php <> 3500.00
     OR r.onboarding_price_php IS DISTINCT FROM 2100.00
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
