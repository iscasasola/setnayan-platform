-- vendor_ai_addon_sku_and_trial
-- ============================================================================
-- Vendor AI ("the AI Chatbot") — a sellable, per-vendor-entitled add-on that
-- turns ON the existing (flag-dark) vendor Auto-Reply Assistant
-- (apps/web/lib/vendor-autoreply/*). Owner-locked 2026-07-22:
--
--   • FLAT ₱1,500 / 28-day add-on, available on ALL PAID tiers (solo/pro/
--     enterprise) — NOT free/verified.
--   • FREE for the vendor's FIRST 28-day cycle (one-time per account, on
--     activation + verification); ₱1,500 / cycle after that.
--   • The INBOX stays free — a vendor without the add-on still reads + replies
--     by hand. The ₱1,500 only buys the AI auto-answer.
--
-- This migration is the SUBSTRATE:
--   1. Extend the vendor_billing_catalog `offering_type` + `vendor_billing_shape`
--      CHECKs to admit a recurring vendor add-on (`vendor_addon_recurring`),
--      following the exact drop/recreate pattern used by 20270511762904
--      (extra seat) and 20270512705572 (custom tier).
--   2. Seed the admin-managed `vendor_ai_addon` SKU (₱1,500).
--   3. Add the per-account one-time trial marker + the entitlement window to
--      vendor_profiles.
--
-- The ₱0 FIRST cycle is NOT a catalog row (vendor_billing_catalog has a
-- price_php > 0 CHECK) — it is expressed by a price RESOLVER that returns 0
-- when the trial is unused (apps/web/lib/vendor-addon-pricing.ts). The catalog
-- carries only the standing ₱1,500 renewal price.
--
-- RLS: no new table. vendor_billing_catalog is public-select (admin-managed
-- writes); vendor_profiles already has RLS. So no new policy is needed.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / IF EXISTS everywhere,
-- ON CONFLICT DO UPDATE that never stomps an admin's price edit.
-- ============================================================================

BEGIN;

-- ── 1 · catalog: a 'vendor_addon_recurring' offering_type ────────────────────
-- Same drop+recreate pattern as 20270512705572. Include EVERY value currently
-- allowed (subscription_monthly/annual · token_pack · branch · seat ·
-- custom_addon) plus the new 'vendor_addon_recurring' so existing rows keep
-- validating.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN (
    'subscription_monthly', 'subscription_annual', 'token_pack',
    'branch', 'seat', 'custom_addon', 'vendor_addon_recurring'
  ));

-- A 'vendor_addon_recurring' row is shape-wise a subscription/branch/seat: it
-- carries no token grant (token_grant_count NULL) and no cap columns. Add it to
-- the non-token arm of the shape CHECK.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN (
       'subscription_monthly', 'subscription_annual', 'branch', 'seat',
       'custom_addon', 'vendor_addon_recurring'
     ) AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- ── 2 · seed the Vendor AI add-on SKU · ₱1,500 / 28-day (owner 2026-07-22) ────
-- display_order 82 sits right after the Additional-Branch (80) + Extra-Seat (81)
-- add-ons, before the Custom rate-card block (90+). price_php intentionally NOT
-- overwritten on conflict — once the row exists its price is admin-managed at
-- /admin/pricing. token_grant_count / max_* stay NULL (add-on shape).
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_ai_addon', 'Vendor AI — AI Chatbot (28-day)', 1500.00, 'vendor_addon_recurring', NULL, NULL, NULL, 82)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

-- ── 3 · per-vendor trial marker + entitlement window ─────────────────────────
-- ai_addon_trial_used_at — the ONE-TIME-per-account free-cycle marker. NULL =
-- the free first cycle is still available (price resolves to ₱0); once stamped,
-- every future cycle is the ₱1,500 renewal. The claim is made atomic in the
-- app layer via `UPDATE … WHERE ai_addon_trial_used_at IS NULL`.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS ai_addon_trial_used_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.ai_addon_trial_used_at IS
  'Vendor AI add-on (owner 2026-07-22): timestamp the ONE-TIME free first 28-day cycle was claimed. NULL = free cycle still available (resolveVendorAiAddonPricePhp returns 0); once set, every cycle is the ₱1,500 renewal. Claimed atomically (UPDATE … WHERE IS NULL).';

-- ai_addon_expires_at — the ACTIVE entitlement window end. The assistant runs
-- for this vendor only while now() < ai_addon_expires_at (checked at the
-- inbox-hook enablement boundary). Stamped now()+28d on activation (free cycle
-- direct-activate) or on paid-order approval (sku-activation hook, stacking from
-- the later of now / current expiry). NULL = never activated.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS ai_addon_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.ai_addon_expires_at IS
  'Vendor AI add-on (owner 2026-07-22): end of the active 28-day entitlement window. The Auto-Reply Assistant runs only while now() < this. Stamped on activation (free cycle) / paid-order approval; NULL = never activated. Lapse is automatic at read time — no cron.';

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, price_php, offering_type, display_order
--   FROM vendor_billing_catalog WHERE sku_code = 'vendor_ai_addon';
-- -- Expected: vendor_ai_addon · 1500.00 · vendor_addon_recurring · 82
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'vendor_profiles'
--    AND column_name IN ('ai_addon_trial_used_at', 'ai_addon_expires_at');
-- -- Expected: both rows present.
-- ============================================================================
