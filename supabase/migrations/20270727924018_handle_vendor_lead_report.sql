-- handle_vendor_lead_report — Phase C of fake-inquiry protection: report → refund.
-- ============================================================================
-- The generic vendor "Report user" already exists (writes user_reports, admin
-- reviews at /admin/user-reports). This wires a VENDOR's report into the token
-- economy so reporting a fake actually returns the vendor's held token (Phase B),
-- and a coordinated attack across vendors refunds the whole blast radius.
--
-- Called (best-effort, off-request) after a vendor's user_reports insert. Two acts:
--   1. SELF no-reply refund — if the reporting vendor holds a token for this lead
--      and the couple NEVER replied after accept, release it (no reply = a dead /
--      fake lead the vendor shouldn't pay for). If the couple DID engage, no auto-
--      refund — the report still lands in the admin queue for a human. (This is
--      the report-abuse guard: refund keys on the objective no-reply signal, not
--      the vendor's word.)
--   2. CLUSTER blast-radius refund — when ≥ threshold DISTINCT users have reported
--      this couple, release every outstanding hold across the couple's events
--      (a competitor's sock-puppet spray becomes a net-zero for every victim
--      vendor). Suspension stays a human decision in the existing admin queue —
--      we never auto-ban a couple (presumption-of-a-real-couple).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_vendor_lead_report(
  p_vendor_profile_id UUID,
  p_event_id          UUID,
  p_reported_user_id  UUID,
  p_reason            TEXT DEFAULT 'reported',
  p_cluster_threshold INT  DEFAULT 3
) RETURNS JSONB AS $$
DECLARE
  v_hold_id            UUID;
  v_accepted_at        TIMESTAMPTZ;
  v_reply_count        INT;
  v_distinct_reporters INT;
  v_self_refunded      BOOLEAN := false;
  v_blast              INT := 0;
  v_clustered          BOOLEAN := false;
BEGIN
  -- 1. SELF no-reply refund.
  SELECT hold_id INTO v_hold_id FROM public.lead_token_holds
   WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id AND status = 'held'
   LIMIT 1;
  IF v_hold_id IS NOT NULL THEN
    SELECT accepted_at INTO v_accepted_at FROM public.chat_threads
     WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
     LIMIT 1;
    -- Couple messages AFTER accept = genuine engagement. The inquiry + one
    -- follow-up land while 'pending' (before accepted_at), so they don't count.
    SELECT COUNT(*) INTO v_reply_count FROM public.chat_messages
     WHERE event_id = p_event_id
       AND vendor_profile_id = p_vendor_profile_id
       AND sender_role = 'couple'
       AND (v_accepted_at IS NULL OR created_at > v_accepted_at);
    IF v_reply_count = 0 THEN
      PERFORM public.release_lead_token_hold(v_hold_id, 'reported_no_reply:' || p_reason);
      v_self_refunded := true;
    END IF;
  END IF;

  -- 2. CLUSTER — distinct users who have reported this couple.
  SELECT COUNT(DISTINCT reporter_user_id) INTO v_distinct_reporters
    FROM public.user_reports
   WHERE target_type = 'user' AND target_id = p_reported_user_id;

  IF v_distinct_reporters >= GREATEST(p_cluster_threshold, 1) THEN
    v_clustered := true;
    -- Blast-radius refund: release every held hold across the reported couple's
    -- events + drop the never-charged unlock rows (consistent with the hardening).
    WITH couple_events AS (
      SELECT event_id FROM public.event_members
       WHERE user_id = p_reported_user_id AND member_type = 'couple'
    ),
    released AS (
      UPDATE public.lead_token_holds h
         SET status = 'released', released_at = now(), release_reason = 'reported_cluster'
       WHERE h.status = 'held'
         AND h.event_id IN (SELECT event_id FROM couple_events)
      RETURNING h.vendor_profile_id, h.event_id
    ),
    dropped AS (
      DELETE FROM public.vendor_event_unlocks veu
       USING released r
       WHERE veu.vendor_profile_id = r.vendor_profile_id
         AND veu.event_id = r.event_id
      RETURNING veu.event_id
    )
    SELECT COUNT(*) INTO v_blast FROM released;
  END IF;

  RETURN jsonb_build_object(
    'self_refunded', v_self_refunded,
    'distinct_reporters', v_distinct_reporters,
    'clustered', v_clustered,
    'blast_refunded', v_blast);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.handle_vendor_lead_report(UUID, UUID, UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_vendor_lead_report(UUID, UUID, UUID, TEXT, INT) TO service_role;
