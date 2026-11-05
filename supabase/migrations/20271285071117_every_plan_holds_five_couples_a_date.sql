-- ============================================================================
-- 20271285071117_every_plan_holds_five_couples_a_date.sql
--
-- ⚖ PLANS PRICE REACH, NEVER INCOME — owner 2026-10-23 (DECISION_LOG), verbatim:
--   "their price differences is based on their type of business reach and not
--    their capability to maximize the app features that return us income. We
--    want everybody to be able to give us booking fee."
--
-- The couples-per-date ceiling (accepted-but-not-yet-locked customers a shop may
-- hold for ONE date, enforced by `enforce_vendor_whitelist_per_date`) is now the
-- SAME on every plan: 5. It was Free 1 · Verified 2 · Solo 3 · Pro 5 ·
-- Enterprise/Custom 10 (2026-08-09, verified retuned 2026-08-29).
--
-- ONE edit to shipped machinery: the `whitelist_per_date` arm of
-- `vendor_tier_limit`, copied from its LATEST definition
-- (20271180727490_the_plan_says_its_number.sql) with every tier — and the
-- unknown-tier ELSE — reading 5. The `waitlist_acceptances` arm is copied
-- VERBATIM (unchanged: the booked-out waitlist is a separate owner decision).
-- The Custom "no limit" axis (`vendor_pipeline_is_unlimited`) is untouched: the
-- trigger still asks it before this number.
--
-- GRANDFATHERED by construction: the trigger counts at the moment of a NEW
-- accept, so an Enterprise shop already holding more than 5 for a date keeps
-- every one of them; only the next accept on that date is refused.
--
-- Mirrors TIER_CAPS.*.whitelistPerDate (= WHITELIST_PER_DATE_ALL_PLANS) in
-- apps/web/lib/vendor-tier-caps.ts; tests/db/vendor-tier-pipeline-caps.db.test.ts
-- holds the two in step (it derives from the TypeScript side).
--
-- Still ship-dark at the database level exactly as before
-- (platform_settings.vendor_tier_pipeline_caps_enabled). Idempotent: CREATE OR
-- REPLACE only. No schema, RLS or grant change (vendor_tier_limit stays revoked
-- from anon/authenticated; CREATE OR REPLACE keeps the existing ACL).
-- ============================================================================

BEGIN;

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
        WHEN 'custom'     THEN 5   -- (was 10) — the ₱2,500 "no limit" axis still lifts it
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 1   -- owner 2026-08-29 (was 0, cloned from free)
        WHEN 'solo'       THEN 1
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 5
        WHEN 'custom'     THEN 5
        ELSE 0
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier pipeline limits. Keys: whitelist_per_date (accepted-but-not-yet-locked customers a vendor may hold for ONE date — 5 on EVERY plan since 2026-10-23, "plans price reach, not income"; was 1/2/3/5/10) · waitlist_acceptances (couples they may accept off the waitlist for one date; 2026-08-09, verified 2026-08-29). Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; the two are held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts, which derives from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

COMMIT;
