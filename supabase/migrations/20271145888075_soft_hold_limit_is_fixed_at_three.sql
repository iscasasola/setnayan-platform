-- ============================================================================
-- max_soft_holds_per_date: say that it is FIXED, because it is
-- ============================================================================
--
-- The column's shipped comment reads:
--
--   "... Default 3. Vendor adjusts in /vendor-dashboard/settings/availability
--    (UI ships V1.x ...). Range 1-20 enforced by CHECK."
--
-- `/vendor-dashboard/settings/availability` HAS NEVER EXISTED. There is no
-- `app/vendor-dashboard/settings/` directory at all, and the column has ZERO
-- writers anywhere in the application — it is READ in one place (the lock
-- soft-hold gate in app/dashboard/[eventId]/vendors/actions.ts) and written
-- nowhere. Verified in production: both live shops hold the default 3.
--
-- So the product currently documents a per-vendor setting that no vendor can
-- reach. A comment is what a reader queries when the code is ambiguous, and
-- this one sends them looking for a route that cannot be found — or worse,
-- lets them conclude the control exists and move on.
--
-- WHAT IS *NOT* CHANGED, deliberately:
--   • the DEFAULT stays 3
--   • the CHECK stays 1-20
-- Both are kept so the control can be built later without a migration. This
-- migration changes the DESCRIPTION only — no data, no constraint, no default.
--
-- Idempotent: COMMENT ON is a full replace.
-- ============================================================================

COMMENT ON COLUMN public.vendor_profiles.max_soft_holds_per_date IS
  'How many concurrent contracted-status picks this vendor allows on the '
  'same event date before further locks are blocked with soft_hold_limit_'
  'reached. FIXED AT THE DEFAULT OF 3 FOR EVERY SHOP — there is no vendor '
  'control and no admin control, and this column has zero writers in the '
  'application. (An earlier version of this comment named '
  '/vendor-dashboard/settings/availability as where a vendor changes it; that '
  'route has never existed.) The DEFAULT 3 and the 1-20 CHECK are retained so '
  'a control can be added later without a migration. Read by the lock '
  'soft-hold gate only.';
