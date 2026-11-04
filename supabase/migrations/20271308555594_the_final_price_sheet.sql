-- ============================================================================
-- THE FINAL PRICE SHEET — ONE PRICE, APPLE AND WEBSITE (owner, 2026-11-04)
-- ============================================================================
--
-- ⚖ DECISION_LOG 2026-11-04 rows, newest wins on any conflict:
--   · "FINAL PRICE SHEET — ONE PRICE, APPLE AND WEBSITE" (owner's cost sheet,
--     header "Apple and Website", *"same price for both"*);
--   · "STORAGE BY THE YEAR" (*"one year for storage 5,10,15 is 990,1490,1990"*);
--   · "SUPPLIER PRICE SHEET" (plans, 3D booth, photo challenge, Ultra-only
--     branch + seat, the ₱500 supplier pack retires);
--   · "SIX OWNER ANSWERS" (suppliers buy the same Papic packs; Pro = 1,000 credits);
--   · "EVENT PRO = … SETNAYAN AI IS NOT SOLD SEPARATELY" (its price is superseded;
--     the AI part stands: AI comes inside Event Plus and Event Pro);
--   · "DEEP SEARCH AND CHATBOT KEEP TWO PRICES BY PLAN" (₱499 / ₱799, ₱1,490 / ₱1,990);
--   · "GIFT PRICES" (what a Verified-and-up supplier pays to gift a product).
--
-- This file is the ONLY place these figures are typed. Product code reads the
-- two catalogues (CLAUDE.md: "never derive a price from … a code comment —
-- read platform_retail_catalog_v2"). Every row stays editable in Admin › Pricing.
--
-- NOT TOUCHED: already-paid orders (they keep the amount actually paid), the
-- legacy-cap rows (`event_hub_pro_legacy_part_lines`), and every retired row's
-- history. Nothing is deleted — rows that stop selling get is_active = FALSE.
--
-- ALTER before UPDATE (memory "ALTER before UPDATE in one migration").
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 0 · two new catalogue columns (ALTER first) ─────────────────────────────
-- gift_price_php — owner 2026-11-04 "GIFT PRICES": the fixed figure a Verified,
-- Solo, Pro or Ultra shop pays to gift this product to a couple. NULL = this
-- product cannot be gifted at a gift price. A Free (unverified) shop pays the
-- list price (`retail_price_php`), as ruled the same day.
ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS gift_price_php NUMERIC(12,2);
ALTER TABLE public.platform_retail_catalog_v2
  DROP CONSTRAINT IF EXISTS platform_retail_catalog_v2_gift_price_positive;
ALTER TABLE public.platform_retail_catalog_v2
  ADD CONSTRAINT platform_retail_catalog_v2_gift_price_positive
  CHECK (gift_price_php IS NULL OR gift_price_php > 0);
COMMENT ON COLUMN public.platform_retail_catalog_v2.gift_price_php IS
  'What a Verified-and-up supplier pays to gift this product to a couple (owner 2026-11-04 "GIFT PRICES"). NULL = no gift price. A Free shop pays retail_price_php. Admin-managed; never typed in code.';

-- included_papic_credits — owner 2026-11-02/04: Event Plus includes 100 Papic
-- credits, Event Pro 1,000. Granted once per event into the shared pool when the
-- order is approved; an upgrade Plus → Pro tops the grant up to Pro's number.
ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS included_papic_credits INTEGER;
ALTER TABLE public.platform_retail_catalog_v2
  DROP CONSTRAINT IF EXISTS platform_retail_catalog_v2_included_papic_credits_nonneg;
ALTER TABLE public.platform_retail_catalog_v2
  ADD CONSTRAINT platform_retail_catalog_v2_included_papic_credits_nonneg
  CHECK (included_papic_credits IS NULL OR included_papic_credits >= 0);
COMMENT ON COLUMN public.platform_retail_catalog_v2.included_papic_credits IS
  'Papic credits this product grants the event''s shared pool once, on approval (Event Plus 100 · Event Pro 1,000, owner 2026-11-04). An upgrade tops up to the higher number, never adds both. Admin-managed.';

-- The included credits land as their own grant source, so an upgrade can read
-- what Plus already put in and top up to Pro's number (never add both), and so
-- a basket that also holds a Papic pack (source 'topup_order', same order) is
-- never mistaken for "already granted".
ALTER TABLE public.papic_event_point_grants
  DROP CONSTRAINT IF EXISTS papic_event_point_grants_source_check;
ALTER TABLE public.papic_event_point_grants
  ADD CONSTRAINT papic_event_point_grants_source_check
  CHECK (source IN ('admin','topup_order','comp','migration','free_grant','camera_grant','plan_included'));

-- ── 1 · couple products (platform_retail_catalog_v2) ────────────────────────
-- 1a · Event Plus — a NEW row. ₱2,990, includes 100 Papic credits + Setnayan AI.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, onboarding_price_php,
   saas_overhead_cost_php, description, is_active, billing_period,
   is_pax_priced, is_token_able)
VALUES
  ('EVENT_PLUS', 'Event Plus', 2990.00, NULL, 200.00,
   'Setnayan AI and 100 Papic credits for your event. Upgrade to Event Pro any time and pay only the difference.',
   TRUE, 'one_time', FALSE, FALSE)
ON CONFLICT (service_code) DO UPDATE
   SET title                = EXCLUDED.title,
       retail_price_php     = EXCLUDED.retail_price_php,
       onboarding_price_php = NULL,
       description          = EXCLUDED.description,
       is_active            = TRUE,
       retired_at           = NULL,
       billing_period       = 'one_time',
       updated_at           = NOW();

CREATE TEMP TABLE _retail (service_code TEXT, title TEXT, php NUMERIC, gift NUMERIC, credits INTEGER) ON COMMIT DROP;
INSERT INTO _retail (service_code, title, php, gift, credits) VALUES
  ('PAPIC_GUEST_150',    'Papic 150',   99.00,   90.00, NULL),
  ('PAPIC_GUEST_1K',     'Papic 1000',  499.00,  449.00, NULL),
  ('PAPIC_GUEST',        'Papic 3000',  999.00,  899.00, NULL),
  ('EVENT_PLUS',         'Event Plus',  2990.00, 2690.00, 100),
  ('COUPLE_WEBSITE_PRO', 'Event Pro',   5690.00, 5190.00, 1000),
  ('LIVE_STUDIO',        NULL,          1990.00, 1790.00, NULL),
  ('PAKANTA',            NULL,          2990.00, 2690.00, NULL),
  ('PATIKTOK_COMPILER',  NULL,          2490.00, 2290.00, NULL);

UPDATE public.platform_retail_catalog_v2 c
   SET retail_price_php       = r.php,
       gift_price_php         = r.gift,
       included_papic_credits = r.credits,
       title                  = COALESCE(r.title, c.title),
       onboarding_price_php   = NULL,
       updated_at             = NOW()
  FROM _retail r
 WHERE c.service_code = r.service_code;

-- The three packs' descriptions say their new names too (the pay page reads it).
UPDATE public.platform_retail_catalog_v2
   SET description = 'Adds ' || to_char(t.points, 'FM999,999') ||
                     ' Papic credits to the event''s shared pot. Added on top of whatever is already there, and repeatable.',
       updated_at = NOW()
  FROM public.papic_pass_tiers t
 WHERE t.service_code = platform_retail_catalog_v2.service_code
   AND platform_retail_catalog_v2.service_code IN ('PAPIC_GUEST_150', 'PAPIC_GUEST_1K', 'PAPIC_GUEST');

-- 1b · Setnayan AI is no longer sold on its own — it comes with Plus and Pro.
-- Events that already own it keep it (`events.setnayan_ai_active` is untouched).
UPDATE public.platform_retail_catalog_v2
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         'Owner 2026-11-04: Setnayan AI is not sold separately — it comes with Event Plus and Event Pro. Events that bought it keep it.'),
       updated_at        = NOW()
 WHERE service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D')
   AND is_active;

-- ── 2 · supplier products (vendor_billing_catalog) ──────────────────────────
CREATE TEMP TABLE _vendor (sku_code TEXT, title TEXT, php NUMERIC) ON COMMIT DROP;
INSERT INTO _vendor (sku_code, title, php) VALUES
  -- Plans: 4 weeks / year (year = 10 × the 4-week price).
  ('solo_vendor_monthly',       'Solo Vendor (4 weeks)',   990.00),
  ('solo_vendor_annual',        'Solo Vendor (1 year)',    9900.00),
  ('pro_vendor_monthly',        'Pro Vendor (4 weeks)',    2490.00),
  ('pro_vendor_annual',         'Pro Vendor (1 year)',     24900.00),
  -- Ultra: owner 2026-11-04 "ULTRA = ₱5,990 PER 4 WEEKS / ₱59,900 PER YEAR, WITH TRIMMED ALLOWANCES"
  -- (supersedes the sheet's ₱9,990 / ₱99,900 the same day; the allowances are TIER_CAPS, another builder's).
  ('enterprise_vendor_monthly', 'Ultra Vendor (4 weeks)',  5990.00),
  ('enterprise_vendor_annual',  'Ultra Vendor (1 year)',   59900.00),
  -- Add-ons.
  ('vendor_3d_booth',           NULL,                      1490.00),
  ('vendor_photo_challenge',    NULL,                      1490.00),
  ('vendor_additional_branch',  'Additional Branch (4 weeks · Ultra only)', 1990.00),
  ('vendor_extra_seat',         'Extra Team Seat (4 weeks · Ultra only)',   990.00),
  -- Deep Search + AI chatbot: TWO PRICES BY PLAN. These rows are the Pro/Ultra price;
  -- the `_entry` rows below are the Free/Verified/Solo price.
  ('vendor_deep_search',        'Deep Search (per search · Pro and Ultra)',     499.00),
  ('vendor_ai_addon',           'AI Chatbot (4 weeks · Pro and Ultra)',         1490.00);

UPDATE public.vendor_billing_catalog v
   SET price_php  = x.php,
       title      = COALESCE(x.title, v.title),
       updated_at = NOW()
  FROM _vendor x
 WHERE v.sku_code = x.sku_code;

-- 2a · the entry-band rows (Free / Verified / Solo). Price is admin-managed once
-- the row exists, like every sibling — but this sheet sets it, so it is written.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order, is_active)
VALUES
  ('vendor_deep_search_entry', 'Deep Search (per search · Free, Verified and Solo)', 799.00,  'vendor_addon_metered',   NULL, NULL, NULL, 88, TRUE),
  ('vendor_ai_addon_entry',    'AI Chatbot (4 weeks · Free, Verified and Solo)',     1990.00, 'vendor_addon_recurring', NULL, NULL, NULL, 89, TRUE)
ON CONFLICT (sku_code) DO UPDATE
   SET title      = EXCLUDED.title,
       price_php  = EXCLUDED.price_php,
       is_active  = TRUE,
       retired_at = NULL,
       updated_at = NOW();

-- 2b · storage — priced, NOT ON SALE. There is no storage purchase or quota in
-- the app yet (no action, no activation hook, no limit to raise), so a sellable
-- row would take money for nothing. The rows hold the owner's figures for the
-- build that sells them; flipping is_active is that build's job.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order, is_active, retirement_reason)
VALUES
  ('vendor_storage_5gb',         'Storage 5 GB (4 weeks)',  99.00,   'vendor_addon_recurring', NULL, NULL, NULL, 90, FALSE, 'Priced 2026-11-04; storage purchase not built yet.'),
  ('vendor_storage_5gb_annual',  'Storage 5 GB (1 year)',   990.00,  'vendor_addon_recurring', NULL, NULL, NULL, 91, FALSE, 'Priced 2026-11-04; storage purchase not built yet.'),
  ('vendor_storage_10gb',        'Storage 10 GB (4 weeks)', 149.00,  'vendor_addon_recurring', NULL, NULL, NULL, 92, FALSE, 'Priced 2026-11-04; storage purchase not built yet.'),
  ('vendor_storage_10gb_annual', 'Storage 10 GB (1 year)',  1490.00, 'vendor_addon_recurring', NULL, NULL, NULL, 93, FALSE, 'Priced 2026-11-04; storage purchase not built yet.'),
  ('vendor_storage_15gb',        'Storage 15 GB (4 weeks)', 199.00,  'vendor_addon_recurring', NULL, NULL, NULL, 94, FALSE, 'Priced 2026-11-04; storage purchase not built yet.'),
  ('vendor_storage_15gb_annual', 'Storage 15 GB (1 year)',  1990.00, 'vendor_addon_recurring', NULL, NULL, NULL, 95, FALSE, 'Priced 2026-11-04; storage purchase not built yet.')
ON CONFLICT (sku_code) DO UPDATE
   SET title      = EXCLUDED.title,
       price_php  = EXCLUDED.price_php,
       updated_at = NOW();

-- 2b′ · EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10× (owner 2026-11-04, DECISION_LOG
-- "EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10× THE 4-WEEK PRICE"). The plans and storage
-- already carry theirs above. The seat and branch years, and the two new add-ons of the same
-- day (extra category ₱499 · +2 service cards ₱99), are PRICED but DARK: no yearly seat/branch
-- purchase and no category/cards purchase is built. `vendor_addon_recurring`, not 'seat' /
-- 'branch', so no reader that picks the seat or branch row by offering_type can pick a year.
-- tests/db/a-year-is-ten-four-week-cycles.db.test.ts holds every pair at exactly 10×.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order, is_active, retirement_reason)
VALUES
  ('vendor_extra_seat_annual',        'Extra Team Seat (1 year · Ultra only)',   9900.00,  'vendor_addon_recurring', NULL, NULL, NULL, 96,  FALSE, 'Priced 2026-11-04; yearly seat purchase not built yet.'),
  ('vendor_additional_branch_annual', 'Additional Branch (1 year · Ultra only)', 19900.00, 'vendor_addon_recurring', NULL, NULL, NULL, 97,  FALSE, 'Priced 2026-11-04; yearly branch purchase not built yet.'),
  ('vendor_extra_category',           'Extra Category (4 weeks)',                499.00,   'vendor_addon_recurring', NULL, NULL, NULL, 98,  FALSE, 'Priced 2026-11-04; extra-category purchase not built yet.'),
  ('vendor_extra_category_annual',    'Extra Category (1 year)',                 4990.00,  'vendor_addon_recurring', NULL, NULL, NULL, 99,  FALSE, 'Priced 2026-11-04; extra-category purchase not built yet.'),
  ('vendor_service_cards_2',          '+2 Service Cards (4 weeks)',              99.00,    'vendor_addon_recurring', NULL, NULL, NULL, 100, FALSE, 'Priced 2026-11-04; service-card purchase not built yet.'),
  ('vendor_service_cards_2_annual',   '+2 Service Cards (1 year)',               990.00,   'vendor_addon_recurring', NULL, NULL, NULL, 101, FALSE, 'Priced 2026-11-04; service-card purchase not built yet.')
ON CONFLICT (sku_code) DO UPDATE
   SET title      = EXCLUDED.title,
       price_php  = EXCLUDED.price_php,
       updated_at = NOW();

-- 2c · the ₱500 supplier Papic pack retires. Credits already bought stay in the
-- shop wallet (`shop_papic_wallet_entries` is untouched); suppliers now buy the
-- same three Papic packs couples buy, priced from platform_retail_catalog_v2.
UPDATE public.vendor_billing_catalog
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         'Owner 2026-11-04: suppliers buy the same Papic packs as couples (Papic 150 · 1000 · 3000). Credits already bought are kept.'),
       updated_at        = NOW()
 WHERE sku_code = 'vendor_papic_portfolio_pack'
   AND is_active;

-- ── 2d · THE GIFT PRICE (owner 2026-11-04, "GIFT PRICES") ───────────────────
-- What a SUPPLIER pays to gift a product is its own fixed figure, stored on the
-- row as `gift_price_php` (above) — never "list less 10%", never typed in code.
-- Verified-and-up shops (`vendor_profiles.tier_state` <> 'free') pay the gift
-- price; a Free shop pays the list price.
--
-- The booking-fee gift is SIZED exactly as before (40% of the fee, spent along
-- the REGULAR-price ladder — the couple's photographs do not change with the
-- supplier's plan). Only the supplier's CHARGE for those credits moves: it is
-- read off the GIFT-price ladder at the same credits, interpolated the same way
-- (round half up), and never above the list charge. A ladder with any rung
-- missing its gift price, or one whose gift price does not rise with its
-- credits, charges the list price — fail toward the figure already shown.
-- Mirror: `setnayanGiftForFee(fee, ladder, { giftPrice })` in
-- apps/web/lib/setnayan-gift.ts; the-gift-reaches-the-couple.db.test.ts asserts
-- the two agree.
CREATE OR REPLACE FUNCTION public.vendor_pays_gift_price(p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT vp.tier_state::TEXT <> 'free'
       FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = p_vendor_profile_id),
    FALSE);
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_pays_gift_price(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vendor_pays_gift_price(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.vendor_pays_gift_price(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.setnayan_gift_for_fee(
  p_fee_centavos BIGINT,
  p_vendor_profile_id UUID
)
RETURNS TABLE (credits INTEGER, charge_centavos BIGINT, capped BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
  v_charge  BIGINT;
  v_capped  BOOLEAN;
  v_c       BIGINT[];
  v_g       BIGINT[];
  v_n       INTEGER;
  v_gift    BIGINT;
  i         INTEGER;
BEGIN
  SELECT g.credits, g.charge_centavos, g.capped
    INTO v_credits, v_charge, v_capped
    FROM public.setnayan_gift_for_fee(p_fee_centavos) g;

  IF COALESCE(v_credits, 0) <= 0 OR NOT public.vendor_pays_gift_price(p_vendor_profile_id) THEN
    RETURN QUERY SELECT COALESCE(v_credits, 0), COALESCE(v_charge, 0::BIGINT), COALESCE(v_capped, FALSE);
    RETURN;
  END IF;

  -- The same rungs the sizing used, at their GIFT price.
  SELECT array_agg(t.points::BIGINT ORDER BY t.points),
         array_agg(round(c.gift_price_php * 100)::BIGINT ORDER BY t.points)
    INTO v_c, v_g
    FROM public.platform_retail_catalog_v2 c
    JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
   WHERE left(c.service_code, 11) = 'PAPIC_GUEST'
     AND c.is_active IS TRUE
     AND c.retired_at IS NULL
     AND c.retail_price_php > 0
     AND t.is_active IS TRUE
     AND t.is_topup IS NOT TRUE
     AND t.points > 0
     AND t.points <= 50000;

  v_n := COALESCE(array_length(v_c, 1), 0);
  v_gift := NULL;
  IF v_n > 0 AND NOT EXISTS (SELECT 1 FROM unnest(v_g) x WHERE x IS NULL OR x <= 0) THEN
    FOR i IN 2 .. v_n LOOP
      IF v_c[i] = v_c[i - 1] OR v_g[i] <= v_g[i - 1] THEN
        v_n := 0;
        EXIT;
      END IF;
    END LOOP;
    FOR i IN 1 .. v_n LOOP
      IF v_credits = v_c[i] THEN
        v_gift := v_g[i];
        EXIT;
      END IF;
      IF i < v_n AND v_credits < v_c[i + 1] AND v_credits > v_c[i] THEN
        v_gift := v_g[i]
          + (2 * (v_credits - v_c[i]) * (v_g[i + 1] - v_g[i]) + (v_c[i + 1] - v_c[i]))
            / (2 * (v_c[i + 1] - v_c[i]));
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_credits, LEAST(v_charge, COALESCE(v_gift, v_charge)), v_capped;
END;
$$;

COMMENT ON FUNCTION public.setnayan_gift_for_fee(BIGINT, UUID) IS
  'The Setnayan gift a booking fee buys, charged to THIS shop: the same credits as '
  'setnayan_gift_for_fee(BIGINT), and for a Verified-and-up shop the charge read off '
  'the gift_price_php ladder at those credits (owner 2026-11-04). Free pays the list '
  'charge. Mirror of setnayanGiftForFee(fee, ladder, { giftPrice }) in apps/web/lib/setnayan-gift.ts.';

REVOKE EXECUTE ON FUNCTION public.setnayan_gift_for_fee(BIGINT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.setnayan_gift_for_fee(BIGINT, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.setnayan_gift_for_fee(BIGINT, UUID) TO service_role;

-- The two places the gift is CHARGED now pass the shop. Bodies copied from
-- 20271229508655_a_locked_gift_cannot_move.sql; the ONLY change in each is the
-- shop argument on the setnayan_gift_for_fee call (and, in the stamp, reading
-- event_vendors.marketplace_vendor_id to have it). A stamp already taken keeps
-- its charge — the promise is frozen at lock, as before.
CREATE OR REPLACE FUNCTION public.stamp_setnayan_gift_at_lock(
  p_event_vendor_id UUID,
  p_confirm BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev            RECORD;
  v_offered       BOOLEAN;
  v_fee_centavos  BIGINT;
  -- ⚠ SEPARATE SCALARS, NOT A RECORD. A first cut used `v_gift RECORD` and
  -- assigned `ROW(0, 0)` on the no-gift path — an ANONYMOUS record whose fields
  -- have no names, so the very next `v_gift.credits` raised 42703. It failed
  -- only on the branch where the card says NO, which is the branch nothing in
  -- production would have exercised for months.
  v_credits       INTEGER := 0;
  v_centavos      BIGINT  := 0;
BEGIN
  SELECT ev.vendor_id, ev.marketplace_vendor_id, ev.total_cost_php, ev.setnayan_gift_confirmed_at,
         ev.setnayan_gift_credits_at_lock, ev.setnayan_gift_centavos_at_lock,
         ev.setnayan_gift_offered_at_lock, ev.setnayan_gift_locked_at
    INTO v_ev
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Already confirmed ⇒ immutable. Silently done, not an error: both writers
  -- call this and a re-run must never raise on a supplier pressing yes twice.
  IF v_ev.setnayan_gift_confirmed_at IS NOT NULL THEN RETURN; END IF;

  -- ⚠ NOT `setnayan_gift_offered_on(vendor_id)` FROM A BEFORE TRIGGER — this is
  -- an ordinary function called AFTER the row is written, so the read is the
  -- post-image and the join is sound. (Called from a BEFORE trigger the same
  -- helper reads the PRE-image and answers FALSE for every insert.)
  v_offered := public.setnayan_gift_offered_on(p_event_vendor_id);

  v_fee_centavos := public.booking_fee_centavos(
    ROUND(COALESCE(v_ev.total_cost_php, 0) * 100)::BIGINT
  );

  IF v_offered AND COALESCE(v_fee_centavos, 0) > 0 THEN
    SELECT COALESCE(g.credits, 0), COALESCE(g.charge_centavos, 0)
      INTO v_credits, v_centavos
      FROM public.setnayan_gift_for_fee(v_fee_centavos, v_ev.marketplace_vendor_id) g;
  END IF;

  UPDATE public.event_vendors ev
     SET setnayan_gift_locked_at = COALESCE(ev.setnayan_gift_locked_at, NOW()),
         setnayan_gift_confirmed_at = CASE WHEN p_confirm THEN NOW() ELSE ev.setnayan_gift_confirmed_at END,
         -- The couple keeps the better promise; the supplier's charge rides
         -- with it, so the pair never splits across two stamps.
         setnayan_gift_offered_at_lock =
           COALESCE(ev.setnayan_gift_offered_at_lock, FALSE) OR COALESCE(v_offered, FALSE),
         setnayan_gift_credits_at_lock =
           GREATEST(COALESCE(ev.setnayan_gift_credits_at_lock, 0), v_credits),
         setnayan_gift_centavos_at_lock =
           CASE
             WHEN v_credits >= COALESCE(ev.setnayan_gift_credits_at_lock, 0)
               THEN v_centavos
             ELSE ev.setnayan_gift_centavos_at_lock
           END,
         setnayan_gift_fee_basis_centavos =
           CASE
             WHEN v_credits >= COALESCE(ev.setnayan_gift_credits_at_lock, 0)
               THEN v_fee_centavos
             ELSE ev.setnayan_gift_fee_basis_centavos
           END
   WHERE ev.vendor_id = p_event_vendor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_fee_charges_size_the_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift  RECORD;
  v_stamp RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.setnayan_gift_offered =
      NEW.kind = 'primary'
      AND NEW.source = 'lock'
      AND NEW.event_vendor_id IS NOT NULL
      AND public.setnayan_gift_offered_on(NEW.event_vendor_id);
  ELSE
    NEW.setnayan_gift_offered = OLD.setnayan_gift_offered;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status = 'paid' THEN
    NEW.gift_credits  := OLD.gift_credits;
    NEW.gift_centavos := OLD.gift_centavos;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'paid'
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN
    NEW.gift_credits  := OLD.gift_credits;
    NEW.gift_centavos := OLD.gift_centavos;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending'
     AND NEW.setnayan_gift_offered
     AND COALESCE(NEW.amount_charged_centavos, 0) > 0 THEN

    -- ⚖ THE PROMISE WINS. Owner 2026-09-15/16: the gift is frozen at lock, both
    -- the yes/no and the number. A stamped booking is billed and granted what
    -- the couple was actually promised, whatever the catalogue says now.
    IF NEW.event_vendor_id IS NOT NULL THEN
      SELECT ev.setnayan_gift_locked_at,
             ev.setnayan_gift_credits_at_lock,
             ev.setnayan_gift_centavos_at_lock
        INTO v_stamp
        FROM public.event_vendors ev
       WHERE ev.vendor_id = NEW.event_vendor_id;

      IF v_stamp.setnayan_gift_locked_at IS NOT NULL
         AND COALESCE(v_stamp.setnayan_gift_credits_at_lock, 0) > 0 THEN
        NEW.gift_credits  := v_stamp.setnayan_gift_credits_at_lock;
        NEW.gift_centavos := COALESCE(v_stamp.setnayan_gift_centavos_at_lock, 0);
        RETURN NEW;
      END IF;
    END IF;

    -- No stamp (a booking older than SUP-I, or one that never went through a
    -- lock): behave exactly as before — size it on the live fee.
    SELECT g.credits, g.charge_centavos INTO v_gift
      FROM public.setnayan_gift_for_fee(NEW.amount_charged_centavos, NEW.vendor_profile_id) g;
    NEW.gift_credits  := COALESCE(v_gift.credits, 0);
    NEW.gift_centavos := COALESCE(v_gift.charge_centavos, 0);
    RETURN NEW;
  END IF;

  NEW.gift_credits  := 0;
  NEW.gift_centavos := 0;
  RETURN NEW;
END;
$$;

-- ── 3 · read it back, or refuse ─────────────────────────────────────────────
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(r.service_code, ', ') INTO v_bad
    FROM _retail r
    LEFT JOIN public.platform_retail_catalog_v2 c
      ON c.service_code = r.service_code
     AND c.is_active
     AND c.retail_price_php = r.php
     AND c.gift_price_php = r.gift
     AND c.included_papic_credits IS NOT DISTINCT FROM r.credits
     AND (r.title IS NULL OR c.title = r.title)
   WHERE c.service_code IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'the_final_price_sheet: couple rows did not land — %', v_bad;
  END IF;

  SELECT string_agg(x.sku_code, ', ') INTO v_bad
    FROM _vendor x
    LEFT JOIN public.vendor_billing_catalog v
      ON v.sku_code = x.sku_code AND v.price_php = x.php
   WHERE v.sku_code IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'the_final_price_sheet: supplier rows did not land — %', v_bad;
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_retail_catalog_v2
              WHERE service_code LIKE 'SETNAYAN_AI%' AND is_active) THEN
    RAISE EXCEPTION 'the_final_price_sheet: a Setnayan AI row is still on sale';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vendor_billing_catalog
              WHERE sku_code IN ('vendor_papic_portfolio_pack', 'vendor_ai_addon_advanced') AND is_active) THEN
    RAISE EXCEPTION 'the_final_price_sheet: the ₱500 supplier pack or the Advanced AI add-on is on sale';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vendor_billing_catalog
              WHERE sku_code LIKE 'vendor_storage_%' AND is_active) THEN
    RAISE EXCEPTION 'the_final_price_sheet: a storage row is on sale with no purchase built';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vendor_billing_catalog
              WHERE sku_code IN ('vendor_extra_seat_annual', 'vendor_additional_branch_annual',
                                 'vendor_extra_category', 'vendor_extra_category_annual',
                                 'vendor_service_cards_2', 'vendor_service_cards_2_annual')
                AND is_active) THEN
    RAISE EXCEPTION 'the_final_price_sheet: a yearly seat/branch or a category/cards row is on sale with no purchase built';
  END IF;
END $$;

COMMIT;
