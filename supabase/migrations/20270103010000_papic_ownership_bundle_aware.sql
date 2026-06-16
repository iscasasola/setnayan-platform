-- 20270103010000_papic_ownership_bundle_aware.sql
--
-- WHY (PR #1447 follow-up · 2026-06-15): PR #1447 made the APP-side ownership
-- read bundle-aware (lib/entitlements.ts eventOwnsSku + BUNDLE_CHILD_SKUS): a
-- couple who buys the MEDIA_PACK bundle — which lands as ONE orders row keyed
-- service_key='MEDIA_PACK', no per-child decomposition — now owns the child
-- SKUs (incl. PAPIC_SEATS / PAPIC_GUEST). But the DB RPC that actually
-- materializes seats/guest quota, public.papic_provision_seats() (migration
-- 20260718000000), gates via public.papic_event_owns_service(event, key) which
-- matched the EXACT service_key only. So a Media-Pack buyer passed the (now
-- bundle-aware) app gate but the RPC raised "you don't own this" and refused to
-- provision. This migration closes that gap at the DB level so the two layers
-- agree: own the bundle → own the child → provisioning succeeds.
--
-- Approach mirrors the read-side model PR #1447 established (no behavioral
-- surprise): a generic helper public.bundles_granting_sku(child) returns the
-- bundle service_keys that include `child`, and papic_event_owns_service ORs an
-- "owns a granting bundle" clause onto its existing exact-key check.
--
-- ⚠ SOURCE OF TRUTH: the bundle→child membership below MIRRORS
-- BUNDLE_CHILD_SKUS in apps/web/lib/entitlements.ts (itself the mirror of
-- BUNDLE_MEMBERS in app/onboarding/wedding/_components/onboarding-pricing.ts —
-- the "what's included" surface the couple actually buys). KEEP ALL THREE IN
-- SYNC if bundle composition changes.
--
-- Idempotent (CREATE OR REPLACE). Additive — no data change, no behavior change
-- for à-la-carte buyers (the exact-key branch is preserved verbatim). NOT
-- AUTO-APPLIED: owner runs `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

-- ---------------------------------------------------------------------------
-- bundles_granting_sku(child) → the bundle service_keys that grant `child`.
-- Pure function of its input (a constant VALUES map) → IMMUTABLE. Returns an
-- empty array (never NULL) for a SKU that no bundle includes, so callers can
-- safely `= ANY(...)` the result.
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
      ('MEDIA_PACK', 'PAKANTA')
  ) AS m(bundle_key, child_key)
  WHERE m.child_key = p_child
$$;

COMMENT ON FUNCTION public.bundles_granting_sku(TEXT) IS
  'Bundle service_keys (GUIDED_PACK/MEDIA_PACK) that grant the given child SKU. Mirrors BUNDLE_CHILD_SKUS in apps/web/lib/entitlements.ts — keep in sync.';

-- ---------------------------------------------------------------------------
-- papic_event_owns_service: exact-key OR owns-a-granting-bundle. The exact-key
-- branch + status filter are preserved verbatim from migration 20260718000000;
-- only the bundle clause is added. Callers (papic_provision_seats →
-- 'PAPIC_SEATS', papic guest paths → 'PAPIC_GUEST') become bundle-aware with no
-- signature change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_event_owns_service(
  p_event_id   UUID,
  p_service_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.event_id = p_event_id
      -- orders.status is the order_status ENUM, so cast to text BEFORE the
      -- COALESCE (coalescing an enum with '' raises 22P02). A null/blank status
      -- counts as owned — matches the app-side eventOwnsSku() semantics.
      AND COALESCE(o.status::text, '') NOT IN ('cancelled', 'refunded', 'lapsed')
      AND (
        -- Direct à-la-carte order for this SKU (unchanged from 20260718000000).
        o.service_key = p_service_key
        -- OR a bundle the event bought that includes this SKU (PR #1447 parity).
        OR o.service_key = ANY (public.bundles_granting_sku(p_service_key))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.bundles_granting_sku(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.papic_event_owns_service(UUID, TEXT) TO authenticated, anon;

COMMIT;
