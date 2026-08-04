-- ============================================================================
-- Vendor TEAM ADMINS can write package INCLUSIONS, not just the package row.
--
-- THE BUG THIS CLOSES (reachable on main today, silent):
--   20260822000000_vendor_admin_table_access.sql:42-46 gave `vendor_packages` a
--   `*_team_admin` policy keyed on public.current_vendor_profile_ids(), which
--   unions the owner AND admin-rank team members
--   (20260821000000_vendor_role_aware_rls.sql:23-35).
--   `vendor_package_items` and `vendor_package_item_options` were NOT in that
--   migration. Their only write policies remain the direct-owner ones keyed on
--   `vendor_profiles.user_id = auth.uid()` (20260604110000:194-224 and
--   20271006413374:241-273).
--
--   So a vendor TEAM ADMIN — who resolves to a vendor profile through
--   vendor_team_members (apps/web/lib/vendor-profile.ts:292-315) — INSERTs the
--   package row successfully, is then refused every inclusion row, and
--   apps/web/app/vendor-dashboard/packages/actions.ts:227-231 deletes the
--   package it just created. A whole class of vendor cannot author a package at
--   all, and is told nothing.
--
--   Half-write, then self-erase. Nothing surfaces it: an RLS refusal and an
--   empty result are the same value to the client.
--
-- WHAT THIS DOES: adds the missing `*_team_admin` policies to both child
-- tables, mirroring the EXISTING owner-write joins exactly and swapping only
-- the `vendor_profiles.user_id = auth.uid()` leg for the canonical helper. No
-- new predicate is invented — RLS patterns are owner-locked.
--
-- ⚠ NO GRANT IS ADDED OR WIDENED. Both tables already sit at their committed
-- privilege level, and the anon-facing policies stay SELECT-only gated on
-- `is_active = TRUE` (20260604110000:115-121, :183-192; 20271006413374:226-238).
-- A permissive policy `TO authenticated` changes nothing for anon.
--
-- ⚠ Two new pg_policy rows change the exposure surface, so
-- supabase/security/exposure-surface.baseline.txt is REGENERATED in this same
-- PR — the freeze test emits one fact per policy and would otherwise fail
-- (apps/web/tests/db/exposure-surface.ts:315-339).
-- ============================================================================

BEGIN;

-- ---- vendor_package_items ---------------------------------------------------
-- Mirrors vendor_package_items_owner_write (20260604110000:194-224); the
-- profiles join is replaced by the helper, which already covers the owner.
DROP POLICY IF EXISTS vendor_package_items_team_admin ON public.vendor_package_items;
CREATE POLICY vendor_package_items_team_admin
  ON public.vendor_package_items
  FOR ALL
  TO authenticated
  USING (
    package_id IN (
      SELECT vp.package_id
      FROM public.vendor_packages vp
      WHERE vp.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  )
  WITH CHECK (
    -- Restated in full, NOT aliased to USING: a WITH CHECK that only repeats
    -- USING lets an admin of vendor 1 attach a row to vendor 2's package.
    package_id IN (
      SELECT vp.package_id
      FROM public.vendor_packages vp
      WHERE vp.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- ---- vendor_package_item_options --------------------------------------------
-- Mirrors vendor_package_item_options_owner_write (20271006413374:241-273).
DROP POLICY IF EXISTS vendor_package_item_options_team_admin ON public.vendor_package_item_options;
CREATE POLICY vendor_package_item_options_team_admin
  ON public.vendor_package_item_options
  FOR ALL
  TO authenticated
  USING (
    item_id IN (
      SELECT i.item_id
      FROM public.vendor_package_items i
      INNER JOIN public.vendor_packages vp ON vp.package_id = i.package_id
      WHERE vp.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  )
  WITH CHECK (
    item_id IN (
      SELECT i.item_id
      FROM public.vendor_package_items i
      INNER JOIN public.vendor_packages vp ON vp.package_id = i.package_id
      WHERE vp.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- ---- post-condition ---------------------------------------------------------
-- A migration that merges green while creating nothing is the failure mode this
-- repo has already been bitten by. Refuse to apply unless both policies exist.
DO $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'vendor_package_items'
      AND policyname = 'vendor_package_items_team_admin'
  ) THEN
    missing := missing || 'vendor_package_items_team_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'vendor_package_item_options'
      AND policyname = 'vendor_package_item_options_team_admin'
  ) THEN
    missing := missing || 'vendor_package_item_options_team_admin';
  END IF;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration 20271104090000 did not create: %. Vendor team admins would still be refused package inclusions.',
      array_to_string(missing, ', ');
  END IF;
END $$;

COMMIT;
