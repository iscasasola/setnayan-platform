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
--     branches_included Pro 1 · Ultra 3. The MONTHLY plan rows' max_sub_seats follow. TIER_CAPS moves in the same PR;
--     the db tests that derive from it hold the two equal.
-- 2 · THE PRICE. Pro's 4-week row ₱4,990 → ₱3,990 (the owner's figure). Plus ₱1,490 and Ultra ₱9,990 are unchanged.
--     🔑 MONTHLY ONLY: the yearly price is an open owner call, so NO annual row is touched (not its price, not its caps).
--     A price row is the catalogue, never a subscription: no order, purchase or vendor_profiles row is written here.
-- 3 · THE ULTRA ADD-ON — the ONE add-on: +1 branch · +15 live cards · +3 people · +50 GB, ₱2,490 per 28 days, Ultra
--     only, may be bought more than once. A new offering type 'ultra_addon', the SKU `vendor_ultra_addon`, and the
--     paid COUNT `vendor_profiles.extra_ultra_addons` — exactly the `extra_*` count pattern of 20271316466285: the
--     sku-activation hook RECOMPUTES it from the shop's paid `vendor_ultra_addon__<vendor_profile_id>` orders;
--     `guard_vendor_profiles_entitlement` refuses a self-grant; `vendor_profiles_self` projects it. The two database
--     gates add it on Ultra: `enforce_included_branch_allowance` (+1 branch each) and
--     `enforce_supplier_storage_allowance` (+50 GB each). Cards and people are app-side allowances (the app adds +15 /
--     +3 each — lib/vendor-ultra-addons.ts).
-- 4 · SINGLE EXTRAS ARE NO LONGER OFFERED (owner: "they only buy the … pack"). The APP stops offering a NEW extra seat
--     or extra branch. ⚠ Their catalogue rows are deliberately LEFT ACTIVE here: a shop that already pays for an extra
--     seat or branch renews it at that row's price (`renewBranch` and the seat renewal read an ACTIVE row), and the
--     owner ruled that no existing subscriber's price or limits move until §C. Switching them off is §C's call.
--
-- RLS unchanged · no new table · no write to any shop's, order's or subscription's row.
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

-- The plan rows' seat count — MONTHLY rows only (the annual rows wait for the yearly ruling).
UPDATE public.vendor_billing_catalog
   SET max_sub_seats = v.seats, updated_at = NOW()
  FROM (VALUES ('pro_vendor_monthly', 4), ('enterprise_vendor_monthly', 15)) AS v(sku_code, seats)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND vendor_billing_catalog.max_sub_seats IS DISTINCT FROM v.seats;

-- ── 2 · the price: Pro ₱3,990 per 4 weeks (monthly only) ────────────────────
UPDATE public.vendor_billing_catalog
   SET price_php = 3990.00, updated_at = NOW()
 WHERE sku_code = 'pro_vendor_monthly'
   AND price_php IS DISTINCT FROM 3990.00;

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
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · storage_gb (the table also holds service_cards_total · parent_categories · agent_accounts, which the app reads). Bookings per date are NOT a plan limit since 2026-11-18 (ruling 17) — no key. Branch numbers of 2026-11-19 (Pro 1 · Ultra 3); the Ultra Add-on''s bought room is not here — the two gates that read vendor_profiles.extra_ultra_addons add it. An unknown TIER reads as Free; an unknown KEY returns NULL on purpose. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';

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

-- 3c · the paid count.
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS extra_ultra_addons INT NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_extra_ultra_addons_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_extra_ultra_addons_check CHECK (extra_ultra_addons >= 0);

COMMENT ON COLUMN public.vendor_profiles.extra_ultra_addons IS
  'Paid Ultra Add-ons (owner 2026-11-19: +1 branch · +15 live cards · +3 people · +50 GB each, Ultra only, may be bought more than once). Recomputed from paid vendor_ultra_addon__<id> orders by the activation hook. Added by enforce_included_branch_allowance and enforce_supplier_storage_allowance, and by the app to the cards and people allowances. Never vendor-writable (entitlement guard).';

GRANT SELECT (extra_ultra_addons) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (extra_ultra_addons) ON public.vendor_profiles FROM anon;

-- 3d · a shop cannot grant itself the count — 20271316466285's guard with the one column added at INSERT and UPDATE.
CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_level TEXT := to_jsonb(NEW) ->> 'ai_addon_level';
  old_level TEXT := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ->> 'ai_addon_level' END;
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.tier_state IS DISTINCT FROM 'free'::public.vendor_tier_state
         OR NEW.tier_expires_at IS NOT NULL
         OR NEW.extra_agent_seats IS DISTINCT FROM 0
         -- The four Ultra add-on counts, added 20271316466285. Bought, never self-granted.
         OR NEW.extra_parent_categories IS DISTINCT FROM 0
         OR NEW.extra_services_per_leaf IS DISTINCT FROM 0
         OR NEW.extra_waitlist_acceptances IS DISTINCT FROM 0
         OR NEW.extra_bookings_per_date IS DISTINCT FROM 0
         -- The Ultra Add-on count, added 20271351415438. Bought, never self-granted.
         OR NEW.extra_ultra_addons IS DISTINCT FROM 0
         OR NEW.ai_addon_expires_at IS NOT NULL
         OR NEW.ai_addon_trial_used_at IS NOT NULL
         OR NEW.booth_addon_expires_at IS NOT NULL
         OR NEW.booth_addon_trial_used_at IS NOT NULL
         -- Papic Challenges, added 20271181420277. A shop cannot be born holding
         -- a 28-day window it never paid for.
         OR NEW.papic_challenge_expires_at IS NOT NULL
         OR (new_level IS NOT NULL AND new_level <> 'basic')
         -- Trust columns: a self-created profile may never arrive pre-verified
         -- or pre-visible. Both are admin-granted only. The literals below are
         -- the COLUMN DEFAULTS verbatim — 'unverified' (20260516050000:83-84)
         -- and 'hidden' (20271013500000 step 2; WAS 'coming_soon' from
         -- 20260515005000 until the owner retired that state on 2026-07-27) —
         -- and both are ENUMs, so they are cast explicitly. Getting either wrong
         -- would reject ordinary vendor registration.
         OR NEW.verification_state
              IS DISTINCT FROM 'unverified'::public.vendor_verification_state
         OR NEW.public_visibility
              IS DISTINCT FROM 'hidden'::public.vendor_public_visibility
         -- Trust columns, added 20271134103060. A shop cannot be BORN carrying
         -- the mark that says Setnayan checked it, any more than it can be born
         -- verified. All three are stamped only by /admin/verify (service-role).
         OR NEW.experience_verified_at IS NOT NULL
         OR NEW.experience_verified_by IS NOT NULL
         OR NEW.last_verified_at IS NOT NULL
         -- The Verified badge's deadline, added 20271221359289. It decides
         -- whether the badge shows; a shop cannot be born holding one.
         OR NEW.next_renewal_due_at IS NOT NULL
         -- A shop cannot be born holding money, or born with a plan queued up
         -- behind the one it is on. With the applier live, an unguarded
         -- `pending_tier` is a plan that switches itself on for free the moment
         -- the current term runs out.
         OR NEW.pending_tier IS NOT NULL
         OR NEW.pending_tier_purchase_id IS NOT NULL
         OR COALESCE(NEW.subscription_credit_php, 0) <> 0
         -- tier_source, added with the column in 20271209332066. A shop cannot
         -- be BORN claiming it paid its own way: the default is the only value a
         -- vendor may arrive with, and self-serve checkout writes as service_role.
         OR NEW.tier_source IS DISTINCT FROM 'admin_comp'
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, scheduled plan changes, account credit, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      -- Enforce the year-change auto-unverify that the app performs as a
      -- courtesy. Done BEFORE the refusal check so the forced NULLs are what
      -- the check below sees — and so a vendor who PATCHes the year directly,
      -- never naming the stamp columns, still loses the mark. The admin's
      -- check was against a specific number; change the number and the check
      -- no longer means anything.
      IF NEW.in_business_since_year IS DISTINCT FROM OLD.in_business_since_year THEN
        NEW.experience_verified_at := NULL;
        NEW.experience_verified_by := NULL;
      END IF;

      IF NEW.tier_state IS DISTINCT FROM OLD.tier_state
         OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at
         OR NEW.extra_agent_seats IS DISTINCT FROM OLD.extra_agent_seats
         -- The four Ultra add-on counts (20271316466285) — recomputed only by the paid activation path.
         OR NEW.extra_parent_categories IS DISTINCT FROM OLD.extra_parent_categories
         OR NEW.extra_services_per_leaf IS DISTINCT FROM OLD.extra_services_per_leaf
         OR NEW.extra_waitlist_acceptances IS DISTINCT FROM OLD.extra_waitlist_acceptances
         OR NEW.extra_bookings_per_date IS DISTINCT FROM OLD.extra_bookings_per_date
         -- The Ultra Add-on count (20271351415438), recomputed only by the paid activation path.
         OR NEW.extra_ultra_addons IS DISTINCT FROM OLD.extra_ultra_addons
         OR NEW.ai_addon_expires_at IS DISTINCT FROM OLD.ai_addon_expires_at
         OR NEW.ai_addon_trial_used_at IS DISTINCT FROM OLD.ai_addon_trial_used_at
         OR NEW.booth_addon_expires_at IS DISTINCT FROM OLD.booth_addon_expires_at
         OR NEW.booth_addon_trial_used_at IS DISTINCT FROM OLD.booth_addon_trial_used_at
         -- Papic Challenges, added 20271181420277.
         OR NEW.papic_challenge_expires_at IS DISTINCT FROM OLD.papic_challenge_expires_at
         OR new_level IS DISTINCT FROM old_level
         -- Trust columns: self-verification, and reversing an admin visibility
         -- freeze on a suspended vendor.
         OR NEW.verification_state IS DISTINCT FROM OLD.verification_state
         OR NEW.public_visibility IS DISTINCT FROM OLD.public_visibility
         -- When the shop was last verified is the admin's record, never the
         -- vendor's — not even to clear it.
         OR NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at
         -- The Verified badge's deadline (20271221359289). Moving it LATER keeps
         -- a badge past its papers; clearing it makes the badge permanent. Both
         -- directions are the admin's alone.
         OR NEW.next_renewal_due_at IS DISTINCT FROM OLD.next_renewal_due_at
         -- The experience mark may be CLEARED by the vendor (that is the
         -- year-change unverify, and giving up your own badge harms nobody) but
         -- never SET or moved to another value. Written as "changed AND the new
         -- value is not null" so the allowed direction stays one-way.
         OR (NEW.experience_verified_at IS DISTINCT FROM OLD.experience_verified_at
             AND NEW.experience_verified_at IS NOT NULL)
         OR (NEW.experience_verified_by IS DISTINCT FROM OLD.experience_verified_by
             AND NEW.experience_verified_by IS NOT NULL)
         -- Every part of a scheduled plan change, and the money balance. All six
         -- are named: the applier reads the cycle, the period and the purchase
         -- id as well as the tier, so guarding only `pending_tier` would leave a
         -- shop able to stretch a 28-day plan into 3,650 days.
         OR NEW.pending_tier IS DISTINCT FROM OLD.pending_tier
         OR NEW.pending_tier_period_days IS DISTINCT FROM OLD.pending_tier_period_days
         OR NEW.pending_tier_purchase_id IS DISTINCT FROM OLD.pending_tier_purchase_id
         OR NEW.pending_tier_billing_cycle IS DISTINCT FROM OLD.pending_tier_billing_cycle
         OR NEW.pending_tier_sku_code IS DISTINCT FROM OLD.pending_tier_sku_code
         OR NEW.subscription_credit_php IS DISTINCT FROM OLD.subscription_credit_php
         -- tier_source is the record of WHO PAID, so it is exactly the kind of
         -- claim its subject must not be able to make about itself. Flipping it to
         -- 'self_serve' grants no tier — it makes a GIFT look purchased, which
         -- hides the vendor from fetchCompedVendors and from /admin/gifts.
         OR NEW.tier_source IS DISTINCT FROM OLD.tier_source
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, scheduled plan changes, account credit, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
  SELECT vp.tier_state::text, COALESCE(vp.extra_ultra_addons, 0)
    INTO v_tier, v_addons
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.parent_vendor_profile_id
   FOR UPDATE;

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
  'on Ultra (owner 2026-11-19). Rows already live are never touched (grandfathered). Serialised per shop by a row '
  'lock on vendor_profiles.';

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

  SELECT vp.tier_state::text, COALESCE(vp.extra_ultra_addons, 0) INTO v_tier, v_addons
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
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

-- 3g · the shop's own view re-projected (its projection is frozen at CREATE) — the 20271350091032 block verbatim,
-- with the new count added to its anti-vacuity check.
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0
     OR position('papers_lapsed_at' IN cols) = 0 OR position('papers_current' IN cols) = 0
     OR position('paused_at' IN cols) = 0 OR position('paused_by' IN cols) = 0
     OR position('extra_ultra_addons' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock, video-title, papers, pause or Ultra Add-on columns';
  END IF;
  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;
REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';

COMMIT;
