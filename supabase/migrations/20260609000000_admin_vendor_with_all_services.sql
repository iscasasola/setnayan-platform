-- ============================================================================
-- 20260609000000_admin_vendor_with_all_services.sql
--
-- Owner directive 2026-05-23 — every admin account gets a vendor_profile
-- ("Setnayan Admin Test Vendor") attached + a vendor_services row for every
-- canonical_service in canonical_service_schemas. Owner uses this profile
-- to QA every service surface (vendor dashboard tabs · marketplace card
-- preview · per-canonical-service vendor flow).
--
-- DESIGN PRINCIPLES
-- -----------------
-- 1. **Idempotent.** Safe to re-run on every push. ON CONFLICT DO NOTHING
--    on both INSERT steps. New admins get their profile + services on
--    next push; existing profiles + service rows untouched.
-- 2. **Out of public marketplace.** is_published = FALSE so the admin
--    test vendor never appears on /vendors discovery surface or in
--    vendor_market_stats (which already filters on is_published).
-- 3. **Self-attributed.** created_by_admin_user_id = the admin's own
--    user_id (the audit column from migration
--    20260528000000_admin_owned_unclaimed_vendor_profiles.sql) so the
--    audit trail reads "admin pre-created this for themselves" instead
--    of NULL.
-- 4. **Safe for dual-role admins.** UNIQUE(user_id) on vendor_profiles
--    means an admin who's ALSO a real vendor keeps their existing
--    profile untouched (ON CONFLICT DO NOTHING). The services INSERT
--    is scoped to profiles named EXACTLY 'Setnayan Admin Test Vendor'
--    so we don't accidentally pump every canonical service into a
--    real vendor's offering list.
-- 5. **Survives partial canonical_service_schemas.** If the schemas
--    table hasn't been fully seeded yet (e.g., taxonomy migration
--    20260521040000 hasn't applied), the CROSS JOIN produces 0 rows
--    and the migration is a no-op for services. Next push fills the gap.
-- 6. **No admin = no-op.** If there are zero admins, both INSERTs touch
--    zero rows. Safe to run on fresh databases pre-admin-bootstrap.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Vendor profile for every admin · one per user (UNIQUE(user_id))
-- ----------------------------------------------------------------------------
-- The slug suffix uses the first 8 chars of the admin's UUID so multiple
-- admins (e.g., owner + spouse + Ops Lead per the team composition pulse
-- model) each get a unique slug.
--
-- business_slug nullable + UNIQUE INDEX is partial (WHERE business_slug IS
-- NOT NULL), so leaving it set keeps each admin's slug case-insensitively
-- unique without affecting real vendors' slug claims.

INSERT INTO public.vendor_profiles (
  user_id,
  business_name,
  business_slug,
  tagline,
  location_city,
  is_published,
  created_by_admin_user_id
)
SELECT
  u.user_id,
  'Setnayan Admin Test Vendor',
  'setnayan-admin-' || SUBSTRING(u.user_id::TEXT, 1, 8),
  'Internal admin profile · every canonical service enabled for QA.',
  'Quezon City',
  FALSE,
  u.user_id
FROM public.users u
WHERE u.account_type = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Every canonical service attached to every admin test vendor
-- ----------------------------------------------------------------------------
-- vendor_services has UNIQUE(vendor_profile_id, category), so ON CONFLICT
-- DO NOTHING gap-fills on subsequent pushes when new canonical services
-- are added.
--
-- Pricing/crew columns left at their defaults (NULL/0/FALSE). The owner
-- can populate per-service detail through the vendor dashboard UI when
-- exercising each surface.

INSERT INTO public.vendor_services (
  vendor_profile_id,
  category,
  is_active
)
SELECT
  vp.vendor_profile_id,
  css.canonical_service,
  TRUE
FROM public.vendor_profiles vp
JOIN public.users u ON u.user_id = vp.user_id
CROSS JOIN public.canonical_service_schemas css
WHERE u.account_type = 'admin'
  AND vp.business_name = 'Setnayan Admin Test Vendor'
ON CONFLICT (vendor_profile_id, category) DO NOTHING;

COMMIT;
