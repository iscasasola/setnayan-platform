-- ============================================================================
-- THE OWNER'S PRICE SHEET — 2026-08-27
-- ============================================================================
--
-- Every number in this file is an owner ruling given on 2026-08-27, applied as
-- given. Nothing here is an engineering judgement about what a price ought to
-- be, and nothing here was rounded, smoothed or "improved" on the way in.
--
-- ⚠ PRICES LIVE IN THESE TWO TABLES AND NOWHERE ELSE. If you are reading this
-- migration to find out what something costs today, you are reading the wrong
-- thing — read the row. This file records what CHANGED on one day.
--
-- ── WHAT MOVES, AND WHAT DELIBERATELY DOES NOT ──────────────────────────────
--
-- CUSTOMER CATALOG (platform_retail_catalog_v2)
--   PAPIC_GUEST_50K        ₱10,000 → ₱11,200
--   LIVE_STUDIO             ₱2,999 → ₱3,000
--   PAPIC_ADDON_THANK_YOU   ₱2,499 → ₱2,500
--   COUPLE_WEBSITE_PRO      title "Couple Website PRO" → "Event Hub Pro"
--                           (price UNCHANGED at ₱3,500; service_code UNCHANGED)
--
-- ⚖ THE 50K RUNG SHALLOWS THE DISCOUNT CURVE AT THE TOP, AND THAT IS THE
--   RULING. The ladder is defined against ₱1 = 1 credit; 50,000 at ₱11,200 is
--   77.6% off, where it was 80%. It is STILL the cheapest rung per credit
--   (₱0.224 against 30,000's ₱0.25) and still the most expensive rung in
--   absolute pesos, so both rules the ladder guard actually enforces — never
--   above ₱1 a credit, never worse per credit than the rung below — still hold.
--   No guard was weakened; one pinned expectation moved with the price.
--
-- 🔒 EXPLICITLY UNCHANGED, each one ruled on: the other fifteen Papic rungs
--   (PAPIC_GUEST stays ₱1,200 · PAPIC_GUEST_10K stays ₱3,200) · SETNAYAN_AI
--   (₱2,499 regular / ₱1,499 onboarding — "it has different prices depending on
--   the event") · CUSTOM_QR_GUEST at ₱0.
--
-- CUSTOMER BUNDLES (platform_package_catalog) — RETIRED
--   PAPIC_UNLOCK      "Unlock all of Papic"       ₱15,000 → off sale
--   PAPIC_UNLOCK_LTD  "Unlock all of Papic (Ltd)"  ₱9,000 → off sale
--
--   WHY: superseded by the sixteen-rung credit ladder. With 50,000 credits now
--   at ₱11,200, a ₱15,000 "unlock everything" package no longer prices sensibly
--   against the thing it sits beside.
--   ⚠ THE REASON LIVES IN THIS COMMENT BECAUSE THE TABLE HAS NOWHERE ELSE TO
--   PUT IT. platform_package_catalog is (package_code, title, retail_price_php,
--   is_active, created_at, updated_at, updated_by_admin_id, description) — there
--   are no retirement-reason columns on this branch. A parallel branch adds
--   them; when it lands, this reason should move onto the row.
--
--   Measured before writing, not assumed: production holds TWO orders in its
--   entire life (a cancelled ₱499 and a paid ₱2,499 Setnayan AI) and NEITHER is
--   a bundle; event_software_activations_v2 holds ZERO rows for either code. So
--   there is no live entitlement to strip and no order to strand.
--
-- VENDOR CATALOG (vendor_billing_catalog)
--   enterprise_vendor_monthly   ₱8,000 → ₱10,000
--   solo_vendor_annual         ₱10,000 → ₱10,400
--   pro_vendor_annual          ₱25,000 → ₱26,000
--   enterprise_vendor_annual   ₱80,000 → ₱104,000
--   vendor_additional_branch      ₱999 → ₱1,000
--   vendor_3d_booth             ₱1,500 → ₱2,500
--
-- 🔢 THE ANNUAL RELATIONSHIP, RECORDED AND NOT ENCODED. Every annual figure the
--   owner gave is exactly `four_week_price × 10.4` — thirteen 28-day periods
--   with 20% off. It checks out on all four: 1,000×10.4 = 10,400 ·
--   2,500×10.4 = 26,000 · 10,000×10.4 = 104,000 · and the branch/booth/seat/AI
--   annuals he quoted follow the same rule off their NEW 28-day prices.
--   ⛔ It is written here as an OBSERVATION, never as a derived column or a
--   rule engine. A stored second copy of a pricing rule is how prices drift,
--   and the owner must stay free to break the relationship on any single row.
--
-- VENDOR CUSTOM TIER — RETIRED, all six purchasable rows
--   vendor_custom_base             ₱8,999 → off sale
--   vendor_custom_reach_nationwide ₱2,499 → off sale
--   vendor_custom_domain             ₱499 → off sale
--   vendor_custom_event_slot         ₱499 → off sale
--   vendor_custom_reach_step         ₱499 → off sale
--   vendor_custom_photo_pack          ₱99 → off sale
--
--   Owner's ruling: ENTERPRISE BECOMES THE TOP PURCHASABLE TIER. Anyone needing
--   more than Enterprise's caps is handled by hand, off-platform.
--
--   🔒 THE TIER CONCEPT IS NOT REMOVED, DELIBERATELY. `vendor_tier_rank()` still
--   ranks 'custom' at 6 and the vendor_tier_state enum still carries the value.
--   Read out of production before writing this: the function names every enum
--   value explicitly and its ELSE arm exists precisely so an unranked value
--   fails CLOSED. Retiring what can be BOUGHT is the ruling; deleting the tier
--   concept is not, and touching the rank function would put the no-silent-
--   downgrade guard at risk for no gain.
--   Measured: production holds TWO vendor profiles and BOTH are `solo`. Nobody
--   is on custom, so no vendor's rank can move because of this.
--
--   🚨 AND THIS FLAG DOES NOT CLOSE THE CUSTOM DOOR. Say it here because the
--   next reader will assume it does. `lib/vendor-custom-catalog.ts` reads these
--   rows with `.eq('is_active', true)` and substitutes a hardcoded literal for
--   any row that goes missing — its own docblock says, in terms, that
--   deactivating a row "is not a retirement" and that the axis "keeps quoting,
--   at the same price, with the catalog saying it is off." The vendor-side
--   Custom configurator is still linked from the subscription page and still
--   quotes ₱8,999 + the add-on axes off those fallbacks. Closing it for real
--   means deleting the axes from CUSTOM_SKU_CODES and CUSTOM_UNIT_PRICE_FALLBACK
--   — a separate change, reported to the owner rather than smuggled in here.
--   What this migration DOES achieve on the customer-visible side: `/vendors`
--   and the homepage read through `fetchV2VendorCatalog`, which filters
--   `is_active`, and `getVendorPrices` gives `customFrom` NO peso fallback — so
--   the public "from ₱8,999" figure disappears the moment this applies.
--
-- ⛔ NOT IN THIS FILE, ON PURPOSE:
--   · `vendor_photo_challenge` — the sheet prices it ₱2,500/4wk + ₱26,000/yr,
--     which is a change of SELLING MODEL (per-event → recurring), not a price.
--   · `vendor_branch_28day` — the ₱999 twin of vendor_additional_branch. Left at
--     999 while its sibling moves to 1,000. That inconsistency is deliberate and
--     is reported, not silently reconciled.
--   · The four ANNUAL ADD-ON rows the sheet asks for (branch ₱10,400 · seat
--     ₱2,600 · Vendor AI ₱15,600 · 3D Booth ₱26,000). NOT CREATED. The billing
--     machinery cannot charge or honour an annual add-on: every add-on term is
--     the TypeScript constant 28 (BRANCH_PERIOD_DAYS, SEAT_PERIOD_DAYS,
--     VENDOR_AI_ADDON_PERIOD_DAYS, VENDOR_3D_BOOTH_PERIOD_DAYS), each price
--     reader selects its ONE literal sku_code, and the only function that turns
--     `subscription_annual` into a 365-day term — create_vendor_subscription —
--     maps sku→tier by `LIKE 'solo|pro|enterprise_vendor_%'` and raises
--     UNMAPPED_SKU_TIER for anything else. A priced row nothing can fulfil is
--     the "takes the money and grants nothing" shape this codebase keeps paying
--     for, so the rows are withheld and the gap is reported.
--
-- ============================================================================

BEGIN;

-- ── 1 · the three customer prices ───────────────────────────────────────────
-- Written as data so each number appears exactly once in this file.
CREATE TEMP TABLE _retail_reprice (service_code TEXT PRIMARY KEY, php NUMERIC)
  ON COMMIT DROP;
INSERT INTO _retail_reprice (service_code, php) VALUES
  ('PAPIC_GUEST_50K',       11200.00),
  ('LIVE_STUDIO',            3000.00),
  ('PAPIC_ADDON_THANK_YOU',  2500.00);

UPDATE public.platform_retail_catalog_v2 c
   SET retail_price_php = r.php,
       updated_at       = NOW()
  FROM _retail_reprice r
 WHERE c.service_code = r.service_code
   AND c.retail_price_php IS DISTINCT FROM r.php;

-- ── 2 · Couple Website PRO becomes Event Hub Pro ────────────────────────────
-- The customer-facing name has been "Event Hub Pro" in the corpus and in
-- several rendered surfaces for weeks; the catalog row was the last place still
-- carrying the old one, which is what an admin sees on the pricing screen and
-- what a receipt quotes. Price and service_code are untouched.
UPDATE public.platform_retail_catalog_v2
   SET title      = 'Event Hub Pro',
       updated_at = NOW()
 WHERE service_code = 'COUPLE_WEBSITE_PRO'
   AND title IS DISTINCT FROM 'Event Hub Pro';

-- ── 3 · both Papic bundles come off sale ────────────────────────────────────
-- Deactivated, never deleted. Their rows and their bundle_components stay so
-- that anything minted before today still resolves against what it was sold at.
UPDATE public.platform_package_catalog
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE package_code IN (
         'PAPIC_UNLOCK',
         'PAPIC_UNLOCK_LTD'
       )
   AND is_active;

-- ── 4 · the six vendor prices ───────────────────────────────────────────────
CREATE TEMP TABLE _vendor_reprice (sku_code TEXT PRIMARY KEY, php NUMERIC)
  ON COMMIT DROP;
INSERT INTO _vendor_reprice (sku_code, php) VALUES
  ('enterprise_vendor_monthly',  10000.00),
  ('solo_vendor_annual',         10400.00),
  ('pro_vendor_annual',          26000.00),
  ('enterprise_vendor_annual',  104000.00),
  ('vendor_additional_branch',    1000.00),
  ('vendor_3d_booth',             2500.00);

UPDATE public.vendor_billing_catalog v
   SET price_php  = r.php,
       updated_at = NOW()
  FROM _vendor_reprice r
 WHERE v.sku_code = r.sku_code
   AND v.price_php IS DISTINCT FROM r.php;

-- ── 5 · the Custom tier comes off sale ──────────────────────────────────────
-- 🔑 ONE CODE PER LINE. gitleaks' generic-api-key rule reads a single-line
-- `IN ('A','B','C')` list of upper/underscore identifiers as a leaked
-- credential; it has fired on exactly this shape in this repo before. Splitting
-- the list removes the trigger instead of muting it with an allowlist entry
-- that would break again the next time a line moved.
UPDATE public.vendor_billing_catalog
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE sku_code IN (
         'vendor_custom_base',
         'vendor_custom_reach_nationwide',
         'vendor_custom_domain',
         'vendor_custom_event_slot',
         'vendor_custom_reach_step',
         'vendor_custom_photo_pack'
       )
   AND is_active;

-- ── 6 · refuse to apply if any of it did not take ───────────────────────────
-- 🔑 A MIGRATION THAT SILENTLY MATCHED NOTHING IS THE SHAPE THIS PROJECT KEEPS
-- PAYING FOR. Every statement above is a conditional UPDATE, so a mistyped code
-- would match zero rows, commit green, and leave the price exactly as it was
-- with nothing anywhere saying so. This block reads the rows back and throws.
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- Customer prices, by the object.
  SELECT string_agg(format('%s=%s', c.service_code, c.retail_price_php), ', ')
    INTO v_bad
    FROM public.platform_retail_catalog_v2 c
    JOIN (VALUES
            ('PAPIC_GUEST_50K',       11200.00::NUMERIC),
            ('LIVE_STUDIO',            3000.00),
            ('PAPIC_ADDON_THANK_YOU',  2500.00)
         ) AS w(code, php) ON w.code = c.service_code
   WHERE c.retail_price_php <> w.php OR NOT c.is_active;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'customer reprice did not take: %', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'COUPLE_WEBSITE_PRO'
       AND title = 'Event Hub Pro'
       AND retail_price_php = 3500.00
  ) THEN
    RAISE EXCEPTION 'Event Hub Pro rename did not take, or its price moved (it must not)';
  END IF;

  -- The bundles are off sale.
  IF EXISTS (
    SELECT 1 FROM public.platform_package_catalog
     WHERE is_active
       AND package_code IN (
             'PAPIC_UNLOCK',
             'PAPIC_UNLOCK_LTD'
           )
  ) THEN
    RAISE EXCEPTION 'a Papic unlock bundle is still on sale';
  END IF;

  -- Vendor prices, by the object.
  SELECT string_agg(format('%s=%s', v.sku_code, v.price_php), ', ')
    INTO v_bad
    FROM public.vendor_billing_catalog v
    JOIN (VALUES
            ('enterprise_vendor_monthly',  10000.00::NUMERIC),
            ('solo_vendor_annual',         10400.00),
            ('pro_vendor_annual',          26000.00),
            ('enterprise_vendor_annual',  104000.00),
            ('vendor_additional_branch',    1000.00),
            ('vendor_3d_booth',             2500.00)
         ) AS w(code, php) ON w.code = v.sku_code
   WHERE v.price_php <> w.php;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'vendor reprice did not take: %', v_bad;
  END IF;

  -- The Custom tier is off sale, and Enterprise is still on it.
  IF EXISTS (
    SELECT 1 FROM public.vendor_billing_catalog
     WHERE is_active
       AND sku_code IN (
             'vendor_custom_base',
             'vendor_custom_reach_nationwide',
             'vendor_custom_domain',
             'vendor_custom_event_slot',
             'vendor_custom_reach_step',
             'vendor_custom_photo_pack'
           )
  ) THEN
    RAISE EXCEPTION 'a Custom-tier row is still on sale';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_billing_catalog
     WHERE is_active AND sku_code = 'enterprise_vendor_monthly'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.vendor_billing_catalog
     WHERE is_active AND sku_code = 'enterprise_vendor_annual'
  ) THEN
    RAISE EXCEPTION 'Enterprise must remain purchasable — it is now the top tier';
  END IF;

  -- The rungs the owner did NOT move must not have moved. Cheap, and it is the
  -- assertion that would have caught a temp-table typo spilling into a
  -- neighbouring row.
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'PAPIC_GUEST' AND retail_price_php = 1200.00
  ) OR NOT EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'PAPIC_GUEST_10K' AND retail_price_php = 3200.00
  ) OR NOT EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'SETNAYAN_AI' AND retail_price_php = 2499.00
  ) THEN
    RAISE EXCEPTION 'a rung the owner left alone has moved';
  END IF;
END $$;

COMMIT;
