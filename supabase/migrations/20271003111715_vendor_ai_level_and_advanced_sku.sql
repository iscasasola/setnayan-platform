-- vendor_ai_level_and_advanced_sku
-- ============================================================================
-- Vendor AI (the AI Chatbot) — BASIC / ADVANCED ladder · SCHEMA ONLY.
-- Owner-locked 2026-07-25 vendor monetization model. Prices live in the code
-- SSOT (apps/web/lib/vendor-addon-tier-pricing.ts):
--     ai_chatbot_basic     entry ₱2,000 · growth ₱1,500   (per 28-day cycle)
--     ai_chatbot_advanced  entry ₱3,000 · growth ₱2,500   (per 28-day cycle)
--
-- The CAPABILITY line is NOT invented here — it already exists in the corpus at
-- Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md § 8 and is already mirrored
-- in the shipped auto-reply schema (20270822679405):
--     BASIC    = the "Free (all tiers)" column — deterministic front desk,
--                neutral house-voice templates, handoff, ~30/day cap, reply log.
--     ADVANCED = the "Pro/Enterprise" column, i.e. vendor_bot_config.mode='smart'
--                — voice-match (voice_profile), natural phrasing
--                (vendor_reply_templates, PRECOMPUTED so per-reply cost stays ₱0),
--                reply_in_couple_language, lead analytics, higher cap.
--
-- ── SHAPE (constraint-driven — do not "improve") ────────────────────────────
--   • ONE entitlement window. Both variants stack into the EXISTING
--     vendor_profiles.ai_addon_expires_at. A per-variant expiry column would NOT
--     typecheck: apps/web/lib/sku-activation.ts hardcodes the union
--     `expiryColumn: 'ai_addon_expires_at' | 'booth_addon_expires_at'`.
--   • The LEVEL is a SEPARATE, SERVER-WRITTEN marker (§1). It is deliberately NOT
--     vendor_bot_config.mode — that column is VENDOR-WRITABLE under policy
--     vendor_bot_config_write (20270822679405:36-40), so it is a PREFERENCE that
--     must be GATED BY the entitlement, never used AS the entitlement.
--   • The new SKU code starts with 'vendor_' — REQUIRED: lib/orders.ts
--     isVatInclusiveServiceKey keys off that prefix, and without it the admin
--     payment shortfall guard strands every order. (The shipped `booth_studio`
--     seed violates this — it is NOT the template; 20270907924171 is.)
--
-- ⚠ SHIP ORDER: this migration lands and is VERIFIED APPLIED before any app code
--   NAMES ai_addon_level. PostgREST answers an unknown column with 42703 and
--   nulls the WHOLE row, not one field — so code-ahead-of-schema would blank
--   vendor reads fleet-wide. Verification queries at the foot of this file.
--
-- KEEP IDEMPOTENT: IF NOT EXISTS everywhere; the catalog upsert never stomps
-- price_php or is_active (both admin-managed at /admin/pricing) so a re-apply can
-- never re-lock a SKU the owner switched on.
-- ============================================================================

BEGIN;

-- ── 1 · the SERVER-WRITTEN level marker on the ONE entitlement window ────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS ai_addon_level TEXT;

UPDATE public.vendor_profiles
   SET ai_addon_level = 'basic'
 WHERE ai_addon_level IS NULL;

ALTER TABLE public.vendor_profiles ALTER COLUMN ai_addon_level SET DEFAULT 'basic';
ALTER TABLE public.vendor_profiles ALTER COLUMN ai_addon_level SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_profiles_ai_addon_level_check'
       AND conrelid = 'public.vendor_profiles'::regclass
  ) THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_ai_addon_level_check
      CHECK (ai_addon_level IN ('basic', 'advanced'));
  END IF;
END$$;

COMMENT ON COLUMN public.vendor_profiles.ai_addon_level IS
  'Vendor AI ladder (owner 2026-07-25): which LEVEL the vendor''s single AI add-on window (ai_addon_expires_at) currently grants — ''basic'' or ''advanced''. SERVER-WRITTEN ONLY: stamped by the paid-order activation hook (lib/sku-activation.ts) and the free-first-cycle claim (ai-addon-actions.ts), both on the service-role client, and blocked for vendor self-writes by trg_guard_vendor_profiles_entitlement. NOT vendor_bot_config.mode — that is a vendor-writable PREFERENCE, never an entitlement. Defaults to ''basic'' (least privilege); reading code must also default ''basic''. Lapse is automatic at read time via ai_addon_expires_at — no cron.';

-- ── 2 · seed the ADVANCED SKU · INACTIVE on purpose ─────────────────────────
-- display_order 85 continues the add-on block (80 branch · 82 AI · 83 Photo
-- Challenge · 84 Deep Search). Seeded at 3000.00 = the ENTRY (Free/Solo) band —
-- the HIGHER of the two figures, so a catalog fallback can never under-charge.
--
-- is_active = FALSE is the launch switch: every ADVANCED capability is still
-- UNBUILT, so nothing may be sold yet. Shape copied from 20270907924171 (the
-- good precedent), which the vendor_billing_shape CHECK already admits for
-- offering_type='vendor_addon_recurring' with token_grant_count IS NULL.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, is_active, display_order)
VALUES
  ('vendor_ai_addon_advanced', 'Vendor AI — AI Chatbot Advanced (28-day)', 3000.00, 'vendor_addon_recurring', NULL, NULL, NULL, FALSE, 85)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php AND is_active intentionally NOT overwritten: both admin-managed,
  -- and is_active is the launch switch. A re-applied migration must never
  -- re-lock a SKU the owner has turned on.

-- Rename the existing flat row to its ladder name (price untouched).
UPDATE public.vendor_billing_catalog
   SET title = 'Vendor AI — AI Chatbot Basic (28-day)', updated_at = NOW()
 WHERE sku_code = 'vendor_ai_addon'
   AND title IS DISTINCT FROM 'Vendor AI — AI Chatbot Basic (28-day)';

-- ── 3 · the level marker joins the self-grant guard ─────────────────────────
-- vendor_profiles carries a FOR ALL owner policy with no column scoping
-- (20260513120000:62-67) and Postgres RLS is row-level only, so EVERY paid
-- column needs an explicit check here or it is vendor-writable through
-- PostgREST. 20271002456914 added the four add-on window/trial columns; this
-- adds the new level marker, so a vendor cannot self-promote to 'advanced'.
--
-- Written DROP-TOLERANT: ai_addon_level is read through to_jsonb(NEW/OLD) rather
-- than NEW.<col>, so if the column is ever dropped this function degrades to a
-- no-op on that field instead of raising on every vendor_profiles write.
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
         OR NEW.ai_addon_expires_at IS NOT NULL
         OR NEW.ai_addon_trial_used_at IS NOT NULL
         OR NEW.booth_addon_expires_at IS NOT NULL
         OR NEW.booth_addon_trial_used_at IS NOT NULL
         OR (new_level IS NOT NULL AND new_level <> 'basic')
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on entitlement columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seat and paid add-on changes go through the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      IF NEW.tier_state IS DISTINCT FROM OLD.tier_state
         OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at
         OR NEW.extra_agent_seats IS DISTINCT FROM OLD.extra_agent_seats
         OR NEW.ai_addon_expires_at IS DISTINCT FROM OLD.ai_addon_expires_at
         OR NEW.ai_addon_trial_used_at IS DISTINCT FROM OLD.ai_addon_trial_used_at
         OR NEW.booth_addon_expires_at IS DISTINCT FROM OLD.booth_addon_expires_at
         OR NEW.booth_addon_trial_used_at IS DISTINCT FROM OLD.booth_addon_trial_used_at
         OR new_level IS DISTINCT FROM old_level
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on entitlement columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seat and paid add-on changes go through the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_vendor_profiles_entitlement() IS
  'Self-grant guard for public.vendor_profiles. RLS is row-level only and vendor_profiles_owner is FOR ALL with no column scoping, so every PAID column needs an explicit trigger check here. Guards: tier_state, tier_expires_at, extra_agent_seats (20270920020000) + ai_addon_expires_at, ai_addon_trial_used_at, booth_addon_expires_at, booth_addon_trial_used_at (20271002456914) + ai_addon_level (20271003111715). ⚠ ADD EVERY NEW PAID ENTITLEMENT COLUMN HERE — an unguarded one is vendor-writable through PostgREST the day it ships.';

COMMIT;

-- ============================================================================
-- VERIFICATION — run all three before shipping the code half (PR-B).
--
--   SELECT sku_code, price_php, offering_type, is_active, display_order
--     FROM public.vendor_billing_catalog WHERE sku_code LIKE 'vendor_ai_addon%';
--   -- expect: vendor_ai_addon 1500.00 vendor_addon_recurring t 82
--   --         vendor_ai_addon_advanced 3000.00 vendor_addon_recurring f 85
--
--   SELECT ai_addon_level, count(*) FROM public.vendor_profiles GROUP BY 1;
--   -- expect exactly one row: basic | <every vendor>
--
--   SELECT count(*) FROM public.vendor_profiles
--    WHERE ai_addon_expires_at > now() AND ai_addon_level <> 'basic';
--   -- expect 0 (no live window was silently promoted)
-- ============================================================================
