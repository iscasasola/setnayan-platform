-- vendor extra seat addon (prefix allocated by scripts/new-migration.mjs)
-- Enterprise extra team seats — a paid add-on beyond the base 10 seats.
--
-- Owner 2026-07-02: the vendor team-seat ladder is Free 0 · Verified 0 · Solo 1
-- · Pro 3 · Enterprise 10 (invitable teammates on top of the always-free founding
-- admin). Enterprise can buy MORE seats at ₱250 / 28-day EACH, and those extra
-- seats FOLD INTO the Enterprise renewal (base + N × ₱250 in one order) rather
-- than each carrying its own subscription. So the paid quantity is a persistent
-- count on the vendor profile, NOT a per-seat order with its own window (that is
-- how `vendor_additional_branch` works — deliberately different here).
--
-- This migration is the SUBSTRATE (PR-A): the admin-managed price SKU, the
-- persistent count, and the member-deactivation column PR-B needs to enforce
-- "admin picks who to drop" on downgrade/lapse. It changes no behaviour on its
-- own — extra_agent_seats defaults 0, so effective cap = base cap until a seat
-- add-on order is approved (the app-layer buy flow + activation hook ship in the
-- same PR; the renewal-fold + downgrade reconcile land in PR-B).
--
-- Re-implements the content of the superseded/stale PR #2623
-- (branch vendor-extra-seat-addon) on a fresh migration prefix.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / IF EXISTS everywhere,
-- ON CONFLICT DO UPDATE that never stomps an admin's price edit.
-- =============================================================================

BEGIN;

-- ── 1 · catalog: a 'seat' offering_type + the ₱250 admin-managed SKU ─────────
-- Same drop+recreate pattern as 20270128654206 added 'branch'. Include EVERY
-- value currently allowed (subscription_monthly/annual · token_pack · branch)
-- plus the new 'seat' so existing rows keep validating.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN ('subscription_monthly', 'subscription_annual', 'token_pack', 'branch', 'seat'));

-- A 'seat' row behaves like a subscription/branch shape-wise: token_grant_count
-- NULL. max_sub_seats CARRIES the number of seats one purchase grants (1), so
-- the app can read the unit without a code literal; max_categories stays NULL.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN ('subscription_monthly', 'subscription_annual', 'branch', 'seat') AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- Seed the Extra-Team-Seat fee · ₱250 / 28-day (owner-locked 2026-07-02 · now
-- admin-editable at /admin/pricing). display_order 81 sits right after the
-- Additional-Branch row (80). price_php intentionally NOT overwritten on
-- conflict — once the row exists its price is admin-managed.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_extra_seat', 'Extra Team Seat (28-day)', 250.00, 'seat', NULL, NULL, 1, 81)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();

-- ── 2 · persistent paid-seat count on the vendor profile ─────────────────────
-- Effective team-seat cap = tierCaps(tier).agentAccounts + extra_agent_seats.
-- Only ever > 0 for Enterprise/Custom (the buy flow is gated). Incremented by
-- the sku-activation hook when a `vendor_extra_seat__{id}` order is approved.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS extra_agent_seats INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_extra_agent_seats_nonneg'
  ) THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_extra_agent_seats_nonneg CHECK (extra_agent_seats >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_profiles.extra_agent_seats IS
  'Paid extra team seats beyond the tier''s base agentAccounts cap (Enterprise ₱250/28d add-on, owner 2026-07-02). Incremented on vendor_extra_seat order approval; re-billed at Enterprise renewal (PR-B). effective seat cap = base + this.';

-- ── 3 · member deactivation (for PR-B "admin picks who to drop" on lapse) ─────
-- Inert until PR-B: a deactivated member is soft-locked (kept as a row so the
-- admin can reactivate by paying) rather than deleted. NULL = active.
ALTER TABLE public.vendor_team_members
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_team_members.deactivated_at IS
  'When set, this member is soft-locked (over the paid seat cap after an Enterprise downgrade/non-renewal — admin chose to drop them). NULL = active. Reactivate by clearing when seats are repurchased (PR-B).';

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, price_php, offering_type, max_sub_seats, display_order
--   FROM vendor_billing_catalog WHERE sku_code = 'vendor_extra_seat';
-- -- Expected: vendor_extra_seat · 250.00 · seat · 1 · 81
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'vendor_profiles' AND column_name = 'extra_agent_seats';
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'vendor_team_members' AND column_name = 'deactivated_at';
-- =============================================================================
