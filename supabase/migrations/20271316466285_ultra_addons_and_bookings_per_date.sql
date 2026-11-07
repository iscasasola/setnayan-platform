-- ============================================================================
-- 20271316466285_ultra_addons_and_bookings_per_date.sql
--
-- ⚖ OWNER 2026-11-06 (DECISION_LOG), verbatim:
--   "BOOKINGS PER DATE PER SERVICE IS A PLAN ALLOWANCE" — *"Solo has 1 per date/service, pro has 3 per date/service,
--     ultra has 5 per date/service"*.
--   "BOOKINGS PER DATE PER SERVICE — FREE AND VERIFIED (owner click)" — *"1 each, like Solo. Completes the allowance:
--     Free 1 · Verified 1 · Solo 1 · Pro 3 · Ultra 5."*
--   "ULTRA ADD-ON PRICES" — *"seat, branch + 990 / the rest is +199"*: per 4 weeks, Ultra only — +1 team seat ₱990 ·
--     +1 branch ₱990 (was ₱1,990) · +1 category ₱199 · +1 service card ₱199 · +1 wait list ₱199 · +1 booking per
--     date ₱199. "These go into vendor_billing_catalog (the only price a supplier is charged)."
--
-- 🔑 THE ONLY PRICES TYPED ARE THE OWNER'S VERBATIM FIGURES (990 · 199). Each yearly sibling is DERIVED in SQL as 10×
-- its 4-week row (owner 2026-11-04, "EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10× THE 4-WEEK PRICE"; held by
-- tests/db/a-year-is-ten-four-week-cycles.db.test.ts) and stays DARK — no yearly add-on purchase is built.
--
-- 1 · `vendor_billing_catalog` offering_type / shape CHECKs admit four new add-on types, one per add-on, the
--     'seat' / 'branch' pattern: 'category' · 'service_card' · 'waitlist' · 'booking_per_date'. Re-emitted from the
--     latest definition (20270907924171) with every prior value kept.
-- 2 · Catalogue rows:
--       vendor_additional_branch ₱990 (was ₱1,990) · its year = 10×;
--       vendor_extra_seat stays ₱990 (untouched);
--       vendor_extra_category — the dark ₱499 row of 2026-11-04 is the SAME product ("+1 category"), so it is repriced
--         to ₱199, retyped 'category' and put ON SALE (one row per fact — never a second category SKU); year = 10×;
--       vendor_extra_service_card ₱199 'service_card' — NEW, on sale; year = 10× (dark);
--       vendor_service_cards_2 (+2 cards ₱99, dark, 2026-11-04) — SUPERSEDED by "+1 service card ₱199": stays dark,
--         its reason says so and it points at the new row. Its year keeps its 10× pair;
--       vendor_extra_waitlist ₱199 'waitlist' — NEW, on sale; year = 10× (dark);
--       vendor_extra_booking_per_date ₱199 'booking_per_date' — NEW, on sale; year = 10× (dark).
--     Price is written on conflict too: this file IS the owner's sheet for these rows (the same as the 2026-11-04 sheet).
-- 3 · `vendor_profiles` gains the four PAID COUNTS — extra_parent_categories · extra_services_per_leaf ·
--     extra_waitlist_acceptances · extra_bookings_per_date — INT NOT NULL DEFAULT 0, CHECK >= 0. Exactly the
--     `extra_agent_seats` pattern (20270511762904): the sku-activation hook RECOMPUTES each from the shop's paid
--     `<prefix><vendor_profile_id>` orders on approval and again on a refund. The app adds them to the plan's
--     allowance (lib/vendor-ultra-addons.ts · applyAddOnExtras, via lib/vendor-effective-caps.ts).
--     Granted to `authenticated` by name (column-scoped SELECT since 20271217955839), never to anon; the shop's
--     definer view `vendor_profiles_self` is rebuilt so it projects them.
-- 4 · `guard_vendor_profiles_entitlement` names the four counts — a shop cannot PATCH itself extra room
--     (`vendor_profiles_owner` is FOR ALL on its own row). Re-emitted from its latest definition
--     (20271221359289) with the four clauses added at INSERT and at UPDATE and nothing else changed.
-- 5 · `vendor_tier_limit` gains 'bookings_per_date_per_service': 1 · 1 · 1 · 3 · 5 (Free · Verified · Solo · Pro ·
--     Ultra). The existing arms are VERBATIM from its LATEST definition, 20271310256381 (the Custom plan's
--     retirement, which removed every 'custom' arm — none is put back here). And ONE helper,
--     `service_card_daily_limit(card)`: the card's own "Bookings per day" inside its plan —
--         plan cap NULL  → NULLIF(daily_capacity, 0)                              (no plan returns NULL today; kept
--                                                                                  so a NULL can never read as 0)
--         plan cap N     → LEAST(COALESCE(NULLIF(daily_capacity, 0), N), N)       (a blank card takes N)
--     where N = the plan's number + the bought "+1 booking per date" count (Ultra only).
-- 6 · Every reader of the per-card daily limit reads the helper instead of the raw column — one line each, bodies
--     otherwise VERBATIM from their latest definitions:
--       `vendor_agree_to_lock`         (20271293507816) — THE refusal ('daily_limit_reached');
--       `vendor_day_check`             (20271306441834) — the verdict before the yes, and each card's 'daily_limit';
--       `service_cards_unbookable_on`  (20271269411264) — the bench hides a card full on a date.
--     GRANDFATHERED by construction: bookings a card already holds are never touched — only a NEW booking past the
--     cap is refused. A slotted card is still judged by its slots (unchanged; see the PR body's open item).
-- 7 · `clamp_vendor_waitlist_to_tier` adds the bought "+1 wait list" count to the ceiling (Ultra, after the zero arm,
--     held under the column's 0..10 CHECK). Re-emitted from its LATEST definition, 20271310256381, which dropped the
--     Custom-only "no limit" arm and `vendor_pipeline_is_unlimited` — neither comes back here.
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it. Idempotent.
-- ============================================================================

BEGIN;

-- ── 1 · the add-on offering types ───────────────────────────────────────────
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;
ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN (
    'subscription_monthly', 'subscription_annual', 'token_pack',
    'branch', 'seat', 'custom_addon', 'vendor_addon_recurring',
    'vendor_addon_per_event', 'vendor_addon_metered',
    'category', 'service_card', 'waitlist', 'booking_per_date'
  ));

ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;
ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN (
       'subscription_monthly', 'subscription_annual', 'branch', 'seat',
       'custom_addon', 'vendor_addon_recurring', 'vendor_addon_per_event',
       'vendor_addon_metered',
       'category', 'service_card', 'waitlist', 'booking_per_date'
     ) AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- ── 2 · the owner's prices ───────────────────────────────────────────────────
-- 2a · the branch: ₱990 (was ₱1,990).
UPDATE public.vendor_billing_catalog
   SET price_php  = 990.00,
       title      = 'Additional Branch (4 weeks · Ultra only)',
       updated_at = NOW()
 WHERE sku_code = 'vendor_additional_branch';

-- 2b · the four +₱199 add-ons. One unit each (max_categories carries the +1 for the category row, the way
-- max_sub_seats carries the seat's 1; the other three carry no unit column — the unit is always one).
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order, is_active)
VALUES
  ('vendor_extra_category',         'Extra Category (4 weeks · Ultra only)',          199.00, 'category',         NULL, 1,    NULL, 98,  TRUE),
  ('vendor_extra_service_card',     'Extra Service Card (4 weeks · Ultra only)',      199.00, 'service_card',     NULL, NULL, NULL, 102, TRUE),
  ('vendor_extra_waitlist',         'Extra Wait List Place (4 weeks · Ultra only)',   199.00, 'waitlist',         NULL, NULL, NULL, 104, TRUE),
  ('vendor_extra_booking_per_date', 'Extra Booking per Date (4 weeks · Ultra only)',  199.00, 'booking_per_date', NULL, NULL, NULL, 106, TRUE)
ON CONFLICT (sku_code) DO UPDATE
   SET title             = EXCLUDED.title,
       price_php         = EXCLUDED.price_php,
       offering_type     = EXCLUDED.offering_type,
       max_categories    = EXCLUDED.max_categories,
       is_active         = TRUE,
       retired_at        = NULL,
       retirement_reason = NULL,
       updated_at        = NOW();

-- 2c · their years — priced (10× DERIVED, never typed), not on sale: no yearly add-on purchase is built.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order, is_active, retirement_reason)
SELECT y.sku_code, y.title, m.price_php * 10, 'vendor_addon_recurring', NULL, NULL, NULL, y.display_order, FALSE,
       'Priced 2026-11-06 (10× the 4-week row); yearly add-on purchase not built yet.'
  FROM (VALUES
          ('vendor_extra_service_card_annual',     'vendor_extra_service_card',     'Extra Service Card (1 year · Ultra only)',     103),
          ('vendor_extra_waitlist_annual',         'vendor_extra_waitlist',         'Extra Wait List Place (1 year · Ultra only)',  105),
          ('vendor_extra_booking_per_date_annual', 'vendor_extra_booking_per_date', 'Extra Booking per Date (1 year · Ultra only)', 107)
       ) AS y(sku_code, month_sku, title, display_order)
  JOIN public.vendor_billing_catalog m ON m.sku_code = y.month_sku
ON CONFLICT (sku_code) DO UPDATE
   SET title      = EXCLUDED.title,
       price_php  = EXCLUDED.price_php,
       updated_at = NOW();

-- Every existing year follows its 4-week row (branch, category) — 10× derived.
UPDATE public.vendor_billing_catalog y
   SET price_php  = m.price_php * 10,
       updated_at = NOW()
  FROM public.vendor_billing_catalog m
 WHERE (y.sku_code, m.sku_code) IN (('vendor_additional_branch_annual', 'vendor_additional_branch'),
                                    ('vendor_extra_category_annual',    'vendor_extra_category'))
   AND y.price_php IS DISTINCT FROM m.price_php * 10;

UPDATE public.vendor_billing_catalog
   SET title      = 'Extra Category (1 year · Ultra only)',
       updated_at = NOW()
 WHERE sku_code = 'vendor_extra_category_annual';

-- 2d · "+2 service cards ₱99" (2026-11-04) is superseded by "+1 service card ₱199" (2026-11-06). Stays dark.
UPDATE public.vendor_billing_catalog
   SET is_active            = FALSE,
       retirement_reason    = 'Superseded 2026-11-06 (owner, "ULTRA ADD-ON PRICES"): +1 service card at ₱199 — vendor_extra_service_card.',
       replaced_by_sku_code = 'vendor_extra_service_card',
       updated_at           = NOW()
 WHERE sku_code = 'vendor_service_cards_2';

-- ── 3 · the paid counts ──────────────────────────────────────────────────────
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS extra_parent_categories    INT NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS extra_services_per_leaf    INT NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS extra_waitlist_acceptances INT NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS extra_bookings_per_date    INT NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_ultra_addon_counts_nonneg;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_ultra_addon_counts_nonneg CHECK (
    extra_parent_categories >= 0 AND extra_services_per_leaf >= 0
    AND extra_waitlist_acceptances >= 0 AND extra_bookings_per_date >= 0
  );

COMMENT ON COLUMN public.vendor_profiles.extra_parent_categories IS
  'Paid "+1 category" add-ons (Ultra, owner 2026-11-06). Recomputed from paid vendor_extra_category__<id> orders by the activation hook; added to TIER_CAPS.parentCategories. Never vendor-writable (entitlement guard).';
COMMENT ON COLUMN public.vendor_profiles.extra_services_per_leaf IS
  'Paid "+1 service card" add-ons (Ultra, owner 2026-11-06). Recomputed from paid vendor_extra_service_card__<id> orders; added to TIER_CAPS.servicesPerLeaf. Never vendor-writable.';
COMMENT ON COLUMN public.vendor_profiles.extra_waitlist_acceptances IS
  'Paid "+1 wait list" add-ons (Ultra, owner 2026-11-06). Recomputed from paid vendor_extra_waitlist__<id> orders; added to the waitlist ceiling (clamp_vendor_waitlist_to_tier, TIER_CAPS.waitlistAcceptances). Never vendor-writable.';
COMMENT ON COLUMN public.vendor_profiles.extra_bookings_per_date IS
  'Paid "+1 booking per date" add-ons (Ultra, owner 2026-11-06). Recomputed from paid vendor_extra_booking_per_date__<id> orders; added to every card''s plan cap (service_card_daily_limit). Never vendor-writable.';

-- The shop reads its own counts (the Plan page says "you have +2"; the allowance reads add them). `authenticated` holds
-- column-scoped SELECT on vendor_profiles (20271217955839), so each column is granted by name — rows stay RLS-scoped
-- (the shop reads its own); anon reads none of them.
GRANT SELECT (extra_parent_categories) ON public.vendor_profiles TO authenticated;
GRANT SELECT (extra_services_per_leaf) ON public.vendor_profiles TO authenticated;
GRANT SELECT (extra_waitlist_acceptances) ON public.vendor_profiles TO authenticated;
GRANT SELECT (extra_bookings_per_date) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (extra_parent_categories) ON public.vendor_profiles FROM anon;
REVOKE SELECT (extra_services_per_leaf) ON public.vendor_profiles FROM anon;
REVOKE SELECT (extra_waitlist_acceptances) ON public.vendor_profiles FROM anon;
REVOKE SELECT (extra_bookings_per_date) ON public.vendor_profiles FROM anon;

-- The shop's own definer view projects every column as of its CREATE — rebuilt so it carries the four new ones
-- (`lint-vendor-profiles-column-grants`; block copied from 20271303245624, unchanged).
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
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

-- ── 4 · the self-grant guard ─────────────────────────────────────────────────
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

-- ── 5 · the plan's number, and the one limit every day check reads ───────────
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan (was 1)
        WHEN 'verified'   THEN 5   -- (was 2)
        WHEN 'solo'       THEN 5   -- (was 3)
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5   -- (was 10)
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0   -- owner 2026-11-04 "waitlist 0,0,1,5" (was 1)
        WHEN 'solo'       THEN 0   -- (was 1)
        WHEN 'pro'        THEN 1   -- (was 3)
        WHEN 'enterprise' THEN 3   -- Ultra trimmed 2026-11-04 (was 5)
        ELSE 0
      END
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0   -- owner 2026-11-04 "branches 0,0,3,10"
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 0
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 6   -- Ultra trimmed 2026-11-04 ("branches 0,0,3,10" said 10)
        ELSE 0
      END
    WHEN 'bookings_per_date_per_service' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 1    -- owner click 2026-11-06 "FREE AND VERIFIED": "1 each, like Solo"
        WHEN 'verified'   THEN 1    -- same ruling
        WHEN 'solo'       THEN 1    -- owner 2026-11-06: "Solo has 1 per date/service"
        WHEN 'pro'        THEN 3    -- "pro has 3 per date/service"
        WHEN 'enterprise' THEN 5    -- "ultra has 5 per date/service"
        ELSE 1                      -- unknown tier reads as Free (asVendorTier)
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier limits. Keys: whitelist_per_date (5 on EVERY plan since 2026-10-23) · waitlist_acceptances (0/0/0/1/3 since 2026-11-04) · branches_included (0/0/0/3/6 since 2026-11-04) · bookings_per_date_per_service (most bookings ONE service card takes on ONE date — 1/1/1/3/5 since 2026-11-06; Free/Verified 1 each, like Solo, owner click 2026-11-06). The retired Custom plan''s arms were removed 2026-11-06; an unknown TIER reads as Free. Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts and tests/db/vendor-plan-allowances.db.test.ts, which derive from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

CREATE OR REPLACE FUNCTION public.service_card_daily_limit(p_service_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
           WHEN plan.cap IS NULL THEN NULLIF(vs.daily_capacity, 0)
           ELSE LEAST(COALESCE(NULLIF(vs.daily_capacity, 0), plan.cap), plan.cap)
         END
    FROM public.vendor_services vs
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = vs.vendor_profile_id
    CROSS JOIN LATERAL (
      SELECT public.vendor_tier_limit(vp.tier_state::text, 'bookings_per_date_per_service')
             + CASE WHEN vp.tier_state::text = 'enterprise'
                    THEN GREATEST(COALESCE(vp.extra_bookings_per_date, 0), 0)
                    ELSE 0 END AS cap
    ) plan
   WHERE vs.vendor_service_id = p_service_id;
$function$;

COMMENT ON FUNCTION public.service_card_daily_limit(uuid) IS
  'The most bookings this service card takes on one date: its own daily_capacity inside its plan''s bookings per date '
  'per card (owner 2026-11-06 — Solo 1 · Pro 3 · Ultra 5, + bought "+1 booking per date" on Ultra). A blank card '
  'takes the plan''s number. Free/Verified: 1 each, like Solo (owner 2026-11-06). NULL = no limit. Read by '
  'vendor_agree_to_lock, vendor_day_check and service_cards_unbookable_on. Bookings already held are never touched.';

REVOKE ALL ON FUNCTION public.service_card_daily_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_daily_limit(uuid) TO service_role;

-- ── 6 · the three readers ────────────────────────────────────────────────────
-- 6a · the yes (body VERBATIM from 20271293507816 but the one marked line). CREATE OR REPLACE keeps its grants.
CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state       TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_agreed_at   TIMESTAMPTZ;
  v_event_id    UUID;
  v_group       TEXT;
  v_status      TEXT;
  v_mvid        UUID;
  v_slot        UUID;
  v_rows        INTEGER;
  v_msg         TEXT;
  v_date        DATE;
  v_prec        TEXT;
  v_event_ids   UUID[];
  v_capacity    INT;
  v_used        INT;
  v_competing   INT;
  v_pkg_id      UUID;
  v_covered     INT;
  v_service     UUID;
  v_daily_cap   INT;
BEGIN
  -- ── OWNERSHIP ──────────────────────────────────────────────────────────────
  -- NARROWED from the shipped gate, deliberately. current_vendor_event_vendor_ids()
  -- has a second arm matching on event_vendors.service_id via
  -- agent_assigned_service_ids() — and service_id is a column the COUPLE can
  -- write (authenticated holds UPDATE on it; no constraint ties it to
  -- marketplace_vendor_id). That was harmless while this RPC wrote an inert
  -- marker nobody read. It is NOT harmless now that this RPC is the only thing
  -- that creates a booking.
  -- 🔑 RULE: when an RPC becomes the sole authority for a booking, its ownership
  -- predicate may not key on a column the counterparty controls.
  -- The agent arm is kept — staff seats legitimately answer for their org — but
  -- re-anchored so the service must belong to the org that was actually ASKED.
  IF NOT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND (
         ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
         OR EXISTS (
           SELECT 1
             FROM public.vendor_services vs
            WHERE vs.vendor_service_id = ev.service_id
              AND vs.vendor_profile_id = ev.marketplace_vendor_id
              AND vs.vendor_service_id IN (SELECT public.agent_assigned_service_ids())
         )
       )
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_agreed_at,
         event_id, hard_single_group, status::TEXT, marketplace_vendor_id,
         service_time_slot_id, event_vendor_package_id
    INTO v_state, v_expires_at, v_agreed_at,
         v_event_id, v_group, v_status, v_mvid, v_slot, v_pkg_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested', 'event_id', v_event_id);
  END IF;

  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  IF v_state IN ('declined', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object(
      'status', 'not_pending', 'current', v_state, 'event_id', v_event_id);
  END IF;

  -- LAZY EXPIRY. Kept even though a sweep now exists: the sweep fires on request
  -- traffic, so a vendor can still open a lapsed request between two passes.
  -- Flipping (rather than merely refusing) releases both pending indexes so the
  -- couple can ask again.
  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'expired', 'expired_at', v_expires_at, 'event_id', v_event_id);
  END IF;

  -- ── A CONFIRMED RIVAL IN THE COUPLE'S OWN CATEGORY ─────────────────────────
  -- The couple booked someone else for this hard-single category while the ask
  -- was outstanding. Close the request rather than leaving it to rot in the
  -- pending index. 'cancelled' is the honest value — every path that can confirm
  -- a hard-single sibling is couple-initiated, so the couple did withdraw it, by
  -- booking elsewhere — but the ACTOR IS STAMPED so the record does not lose the
  -- fact that the vendor was here and answered.
  IF v_group IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = v_event_id
       AND ev.hard_single_group = v_group
       AND ev.vendor_id <> p_event_vendor_id
       AND ev.archived_at IS NULL
       AND ev.package_role IS DISTINCT FROM 'covered'
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ) THEN
    UPDATE public.event_vendors
       SET lock_request_state        = 'cancelled',
           lock_request_cancelled_at = NOW(),
           lock_answered_by_user_id  = auth.uid(),
           updated_at                = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'group_taken', 'event_id', v_event_id);
  END IF;

  -- ── OWNER DECISION 3 · DECLINE THE OTHERS FIRST ───────────────────────────
  -- Service_Schedule_and_Quotation_Flow_2026-06-02.md §T1.4. A vendor may not
  -- take one couple while other couples are still waiting on them for the same
  -- date: they must answer the others first, so nobody loses silently.
  -- Capacity is the owner's documented default of 1 (daily_booking_capacity was
  -- never built — see the header). A vendor with no date on the event has no
  -- date to compete on, so the rule does not apply.
  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_prec
    FROM public.events e
   WHERE e.event_id = v_event_id;

  IF v_mvid IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT count(*) INTO v_competing
      FROM public.event_vendors ev
      JOIN public.events e2 ON e2.event_id = ev.event_id
     WHERE ev.marketplace_vendor_id = v_mvid
       AND ev.lock_request_state = 'pending'
       AND ev.archived_at IS NULL
       AND ev.vendor_id <> p_event_vendor_id
       AND e2.event_date = v_date
       AND e2.event_date_precision = 'day';

    IF COALESCE(v_competing, 0) > 0 THEN
      RETURN jsonb_build_object(
        'status', 'resolve_others_first',
        'competing', v_competing,
        'event_date', v_date,
        'event_id', v_event_id);
    END IF;
  END IF;

  -- ── TIME-SLOT CAPACITY ────────────────────────────────────────────────────
  -- Capacity is consumed HERE, not at the couple's ask, because the ask no
  -- longer books anything. The predicate mirrors acquire_service_time_slot's
  -- occupancy count (read from the live function, not retyped from memory).
  IF v_slot IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT slot_capacity INTO v_capacity
      FROM public.vendor_service_time_slots
     WHERE slot_id = v_slot
       AND is_active
     FOR UPDATE;

    IF v_capacity IS NOT NULL THEN
      SELECT array_agg(event_id) INTO v_event_ids
        FROM public.events
       WHERE event_date = v_date
         AND event_date_precision = 'day';

      SELECT count(*) INTO v_used
        FROM public.event_vendors
       WHERE service_time_slot_id = v_slot
         AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND archived_at IS NULL
         AND event_id = ANY (v_event_ids)
         AND vendor_id <> p_event_vendor_id;

      IF v_used >= v_capacity THEN
        RETURN jsonb_build_object(
          'status', 'slot_full', 'event_id', v_event_id);
      END IF;
    END IF;
  END IF;

  -- ── PER-CARD DAILY LIMIT (LOCK-PATH 2 · 20271223386305) ────────────────────
  -- The couple's ASK is checked against the card's "Bookings per day"
  -- (vendors/actions.ts #2), but it is THIS yes that books — and it did not
  -- check the limit at all. Whatever grew the count between the ask and the
  -- yes (a Locked-QR claim, a booking made while the handshake was off, a limit
  -- the supplier lowered) let the yes go past it.
  -- Same rule as the ask and the bench search, and the SAME count — never a
  -- second one: a card with NO active time slot (a slotted card is judged by
  -- its slot, above), a daily_capacity above zero, a day-precise date, and
  -- service_card_bookings_on (booked statuses, not archived, day-precise
  -- events). A row that is already booked is not a new booking, so its yes is
  -- never refused here. The card row is locked first, so two yeses on one card
  -- cannot both read the last free place (NO KEY: bookings that merely
  -- reference the card are not blocked).
  IF v_date IS NOT NULL AND v_prec = 'day'
     AND v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    SELECT ev.service_id INTO v_service
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id;

    IF v_service IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendor_service_time_slots t
       WHERE t.vendor_service_id = v_service
         AND t.is_active
    ) THEN
      PERFORM 1
        FROM public.vendor_services vs
       WHERE vs.vendor_service_id = v_service
       FOR NO KEY UPDATE;
      -- 2026-11-06: the card's own number INSIDE its plan's bookings per date per card (Solo 1 · Pro 3 · Ultra 5 +
      -- bought). The only changed line of this function — `service_card_daily_limit` (§5 above).
      v_daily_cap := public.service_card_daily_limit(v_service);

      IF v_daily_cap IS NOT NULL AND v_daily_cap > 0
         AND public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) >= v_daily_cap THEN
        RETURN jsonb_build_object(
          'status', 'daily_limit_reached', 'daily_limit', v_daily_cap, 'event_id', v_event_id);
      END IF;
    END IF;
  END IF;

  -- ── THE FLIP ──────────────────────────────────────────────────────────────
  -- One statement. state='agreed' AND status='contracted' land together or not
  -- at all. The status half is MONOTONE (see the header): a row that is already
  -- further up the ladder keeps its status, so agreeing can never demote a paid
  -- booking or release the vendor's held date.
  BEGIN
    UPDATE public.event_vendors
       SET lock_request_state       = 'agreed',
           lock_agreed_at           = NOW(),
           lock_answered_by_user_id = auth.uid(),
           lock_declined_at         = NULL,
           lock_decline_reason      = NULL,
           -- ── THE STAMPS THIS FUNCTION HAS ALWAYS BEEN SAID TO WRITE ────────
           -- Added 2026-08-17. `vendors/actions.ts` has asserted since slice A
           -- that "the agree RPC stamps both alongside 'contracted', exactly as
           -- acquire_service_time_slot already does". Half of that was true:
           -- acquire_service_time_slot DOES stamp both (read out of prod, not
           -- retyped); this function stamped NEITHER.
           --
           -- 🔑 A SENTENCE IS NOT A MECHANISM. The comment was written on the
           -- couple's side, describing what a different object would do, and
           -- nothing ever checked. Read the function body, not the prose about
           -- it.
           --
           -- WHY IT MATTERS THE INSTANT THE FLAG GOES ON: this becomes the main
           -- booking path, and ~10 features key off linked_vendor_profile_id —
           -- the supplier doorway on /{slug}, editorial first-pick credit, Real
           -- Stories credit, Papic attribution, stage-note recipients, showcase
           -- credits, the verified median, fraud detection, the plausibility
           -- scanner, venue-room-size. Every handshake booking would have been
           -- a 'contracted' row with a NULL link, i.e. invisible to all of them.
           --
           -- SHAPE COPIED FROM acquire_service_time_slot, which is the only
           -- other RPC that books: rank 1, link taken from the row's OWN
           -- marketplace_vendor_id.
           --
           -- COALESCE is DEFENCE IN DEPTH, NOT A LIVE SAFEGUARD — and I only know
           -- that because writing the test disproved my own reasoning. I added it
           -- believing the `OR is_admin()` arm of the ownership gate could reach a
           -- row whose marketplace_vendor_id is NULL, where a bare assignment
           -- would blank an existing link. It cannot:
           --   event_vendors_lock_request_marketplace_chk
           --     CHECK (lock_request_state IS DISTINCT FROM 'pending'
           --            OR marketplace_vendor_id IS NOT NULL)
           -- and this UPDATE only ever matches lock_request_state='pending'. So
           -- the row it guards against cannot exist today. Kept because it costs
           -- nothing and the constraint is one migration away from being relaxed;
           -- the constraint itself is now pinned by a test, so whoever relaxes it
           -- is told.
           -- 🔑 VERIFY YOUR OWN CONCLUSIONS TOO. This comment was going to assert
           -- a live hazard that the schema already forbids.
           selection_match_rank     = 1,
           linked_vendor_profile_id =
             COALESCE(marketplace_vendor_id, linked_vendor_profile_id),
           status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at               = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    -- ⚠ THE VERIFIED-SHOP TRIGGER RAISES check_violation ON THIS TABLE AND THE
    -- FLIP MAKES IT NEWLY REACHABLE — it used to fire on the couple's write,
    -- where finalizeVendor handled it. (A second one, the free-tier booking cap,
    -- was dropped 2026-10-28 — owner: "Remove the limit." — and its
    -- "fully booked" answer went with it.) The shipped RPC had NO exception block at
    -- all, so a vendor pressing Agree would have met a raw Postgres string.
    -- Discriminate on the message; a blanket handler would tell a fully verified
    -- vendor to finish their verification, which is how a real defect gets
    -- triaged as a user error and never investigated.
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg LIKE 'vendor_not_verified%' THEN
        RETURN jsonb_build_object('status', 'not_verified', 'event_id', v_event_id);
      END IF;
      RAISE;  -- anything else is a real defect and must fail loudly.
    WHEN unique_violation THEN
      -- Raced a rival into the confirmed hard-single index between the
      -- pre-check above and this statement. Defence in depth, not the design.
      RETURN jsonb_build_object('status', 'group_taken', 'event_id', v_event_id);
  END;

  IF v_rows = 0 THEN
    SELECT lock_request_state, lock_agreed_at INTO v_state, v_agreed_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'current', v_state,
      'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  -- ── A PACKAGE IS ONE ANSWER, N ROWS (PR-H slice B) ──────────────────────
  -- The package lock path cascades one ANCHOR row plus a COVERED row per kept
  -- line, all pointing at one event_vendor_packages booking. Only the anchor
  -- carries the request — the pending index's own predicate says so
  -- (package_role IS DISTINCT FROM 'covered'), and a covered line is not a
  -- separate question anybody could answer.
  --
  -- 🔑 SO AGREEING TO THE ANCHOR MUST BOOK THE WHOLE PACKAGE. Without this the
  -- supplier's yes would confirm ONE line and leave every other line of the
  -- package they just agreed to sitting at 'considering' — a half-booked
  -- package, which is not a state the product has copy for, a price for, or a
  -- way out of.
  --
  -- Same MONOTONE shape as the anchor's own flip: a covered row already further
  -- up the ladder keeps its status, so this can never demote a paid line. The
  -- booking row moves 'considering' → 'locked' and takes its locked_at receipt
  -- at the moment the receipt becomes true, not seven days earlier.
  IF v_pkg_id IS NOT NULL THEN
    UPDATE public.event_vendors
       SET status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at = NOW()
     WHERE event_vendor_package_id = v_pkg_id
       AND package_role = 'covered'
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_covered = ROW_COUNT;

    UPDATE public.event_vendor_packages
       SET status    = 'locked',
           locked_at = COALESCE(locked_at, NOW())
     WHERE booking_id = v_pkg_id
       AND status = 'considering';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok', 'agreed_at', NOW(), 'event_id', v_event_id,
    'package_lines_booked', COALESCE(v_covered, 0));
END;
$function$;

-- 6b · the day check (body VERBATIM from 20271306441834 but the two marked lines).
CREATE OR REPLACE FUNCTION public.vendor_day_check(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state      TEXT;
  v_event_id   UUID;
  v_status     TEXT;
  v_mvid       UUID;
  v_slot       UUID;
  v_service    UUID;
  v_date       DATE;
  v_prec       TEXT;
  v_competing  INT := 0;
  v_slot_cap   INT;
  v_slot_used  INT;
  v_daily_cap  INT;
  v_slot_full  BOOLEAN := FALSE;
  v_daily_full BOOLEAN := FALSE;
  v_verdict    TEXT;
  v_services   JSONB;
  v_booked     JSONB;
  v_outside    JSONB;
  v_asking     JSONB;
  v_saved      JSONB;
BEGIN
  -- ── OWNERSHIP — vendor_agree_to_lock's gate, unchanged ────────────────────
  IF NOT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND (
         ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
         OR EXISTS (
           SELECT 1
             FROM public.vendor_services vs
            WHERE vs.vendor_service_id = ev.service_id
              AND vs.vendor_profile_id = ev.marketplace_vendor_id
              AND vs.vendor_service_id IN (SELECT public.agent_assigned_service_ids())
         )
       )
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, event_id, status::TEXT, marketplace_vendor_id,
         service_time_slot_id, service_id
    INTO v_state, v_event_id, v_status, v_mvid, v_slot, v_service
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_prec
    FROM public.events e
   WHERE e.event_id = v_event_id;

  -- No day to check: every capacity gate of the RPC is skipped for these too.
  IF v_mvid IS NULL OR v_date IS NULL OR v_prec IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'no_date', 'event_id', v_event_id, 'ask', v_state);
  END IF;

  -- ── 1 · OTHERS ASKING (the RPC's resolve_others_first count) ──────────────
  SELECT count(*) INTO v_competing
    FROM public.event_vendors ev
    JOIN public.events e2 ON e2.event_id = ev.event_id
   WHERE ev.marketplace_vendor_id = v_mvid
     AND ev.lock_request_state = 'pending'
     AND ev.archived_at IS NULL
     AND ev.vendor_id <> p_event_vendor_id
     AND e2.event_date = v_date
     AND e2.event_date_precision = 'day';

  -- ── 2 · THE ASK'S TIME SLOT (the RPC's slot occupancy predicate) ──────────
  IF v_slot IS NOT NULL THEN
    SELECT slot_capacity INTO v_slot_cap
      FROM public.vendor_service_time_slots
     WHERE slot_id = v_slot
       AND is_active;
    IF v_slot_cap IS NOT NULL THEN
      SELECT count(*) INTO v_slot_used
        FROM public.event_vendors ev
        JOIN public.events e3 ON e3.event_id = ev.event_id
       WHERE ev.service_time_slot_id = v_slot
         AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND ev.archived_at IS NULL
         AND e3.event_date = v_date
         AND e3.event_date_precision = 'day'
         AND ev.vendor_id <> p_event_vendor_id;
      v_slot_full := v_slot_used >= v_slot_cap;
    END IF;
  END IF;

  -- ── 3 · THE CARD'S "BOOKINGS PER DAY" (the RPC's daily gate, same count) ──
  IF v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND v_service IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_service_time_slots t
        WHERE t.vendor_service_id = v_service
          AND t.is_active
     ) THEN
    -- 2026-11-06: the SAME limit the yes refuses on (`service_card_daily_limit`, §5).
    v_daily_cap := public.service_card_daily_limit(v_service);
    v_daily_full := v_daily_cap IS NOT NULL AND v_daily_cap > 0
      AND public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) >= v_daily_cap;
  END IF;

  -- The RPC's order: others first, then the slot, then the card's day.
  v_verdict := CASE
                 WHEN COALESCE(v_competing, 0) > 0 THEN 'resolve_others_first'
                 WHEN v_slot_full THEN 'slot_full'
                 WHEN v_daily_full THEN 'daily_limit_reached'
                 ELSE 'open'
               END;

  -- ── THE CARDS THIS COUPLE HAS FROM THIS SHOP, EACH WITH ITS DAY ────────────
  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'name'), '[]'::jsonb) INTO v_services
    FROM (
      SELECT jsonb_build_object(
               'service_id', vs.vendor_service_id,
               'name', COALESCE(NULLIF(trim(vs.title), ''), vs.category),
               'category', vs.category,
               'mode', CASE WHEN sl.n > 0 THEN 'slot' ELSE 'day' END,
               'daily_limit', CASE WHEN sl.n > 0 THEN NULL ELSE public.service_card_daily_limit(vs.vendor_service_id) END,
               'slots', sl.n,
               'per_slot', sl.per_slot,
               'slot_limit', sl.cap,
               'booked', CASE
                           WHEN sl.n > 0 THEN (
                             SELECT count(*)::int
                               FROM public.event_vendors b
                               JOIN public.events eb ON eb.event_id = b.event_id
                              WHERE b.service_time_slot_id IN (
                                      SELECT t.slot_id FROM public.vendor_service_time_slots t
                                       WHERE t.vendor_service_id = vs.vendor_service_id AND t.is_active)
                                AND b.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
                                AND b.archived_at IS NULL
                                AND eb.event_date = v_date
                                AND eb.event_date_precision = 'day'
                                AND b.event_id <> v_event_id)
                           ELSE public.service_card_bookings_on(vs.vendor_service_id, v_date, p_event_vendor_id)
                         END,
               'is_this_ask', vs.vendor_service_id = v_service
             ) AS c
        FROM public.vendor_services vs
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS n,
                 COALESCE(sum(t.slot_capacity), 0)::int AS cap,
                 max(t.slot_capacity)::int AS per_slot
            FROM public.vendor_service_time_slots t
           WHERE t.vendor_service_id = vs.vendor_service_id
             AND t.is_active
        ) sl
       WHERE vs.vendor_profile_id = v_mvid
         AND vs.vendor_service_id IN (
               SELECT ev.service_id FROM public.event_vendors ev
                WHERE ev.event_id = v_event_id
                  AND ev.marketplace_vendor_id = v_mvid
                  AND ev.service_id IS NOT NULL
                  AND ev.archived_at IS NULL)
    ) s;

  -- ── WHO IS BOOKED THAT DAY ON SETNAYAN (one row per couple) ────────────────
  SELECT COALESCE(jsonb_agg(b ORDER BY b->>'name'), '[]'::jsonb) INTO v_booked
    FROM (
      SELECT DISTINCT ON (ev.event_id) jsonb_build_object(
               'event_id', ev.event_id,
               'name', COALESCE(NULLIF(trim(e.display_name), ''), 'A couple'),
               'event_type', COALESCE(etv.label_en, e.event_type),
               'service', COALESCE(NULLIF(trim(vs.title), ''), vs.category, ev.category::text),
               'service_id', ev.service_id,
               'source', 'setnayan'
             ) AS b
        FROM public.event_vendors ev
        JOIN public.events e ON e.event_id = ev.event_id
        LEFT JOIN public.event_type_vocab etv ON etv.event_type = e.event_type
        LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
       WHERE ev.marketplace_vendor_id = v_mvid
         AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND ev.archived_at IS NULL
         AND ev.event_id <> v_event_id
         AND e.event_date = v_date
         AND e.event_date_precision = 'day'
       ORDER BY ev.event_id, (ev.package_role IS DISTINCT FROM 'covered') DESC
       LIMIT 40
    ) x;

  -- ── …AND OUTSIDE (the shop's own record of a client it sold elsewhere) ─────
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', COALESCE(NULLIF(trim(b.client_name), ''), 'Outside client'),
           'source', 'outside') ORDER BY b.blocked_at), '[]'::jsonb)
    INTO v_outside
    FROM (
      SELECT blk.client_name, blk.blocked_at
        FROM public.vendor_calendar_blocks blk
       WHERE blk.vendor_profile_id = v_mvid
         AND blk.block_source = 'external_client'
         AND (blk.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
         AND (blk.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date
       ORDER BY blk.blocked_at
       LIMIT 20
    ) b;

  -- ── OTHERS ASKING FOR THAT DAY (the rows resolve_others_first counts) ──────
  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'asked_at'), '[]'::jsonb) INTO v_asking
    FROM (
      SELECT jsonb_build_object(
               'event_id', ev.event_id,
               'name', COALESCE(NULLIF(trim(e.display_name), ''), 'A couple'),
               'event_type', COALESCE(etv.label_en, e.event_type),
               'asked_at', ev.lock_requested_at,
               'thread_id', (
                 SELECT t.thread_id FROM public.chat_threads t
                  WHERE t.event_id = ev.event_id
                    AND t.vendor_profile_id = v_mvid
                  ORDER BY t.created_at DESC
                  LIMIT 1)
             ) AS a
        FROM public.event_vendors ev
        JOIN public.events e ON e.event_id = ev.event_id
        LEFT JOIN public.event_type_vocab etv ON etv.event_type = e.event_type
       WHERE ev.marketplace_vendor_id = v_mvid
         AND ev.lock_request_state = 'pending'
         AND ev.archived_at IS NULL
         AND ev.vendor_id <> p_event_vendor_id
         AND e.event_date = v_date
         AND e.event_date_precision = 'day'
       LIMIT 40
    ) y;

  -- ── SHORTLISTED YOU FOR THAT DAY, NOT ASKED ───────────────────────────────
  SELECT COALESCE(jsonb_agg(sv ORDER BY sv->>'name'), '[]'::jsonb) INTO v_saved
    FROM (
      SELECT DISTINCT ON (ev.event_id) jsonb_build_object(
               'event_id', ev.event_id,
               'name', COALESCE(NULLIF(trim(e.display_name), ''), 'A couple'),
               'event_type', COALESCE(etv.label_en, e.event_type),
               'saved_at', ev.created_at
             ) AS sv
        FROM public.event_vendors ev
        JOIN public.events e ON e.event_id = ev.event_id
        LEFT JOIN public.event_type_vocab etv ON etv.event_type = e.event_type
       WHERE ev.marketplace_vendor_id = v_mvid
         AND ev.status IN ('considering', 'shortlisted')
         AND ev.lock_request_state IS NULL
         AND ev.archived_at IS NULL
         AND ev.event_id <> v_event_id
         AND e.event_date = v_date
         AND e.event_date_precision = 'day'
         AND NOT EXISTS (
           SELECT 1 FROM public.event_vendors ask
            WHERE ask.event_id = ev.event_id
              AND ask.marketplace_vendor_id = v_mvid
              AND ask.lock_request_state = 'pending'
              AND ask.archived_at IS NULL)
       ORDER BY ev.event_id, ev.created_at
       LIMIT 40
    ) z;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', v_event_id,
    'ask', v_state,
    'date', v_date,
    'verdict', v_verdict,
    'competing', COALESCE(v_competing, 0),
    'slot_full', v_slot_full,
    'daily_full', v_daily_full,
    'services', v_services,
    'booked', v_booked || v_outside,
    'asking', v_asking,
    'shortlisted', v_saved
  );
END;
$function$;

-- 6c · the bench (body VERBATIM from 20271269411264 but the `dcap` line).
CREATE OR REPLACE FUNCTION public.service_cards_unbookable_on(
  p_service_ids     uuid[],
  p_dates           date[],
  p_named_calendars boolean DEFAULT TRUE
)
RETURNS TABLE (service_id uuid, refused_on date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_service_ids IS NULL OR p_dates IS NULL
     OR cardinality(p_service_ids) = 0 OR cardinality(p_dates) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_service_ids) > 100 THEN
    RAISE EXCEPTION 'too_many_service_ids' USING ERRCODE = '22023',
      HINT = 'at most 100 service cards per call';
  END IF;
  IF cardinality(p_dates) > 31 THEN
    RAISE EXCEPTION 'too_many_dates' USING ERRCODE = '22023',
      HINT = 'at most 31 dates per call';
  END IF;

  RETURN QUERY
  WITH
  svc AS (
    SELECT s.vendor_service_id AS sid, s.vendor_profile_id AS vpid, s.category,
           public.service_card_daily_limit(s.vendor_service_id) AS dcap
      FROM public.vendor_services s
     WHERE s.vendor_service_id = ANY (p_service_ids)
  ),
  d AS (
    SELECT DISTINCT x.day FROM unnest(p_dates) AS x(day) WHERE x.day IS NOT NULL
  ),
  -- A card on halls is on exactly its halls (2026-10-14 🏛) — whatever the flag.
  hall AS (
    SELECT h.vendor_service_id AS sid, h.pool_id
      FROM public.vendor_service_halls h
     WHERE h.vendor_service_id IN (SELECT sid FROM svc)
  ),

  -- ── Pool resolution, read-only (see 20271221805341 header §3) ────────────
  wanted_category AS (
    SELECT svc.sid, svc.vpid, svc.category AS category_key
      FROM svc
      LEFT JOIN public.vendor_schedule_calendar_services cs
        ON cs.vendor_service_id = svc.sid
     WHERE svc.category IS NOT NULL AND length(svc.category) > 0
       AND (NOT p_named_calendars OR cs.pool_id IS NULL)
       AND NOT EXISTS (SELECT 1 FROM hall WHERE hall.sid = svc.sid)
    UNION
    SELECT svc.sid, svc.vpid, l.linked_canonical_service
      FROM svc
      JOIN public.vendor_service_links l ON l.vendor_service_id = svc.sid
     WHERE l.linked_canonical_service IS NOT NULL
       AND length(l.linked_canonical_service) > 0
  ),
  real_pool AS (
    SELECT hall.sid, hall.pool_id FROM hall
    UNION
    SELECT svc.sid, cs.pool_id
      FROM svc
      JOIN public.vendor_schedule_calendar_services cs ON cs.vendor_service_id = svc.sid
     WHERE p_named_calendars
       AND NOT EXISTS (SELECT 1 FROM hall WHERE hall.sid = svc.sid)
    UNION
    SELECT wc.sid, pc.pool_id
      FROM wanted_category wc
      JOIN public.vendor_schedule_pool_categories pc
        ON pc.vendor_profile_id = wc.vpid AND pc.category_key = wc.category_key
  ),
  virtual_pool_card AS (
    SELECT DISTINCT wc.sid, wc.vpid
      FROM wanted_category wc
     WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_schedule_pool_categories pc
        WHERE pc.vendor_profile_id = wc.vpid AND pc.category_key = wc.category_key)
  ),
  active_pool AS (
    SELECT rp.sid, p.pool_id, p.vendor_profile_id AS vpid, p.daily_booking_capacity AS cap
      FROM real_pool rp
      JOIN public.vendor_schedule_pools p ON p.pool_id = rp.pool_id
     WHERE p.is_active
  ),

  -- ── (a)+(a2) shop-wide: refuses every active pool, real or new ──────────
  shop_closed AS (
    SELECT DISTINCT c.vpid, d.day
      FROM (SELECT vpid FROM active_pool UNION SELECT vpid FROM virtual_pool_card) c
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_blocks b
              WHERE b.vendor_profile_id = c.vpid
                AND b.block_source IN ('manual', 'synced_calendar')
                AND b.pool_id IS NULL
                AND b.day_part = 'all_day'
                AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, d.day))
        OR EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = c.vpid
                AND ds.state_date = d.day
                AND ds.pool_id IS NULL
                AND ds.day_state = 'locked')
  ),

  -- ── (a)+(a2)+(b) per REAL active pool ───────────────────────────────────
  pool_refused AS (
    SELECT ap.sid, d.day
      FROM active_pool ap
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_blocks b
              WHERE b.vendor_profile_id = ap.vpid
                AND b.block_source IN ('manual', 'synced_calendar')
                AND (b.pool_id = ap.pool_id OR b.pool_id IS NULL)
                AND b.day_part = 'all_day'
                AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, d.day))
        OR EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = ap.vpid
                AND ds.state_date = d.day
                AND (ds.pool_id = ap.pool_id OR ds.pool_id IS NULL)
                AND ds.day_state = 'locked')
        OR (
             (SELECT count(*) FROM public.vendor_schedule_pool_bookings pb
               WHERE pb.pool_id = ap.pool_id
                 AND pb.booked_date = d.day
                 AND pb.released_at IS NULL)
           + (SELECT count(*) FROM public.vendor_calendar_blocks b
               WHERE b.pool_id = ap.pool_id
                 AND b.block_source = 'external_client'
                 AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, d.day))
           ) >= ap.cap
    UNION
    SELECT vp.sid, sc.day
      FROM virtual_pool_card vp
      JOIN shop_closed sc ON sc.vpid = vp.vpid
  ),

  -- ── SLOTS (every plan since 2026-10-14), per acquire_service_time_slot ──
  slot AS (
    SELECT t.slot_id, t.vendor_service_id AS sid, t.vendor_profile_id AS vpid, t.slot_capacity AS cap,
           t.start_time AS st, t.end_time AS et
      FROM public.vendor_service_time_slots t
     WHERE t.vendor_service_id IN (SELECT sid FROM svc)
       AND t.is_active
  ),
  slot_refused AS (
    SELECT sc.sid, d.day
      FROM (SELECT DISTINCT sid, vpid FROM slot) sc
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = sc.vpid
                AND ds.state_date = d.day
                AND ds.pool_id IS NULL
                AND ds.day_state = 'locked')
        OR NOT EXISTS (
             -- a slot with room that day, whose hours are not "Not available"
             SELECT 1 FROM slot sl
              WHERE sl.sid = sc.sid
                AND NOT public.calendar_blocks_refuse_slot(sl.sid, d.day, sl.st, sl.et)
                AND (SELECT count(*)
                       FROM public.event_vendors ev
                       JOIN public.events e ON e.event_id = ev.event_id
                      WHERE ev.service_time_slot_id = sl.slot_id
                        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
                        AND ev.archived_at IS NULL
                        AND e.event_date = d.day
                        AND e.event_date_precision = 'day') < sl.cap)
  ),

  -- ── PER-CARD DAILY LIMIT (#2), per vendors/actions.ts finalizeVendor ─────
  capacity_refused AS (
    SELECT svc.sid, d.day
      FROM svc
     CROSS JOIN d
     WHERE svc.dcap IS NOT NULL AND svc.dcap > 0
       AND NOT EXISTS (SELECT 1 FROM slot sl WHERE sl.sid = svc.sid)
       AND public.service_card_bookings_on(svc.sid, d.day) >= svc.dcap
  )

  SELECT r.sid, r.day FROM pool_refused r
  UNION
  SELECT r.sid, r.day FROM slot_refused r
  UNION
  SELECT r.sid, r.day FROM capacity_refused r;
END;
$function$;

REVOKE ALL ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) TO service_role;

-- ── 7 · the waitlist ceiling counts the bought places ────────────────────────
CREATE OR REPLACE FUNCTION public.clamp_vendor_waitlist_to_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled   BOOLEAN;
  v_cap       INT;
  v_touched   BOOLEAN;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  v_cap := public.vendor_tier_limit(NEW.tier_state::text, 'waitlist_acceptances');
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_cap = 0 THEN
    -- No waitlist on this plan AT ALL: not a number, a feature. Unconditional —
    -- grandfathering protects a number a supplier chose, never an allowance
    -- they have stopped paying for. The switch cannot be left on, and the
    -- number goes to 0 so nothing downstream reads a stale 1..3 and offers a
    -- CTA the vendor's plan does not include.
    NEW.waitlist_enabled := FALSE;
    NEW.max_waitlist_acceptances := 0;
    RETURN NEW;
  END IF;

  -- ULTRA ADD-ON (owner 2026-11-06, "ULTRA ADD-ON PRICES"): each paid "+1 wait list" raises the ceiling by one —
  -- Ultra only, AFTER the zero arm (an add-on raises a number, it never conjures a feature). Held under the column's
  -- own CHECK (0..10).
  IF NEW.tier_state::text = 'enterprise' THEN
    v_cap := LEAST(v_cap + GREATEST(COALESCE(NEW.extra_waitlist_acceptances, 0), 0), 10);
  END IF;

  -- GRANDFATHER: only bind the ceiling to a number somebody is actually
  -- setting. TG_OP='UPDATE' with the column untouched leaves an above-ceiling
  -- value exactly as the supplier chose it.
  v_touched := (TG_OP <> 'UPDATE')
    OR (NEW.max_waitlist_acceptances IS DISTINCT FROM OLD.max_waitlist_acceptances);
  IF NOT v_touched THEN
    RETURN NEW;
  END IF;

  IF NEW.max_waitlist_acceptances > v_cap THEN
    NEW.max_waitlist_acceptances := v_cap;
  ELSIF NEW.max_waitlist_acceptances < 1 THEN
    -- A plan that HAS a waitlist always accepts at least one.
    NEW.max_waitlist_acceptances := 1;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
