-- ============================================================================
-- 20270330200000_vendor_customer_source_counts.sql
-- Vendor dashboard CRM signal — In-house vs Import customer counts.
--
-- Owner taxonomy (locked 2026-06-30, project_setnayan_vendor_import_crm_workstream):
--   • In-house customers  = customers who inquired from Setnayan (Explore +
--     the vendor's Website). In code: event_vendors linking to the vendor with
--     source IS DISTINCT FROM 'vendor_invite' (NULL / host_manual /
--     host_marketplace_search).
--   • Import customers     = customers imported to shortlist / locked by the
--     vendor via QR Code. In code: event_vendors.source = 'vendor_invite' (the
--     importVendorToEventShortlist QR-claim path, PR #2449). Same discriminator
--     the receipt-backed review pill uses (PR #2453).
--
-- WHY a SECURITY DEFINER RPC: event_vendors carries COUPLE-ONLY RLS
-- (event_vendors_couple_read/_write), so a vendor's own session reads ZERO rows
-- from it — the home page already works around this for bookings by deriving
-- from chat_threads. This function lets the vendor read just the two AGGREGATE
-- counts for THEIR OWN profile (no PII, no rows) over that couple-RLS table,
-- gated to the vendor's owner or a team member. Mirrors the ownership-checked
-- DEFINER pattern of unlock_vendor_event / review_is_booked_through_setnayan.
--
-- Returns (0, 0) for a non-owner/non-team caller rather than raising — the home
-- page degrades to a zeroed card, never an error.
--
-- No prices. Idempotent (CREATE OR REPLACE).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_customer_source_counts(
  p_vendor_profile_id UUID
)
RETURNS TABLE (in_house BIGINT, imported BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Ownership gate: only the vendor's owner OR a team member may read their own
  -- customer-source counts (DEFINER bypasses event_vendors couple-RLS).
  IF NOT EXISTS (
    SELECT 1
    FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND (
        vp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.vendor_team_members vtm
          WHERE vtm.vendor_profile_id = vp.vendor_profile_id
            AND vtm.user_id = auth.uid()
        )
      )
  ) THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    -- In-house: linked, not a QR import. Counts distinct events so a couple who
    -- shortlisted the vendor for two categories still counts once.
    COUNT(DISTINCT ev.event_id)
      FILTER (WHERE ev.source IS DISTINCT FROM 'vendor_invite')::BIGINT AS in_house,
    -- Import: linked via the vendor's invite QR.
    COUNT(DISTINCT ev.event_id)
      FILTER (WHERE ev.source = 'vendor_invite')::BIGINT AS imported
  FROM public.event_vendors ev
  JOIN public.events e
    ON e.event_id = ev.event_id
   AND e.archived = FALSE
  WHERE (
    ev.marketplace_vendor_id = p_vendor_profile_id
    OR ev.linked_vendor_profile_id = p_vendor_profile_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_customer_source_counts(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_customer_source_counts(UUID) IS
  'Vendor dashboard CRM signal: returns (in_house, imported) distinct-event '
  'counts for the vendor''s own customers, split by event_vendors.source '
  '(''vendor_invite'' = imported via QR; everything else = in-house Explore/'
  'Website). SECURITY DEFINER over couple-RLS event_vendors; gated to the '
  'vendor owner or a team member, else returns (0,0).';

COMMIT;
