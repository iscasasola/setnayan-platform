-- release_event_lead_holds — event cancel/delete token reconciliation
-- (Vendor_Token_Settlement_and_Lifecycle_2026-07-13 §6).
--
-- When an event is cancelled/deleted, its outstanding HELD lead-token holds must
-- be RELEASED (refund — the reservation was never debited) while CONSUMED holds
-- are LEFT ALONE (already settled — the vendor got the value). A hard-delete of
-- the event already frees held reservations *implicitly* via ON DELETE CASCADE,
-- but that is a silent side-effect: it writes no release_reason, and gives the
-- app no chance to notify the affected vendors. This makes it EXPLICIT and
-- returns the released rows so the caller can (later) notify those vendors — and
-- it is the reusable primitive a future couple-facing SOFT-cancel will call
-- (where the rows survive and the release_reason audit is durable).
--
-- Modeled on sweep_ghosted_lead_holds (20270727563372): a CTE that releases the
-- held rows + drops their never-charged unlock rows (frees the verified weekly
-- cap), scoped by event_id instead of age. CONSUMED holds are untouched.

CREATE OR REPLACE FUNCTION public.release_event_lead_holds(
  p_event_id UUID,
  p_reason   TEXT DEFAULT 'event_cancelled'
) RETURNS TABLE (hold_id UUID, vendor_profile_id UUID, tokens INT) AS $$
BEGIN
  RETURN QUERY
  WITH released AS (
    UPDATE public.lead_token_holds h
       SET status = 'released', released_at = now(), release_reason = p_reason
     WHERE h.event_id = p_event_id
       AND h.status = 'held'
    RETURNING h.hold_id, h.vendor_profile_id, h.event_id, h.tokens
  ),
  dropped AS (
    DELETE FROM public.vendor_event_unlocks veu
     USING released r
     WHERE veu.vendor_profile_id = r.vendor_profile_id
       AND veu.event_id = r.event_id
    RETURNING veu.event_id
  )
  SELECT r.hold_id, r.vendor_profile_id, r.tokens FROM released r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.release_event_lead_holds(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_event_lead_holds(UUID, TEXT) TO service_role;
