-- vendor custom tier and plans (prefix allocated by scripts/new-migration.mjs)
-- The negotiated "Custom" vendor tier that sits above Enterprise (owner-signed
-- rate card · VENDOR_TIERS_AND_BENEFITS.md §11).
--
-- Custom runs as Enterprise automatically (all Enterprise feature/boolean caps),
-- with the numeric ceilings raised per an ACTIVE composed plan: base ₱8,999/28d
-- gets everything in Enterprise + white-glove, main address + 100 km reach + 10
-- seats + 8 slots/category + 300 photos. Above that the vendor composes add-ons
-- (branches · reach · seats · slots · photos · included tokens · custom domain),
-- each an admin-managed per-unit price in vendor_billing_catalog; the composed
-- 28-day total is quoted per-plan (see lib/vendor-custom-pricing.ts) and stored
-- on vendor_custom_plans.
--
-- This migration:
--   1. Extends the vendor_tier_state ENUM with 'custom' (ALTER TYPE cannot run
--      in a txn block — kept OUTSIDE the BEGIN/COMMIT below, mirroring the Solo
--      migration 20270221294989).
--   2. Extends vendor_billing_catalog with a 'custom_addon' offering_type + the
--      per-unit composition SKUs (admin-managed prices; never hardcoded in app).
--   3. Creates vendor_custom_plans (composed plan drafts/quotes/active), RLS AT
--      CREATE TABLE TIME (owner+admin via current_vendor_profile_ids()/is_admin,
--      the exact pattern vendor_branches uses).
--
-- KEEP IDEMPOTENT: ADD VALUE IF NOT EXISTS · IF NOT EXISTS · ON CONFLICT DO
-- UPDATE that never stomps an admin's price edit · DROP POLICY IF EXISTS first.
-- =============================================================================

-- ── 1 · Extend the tier ENUM (must run outside a transaction block) ──────────
ALTER TYPE public.vendor_tier_state ADD VALUE IF NOT EXISTS 'custom' AFTER 'enterprise';

BEGIN;

-- ── 2 · catalog: a 'custom_addon' offering_type + the composition SKUs ────────
-- Same drop+recreate pattern as prior offering_type extensions. Include EVERY
-- value currently allowed (subscription_monthly/annual · token_pack · branch ·
-- seat) plus 'custom_addon' so existing rows keep validating. A custom_addon row
-- is subscription-shaped: token_grant_count NULL (its "included tokens" SKU is a
-- flat per-token face-value line, NOT a token_pack grant).
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN (
    'subscription_monthly', 'subscription_annual', 'token_pack', 'branch', 'seat', 'custom_addon'
  ));

ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN (
       'subscription_monthly', 'subscription_annual', 'branch', 'seat', 'custom_addon'
     ) AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- Seed the Custom rate-card SKUs (owner-signed 2026-07-04 · VENDOR_TIERS §11).
-- Prices below are the INITIAL admin-managed values; once a row exists its
-- price_php is NOT overwritten on conflict (admin edits at /admin/pricing win).
-- display_order 90+ sits after the branch (80) / seat (81) add-ons. The app
-- ALWAYS reads these via the catalog (lib/vendor-custom-catalog.ts) — never a
-- hardcoded literal (the pricing lib takes unit prices as an argument).
--
-- Note: the "additional branch" unit reuses the existing `vendor_additional_branch`
-- SKU (₱999, seeded by 20270128654206) — no duplicate row here.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_custom_base',            'Custom Tier — Base (28-day)',           8999.00, 'custom_addon', NULL, NULL, NULL, 90),
  ('vendor_custom_reach_step',      'Custom — Reach +100 km (28-day)',        499.00, 'custom_addon', NULL, NULL, NULL, 91),
  ('vendor_custom_reach_nationwide','Custom — Nationwide Reach (28-day)',    2499.00, 'custom_addon', NULL, NULL, NULL, 92),
  ('vendor_custom_event_slot',      'Custom — +1 Event Slot / category (28-day)', 499.00, 'custom_addon', NULL, NULL, NULL, 93),
  ('vendor_custom_photo_pack',      'Custom — +100 Portfolio Photos (28-day)',  99.00, 'custom_addon', NULL, NULL, NULL, 94),
  ('vendor_custom_included_token',  'Custom — Included Token (per cycle)',      100.00, 'custom_addon', NULL, NULL, NULL, 95),
  ('vendor_custom_domain',          'Custom — Custom Domain (28-day)',          499.00, 'custom_addon', NULL, NULL, NULL, 96)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

-- ── 3 · vendor_custom_plans — composed plan drafts / quotes / active ─────────
-- One row per composed Custom plan for a vendor org (vendor_profiles is the org
-- unit; multi-admin governance already lives there). composition is the exact
-- knob set the pricing lib quotes from; quoted_28d_php stores the charm-rounded
-- 28-day total in PHP (same unit as vendor_billing_catalog.price_php). status
-- walks draft → quoted → pending_payment → active (or rejected / lapsed).
CREATE TABLE IF NOT EXISTS public.vendor_custom_plans (
  custom_plan_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- {branches, reachKm|nationwide, seats, slotsPerCategory, photos, tokensPerCycle, domain}
  composition        JSONB NOT NULL DEFAULT '{}'::jsonb,
  discount_type      TEXT NULL CHECK (discount_type IS NULL OR discount_type IN ('amount', 'percent')),
  discount_value     NUMERIC(12, 2) NULL CHECK (discount_value IS NULL OR discount_value >= 0),
  -- Charm-rounded 28-day total (PHP), NULL until quoted. Same unit as catalog.
  quoted_28d_php     NUMERIC(12, 2) NULL CHECK (quoted_28d_php IS NULL OR quoted_28d_php >= 0),
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'quoted', 'pending_payment', 'active', 'rejected', 'lapsed')),
  created_by         UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_custom_plans_vendor_idx
  ON public.vendor_custom_plans (vendor_profile_id, status);

-- At most one ACTIVE plan per vendor org (the effective-caps overlay reads it).
CREATE UNIQUE INDEX IF NOT EXISTS vendor_custom_plans_one_active_idx
  ON public.vendor_custom_plans (vendor_profile_id)
  WHERE status = 'active';

COMMENT ON TABLE public.vendor_custom_plans IS
  'Composed Custom-tier plans (owner-signed rate card · VENDOR_TIERS_AND_BENEFITS.md §11). composition holds the knob set {branches, reachKm|nationwide, seats, slotsPerCategory, photos, tokensPerCycle, domain}; quoted_28d_php is the charm-rounded 28-day total in PHP. status: draft→quoted→pending_payment→active (or rejected/lapsed). An ACTIVE row overlays the ''custom'' tier caps (lib/vendor-effective-caps.ts). At most one active plan per vendor.';

-- RLS AT CREATE TABLE TIME (same migration) — copies vendor_branches exactly:
-- owner+admin of the vendor org manage; Setnayan admin reads all.
ALTER TABLE public.vendor_custom_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_custom_plans_vendor_access ON public.vendor_custom_plans;
CREATE POLICY vendor_custom_plans_vendor_access
  ON public.vendor_custom_plans FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_custom_plans_admin_all ON public.vendor_custom_plans;
CREATE POLICY vendor_custom_plans_admin_all
  ON public.vendor_custom_plans FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = 'public.vendor_tier_state'::regtype ORDER BY enumsortorder;
-- -- expect: … enterprise, custom
--
-- SELECT sku_code, price_php, offering_type, display_order
--   FROM vendor_billing_catalog WHERE offering_type = 'custom_addon' ORDER BY display_order;
--
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.vendor_custom_plans'::regclass;
-- =============================================================================
