-- supplier_plans_rebuilt_2026_11_18
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🪜 SUPPLIER PLANS REBUILT — owner 2026-11-18, DECISION_LOG rows "SUPPLIER PLANS REBUILT" and "SUPPLIER CARDS: MAX 80,
-- ULTRA 200" (specs commits 62a95241 → a7b0d59d; rulings 17 · 18 · 23 · 30–32 · 39 in PLAN_RULINGS_2026-11-18.md).
-- Owner's frame, verbatim: bookings, shortlists and inquiries cannot be limited by plan (each leads to a booking fee),
-- so the plans differ ONLY on reach, size (cards, categories, seats, branches, storage) and tools.
--
-- This file is the DATA half for the five plans that exist today (free · verified · solo=Plus · pro · enterprise).
-- `enterprise` carries the numbers of the plan the owner now calls MAX (today's top plan, ₱9,990). The new top plan
-- (Ultra ₱19,990) is a separate change. TIER_CAPS in apps/web/lib/vendor-tier-caps.ts moves in the same PR; the db
-- tests that derive from it hold the two equal.
--
-- 1 · BOOKINGS PER DATE ARE NOT A PLAN LIMIT (ruling 17: *"a cake business can handle 30 cakes in a day … I think that
--     is wrong pricing"*). `service_card_daily_limit` returns the card's OWN `daily_capacity` (NULL = no per-card
--     limit), with no plan cap over it. Reverses 20271316466285's plan cap. Signature, grants and readers unchanged.
--     The admin rows for `bookings_per_date_per_service` are removed (nothing reads them any more).
-- 2 · THE SHOP'S OWN DAILY LIMIT RISES 50 → 500 (ruling 18: *"Yes, 500"*): the CHECK on
--     `vendor_schedule_pools.daily_booking_capacity` becomes 1..500 (loosen only; every row already passes).
-- 3 · SERVICE CARDS ARE COUNTED IN TOTAL (rulings 23 · 39): a new plan-contents key `service_cards_total`
--     (Free 1 · Verified 3 · Plus 10 · Pro 20 · Max 80) replaces `services_per_leaf`, whose rows are removed.
--     GRANDFATHERED: no card is touched — the app's create gate refuses only a NEW card past the total.
-- 4 · THE OTHER NUMBERS (rulings 24 · 30 · 31 · 32): main categories 1 · 1 · 2 · 8 · all 12; seats beyond the owner
--     0 · 0 · 1 · 5 · 11 (= 1 · 1 · 2 · 6 · 12 with the owner); branches besides the main shop 0 · 0 · 0 · 2 · 5;
--     storage — · — · 5 · 10 · 20 GB; waitlist NO plan limit (ruling 32) — every plan's allowance is the column's own
--     ceiling (`max_waitlist_acceptances` 0..10), so the shop's setting is the only limit.
--     Written to the admin-editable `vendor_plan_contents` rows (its trigger records each change) AND to
--     `vendor_tier_limit()`'s code fallback, and the plan rows' max_categories / max_sub_seats in the catalogue.
--     Lowering a number takes nothing away: shops above it keep what they have.
--
-- 🔑 NO PRICE IS WRITTEN. Prices live in the admin billing catalogue (owner changes them there).
-- RLS unchanged · no new table · no write to any shop's data · the only removed rows are plan-content config rows.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ── 2 · the shop's own daily limit: 1..500 ──────────────────────────────────
ALTER TABLE public.vendor_schedule_pools
  DROP CONSTRAINT IF EXISTS vendor_schedule_pools_daily_booking_capacity_check;
ALTER TABLE public.vendor_schedule_pools
  ADD CONSTRAINT vendor_schedule_pools_daily_booking_capacity_check
  CHECK (daily_booking_capacity BETWEEN 1 AND 500);

-- ── 3 · the plan-contents key list gains service_cards_total ───────────────
ALTER TABLE public.vendor_plan_contents
  DROP CONSTRAINT IF EXISTS vendor_plan_contents_key_check;
ALTER TABLE public.vendor_plan_contents
  ADD CONSTRAINT vendor_plan_contents_key_check CHECK (key IN (
    'whitelist_per_date', 'waitlist_acceptances', 'branches_included',
    'service_cards_total', 'parent_categories', 'agent_accounts',
    -- retired 2026-11-18 (no rows hold them); kept so an old history read never trips the list
    'bookings_per_date_per_service', 'services_per_leaf'));

DELETE FROM public.vendor_plan_contents
 WHERE key IN ('bookings_per_date_per_service', 'services_per_leaf');

-- ── 3 · 4 · the numbers ─────────────────────────────────────────────────────
INSERT INTO public.vendor_plan_contents (plan, key, value) VALUES
  ('free', 'service_cards_total', 1),
  ('verified', 'service_cards_total', 3),
  ('solo', 'service_cards_total', 10),
  ('pro', 'service_cards_total', 20),
  ('enterprise', 'service_cards_total', 80)
ON CONFLICT (plan, key) DO NOTHING;

UPDATE public.vendor_plan_contents c
   SET value = v.value
  FROM (VALUES
          ('free', 'parent_categories', 1),
          ('verified', 'parent_categories', 1),
          ('solo', 'parent_categories', 2),
          ('pro', 'parent_categories', 8),
          ('enterprise', 'parent_categories', 12),
          ('free', 'agent_accounts', 0),
          ('verified', 'agent_accounts', 0),
          ('solo', 'agent_accounts', 1),
          ('pro', 'agent_accounts', 5),
          ('enterprise', 'agent_accounts', 11),
          ('free', 'branches_included', 0),
          ('verified', 'branches_included', 0),
          ('solo', 'branches_included', 0),
          ('pro', 'branches_included', 2),
          ('enterprise', 'branches_included', 5),
          ('free', 'waitlist_acceptances', 10),
          ('verified', 'waitlist_acceptances', 10),
          ('solo', 'waitlist_acceptances', 10),
          ('pro', 'waitlist_acceptances', 10),
          ('enterprise', 'waitlist_acceptances', 10),
          ('free', 'service_cards_total', 1),
          ('verified', 'service_cards_total', 3),
          ('solo', 'service_cards_total', 10),
          ('pro', 'service_cards_total', 20),
          ('enterprise', 'service_cards_total', 80)
       ) AS v(plan, key, value)
 WHERE c.plan = v.plan
   AND c.key = v.key
   AND c.value IS DISTINCT FROM v.value;

-- The plan rows in the catalogue carry the same two caps (held by deep-search-one-price-and-plan-caps.db.test.ts).
UPDATE public.vendor_billing_catalog
   SET max_categories = v.cats, max_sub_seats = v.seats, updated_at = NOW()
  FROM (VALUES
          ('solo_vendor_monthly', 2, 1),        ('solo_vendor_annual', 2, 1),
          ('pro_vendor_monthly', 8, 5),         ('pro_vendor_annual', 8, 5),
          ('enterprise_vendor_monthly', 12, 11), ('enterprise_vendor_annual', 12, 11)
       ) AS v(sku_code, cats, seats)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND (vendor_billing_catalog.max_categories IS DISTINCT FROM v.cats
        OR vendor_billing_catalog.max_sub_seats IS DISTINCT FROM v.seats);

-- The code fallback — the body of 20271346711828 with the 2026-11-18 numbers; the bookings arm is gone (an unknown
-- key answers NULL, as before) and `service_cards_total` is not served here (the app reads it).
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    -- The admin-edited number (owner 2026-11-13). An unknown tier reads as Free, like the arms below.
    (SELECT c.value
       FROM public.vendor_plan_contents c
      WHERE c.plan = CASE WHEN COALESCE(p_tier, 'free') IN ('free', 'verified', 'solo', 'pro', 'enterprise')
                          THEN COALESCE(p_tier, 'free') ELSE 'free' END
        AND c.key = p_key),
    -- The code values — the fallback when no row exists.
    CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan
        WHEN 'verified'   THEN 5
        WHEN 'solo'       THEN 5
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN 10       -- owner 2026-11-18 (ruling 32): no plan limit — the column's own ceiling
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'pro'        THEN 2    -- owner 2026-11-18 (ruling 30): Pro 2
        WHEN 'enterprise' THEN 5    -- Max 5
        ELSE 0                      -- Free · Verified · Plus (and an unknown tier, read as Free)
      END
    WHEN 'storage_gb' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'solo'       THEN 5    -- owner 2026-11-13 / 2026-11-18: Plus 5 GB
        WHEN 'pro'        THEN 10   -- Pro 10 GB
        WHEN 'enterprise' THEN 20   -- Max 20 GB (ruling 24; was 15)
        ELSE NULL                   -- Free · Verified: no allowance ruled — no cap
      END
    ELSE NULL                       -- unknown key: NULL, never a silent 0
    END
  );
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · storage_gb (the table also holds service_cards_total · parent_categories · agent_accounts, which the app reads). Bookings per date are NOT a plan limit since 2026-11-18 (ruling 17) — no key. An unknown TIER reads as Free; an unknown KEY returns NULL on purpose. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';

-- ── 1 · a card's day: the shop's own number, no plan cap ───────────────────
CREATE OR REPLACE FUNCTION public.service_card_daily_limit(p_service_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NULLIF(vs.daily_capacity, 0)
    FROM public.vendor_services vs
   WHERE vs.vendor_service_id = p_service_id;
$function$;

COMMENT ON FUNCTION public.service_card_daily_limit(uuid) IS
  'The most bookings this service takes on one date: the card''s OWN daily_capacity — no plan cap since 2026-11-18 '
  '(owner, ruling 17: bookings per date are not a plan limit; every booking pays the booking fee). NULL = no per-card '
  'limit. Read by vendor_agree_to_lock, vendor_day_check and service_cards_unbookable_on. Bookings already held are '
  'never touched.';

REVOKE ALL ON FUNCTION public.service_card_daily_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_daily_limit(uuid) TO service_role;

COMMIT;
