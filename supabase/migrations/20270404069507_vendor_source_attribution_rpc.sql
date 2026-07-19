-- vendor_source_attribution_rpc
-- ============================================================================
-- App-vs-Import ROI attribution for the vendor "My Performance" page (Phase 6
-- of the vendor-dashboard reorg).
--
-- WHY: A vendor wants to know how much of their booked business came THROUGH
-- Setnayan (the marketplace found them the couple) vs. business they already
-- had off-platform (a couple they knew added them manually). That "did the app
-- earn its keep?" split is the honest ROI story.
--
-- HOW it's cleanly derivable WITHOUT a new column:
--   • event_vendors.source already discriminates HOW a booking row was created
--     (20260604120000_event_vendors_source_tracking.sql):
--       'host_marketplace_search'      → couple found the vendor via Setnayan
--                                        marketplace name-search  → SETNAYAN
--       'auto_cascade_from_finalize'   → Setnayan auto-surfaced the vendor's
--                                        other services after a related lock →
--                                        a platform-driven up-sell            → SETNAYAN
--       'host_manual'                  → couple manually added a vendor they
--                                        already knew (off-platform lead)      → OFF-PLATFORM
--       'admin'                        → an admin attached the row (not a
--                                        Setnayan discovery event)            → OFF-PLATFORM
--       NULL / anything else (legacy)  → can't attribute                      → UNATTRIBUTED
--   • event_vendors.total_cost_php already carries the contract value the couple
--     confirmed (respond_vendor_proposal sets it from the accepted proposal).
--     Vendors settle payment off-platform (0% commission, Setnayan Pay dormant),
--     so this is the ONLY per-booking peso figure the platform holds. It is
--     nullable — a booked row can lack a confirmed price — so the peso ROI is
--     partial by nature and the UI labels it honestly.
--
-- OWNERSHIP + SECURITY:
--   event_vendors has NO vendor-facing SELECT RLS policy (it's a couple table;
--   see 20270315091571 "the vendor has no direct couple-table read"). So this
--   reader is SECURITY DEFINER + gates the caller to their own vendor org via
--   current_vendor_profile_ids() (or a console admin), mirroring the shipped
--   demand_radar_for_vendor() pattern. It returns ONLY the caller's own booked
--   rows, pre-aggregated — never any couple identity.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT. No table, no policy.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_source_attribution(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  attribution      TEXT,     -- 'setnayan' | 'off_platform' | 'unattributed'
  booking_count    INTEGER,  -- # of booked event_vendors rows in this class
  priced_count     INTEGER,  -- # of those rows that carry a total_cost_php
  revenue_php      NUMERIC   -- SUM(total_cost_php) over priced rows (NULLs skipped)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Ownership gate — only the vendor's own org (or a console admin) may read.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH booked AS (
    SELECT
      -- Null-safe source classification. Setnayan-attributed = the platform
      -- created the discovery (marketplace search) or the up-sell (cascade).
      -- Everything else the couple/admin brought in themselves = off-platform.
      CASE
        WHEN COALESCE(ev.source, '') IN (
          'host_marketplace_search',
          'auto_cascade_from_finalize'
        ) THEN 'setnayan'
        WHEN COALESCE(ev.source, '') IN (
          'host_manual',
          'admin'
        ) THEN 'off_platform'
        ELSE 'unattributed'
      END AS attribution,
      ev.total_cost_php
    FROM public.event_vendors ev
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      -- "Booked" = a real commercial commitment (mirrors
      -- BOOKED_EVENT_VENDOR_STATUSES in lib/vendor-funnel.ts, intersected with
      -- the live vendor_status enum: contracted/deposit_paid/delivered/complete).
      AND COALESCE(ev.status::text, '') IN (
        'contracted', 'deposit_paid', 'delivered', 'complete'
      )
      AND (p_since IS NULL OR ev.created_at >= p_since)
  )
  SELECT
    b.attribution,
    COUNT(*)::INTEGER,
    COUNT(b.total_cost_php)::INTEGER,
    COALESCE(SUM(b.total_cost_php), 0)::NUMERIC
  FROM booked b
  GROUP BY b.attribution;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_source_attribution(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_source_attribution(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.vendor_source_attribution(UUID, TIMESTAMPTZ) IS
  'App-vs-Import ROI for the vendor My Performance page. SECURITY DEFINER, ownership-gated to current_vendor_profile_ids() (or a console admin). Classifies the caller''s BOOKED event_vendors rows into setnayan (host_marketplace_search / auto_cascade_from_finalize) vs off_platform (host_manual / admin) vs unattributed (NULL/legacy source), returning per-class booking_count, priced_count, and SUM(total_cost_php). Peso figures are partial by nature — total_cost_php is nullable and vendors settle payment off-platform. Never exposes couple identity.';

COMMIT;
