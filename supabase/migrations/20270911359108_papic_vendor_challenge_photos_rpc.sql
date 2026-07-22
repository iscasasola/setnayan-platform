-- Papic Games — Phase 5: vendor challenge photo delivery (owner 2026-07-22 "both").
-- A booked vendor who PAID the ₱400 Photo Challenge sponsorship receives the guest
-- photos/videos taken at THEIR challenges — but ONLY the ones a guest explicitly
-- consented to share (§4), AND only past the same strict OUTBOUND gates the
-- guest-facing surfaces use. This is a leaving-the-couple's-control delivery, so
-- the posture is the STRICT allowlist (moderation_state='clean'), NOT the couple
-- dashboard's denylist. Flag-gated at the call site (NEXT_PUBLIC_PAPIC_GAMES_V1).
--
-- Returns WEB-COPY derivative refs ONLY (display/thumb/poster/clip_web) — NEVER
-- r2_object_key (the geo-bearing original). The caller presigns them via
-- displayUrlForStoredAsset. SECURITY DEFINER: event_vendors + papic_missions +
-- papic_guest_captures + papic_mission_completions have no vendor RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.papic_vendor_challenge_photos(p_event_id UUID)
RETURNS TABLE (
  capture_id      UUID,
  mission_id      UUID,
  prompt          TEXT,
  media_type      TEXT,
  display_r2_key  TEXT,
  thumb_r2_key    TEXT,
  poster_r2_key   TEXT,
  clip_web_r2_key TEXT,
  captured_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
BEGIN
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RETURN;  -- not a vendor → empty
  END IF;

  -- PAID-SPONSORSHIP gate (the ₱400): only a vendor who sponsored Photo Challenge
  -- for THIS event may collect its photos — mirrors papic_create_vendor_challenge.
  IF NOT EXISTS (
    SELECT 1 FROM public.papic_photo_challenge_sponsorships s
    WHERE s.event_id = p_event_id
      AND s.vendor_profile_id = ANY(v_profile_ids)
  ) THEN
    RETURN;  -- not sponsored → empty
  END IF;

  RETURN QUERY
  SELECT cap.capture_id, m.mission_id, m.prompt, cap.media_type,
         cap.display_r2_key, cap.thumb_r2_key, cap.poster_r2_key, cap.clip_web_r2_key,
         cap.captured_at
  FROM public.papic_mission_completions comp
  -- the completion's mission must be a VENDOR challenge owned by THIS vendor.
  JOIN public.papic_missions m
    ON m.mission_id = comp.mission_id AND m.source = 'vendor'
  JOIN public.event_vendors ev
    ON ev.vendor_id = m.vendor_id AND ev.marketplace_vendor_id = ANY(v_profile_ids)
  -- Per-mission sponsorship correlation (defense-in-depth): the mission's OWN
  -- vendor profile must have paid the ₱400 sponsorship — not merely some profile
  -- the caller controls. Matches the authoring RPC's per-profile gate, so the
  -- delivery gate can't drift from the create gate for a dual-org caller.
  JOIN public.papic_photo_challenge_sponsorships sp
    ON sp.event_id = comp.event_id AND sp.vendor_profile_id = ev.marketplace_vendor_id
  JOIN public.papic_guest_captures cap
    ON cap.capture_id = comp.capture_id
  WHERE comp.event_id = p_event_id
    -- §4 per-vendor share consent (the guest tapped "Share this photo with <vendor>").
    AND comp.consent_to_share = true
    -- STRICT OUTBOUND moderation allowlist (not the couple denylist): the capture
    -- must have been NSFW-screened clean and not moderation-hidden.
    AND cap.moderation_state = 'clean'
    AND cap.hidden_at IS NULL
  ORDER BY comp.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_vendor_challenge_photos(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_vendor_challenge_photos(UUID) TO authenticated;
COMMENT ON FUNCTION public.papic_vendor_challenge_photos(UUID) IS
  'Papic Games Phase 5: a booked, sponsored vendor collects the CONSENTED guest photos from their challenges (consent_to_share + moderation_state=clean + not hidden). Returns web-copy derivative refs only (never the geo-bearing original). SECURITY DEFINER, sponsorship-gated.';

COMMIT;
