-- reseed_bundle_components_without_led
--
-- ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
-- Migration 20271132121622 removed the LED wall backdrop and DELETEd its
-- `bundle_components` row. That corrected the DATA but not the SEED: the
-- membership guard (`apps/web/scripts/lint-entitlement-gates.mjs`, guard 2)
-- compares three mirrors of "what does this bundle include" —
--   1. BUNDLE_CHILD_SKUS      (lib/entitlements.ts)
--   2. BUNDLE_MEMBERS         (onboarding-pricing.ts)
--   3. the LATEST migration containing `INSERT INTO public.bundle_components`
-- — and mirror 3 was still `20270511379088`, which lists LIVE_BACKGROUND. A
-- DELETE is invisible to a parser that reads INSERT tuples, so the seed kept
-- asserting a membership the database no longer had.
--
-- This re-seed IS mirror 3 from now on. It states the membership in full
-- rather than patching it, so the file a reader (or the guard) opens is the
-- whole truth and not a diff they must replay in their head.
--
-- ⚠ Both bundles have been off sale since 2026-06-29 and prod has ZERO orders,
-- so this changes nothing anyone can buy. It exists so the guard can see.
--
-- Idempotent: delete-then-insert inside one transaction.

BEGIN;

-- Rebuild both compositions from scratch. Scoped to the two bundles this file
-- claims to own — a blanket `DELETE FROM public.bundle_components` would also
-- silently drop any third bundle a later migration introduces.
DELETE FROM public.bundle_components
 WHERE bundle_sku_code IN ('GUIDED_PACK', 'MEDIA_PACK');

INSERT INTO public.bundle_components (bundle_sku_code, component_service_code)
VALUES
  -- Essentials (GUIDED_PACK) — the owner's 7. Unchanged.
  ('GUIDED_PACK', 'SETNAYAN_AI'),
  ('GUIDED_PACK', 'ANIMATED_MONOGRAM'),
  ('GUIDED_PACK', 'CUSTOM_QR_GUEST'),
  ('GUIDED_PACK', 'PRO_RSVP'),
  ('GUIDED_PACK', 'PAPIC_GUEST'),
  ('GUIDED_PACK', 'EVENT_WEBSITE'),
  ('GUIDED_PACK', 'PRO_WEBSITE'),
  -- Complete (MEDIA_PACK) — 15, was 16. LIVE_BACKGROUND is absent because the
  -- LED wall backdrop was removed from the product on 2026-08-11; it is not
  -- merely off sale, it does not exist. Every other member is unchanged.
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
  ('MEDIA_PACK', 'PANOOD_SYSTEM'),
  ('MEDIA_PACK', 'PAKANTA')
ON CONFLICT DO NOTHING;

COMMIT;

-- ── VERIFY (against prod after deploy — the OBJECT, not the log) ───────────
-- SELECT bundle_sku_code, count(*) AS members,
--        bool_or(component_service_code = 'LIVE_BACKGROUND') AS still_has_led
--   FROM public.bundle_components
--  WHERE bundle_sku_code IN ('GUIDED_PACK','MEDIA_PACK')
--  GROUP BY 1 ORDER BY 1;
-- Expected: GUIDED_PACK 7 f · MEDIA_PACK 15 f
