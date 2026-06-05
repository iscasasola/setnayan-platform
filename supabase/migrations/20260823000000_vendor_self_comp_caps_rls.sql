-- =============================================================================
-- 20260823000000_vendor_self_comp_caps_rls.sql
--
-- Fix: vendor_self_comp_caps had RLS ENABLED but ZERO policies — so the only
-- role that could read it was service_role. The vendor self-comp quota reader
-- (lib/self-purchase.ts:fetchSelfCompQuota) runs under the vendor's authed
-- client, so an admin-raised cap was invisible to the vendor (the read
-- returned nothing and the code fell back to the default cap of 12). No data
-- was wrong, but a raised cap never took effect for the vendor.
--
-- NOTE: the other three tables flagged alongside this one — vendor_active_ads,
-- vendor_active_tools, vendor_market_stats — are VIEWS, not tables. Views can't
-- carry RLS (access is by GRANT + view definition), so their "no policies"
-- state is correct-by-design, not a gap. Nothing to do there.
--
-- WHAT: add the two policies this table should have had at CREATE time —
--   • owner+admin of the vendor read their OWN cap   (current_vendor_profile_ids)
--   • platform admin manages all caps                 (is_admin — sets/raises)
-- Idempotent (DROP IF EXISTS → CREATE). RLS-only; the table already has RLS on.
-- =============================================================================

-- Vendor (owner + team-admin) reads their own quarterly comp cap.
DROP POLICY IF EXISTS vendor_self_comp_caps_owner_read ON public.vendor_self_comp_caps;
CREATE POLICY vendor_self_comp_caps_owner_read ON public.vendor_self_comp_caps
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Platform admin (Setnayan staff) sets / raises caps for any vendor.
DROP POLICY IF EXISTS vendor_self_comp_caps_admin_manage ON public.vendor_self_comp_caps;
CREATE POLICY vendor_self_comp_caps_admin_manage ON public.vendor_self_comp_caps
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
