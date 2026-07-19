-- 20270511379088_bundle_components_single_source_table.sql
--
-- WHY (Entity Map & Hardcode Audit 2026-07-04 · Violation #2 · owner-directed):
-- "which component service_codes a bundle SKU grants" was maintained in THREE
-- hand-synced places — two app consts (BUNDLE_CHILD_SKUS in
-- apps/web/lib/entitlements.ts + BUNDLE_MEMBERS in the onboarding pricing file)
-- and the hardcoded VALUES list inside the DB fn public.bundles_granting_sku().
-- That triple already DRIFTED once: the PAPIC_UNLOCK umbrella (#2269) added its
-- 6 Papic children on the APP side but the DB fn's PAPIC_UNLOCK mirror was
-- flagged "still deferred", so a PAPIC_UNLOCK buyer passed the app gate for a
-- child SKU while the DB gate still answered "not owned" — the exact class of
-- bug that denied Papic buyers their bundle entitlement for ~a month.
--
-- FIX: make bundle composition ONE source both layers read.
--   1. public.bundle_components — (bundle_sku_code, component_service_code) with
--      real FKs to BOTH catalogs (platform_package_catalog.package_code +
--      platform_retail_catalog_v2.service_code). This is the single source.
--   2. Seed it from the CURRENT live composition (see the DIVERGENCE note below).
--   3. Re-declare bundles_granting_sku() to SELECT from the table instead of a
--      hardcoded VALUES list. papic_event_owns_service(), the pabati/panood
--      gates, and papic_provision_seats all call it dynamically, so the DB gate
--      converges on the table with no further change.
-- The app consts are demoted to a DB-first read (fetchBundleComponents) with the
-- const as the graceful-degrade FALLBACK (house pattern) — see entitlements.ts.
--
-- ── DIVERGENCE resolved at seed time (reported in the PR) ────────────────────
-- At audit time the three sources AGREED on GUIDED_PACK (7) and MEDIA_PACK (16)
-- once the LATEST migration defining the fn (20270319615897, Patiktok retire) is
-- taken as the DB truth. They DISAGREED on PAPIC_UNLOCK:
--     • app BUNDLE_CHILD_SKUS.PAPIC_UNLOCK = 7 (incl. PAPIC_GUEST)
--     • DB fn PAPIC_UNLOCK                 = 6 (MISSING PAPIC_GUEST)
-- We seed the APP shape (7 · PAPIC_GUEST INCLUDED) because that is the layer the
-- entitlement path the user actually experiences honors: the Papic surfaces gate
-- on the app eventSkuActive('PAPIC_GUEST') / eventHasPapicUnlock (which read
-- BUNDLE_CHILD_SKUS.PAPIC_UNLOCK ∋ PAPIC_GUEST), and the DB fn's own defining
-- migration explicitly flagged its PAPIC_UNLOCK mirror as "still deferred". So
-- converging the DB fn onto the app intent CLOSES the drift in the correct
-- direction: a PAPIC_UNLOCK buyer's guest-disposable-camera DB gate
-- (papic_record_guest_capture → papic_event_owns_service('PAPIC_GUEST')) now
-- agrees with the app UI instead of silently rejecting the capture.
--
-- Idempotent (IF NOT EXISTS · ON CONFLICT DO NOTHING · CREATE OR REPLACE).
-- Additive — GUIDED_PACK/MEDIA_PACK buyers are unaffected (those pairs are
-- byte-identical to the prior fn); the only behavior change is the DB gate now
-- also honors PAPIC_UNLOCK → PAPIC_GUEST, matching the app.
--
-- NOT AUTO-APPLIED. The orchestrator applies this after merge via the Supabase
-- MCP + a drift-ledger row (owner runs `supabase db push` / MCP apply_migration).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. bundle_components — the single source of bundle->child composition.
--    Real FKs to both catalogs so a typo'd or retired code can never seed, and a
--    catalog delete cascades the membership row away. RLS at CREATE-TABLE time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bundle_components (
  bundle_sku_code        TEXT NOT NULL
    REFERENCES public.platform_package_catalog (package_code) ON DELETE CASCADE,
  component_service_code TEXT NOT NULL
    REFERENCES public.platform_retail_catalog_v2 (service_code) ON DELETE CASCADE,
  PRIMARY KEY (bundle_sku_code, component_service_code)
);

COMMENT ON TABLE public.bundle_components IS
  'Single source of truth for bundle composition: which component service_codes each package SKU grants. Read DB-first by apps/web/lib/entitlements.ts (const BUNDLE_CHILD_SKUS is the graceful-degrade fallback) and by public.bundles_granting_sku(). Seeded 2026-07-04 from the audited live composition (Entity Map & Hardcode Audit Violation #2).';

-- Reverse-lookup index for bundles_granting_sku(child) — the fn filters on the
-- component code, so index it (the PK leads with bundle_sku_code).
CREATE INDEX IF NOT EXISTS bundle_components_component_idx
  ON public.bundle_components (component_service_code);

ALTER TABLE public.bundle_components ENABLE ROW LEVEL SECURITY;

-- Public read: bundle composition is not sensitive (it's the "what's included"
-- surface the customer sees when buying) and both anon + authenticated readers
-- resolve entitlement through it. No write policy -> only the service role /
-- migrations mutate it (admin-managed catalog data, same as the catalogs).
DROP POLICY IF EXISTS bundle_components_public_read ON public.bundle_components;
CREATE POLICY bundle_components_public_read
  ON public.bundle_components
  FOR SELECT
  USING (true);

GRANT SELECT ON public.bundle_components TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Seed the CURRENT live composition. ON CONFLICT DO NOTHING -> idempotent and
--    non-clobbering (a later admin edit to the table survives a re-run). The
--    catalog FKs guarantee every code below is a real, present catalog row
--    (verified 2026-07-04: all 3 bundle codes + all 17 distinct children exist).
-- ---------------------------------------------------------------------------
INSERT INTO public.bundle_components (bundle_sku_code, component_service_code)
VALUES
  -- GUIDED_PACK · Essentials (7) — agrees across all three prior sources.
  ('GUIDED_PACK', 'SETNAYAN_AI'),
  ('GUIDED_PACK', 'ANIMATED_MONOGRAM'),
  ('GUIDED_PACK', 'CUSTOM_QR_GUEST'),
  ('GUIDED_PACK', 'PRO_RSVP'),
  ('GUIDED_PACK', 'PAPIC_GUEST'),
  ('GUIDED_PACK', 'EVENT_WEBSITE'),
  ('GUIDED_PACK', 'PRO_WEBSITE'),
  -- MEDIA_PACK · Complete (16) — agrees across all three prior sources
  -- (SDE + PATIKTOK_COMPILER already removed by their retirement migrations).
  ('MEDIA_PACK', 'SETNAYAN_AI'),
  ('MEDIA_PACK', 'ANIMATED_MONOGRAM'),
  ('MEDIA_PACK', 'CUSTOM_QR_GUEST'),
  ('MEDIA_PACK', 'PRO_RSVP'),
  ('MEDIA_PACK', 'EVENT_WEBSITE'),
  ('MEDIA_PACK', 'PRO_WEBSITE'),
  ('MEDIA_PACK', 'PAPIC_GUEST'),
  ('MEDIA_PACK', 'PAPIC_ADDON_STORIES'),
  ('MEDIA_PACK', 'PAPIC_SEATS'),
  ('MEDIA_PACK', 'CAMERA_BRIDGE'),
  ('MEDIA_PACK', 'PABATI'),
  ('MEDIA_PACK', 'PAPIC_ADDON_THANK_YOU'),
  ('MEDIA_PACK', 'LIVE_WALL'),
  ('MEDIA_PACK', 'LIVE_BACKGROUND'),
  ('MEDIA_PACK', 'PANOOD_SYSTEM'),
  ('MEDIA_PACK', 'PAKANTA'),
  -- PAPIC_UNLOCK · "Unlock all of Papic" umbrella (7) — seeded from the APP
  -- shape (PAPIC_GUEST INCLUDED), which is the layer the entitlement path honors.
  -- This is the ONE row that CLOSES the audited drift: the old DB fn lacked it.
  ('PAPIC_UNLOCK', 'KWENTO'),
  ('PAPIC_UNLOCK', 'LIVE_WALL'),
  ('PAPIC_UNLOCK', 'PAPIC_ADDON_THANK_YOU'),
  ('PAPIC_UNLOCK', 'PAPIC_ADDON_STORIES'),
  ('PAPIC_UNLOCK', 'PABATI'),
  ('PAPIC_UNLOCK', 'CAMERA_BRIDGE'),
  ('PAPIC_UNLOCK', 'PAPIC_GUEST')
ON CONFLICT (bundle_sku_code, component_service_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Re-declare bundles_granting_sku(child) to SELECT from the table. Same
--    signature, same contract (returns TEXT[] · never NULL · sorted), so every
--    existing caller (papic_event_owns_service, the PABATI/PANOOD gates,
--    papic_provision_seats, RLS) is unaffected — they just now read the single
--    source. STABLE (not IMMUTABLE): it reads a table, so its result can change
--    between statements if an admin edits composition; STABLE is the correct
--    volatility for a table-reading SQL fn.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bundles_granting_sku(p_child TEXT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(bc.bundle_sku_code ORDER BY bc.bundle_sku_code),
    ARRAY[]::text[]
  )
  FROM public.bundle_components bc
  WHERE bc.component_service_code = p_child
$$;

COMMENT ON FUNCTION public.bundles_granting_sku(TEXT) IS
  'Bundle package_codes that grant the given child service_code. Reads public.bundle_components (the single source of bundle composition). Replaces the former hardcoded VALUES list — no longer keep-in-sync with app consts; the app now reads the same table DB-first (see entitlements.ts fetchBundleComponents).';

GRANT EXECUTE ON FUNCTION public.bundles_granting_sku(TEXT) TO authenticated, anon;

COMMIT;
