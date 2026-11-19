-- ultra_addon_and_the_19_nov_plan_numbers
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
-- ============================================================================
-- 🪜 THE 19 NOV SUPPLIER PLAN NUMBERS + THE ULTRA ADD-ON — owner 2026-11-19 (specs DECISION_LOG; change plan
-- SUPPLIER_PLANS_CHANGE_PLAN_2026-11-19.md §B, commit ac15265b). Owner, verbatim: *"use what is on max be named ultra
-- and remove the current ultra"* · *"just 1 pack"* · *"Ultra Addon"* · *"2490"* · the final table: *"this is good"*.
--
-- The ladder stays free · verified · solo (Plus) · pro · enterprise (Ultra) — NO fifth tier. People include the owner;
-- branches are EXTRAS besides the main shop (the 18 Nov meaning):
--     Free 1·1·0 · Verified 1·3·0 · Plus 2·10·0 · Pro 5·27·1 · Ultra 16·68·3   (people · live cards · branches)
--     Storage unchanged: Plus 5 GB · Pro 10 GB · Ultra 20 GB.
--
-- 1 · THE NUMBERS. `vendor_plan_contents` (admin-editable; its trigger records each change) and `vendor_tier_limit()`'s
--     code fallback: agent_accounts (people − 1) Pro 4 · Ultra 15; service_cards_total Pro 27 · Ultra 68;
--     branches_included Pro 1 · Ultra 3. Every plan row's max_sub_seats follows (held by
--     deep-search-one-price-and-plan-caps.db.test.ts). TIER_CAPS moves in the same PR; the db tests hold the two equal.
-- 2 · THE PRICE. Pro's 4-week row ₱4,990 → ₱3,990 (the owner's figure). Plus ₱1,490 and Ultra ₱9,990 are unchanged.
--     The yearly row follows the STANDING rule — owner 2026-11-04, "EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10× THE
--     4-WEEK PRICE" (held by a-year-is-ten-four-week-cycles.db.test.ts) — so pro_vendor_annual is DERIVED in SQL as 10×
--     (₱39,900), never typed. ⚠ The owner has an open call on the yearly price ("10 payments for 13?"); if it changes,
--     that rule changes with it in one place. A price row is the catalogue, never a subscription: no order, purchase or
--     vendor_profiles row is written here.
-- 3 · THE ULTRA ADD-ON — the ONE add-on: +1 branch · +15 live cards · +3 people · +50 GB, ₱2,490 per 28 days, Ultra
--     only, may be bought more than once. A new offering type 'ultra_addon' and the SKU `vendor_ultra_addon`.
--     🔑 IT LASTS 28 DAYS PER PAYMENT (review, 2026-11-19: a count with no expiry kept one ₱2,490 payment forever). So
--     there is NO stored count: each paid `vendor_ultra_addon__<vendor_profile_id>` order carries its own window
--     (`orders.expires_at`, stamped paid + 28 days by the activation hook — the paid-branch pattern), and the live
--     number is `vendor_live_ultra_addons(vendor)` = paid orders whose window covers now(). A refund leaves 'paid' and
--     drops out at once; a lapsed window drops out by itself — no cron, no recompute. The two database gates add it
--     on Ultra: `enforce_included_branch_allowance` (+1 branch each) and `enforce_supplier_storage_allowance` (+50 GB
--     each). The app reads the same function (`vendor_live_ultra_addons_for`, checked) for cards, people and the rest.
-- 4 · SINGLE EXTRAS ARE NO LONGER OFFERED (owner: "they only buy the … pack"). The APP stops offering a NEW extra seat
--     or extra branch. ⚠ Their catalogue rows are deliberately LEFT ACTIVE here: a shop that already pays for an extra
--     seat or branch renews it at that row's price (`renewBranch` and the seat renewal read an ACTIVE row), and the
--     owner ruled that no existing subscriber's price or limits move until §C. Switching them off is §C's call.
--
-- RLS unchanged · no new table or column · no write to any shop's, order's or subscription's row.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it. Idempotent.
-- ============================================================================

BEGIN;

-- ── 1 · the numbers ─────────────────────────────────────────────────────────
UPDATE public.vendor_plan_contents c
   SET value = v.value
  FROM (VALUES
          ('pro', 'agent_accounts', 4),            ('enterprise', 'agent_accounts', 15),
          ('pro', 'service_cards_total', 27),      ('enterprise', 'service_cards_total', 68),
          ('pro', 'branches_included', 1),         ('enterprise', 'branches_included', 3)
       ) AS v(plan, key, value)
 WHERE c.plan = v.plan
   AND c.key = v.key
   AND c.value IS DISTINCT FROM v.value;

-- The plan rows' seat count — a year buys the same plan, so its row carries the same caps.
UPDATE public.vendor_billing_catalog
   SET max_sub_seats = v.seats, updated_at = NOW()
  FROM (VALUES ('pro_vendor_monthly', 4), ('pro_vendor_annual', 4),
               ('enterprise_vendor_monthly', 15), ('enterprise_vendor_annual', 15)) AS v(sku_code, seats)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND vendor_billing_catalog.max_sub_seats IS DISTINCT FROM v.seats;

-- ── 2 · the price: Pro ₱3,990 per 4 weeks; its year derived 10× (the standing rule) ──
UPDATE public.vendor_billing_catalog
   SET price_php = 3990.00, updated_at = NOW()
 WHERE sku_code = 'pro_vendor_monthly'
   AND price_php IS DISTINCT FROM 3990.00;

UPDATE public.vendor_billing_catalog y
   SET price_php = m.price_php * 10, updated_at = NOW()
  FROM public.vendor_billing_catalog m
 WHERE y.sku_code = 'pro_vendor_annual'
   AND m.sku_code = 'pro_vendor_monthly'
   AND y.price_php IS DISTINCT FROM m.price_php * 10;

-- The code fallback — the body of 20271350427190 with the 19 Nov branch numbers (Pro 1 · Ultra 3).
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
        WHEN 'pro'        THEN 1    -- owner 2026-11-19: Pro 1 (was 2)
        WHEN 'enterprise' THEN 3    -- Ultra 3 (was 5)
        ELSE 0                      -- Free · Verified · Plus (and an unknown tier, read as Free)
      END
    WHEN 'storage_gb' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'solo'       THEN 5    -- owner 2026-11-13 / 2026-11-18: Plus 5 GB
        WHEN 'pro'        THEN 10   -- Pro 10 GB
        WHEN 'enterprise' THEN 20   -- Ultra 20 GB
        ELSE NULL                   -- Free · Verified: no allowance ruled — no cap
      END
    ELSE NULL                       -- unknown key: NULL, never a silent 0
    END
  );
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · storage_gb (the table also holds service_cards_total · parent_categories · agent_accounts, which the app reads). Bookings per date are NOT a plan limit since 2026-11-18 (ruling 17) — no key. Branch numbers of 2026-11-19 (Pro 1 · Ultra 3); the Ultra Add-on''s bought room is not here — the two gates add vendor_live_ultra_addons(). An unknown TIER reads as Free; an unknown KEY returns NULL on purpose. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';

-- ── 3 · the Ultra Add-on ─────────────────────────────────────────────────────
-- 3a · its offering type (every prior value kept, from 20271316466285).
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;
ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN (
    'subscription_monthly', 'subscription_annual', 'token_pack',
    'branch', 'seat', 'custom_addon', 'vendor_addon_recurring',
    'vendor_addon_per_event', 'vendor_addon_metered',
    'category', 'service_card', 'waitlist', 'booking_per_date',
    'ultra_addon'
  ));

ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;
ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN (
       'subscription_monthly', 'subscription_annual', 'branch', 'seat',
       'custom_addon', 'vendor_addon_recurring', 'vendor_addon_per_event',
       'vendor_addon_metered',
       'category', 'service_card', 'waitlist', 'booking_per_date',
       'ultra_addon'
     ) AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- 3b · the SKU — the owner's ₱2,490 per 28 days. max_sub_seats carries its +3 people (the seat row's pattern).
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order, is_active)
VALUES
  ('vendor_ultra_addon', 'Ultra Add-on (4 weeks · Ultra only)', 2490.00, 'ultra_addon', NULL, NULL, 3, 95, TRUE)
ON CONFLICT (sku_code) DO UPDATE
   SET title         = EXCLUDED.title,
       price_php     = EXCLUDED.price_php,
       offering_type = EXCLUDED.offering_type,
       max_sub_seats = EXCLUDED.max_sub_seats,
       is_active     = TRUE,
       updated_at    = NOW();

-- 3c · THE LIVE COUNT — paid orders whose 28-day window covers now. Internal: the gates call it; no grant.
CREATE OR REPLACE FUNCTION public.vendor_live_ultra_addons(p_vendor_profile_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int
    FROM public.orders o
   WHERE o.service_key = 'vendor_ultra_addon__' || p_vendor_profile_id::text
     AND o.status = 'paid'
     AND o.expires_at IS NOT NULL
     AND o.expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.vendor_live_ultra_addons(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_live_ultra_addons(uuid) IS
  'The Ultra Add-ons a shop holds NOW (owner 2026-11-19: +1 branch · +15 live cards · +3 people · +50 GB each, 28 days per payment): its paid vendor_ultra_addon__<id> orders whose expires_at (stamped paid + 28 days by the activation hook) is still ahead. No stored count — a refund or a lapsed window drops out by itself. Internal (the branch and storage gates); the app reads vendor_live_ultra_addons_for.';

-- 3d · the app's read — the same number, for the caller's own shop (or Setnayan / the service role) only.
CREATE OR REPLACE FUNCTION public.vendor_live_ultra_addons_for(p_vendor_profile_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids('viewer')) THEN
    RAISE EXCEPTION 'vendor_live_ultra_addons_for: not your shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.vendor_live_ultra_addons(p_vendor_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_live_ultra_addons_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_live_ultra_addons_for(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.vendor_live_ultra_addons_for(uuid) IS
  'vendor_live_ultra_addons for the app: the caller''s own shop (owner or team member), Setnayan, or the service role. Anyone else is refused.';

-- 3e · the included-branch gate adds +1 branch per Ultra Add-on (20271307996183's body, otherwise verbatim).
CREATE OR REPLACE FUNCTION public.enforce_included_branch_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier   text;
  v_addons int;
  v_cap    int;
  v_in_use int;
BEGIN
  -- Only a row that BECOMES a live included branch is counted. Everything else (a paid branch, a rename, a cancel,
  -- a row that was already a live included branch) passes untouched — that is the grandfathering.
  IF NOT (NEW.included_in_plan AND NEW.cancelled_at IS NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.included_in_plan AND OLD.cancelled_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialise per shop: two concurrent adds must not both see "one left".
  SELECT vp.tier_state::text
    INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.parent_vendor_profile_id
   FOR UPDATE;
  v_addons := public.vendor_live_ultra_addons(NEW.parent_vendor_profile_id);

  v_cap := COALESCE(public.vendor_tier_limit(v_tier, 'branches_included'), 0)
           -- The Ultra Add-on (owner 2026-11-19): +1 branch each, on Ultra only.
           + CASE WHEN v_tier = 'enterprise' THEN GREATEST(v_addons, 0) ELSE 0 END;

  SELECT count(*)
    INTO v_in_use
    FROM public.vendor_branches b
   WHERE b.parent_vendor_profile_id = NEW.parent_vendor_profile_id
     AND b.included_in_plan
     AND b.cancelled_at IS NULL
     AND b.branch_id IS DISTINCT FROM NEW.branch_id;

  IF v_in_use >= v_cap THEN
    RAISE EXCEPTION 'included_branch_allowance: this plan includes % branches and % are in use', v_cap, v_in_use
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_included_branch_allowance() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_included_branch_allowance() IS
  'Refuses a vendor_branches row that BECOMES a live included branch (included_in_plan AND cancelled_at IS NULL) '
  'when the shop already holds vendor_tier_limit(tier, ''branches_included'') of them, plus one per paid Ultra Add-on '
  'live on Ultra (owner 2026-11-19; vendor_live_ultra_addons). Rows already live are never touched (grandfathered). '
  'Serialised per shop by a row lock on vendor_profiles.';

-- 3f · the storage gate adds +50 GB per Ultra Add-on (20271342883073's body, otherwise verbatim).
CREATE OR REPLACE FUNCTION public.enforce_supplier_storage_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier   text;
  v_addons int;
  v_gb     int;
  v_size   bigint;
  v_used   bigint;
BEGIN
  IF NEW.media_id IS NULL THEN
    RETURN NEW;                                   -- a link, a portfolio pointer or a chat document: no stored bytes
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.media_id IS NOT DISTINCT FROM OLD.media_id THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_addons := public.vendor_live_ultra_addons(NEW.vendor_profile_id);
  v_gb := public.vendor_tier_limit(v_tier, 'storage_gb');
  IF v_gb IS NULL THEN
    RETURN NEW;                                   -- no allowance on this plan (Free · Verified)
  END IF;
  -- The Ultra Add-on (owner 2026-11-19): +50 GB each, on Ultra only.
  IF v_tier = 'enterprise' THEN
    v_gb := v_gb + 50 * GREATEST(v_addons, 0);
  END IF;

  -- One shop's filings in a row, so two uploads racing for the last megabytes cannot both get in.
  PERFORM pg_advisory_xact_lock(hashtext('supplier_storage:' || NEW.vendor_profile_id::text));

  -- These bytes are already counted (another file of this shop points at the same copy): a link adds nothing.
  IF EXISTS (
    SELECT 1 FROM public.event_supplier_files f
     WHERE f.media_id = NEW.media_id
       AND f.vendor_profile_id = NEW.vendor_profile_id
       AND (TG_OP = 'INSERT' OR f.file_id <> NEW.file_id)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(m.size_bytes, 0) INTO v_size
    FROM public.supplier_media m
   WHERE m.media_id = NEW.media_id AND m.vendor_profile_id = NEW.vendor_profile_id;
  v_used := public.vendor_storage_used_bytes(NEW.vendor_profile_id);

  IF v_used + COALESCE(v_size, 0) > v_gb::bigint * 1000000000 THEN
    RAISE EXCEPTION 'storage_allowance: this file does not fit the % GB your plan holds', v_gb
      USING ERRCODE = 'P0001',
            HINT = 'Remove files from an event to make room, or move to a plan that holds more.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_supplier_storage_allowance() FROM PUBLIC, anon, authenticated;

COMMIT;
