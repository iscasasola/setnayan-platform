-- get_lead_trust_flags — Phase D of fake-inquiry protection: the "informed accept".
-- ============================================================================
-- Surfaces a POSITIVE, non-PII trust cue on the masked lead so a vendor's accept
-- (and, under Phase B, their held token) is informed. Mirrors the shape + gating
-- of get_returning_client_flags (SECURITY DEFINER, ownership-checked, batched).
--
-- Signal (v1): `active_planner` = the couple has already gotten ≥1 OTHER vendor
-- to ACCEPT their inquiry on this event — real, social-proof engagement. It is a
-- PURELY POSITIVE nudge (presumption-of-a-real-couple): there is no "risky" /
-- "suspicious" tier, the couple never sees it, and it never gates anything — a
-- brand-new couple simply has no badge (not a warning). The count of competing
-- vendors is deliberately NOT exposed (only the boolean).
--
-- Scoped to the caller-vendor's OWN inquiry events (an EXISTS on chat_threads),
-- so a vendor can't probe arbitrary events. Returns only the boolean → even that
-- scoping is belt-and-suspenders, not a PII guard.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_lead_trust_flags(
  p_vendor_profile_id UUID,
  p_event_ids         UUID[]
) RETURNS TABLE (
  event_id       UUID,
  active_planner BOOLEAN
) AS $$
BEGIN
  -- Ownership check (SECURITY DEFINER + granted to authenticated → mandatory).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  RETURN QUERY
  SELECT e.event_id,
         (
           SELECT COUNT(*) FROM public.chat_threads ct2
            WHERE ct2.event_id = e.event_id
              AND ct2.inquiry_status = 'accepted'
         ) >= 1 AS active_planner
  FROM public.events e
  WHERE e.event_id = ANY (p_event_ids)
    -- Only events the caller-vendor actually has an inquiry on.
    AND EXISTS (
      SELECT 1 FROM public.chat_threads ct
      WHERE ct.event_id = e.event_id
        AND ct.vendor_profile_id = p_vendor_profile_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_lead_trust_flags(UUID, UUID[]) IS
  'Vendor-inbox lead trust badge (Phase D · fake-inquiry protection). Batched over inquiry event_ids the caller-vendor owns a thread on: returns active_planner = the couple already has >=1 ACCEPTED vendor thread on the event (real engagement / social proof). Purely positive, non-PII, never a gate, couple never sees it. SECURITY DEFINER because vendor RLS cannot read the couple''s cross-vendor threads; ownership-checked via auth.uid().';

REVOKE ALL ON FUNCTION public.get_lead_trust_flags(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lead_trust_flags(UUID, UUID[]) TO authenticated;
