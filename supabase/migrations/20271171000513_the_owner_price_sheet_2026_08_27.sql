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
-- VENDOR CUSTOM TIER — RULED RETIRED, THEN REVERSED THE SAME DAY. UNTOUCHED HERE.
--
--   All six Custom rows STAY ON SALE. Five of them — the add-on axes — are not
--   touched or even named here. The sixth, the base fee, is REPRICED (below),
--   and that is the only Custom change in this file.
--
--   ⛔ AND THERE IS NO ASSERTION HERE PINNING THEM ON SALE, on purpose. One was
--   written and removed: it would have made a PRICE migration fail forever the
--   day the owner legitimately retires one of those rows, and the replay runs
--   this file on every db test. A migration must not hold an unrelated product
--   hostage to prove it did not touch it. The inversion rule below is guarded in
--   the test suite instead, which is where a standing rule belongs.
--
-- CUSTOM BASE — REPRICED, BECAUSE TODAY'S ENTERPRISE RAISE INVERTED THE LADDER
--   vendor_custom_base  ₱8,999 → ₱11,000  (owner 2026-08-27)
--
--   🚨 THE RAISE IN THIS SAME FILE CREATED A LIVE INVERSION. Enterprise went to
--   ₱10,000 while the Custom base — documented everywhere as "the unlimited tier
--   ABOVE Enterprise" — sat at ₱8,999. The tier above cost ₱1,001 LESS than the
--   tier below it. Caught before anyone could act on it: production holds two
--   vendor profiles and BOTH are `solo`, so nobody was ever quoted the inverted
--   ladder.
--
--   ⚠ THIS WAS PREDICTED AND THE PREDICTION WAS NOT A MECHANISM.
--   `Vendor_Subscription_Ladder_2026-07-22.md:27` already carried
--   "⚠ With Enterprise now ₱8,000, round Custom's floor to ₱9,000 for
--   consistency." Nobody actioned it, and a note in a document cannot fail a
--   build. That is exactly why the rule now lives in
--   `apps/web/tests/db/custom-sits-above-enterprise.db.test.ts`, which derives
--   BOTH figures from the catalog and fails if the base ever falls to or below
--   Enterprise's 28-day price. The doc records the reasoning; the guard holds it.
--
--   ✅ ₱11,000 IS FINAL. THE ₱500 QUESTION IS CLOSED, NOT PENDING.
--   It was briefly open: the SIGNED rate card derived the old ₱8,999 as
--   "Enterprise ₱7,499 + ₱1,500 white-glove premium", which applied to
--   Enterprise ₱10,000 would have given ₱11,500 instead. That was surfaced
--   rather than silently "corrected" — and then the owner settled it by
--   removing its premise. On 2026-08-27 he ruled, verbatim: *"custom does not
--   mean they get their own concierge from us. it just means they get an
--   upgrade the 3 tiers does not provide."*
--
--   Custom is a CAPABILITY upgrade — Enterprise with its ceilings removed — so
--   the white-glove premium no longer exists to be priced, and there is nothing
--   left for ₱11,000 to be reconciled against. Nothing was owed to anybody
--   either: all four white-glove promises (account manager, quarterly review,
--   named contact, onboarding/migration) were pure marketing copy with no
--   implementation, and production has never had a Custom subscriber. The
--   marketing copy was deleted in this same PR.
--
--   ⛔ THE FIVE ADD-ON AXES ARE UNCHANGED (₱99 · ₱499 ×3 · ₱2,499). The
--   inversion is about the ENTRY price; the axes sit on top of it.
--
--   ✅ AND THE BASE IS GENUINELY THE FLOOR — checked in the quote math, not
--   assumed. `computeCustomQuote` charm-rounds, then floors at base, and the
--   per-org admin DISCOUNT is floored at base too
--   (`final28 = Math.max(charmRoundUp(discounted), p.base)`), so neither a
--   composition nor a discount can quote a Custom plan below the base. Raising
--   the base therefore closes the inversion on every self-serve and admin quote
--   path. The one thing outside it is a hand-written org-scoped catalog row
--   (§11 "Stage 1 — manual"), which is a negotiated deal, not a product path.
--
--   🔑 WHY THIS PARAGRAPH EXISTS AT ALL, AND WHY IT IS THE MOST USEFUL THING IN
--   THIS FILE. Earlier on 2026-08-27 the owner ruled the Custom tier retired and
--   this migration deactivated all six rows. Building it surfaced the fact that
--   KILLED the ruling: **flipping is_active does not retire this product.**
--   `lib/vendor-custom-catalog.ts` reads these rows with `.eq('is_active', true)`
--   and then substitutes a HARDCODED LITERAL for any row that comes back
--   missing — so every axis keeps quoting at exactly the same price with the
--   catalog saying it is off. Its own docblock had already written this down, in
--   terms: deactivating a row "is not a retirement"; the axis "keeps quoting, at
--   the same price, with the catalog saying it is off."
--
--   So the flag produced a HALF state, not a retirement: `/vendors` and the
--   homepage would have stopped showing Custom (they read through
--   `fetchV2VendorCatalog`, which filters is_active, and `customFrom` has no
--   peso fallback), while the vendor-side configurator — still linked from
--   /vendor-dashboard/subscription — kept quoting and kept selling it. A tier
--   invisible to shoppers and fully buyable by anyone already inside.
--
--   Shown that, the owner reversed himself the same day: a supplier must see
--   exactly what they can buy, and he would rather Custom stay genuinely on sale
--   than ship a tier that looks retired and is not. ⚖ ONE decision, reversed
--   before anything applied — which is why this file was EDITED rather than
--   given a second statement putting the rows back. A retire-then-restore pair
--   would read in the audit trail as two owner rulings when there was one.
--
--   ⛔ THE DURABLE RULE, because it will be re-learned otherwise: AN is_active
--   FLIP IS NOT A RETIREMENT WHEN A CODE-SIDE FALLBACK EXISTS. Before retiring
--   any catalog row, grep for a reader that supplies a literal when the row goes
--   missing. If one exists, the flag hides the product from the people who have
--   not bought it and changes nothing for the people who can.
--
--   🔒 `vendor_tier_rank()` and the vendor_tier_state enum were never touched at
--   any point in this, so there is nothing to undo there either.
--
-- THE THREE ANNUAL TITLES NOW STATE A DISCOUNT WE DO NOT GIVE — RETITLED
--
--   🚨 THE MULTIPLIER MOVED AND THE PROMISE IN THE NAME DID NOT. Production
--   billed annual at 28-day × 10 (13 cycles for 10) — about 23% off, or "12
--   weeks free". The owner's sheet moves every annual to × 10.4, which is
--   exactly 20% off, or 10.4 weeks. Three row TITLES carried the OLD figure as a
--   customer-facing claim about money:
--
--     solo_vendor_annual        "… (Annual · save 12 weeks)"
--     pro_vendor_annual         "… (Annual · save ~23%)"
--     enterprise_vendor_annual  "… (Annual · save ~23%)"
--
--   Shipping the new prices under those names advertises a discount we no longer
--   give. All three now say "save 20%".
--
--   ⚖ WHY A PERCENTAGE AND NOT "10.4 weeks". The saving is EXACTLY 20% on all
--   three (13,000 vs 10,400 · 32,500 vs 26,000 · 130,000 vs 104,000), so the
--   percentage is precise, uniform and needs no rounding weasel. "10.4 weeks" is
--   arithmetically identical but reads like a fake-precise number, and the "~"
--   the old titles needed is exactly what a clean figure avoids.
--
--   ⚠ THE SAME CLAIM IS ALSO RENDERED IN TWO PLACES THAT ARE NOT THIS TABLE and
--   they move in the same change: the annual badge on the subscription cards and
--   the cycle-toggle hint both hardcoded "12 weeks". The per-tier peso saving
--   beside them is COMPUTED (28d x 13 - annual), so it re-derives on its own.
--
-- THE CUSTOM DIALS — THREE ROUNDED, TWO DROPPED (owner 2026-08-27)
--
--   vendor_custom_reach_nationwide  ₱2,499 → ₱2,500
--   vendor_custom_event_slot          ₱499 → ₱500
--   vendor_custom_domain              ₱499 → ₱500
--
--   Owner: *"make the whole number 500, 2500"*. That is the THIRD rounding of a
--   -1 charm ending in one day, after Live Studio ₱2,999 → ₱3,000 and Thank You
--   ₱2,499 → ₱2,500.
--   ⛔ AND IT IS NOT A GENERAL RULE. Asked whether charm pricing should be
--   retired repo-wide he declined: *"no we will adjust them manually on the app
--   since i have control on the prices there as well."* SETNAYAN_AI stays
--   ₱2,499. The catalog is MEANT to hold a mix of -1 and round endings. Do not
--   sweep, harmonise or "tidy" price endings — see the DECISION_LOG row.
--
--   DROPPED, and dropping is NOT this flag alone:
--     vendor_custom_reach_step   +100 km, ₱499  — nationwide is now the ONLY
--                                                 reach upgrade
--     vendor_custom_photo_pack   +100 portfolio photos, ₱99
--
--   🔑 THE CODE CAME OUT FIRST, AND THAT ORDER IS THE WHOLE POINT.
--   `lib/vendor-custom-catalog.ts` substitutes a hardcoded literal for any row
--   that goes missing, so deactivating these two rows on their own would have
--   changed NOTHING — both axes would have gone on quoting at ₱499 and ₱99 with
--   the catalog saying they were off. That module's own docblock has said so
--   since the token retirement of 2026-08-07, and it names the fix: delete the
--   axis from the SKU map, the fallback, `CustomUnitPrices`, the quote math and
--   BOTH configurators. All of that is in this PR; the UPDATE below is the last
--   step, not the first.
--
--   Safe by arithmetic: `vendor_custom_plans` holds ZERO rows in production, so
--   no stored composition can be re-priced by the removal.
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

-- ── 5 · the three annual titles stop promising the old discount ────────────
-- A TITLE IS CUSTOMER-FACING COPY, not a label. These three state the saving in
-- the product name, so a price change that leaves them alone ships a false
-- promise. Matched on the OLD text so a re-run cannot clobber a later rename.
--
-- 🔑 THE PATTERN IS '%23%' — CONTAINS "23" — AND THAT IS DELIBERATE, NOT LAZY.
-- The first draft wrote '%23%%' meaning "a literal percent sign". In a LIKE
-- pattern '%%' is NOT an escape (that rule belongs to RAISE / format), so it
-- parsed as two wildcards and matched only by accident. Matching on "23"
-- inside a WHERE already scoped to one sku_code is unambiguous, so the simple
-- pattern is both correct and honest about what it tests.
UPDATE public.vendor_billing_catalog
   SET title      = 'Solo Vendor (Annual · save 20%)',
       updated_at = NOW()
 WHERE sku_code = 'solo_vendor_annual'
   AND title LIKE '%12 weeks%';

UPDATE public.vendor_billing_catalog
   SET title      = 'Pro Vendor (Annual · save 20%)',
       updated_at = NOW()
 WHERE sku_code = 'pro_vendor_annual'
   AND title LIKE '%23%';

UPDATE public.vendor_billing_catalog
   SET title      = 'Enterprise Vendor (Annual · save 20%)',
       updated_at = NOW()
 WHERE sku_code = 'enterprise_vendor_annual'
   AND title LIKE '%23%';

-- ── 6 · the Custom dials: three rounded, two dropped ───────────────────────
-- One code per line — gitleaks reads a single-line IN (...) list of these as a
-- credential.
UPDATE public.vendor_billing_catalog
   SET price_php = 2500.00, updated_at = NOW()
 WHERE sku_code = 'vendor_custom_reach_nationwide'
   AND price_php IS DISTINCT FROM 2500.00;

UPDATE public.vendor_billing_catalog
   SET price_php = 500.00, updated_at = NOW()
 WHERE sku_code = 'vendor_custom_event_slot'
   AND price_php IS DISTINCT FROM 500.00;

UPDATE public.vendor_billing_catalog
   SET price_php = 500.00, updated_at = NOW()
 WHERE sku_code = 'vendor_custom_domain'
   AND price_php IS DISTINCT FROM 500.00;

-- The two dropped axes come off sale. Deactivated, never deleted: a row that
-- vanishes takes its own history with it, and the code no longer reads either.
UPDATE public.vendor_billing_catalog
   SET is_active = FALSE, updated_at = NOW()
 WHERE sku_code IN (
         'vendor_custom_reach_step',
         'vendor_custom_photo_pack'
       )
   AND is_active;

-- ── 7 · the Custom base rises above Enterprise ──────────────────────────────
-- Kept as its OWN statement rather than a seventh row in _vendor_reprice,
-- because it is not part of the price sheet: it is the correction the sheet's
-- own Enterprise raise made necessary. A future reader diffing this file should
-- be able to see that distinction without reading the commit message.
UPDATE public.vendor_billing_catalog
   SET price_php  = 11000.00,
       updated_at = NOW()
 WHERE sku_code = 'vendor_custom_base'
   AND price_php IS DISTINCT FROM 11000.00;

-- ── 8 · refuse to apply if any of it did not take ───────────────────────────
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

  -- No annual row may still advertise the retired discount.
  SELECT string_agg(sku_code || ' => ' || title, ', ')
    INTO v_bad
    FROM public.vendor_billing_catalog
   WHERE offering_type = 'subscription_annual'
     AND (title LIKE '%12 weeks%' OR title LIKE '%23%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'an annual row still promises the old ~23%% / 12-weeks discount, but annual is now 20%%: %', v_bad;
  END IF;

  -- The three rounded dials, by the object.
  SELECT string_agg(format('%s=%s', v.sku_code, v.price_php), ', ')
    INTO v_bad
    FROM public.vendor_billing_catalog v
    JOIN (VALUES
            ('vendor_custom_reach_nationwide', 2500.00::NUMERIC),
            ('vendor_custom_event_slot',        500.00),
            ('vendor_custom_domain',            500.00)
         ) AS w(code, php) ON w.code = v.sku_code
   WHERE v.price_php <> w.php OR NOT v.is_active;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a Custom dial did not round, or went inactive: %', v_bad;
  END IF;

  -- And the two dropped axes are off sale.
  IF EXISTS (
    SELECT 1 FROM public.vendor_billing_catalog
     WHERE is_active
       AND sku_code IN (
             'vendor_custom_reach_step',
             'vendor_custom_photo_pack'
           )
  ) THEN
    RAISE EXCEPTION 'a dropped Custom axis is still on sale';
  END IF;

  -- 🔑 THE INVERSION MUST BE GONE. Both figures read back out of the catalog,
  -- never re-typed against each other — the same reason the standing guard in
  -- the test suite derives both sides. This is the one assertion here that is
  -- about a RELATIONSHIP rather than a value, and it is the one that would have
  -- caught today's mistake if it had existed this morning.
  SELECT format('custom base %s vs enterprise 28-day %s', c.price_php, e.price_php)
    INTO v_bad
    FROM public.vendor_billing_catalog c,
         public.vendor_billing_catalog e
   WHERE c.sku_code = 'vendor_custom_base'
     AND e.sku_code = 'enterprise_vendor_monthly'
     AND c.price_php <= e.price_php;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'the tier above Enterprise costs the same or less than Enterprise: %', v_bad;
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
