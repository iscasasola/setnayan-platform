-- 20270303150000_papic_unlock_bundle_granting_sku.sql
--
-- WHY (PAPIC_UNLOCK deferred-part follow-up · owner 2026-06-26): the "Unlock all
-- of Papic" umbrella bundle (PR #2269 · platform_package_catalog 'PAPIC_UNLOCK')
-- grants its 6 Papic add-ons on the APP side (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK in
-- apps/web/lib/entitlements.ts). But the DB-side mirror public.bundles_granting_sku()
-- — which backs public.papic_event_owns_service() (the DB gate behind
-- papic_provision_seats / the per-camera paths / RLS) — was NOT updated when the
-- umbrella shipped (#2269 flagged it deferred). So a PAPIC_UNLOCK buyer passed the
-- bundle-aware APP gate for a child SKU (e.g. CAMERA_BRIDGE) but the DB function
-- still answered "you don't own this", leaving the two layers disagreeing.
--
-- This migration closes that gap: it re-declares bundles_granting_sku() with the
-- SAME GUIDED_PACK / MEDIA_PACK pairs (verbatim from 20270103010000 — CREATE OR
-- REPLACE redefines the whole body, so they must be re-listed or they'd vanish)
-- PLUS the PAPIC_UNLOCK → 6-child pairs. papic_event_owns_service() already calls
-- bundles_granting_sku(p_service_key) dynamically, so replacing this function
-- alone makes the DB gate PAPIC_UNLOCK-aware with no further change.
--
-- ⚠ SOURCE OF TRUTH: the bundle→child membership below MIRRORS BUNDLE_CHILD_SKUS
-- in apps/web/lib/entitlements.ts (itself the mirror of BUNDLE_MEMBERS in
-- onboarding-pricing.ts). KEEP IN SYNC if bundle composition changes. The
-- lint:entitlement-gates Guard 2 enforces GUIDED_PACK/MEDIA_PACK sync against the
-- ORIGINAL *_papic_ownership_bundle_aware.sql file (this file deliberately does
-- NOT use that suffix so it never shadows the linter's source); PAPIC_UNLOCK pairs
-- are outside Guard 2's scope by design.
--
-- Idempotent (CREATE OR REPLACE). Additive — no data change; à-la-carte buyers and
-- GUIDED_PACK/MEDIA_PACK buyers are unaffected (their pairs are byte-identical to
-- 20270103010000). NOT AUTO-APPLIED: owner runs
-- `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

-- ---------------------------------------------------------------------------
-- bundles_granting_sku(child) → the bundle service_keys that grant `child`.
-- Re-declared with the GUIDED_PACK + MEDIA_PACK pairs verbatim from
-- 20270103010000, plus the PAPIC_UNLOCK → 6 Papic add-ons. Pure function of its
-- input → IMMUTABLE. Returns an empty array (never NULL) for a SKU no bundle
-- includes, so callers can safely `= ANY(...)` the result.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bundles_granting_sku(p_child TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(m.bundle_key ORDER BY m.bundle_key), ARRAY[]::text[])
  FROM (
    VALUES
      -- GUIDED_PACK · Essentials (BUNDLE_CHILD_SKUS.GUIDED_PACK · 7)
      ('GUIDED_PACK', 'SETNAYAN_AI'),
      ('GUIDED_PACK', 'ANIMATED_MONOGRAM'),
      ('GUIDED_PACK', 'CUSTOM_QR_GUEST'),
      ('GUIDED_PACK', 'PRO_RSVP'),
      ('GUIDED_PACK', 'PAPIC_GUEST'),
      ('GUIDED_PACK', 'EVENT_WEBSITE'),
      ('GUIDED_PACK', 'PRO_WEBSITE'),
      -- MEDIA_PACK · Complete (BUNDLE_CHILD_SKUS.MEDIA_PACK · 18)
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
      ('MEDIA_PACK', 'PATIKTOK_COMPILER'),
      ('MEDIA_PACK', 'PAPIC_ADDON_THANK_YOU'),
      ('MEDIA_PACK', 'SDE'),
      ('MEDIA_PACK', 'LIVE_WALL'),
      ('MEDIA_PACK', 'LIVE_BACKGROUND'),
      ('MEDIA_PACK', 'PANOOD_SYSTEM'),
      ('MEDIA_PACK', 'PAKANTA'),
      -- PAPIC_UNLOCK · "Unlock all of Papic" umbrella (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK · 6)
      ('PAPIC_UNLOCK', 'KWENTO'),
      ('PAPIC_UNLOCK', 'LIVE_WALL'),
      ('PAPIC_UNLOCK', 'PAPIC_ADDON_THANK_YOU'),
      ('PAPIC_UNLOCK', 'PAPIC_ADDON_STORIES'),
      ('PAPIC_UNLOCK', 'PABATI'),
      ('PAPIC_UNLOCK', 'CAMERA_BRIDGE')
  ) AS m(bundle_key, child_key)
  WHERE m.child_key = p_child
$$;

COMMENT ON FUNCTION public.bundles_granting_sku(TEXT) IS
  'Bundle service_keys (GUIDED_PACK/MEDIA_PACK/PAPIC_UNLOCK) that grant the given child SKU. Mirrors BUNDLE_CHILD_SKUS in apps/web/lib/entitlements.ts — keep in sync.';

GRANT EXECUTE ON FUNCTION public.bundles_granting_sku(TEXT) TO authenticated, anon;

COMMIT;
