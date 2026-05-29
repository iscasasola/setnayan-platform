-- =============================================================================
-- 20260530010000_iteration_0006_v2_1_amendment_2.sql
-- V2.1 brief amendment #2 · vendor matrix from owner screenshot adopted as
-- canonical (locked 2026-05-30 per CLAUDE.md row "🔒 V2.1 BRIEF AMENDMENT #2
-- LOCKED").
--
-- WHY (full rationale in CLAUDE.md 2026-05-30 row § 1-7):
--
-- (a) Pro 28-day prepaid block ₱1,999/mo → ₱2,499/28-day (CLAUDE.md eighth
--     2026-05-28 row's bump reinstated · matrix row 7 of owner screenshot ·
--     cadence correction per owner verbatim "2,499/28 days and not 1 month").
--     Enterprise ₱5,499/28-day price unchanged · cadence label confirmed.
--
-- (b) Pro Annual ₱19,999/yr → ₱24,999/yr (CLAUDE.md 2026-05-30 row § 4).
--     With 28-day cycles × 13 = ₱32,487/yr sticker · ₱19,999 = ~38% off (too
--     steep) · ₱24,999 = ~23% off symmetric with Enterprise Annual ~23%
--     off ₱71,487 sticker. Enterprise Annual stays at ₱54,999 unchanged.
--     Eleventh 2026-05-28 row's first amendment hereby superseded for the Pro
--     Annual price field only.
--
-- (c) Add Branch SKU ₱999/28-day for Pro+/Enterprise (CLAUDE.md eighth
--     2026-05-28 row reinstated · matrix rightmost column row 7 "Add Branch
--     + 999/month (for pro and enterprise only)" · cadence corrected to
--     28-day per § 1(a) above). Multi-purchase. Tier gate enforced in app
--     layer (NOT DB CHECK since tier_state can flip).
--
-- (d) Boosters surface reinstated (matrix rightmost column · 5 token-spend
--     rows · 4 Bidding Tokens Radius boost · 10 Packages · 25 Chat · 50
--     Video Call · 100 Scheduling · 7-day rolling activation each ·
--     CLAUDE.md eighth 2026-05-28 row reinstated). New table
--     `vendor_token_boosters` tracks active + expired states per vendor.
--
-- (e) Hybrid-anonymity reveal mechanic for Free + Verified vendors (NEW · not
--     in v2.1 brief OR any prior decision-log row · matrix row 7 column
--     header "Screen Vendor Name until Vendor Replies to Customer").
--     Business name HIDDEN in marketplace + browse + microsite until vendor
--     sends their FIRST chat reply to any customer · upon first reply,
--     reveals GLOBALLY (everywhere from then on · for ALL customers + ALL
--     browse + ALL future threads · NOT per-customer · NOT per-thread).
--     Pro + Enterprise retain full name visibility from day 1 unchanged
--     (handled via app-layer OR derivation against subscription state).
--
-- (f) vendor_branches table lands pre-pilot per § 6(f) so engineering surface
--     can iterate without re-migration · sub-account ops UX deferred to V1.x
--     per § 7 deferrals.
--
-- Pilot 2026-06-01 unaffected · all schema additions are additive · monthly
-- subs continue working exactly as before with updated price labels.
--
-- Trigger pragmatic note: Per CLAUDE.md row § 6(e) the canonical trigger
-- specification gates on `tier_state IN ('free','verified')` but the
-- `tier_state` column was never shipped (the 7th 2026-05-28 row lead-broker
-- pivot introduced the design but was retired by the tenth row v2.1 brief
-- lock). The current shipped state uses `verification_state` for the
-- Free vs Verified distinction · Pro/Enterprise are subscription-based
-- and live in app-layer state. The trigger here unconditionally fires on
-- first vendor reply gated only by `name_revealed_at IS NULL` (idempotent
-- gate) · the spec's tier_state pre-filter was a performance optimization
-- to skip pointless UPDATEs for Pro+ vendors · functionally harmless to
-- skip because (1) the column flip is itself idempotent and (2) the app
-- layer's `is_name_revealed` derivation OR's with subscription state so
-- a Pro vendor whose name reveals via this trigger doesn't visibly change.
--
-- Cross-references: CLAUDE.md 2026-05-30 row § 1-7 · iteration 0006
-- Vendors Management + 0015 Main Website + 0019 Communications + 0022
-- Vendor Dashboard + 0026 BIR Tax Compliance + 0028 Email Notifications +
-- 0034 Payments and Cart.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- (1) Pro 28-day price flip ₱1,999 → ₱2,499 (vendor_billing_catalog row
--     `pro_vendor_monthly` · price_php is the canonical column · NUMERIC PHP
--     not centavos · title kept stable for app-layer label resolution).
-- ----------------------------------------------------------------------------

UPDATE public.vendor_billing_catalog
   SET price_php  = 2499.00,
       title      = 'Pro Vendor (28-day prepaid block)',
       updated_at = NOW()
 WHERE sku_code = 'pro_vendor_monthly';

-- Enterprise stays at 5499 (price unchanged) · update title to match
-- 28-day cadence per V2 publisher posture per CLAUDE.md third 2026-05-28
-- row · the `_monthly` suffix in sku_code is legacy nomenclature · app-
-- layer labels + BIR receipt line-item descriptions now read "28-day
-- prepaid block" per § 7(b)(c)(d)(h) marketing-surface + receipt work below.
UPDATE public.vendor_billing_catalog
   SET title      = 'Enterprise Vendor (28-day prepaid block)',
       updated_at = NOW()
 WHERE sku_code = 'enterprise_vendor_monthly';

-- ----------------------------------------------------------------------------
-- (2) Pro Annual price flip ₱19,999 → ₱24,999 (vendor_billing_catalog row
--     `pro_vendor_annual` · per CLAUDE.md 2026-05-30 row § 4 · ~23% off
--     ₱32,487 28-day × 13 sticker · symmetric with Enterprise Annual ~23%
--     off).
-- ----------------------------------------------------------------------------

UPDATE public.vendor_billing_catalog
   SET price_php  = 24999.00,
       title      = 'Pro Vendor (Annual · save 23%)',
       updated_at = NOW()
 WHERE sku_code = 'pro_vendor_annual';

-- Enterprise Annual stays at 54999 (no UPDATE needed) · per § 4 unchanged
-- from eleventh 2026-05-28 row's first v2.1 amendment.

-- ----------------------------------------------------------------------------
-- (3) Add Branch SKU at ₱999/28-day · multi-purchase · Pro+/Enterprise only
--     (gate enforced in app layer · see § 7 implementation note).
-- ----------------------------------------------------------------------------

INSERT INTO public.vendor_billing_catalog
  (sku_code,             title,                                    price_php,  offering_type,            token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_branch_28day', 'Additional Branch (28-day · per branch)', 999.00,    'subscription_monthly',   NULL,              NULL,           NULL,          80)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  price_php         = EXCLUDED.price_php,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();

-- offering_type 'subscription_monthly' is the closest existing CHECK constraint
-- value · the SKU is conceptually a 28-day prepaid recurring charge · the
-- max_categories/max_sub_seats NULL means no per-branch tier-cap (branch
-- inherits parent vendor's tier perks). Tier gate (Pro+/Enterprise only) is
-- enforced at purchase time in app layer · per CLAUDE.md 2026-05-30 row § 6(b):
-- "gated to vendor_profiles where tier_state IN ('pro','enterprise') (gate
-- enforced in app layer · NOT DB CHECK since tier_state can flip)".

-- ----------------------------------------------------------------------------
-- (4) vendor_token_boosters table — Boosters surface per matrix rightmost
--     column · 5 booster types · token-spend · 7-day rolling activation.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_token_boosters (
  booster_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  booster_type        TEXT NOT NULL CHECK (booster_type IN ('radius','packages','chat','video_call','scheduling')),
  tokens_spent        INT  NOT NULL CHECK (tokens_spent > 0),
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent stacked-same-booster · only ONE active booster of each type per
-- vendor at any given time. Vendor must wait for expiry OR explicitly expire
-- the active one before purchasing another of the same type. Multi-type
-- stacking (e.g., active Radius + active Video Call simultaneously) is OK.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_token_boosters_one_active_per_type
  ON public.vendor_token_boosters (vendor_profile_id, booster_type)
  WHERE status = 'active';

-- Index for vendor-side lookup (vendor's own active boosters).
CREATE INDEX IF NOT EXISTS vendor_token_boosters_vendor_idx
  ON public.vendor_token_boosters (vendor_profile_id, status, expires_at);

COMMENT ON TABLE public.vendor_token_boosters IS
  'Boosters surface per CLAUDE.md 2026-05-30 row § 1(d) + matrix rightmost column. Vendor spends tokens for 7-day temporary feature upgrades: 4 tokens Radius boost · 10 Packages boost · 25 Chat boost · 50 Video Call boost · 100 Scheduling boost. Activation 7-day rolling window each. Partial unique index prevents stacking the same booster type concurrently · multi-type stacking allowed. Status lazy-eval transition active→expired on read (no cron per [[reference_setnayan_cron_strategy]]).';

ALTER TABLE public.vendor_token_boosters ENABLE ROW LEVEL SECURITY;

-- Vendor reads + writes own boosters.
DROP POLICY IF EXISTS vendor_token_boosters_vendor_access ON public.vendor_token_boosters;
CREATE POLICY vendor_token_boosters_vendor_access
  ON public.vendor_token_boosters FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Admin reads all (audit + moderation surface).
DROP POLICY IF EXISTS vendor_token_boosters_admin_read ON public.vendor_token_boosters;
CREATE POLICY vendor_token_boosters_admin_read
  ON public.vendor_token_boosters FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- (5) vendor_profiles.name_revealed_at column — hybrid-anonymity canonical
--     reveal source-of-truth. NULL = name hidden in browse/microsite (for
--     Free + Verified tiers · Pro/Enterprise override via app-layer
--     subscription check). Timestamp = name globally revealed (everywhere
--     from then on · NOT per-customer · NOT per-thread).
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS name_revealed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.vendor_profiles.name_revealed_at IS
  'Hybrid-anonymity reveal mechanic per CLAUDE.md 2026-05-30 row § 1(d). NULL = business_name hidden in marketplace cards + microsite + browse results · render anonymized placeholder (taxonomy + city · e.g., "Manila Wedding Photographer") instead of business_name. Timestamp = name globally revealed (everywhere from then on · for ALL customers + ALL browse + ALL future threads · NOT per-customer · NOT per-thread). Set by trigger reveal_vendor_name_on_chat on first vendor chat reply (chat_messages INSERT WHERE sender_role=''vendor''). Pro + Enterprise vendors retain full name visibility from day 1 unchanged (handled via app-layer OR derivation against subscription state · is_name_revealed = subscription IN (''pro'',''enterprise'') OR name_revealed_at IS NOT NULL). Cross-ref: project_setnayan_vendor_hybrid_anonymity memory rule.';

-- ----------------------------------------------------------------------------
-- (6) reveal_vendor_name_on_first_reply() trigger function + trigger on
--     chat_messages · fires AFTER INSERT WHERE sender_role='vendor' AND
--     parent vendor's name_revealed_at IS NULL · idempotent (subsequent
--     replies are no-ops via the IS NULL gate).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reveal_vendor_name_on_first_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire on vendor-sender messages · NOT couple/coordinator.
  -- Cross-ref: chat_sender_role ENUM at 20260513130000_iteration_0019_communications.sql:43
  -- enum values: 'couple', 'vendor', 'coordinator'.
  IF NEW.sender_role = 'vendor' THEN
    -- Idempotent UPDATE · the WHERE clause gates on name_revealed_at IS NULL
    -- so subsequent vendor replies (after the first one that revealed) are
    -- no-ops. The trigger function is unconditional WRT tier_state per the
    -- migration header pragmatic note · app-layer OR derivation absorbs any
    -- harmless reveal-flip on a subscription-state-revealed Pro/Enterprise
    -- vendor.
    UPDATE public.vendor_profiles
       SET name_revealed_at = NOW()
     WHERE vendor_profile_id = NEW.vendor_profile_id
       AND name_revealed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reveal_vendor_name_on_first_reply() IS
  'Hybrid-anonymity reveal trigger function per CLAUDE.md 2026-05-30 row § 6(e). Fires on chat_messages INSERT · if sender_role=''vendor'' AND parent vendor''s name_revealed_at IS NULL · sets name_revealed_at = NOW(). Idempotent (IS NULL gate). Cross-ref: project_setnayan_vendor_hybrid_anonymity memory rule.';

DROP TRIGGER IF EXISTS reveal_vendor_name_on_chat ON public.chat_messages;
CREATE TRIGGER reveal_vendor_name_on_chat
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reveal_vendor_name_on_first_reply();

-- ----------------------------------------------------------------------------
-- (7) vendor_branches table — sub-account ops surface · pre-pilot table only ·
--     UI deferred to V1.x per CLAUDE.md 2026-05-30 row § 7 deferrals.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_branches (
  branch_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  branch_label               TEXT NOT NULL CHECK (length(branch_label) > 0 AND length(branch_label) <= 120),
  branch_city                TEXT NOT NULL CHECK (length(branch_city) > 0 AND length(branch_city) <= 120),
  branch_radius_km           INT  NOT NULL CHECK (branch_radius_km BETWEEN 1 AND 200),
  branch_subscription_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at               TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS vendor_branches_parent_idx
  ON public.vendor_branches (parent_vendor_profile_id, branch_subscription_active);

COMMENT ON TABLE public.vendor_branches IS
  'Add Branch sub-accounts per CLAUDE.md 2026-05-30 row § 1(c) + § 6(f). Each branch ₱999/28-day prepaid (vendor_branch_28day SKU). Pro+/Enterprise vendors only (tier gate enforced in app layer). Branch inherits parent vendor''s tier perks + portfolio + reviews + token wallet; has own branch_city + branch_radius_km + branch_subscription_active for sub-account ops. UI deferred to V1.x per § 7 deferrals · table lands pre-pilot so engineering surface can iterate without re-migration. Cross-ref: iteration 0022 Vendor Dashboard /vendor-dashboard/settings/branches V1.x surface.';

ALTER TABLE public.vendor_branches ENABLE ROW LEVEL SECURITY;

-- Vendor reads + writes own branches.
DROP POLICY IF EXISTS vendor_branches_vendor_access ON public.vendor_branches;
CREATE POLICY vendor_branches_vendor_access
  ON public.vendor_branches FOR ALL
  TO authenticated
  USING (parent_vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (parent_vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Admin reads all (audit + moderation surface).
DROP POLICY IF EXISTS vendor_branches_admin_read ON public.vendor_branches;
CREATE POLICY vendor_branches_admin_read
  ON public.vendor_branches FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- -- (1) Pro 28-day + Pro Annual price flip + Add Branch SKU:
-- SELECT sku_code, title, price_php, offering_type, display_order
--   FROM vendor_billing_catalog
--  WHERE sku_code IN ('pro_vendor_monthly', 'pro_vendor_annual', 'enterprise_vendor_monthly', 'enterprise_vendor_annual', 'vendor_branch_28day')
--  ORDER BY display_order;
-- -- Expected:
-- --  pro_vendor_monthly         · ₱2,499.00  · subscription_monthly · 10
-- --  pro_vendor_annual          · ₱24,999.00 · subscription_annual  · 15
-- --  enterprise_vendor_monthly  · ₱5,499.00  · subscription_monthly · 20
-- --  enterprise_vendor_annual   · ₱54,999.00 · subscription_annual  · 25
-- --  vendor_branch_28day        · ₱999.00    · subscription_monthly · 80
--
-- -- (2) vendor_token_boosters table + partial unique index + RLS:
-- \d public.vendor_token_boosters
-- SELECT indexname FROM pg_indexes WHERE tablename = 'vendor_token_boosters';
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.vendor_token_boosters'::regclass;
--
-- -- (3) vendor_profiles.name_revealed_at column added:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
--    AND column_name = 'name_revealed_at';
--
-- -- (4) reveal_vendor_name_on_chat trigger exists:
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.chat_messages'::regclass
--    AND tgname = 'reveal_vendor_name_on_chat';
--
-- -- (5) vendor_branches table + RLS:
-- \d public.vendor_branches
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.vendor_branches'::regclass;
-- =============================================================================
