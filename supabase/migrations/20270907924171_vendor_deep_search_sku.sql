-- vendor_deep_search_sku
-- ============================================================================
-- Deep Search (vendor-facing) — a sellable, PER-USE metered add-on that lets a
-- PAID-tier (verified) vendor run the web-research "deep search" on their OWN
-- business and auto-fill their Setnayan profile from a "What We Learned" review.
-- It is the vendor-run version of the admin verification deep search
-- (apps/web/lib/vendor-deep-search.ts + 20270505500000_vendor_web_dossiers.sql);
-- it REUSES that same web-gatherer engine + the vendor_web_dossiers store.
--
-- Owner-locked 2026-07-22:
--   • ₱500 PER SEARCH, metered per use (NOT a subscription).
--   • Available to ALL PAID tiers (Solo / Pro / Enterprise / Custom), verified
--     only — NOT the free / verified-only tier.
--   • Pro / Enterprise / Custom get 1 FREE search per 28-day cycle, then ₱500
--     each. Solo pays ₱500 EVERY time (no free allowance).
--
-- The ₱0 FREE search is NOT a catalog row (vendor_billing_catalog has a
-- price_php > 0 CHECK) — it is expressed by a price RESOLVER that returns 0 for a
-- Pro+ vendor with 0 uses in the current cycle
-- (apps/web/lib/vendor-deep-search-addon.ts). The catalog carries only the
-- standing ₱500 per-search price.
--
-- THREE parts:
--   1. Extend vendor_billing_catalog `offering_type` + `vendor_billing_shape`
--      CHECKs to admit a PER-USE metered add-on (`vendor_addon_metered`),
--      following the same drop/recreate pattern as 20270907628470 (Photo
--      Challenge) — include EVERY prior value so existing rows keep validating.
--   2. Seed the admin-managed `vendor_deep_search` SKU (₱500).
--   3. Create the per-use USAGE LOG table `vendor_deep_search_uses` — how the
--      1-free-per-cycle allowance is COUNTED (RLS at CREATE TABLE: vendor-own
--      read via current_vendor_profile_ids(); admin all).
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / IF EXISTS everywhere,
-- ON CONFLICT DO UPDATE that never stomps an admin's price edit.
-- ============================================================================

BEGIN;

-- ── 1 · catalog: a 'vendor_addon_metered' offering_type ──────────────────────
-- Same drop+recreate pattern as 20270907628470. Include EVERY value currently
-- allowed (subscription_monthly/annual · token_pack · branch · seat ·
-- custom_addon · vendor_addon_recurring · vendor_addon_per_event) plus the new
-- 'vendor_addon_metered' so existing rows keep validating.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN (
    'subscription_monthly', 'subscription_annual', 'token_pack',
    'branch', 'seat', 'custom_addon', 'vendor_addon_recurring',
    'vendor_addon_per_event', 'vendor_addon_metered'
  ));

-- A 'vendor_addon_metered' row is shape-wise a subscription/branch/seat/
-- recurring/per-event add-on: no token grant (token_grant_count NULL) and no cap
-- columns. Add it to the non-token arm of the shape CHECK.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN (
       'subscription_monthly', 'subscription_annual', 'branch', 'seat',
       'custom_addon', 'vendor_addon_recurring', 'vendor_addon_per_event',
       'vendor_addon_metered'
     ) AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- ── 2 · seed the Deep Search add-on SKU · ₱500 / search (owner 2026-07-22) ────
-- display_order 84 sits right after the Photo Challenge add-on (83). price_php
-- intentionally NOT overwritten on conflict — once the row exists its price is
-- admin-managed at /admin/pricing. token_grant_count / max_* stay NULL (add-on shape).
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_deep_search', 'Deep Search (per search)', 500.00, 'vendor_addon_metered', NULL, NULL, NULL, 84)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

-- ── 3 · per-use usage log ────────────────────────────────────────────────────
-- One row per Deep Search a vendor runs — this is HOW the 1-free-per-cycle
-- allowance is counted: the app counts this vendor's rows with
-- used_at >= (current 28-day cycle start) and charges ₱0 only when a Pro+ vendor
-- has 0 uses in the window (Solo always pays). `was_free` records which side of
-- that line each run landed on. `order_id` links the paid (₱500) runs to their
-- apply-then-pay order; NULL for the free run. `dossier_id` links to the
-- resulting vendor_web_dossiers row so the vendor can re-open the "What We
-- Learned" review of their OWN searches (the admin verification dossiers about a
-- vendor have NO use row here, so this bridge never surfaces them to the vendor).
CREATE TABLE IF NOT EXISTS public.vendor_deep_search_uses (
  id                 BIGSERIAL PRIMARY KEY,
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  used_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- TRUE = this run consumed the free per-cycle allowance (₱0); FALSE = a paid
  -- ₱500 run (Solo, or a Pro+ vendor's 2nd+ run in the cycle).
  was_free           BOOLEAN NOT NULL,
  -- The paid order that funded a ₱500 run (audit trail; NULL for a free run;
  -- SET NULL if the order is later hard-deleted — the usage record stands).
  order_id           UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  -- The resulting dossier in vendor_web_dossiers (SET NULL if that row is later
  -- removed — the usage/allowance record stands on its own).
  dossier_id         BIGINT REFERENCES public.vendor_web_dossiers(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.vendor_deep_search_uses IS
  'Deep Search (owner 2026-07-22): one row per vendor-run web-research deep search. ₱500/search; Pro+ get 1 free per 28-day cycle (was_free=true), Solo always pays. The COUNT of a vendor''s rows since the current cycle start is what the price resolver reads to decide free vs ₱500. Written by the run action (free) + the sku-activation hook on payment approval (paid).';

CREATE INDEX IF NOT EXISTS vendor_deep_search_uses_vendor_idx
  ON public.vendor_deep_search_uses(vendor_profile_id, used_at DESC);

-- At most ONE usage row per paid order — so a rare re-run of the approval hook
-- (idempotency backstop) can never double-count a ₱500 order against the
-- allowance. Partial (WHERE order_id IS NOT NULL) so the many free runs, which
-- carry order_id = NULL, are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_deep_search_uses_order_uidx
  ON public.vendor_deep_search_uses(order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.vendor_deep_search_uses ENABLE ROW LEVEL SECURITY;

-- The vendor org reads its OWN usage rows (so the Deep Search surface can show
-- "1 free this cycle / ₱500", the run history, and re-open past dossiers).
DROP POLICY IF EXISTS vendor_deep_search_uses_vendor_read
  ON public.vendor_deep_search_uses;
CREATE POLICY vendor_deep_search_uses_vendor_read
  ON public.vendor_deep_search_uses
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Writes come only from the admin-client run/activation paths (RLS-bypassed) —
-- there is no vendor INSERT/UPDATE policy (a vendor can never mint its own free
-- allowance row). Admins may read/write for support + reconciliation.
DROP POLICY IF EXISTS vendor_deep_search_uses_admin_all
  ON public.vendor_deep_search_uses;
CREATE POLICY vendor_deep_search_uses_admin_all
  ON public.vendor_deep_search_uses
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, price_php, offering_type, display_order
--   FROM vendor_billing_catalog WHERE sku_code = 'vendor_deep_search';
-- -- Expected: vendor_deep_search · 500.00 · vendor_addon_metered · 84
--
-- SELECT to_regclass('public.vendor_deep_search_uses');
-- -- Expected: a non-null relation.
-- ============================================================================
