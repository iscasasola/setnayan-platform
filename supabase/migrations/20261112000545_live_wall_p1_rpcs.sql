-- ============================================================================
-- 20261112000545_live_wall_p1_rpcs.sql
--
-- Salamisim Live Photo Wall · P1 — the feed RPCs (build-plan Phase 1 on the
-- P0 schema from 20261104000959). Owner-locked 2026-06-11: FULL ROBUST BUILD;
-- venue projection default = all-with-consent; FaceBlock ship gate = any
-- event with >=1 faceblock_enabled guest is WITHHELD until the P2 blur
-- pipeline ships (fail-closed stub here).
--
-- Gate chain implemented by wall_ingest (allowlist, fail-closed):
--   G0  event owns LIVE_WALL (event_software_activations_v2)
--   --  source row exists, not hidden, not wall-hidden, photos only (no clips)
--   G1  moderation_state = 'clean'  ← REAL: lib/nsfw-screen.ts (self-hosted
--       nsfwjs) writes 'unscreened' -> 'clean'|'nsfw_blocked' on BOTH capture
--       paths. The wall is an ALLOWLIST surface: 'unscreened' never projects
--       (the gallery's fail-open rule does not apply to a venue projection).
--   FB  fail-closed FaceBlock stub: any faceblock_enabled guest on the event
--       => NO wall_feed row (we do not touch moderation_state — that column
--       belongs to the NSFW verdict domain; wall eligibility = row existence).
--   G2  consent veto: any tagged guest with photo_consent = FALSE => withheld.
--   P1 SAFE KEY: wall_safe_r2_key := r2_object_key (original-as-safe). This
--   is acceptable ONLY because of the FB withhold above + the claim-code +
--   LIVE_WALL dark-launch; P2 replaces it with the baked blur derivative.
--
-- Auth model: wall_ingest / wall_visible_photos / wall_claim_display are
-- SERVICE-ROLE-ONLY (REVOKEd from anon+authenticated — the projection is an
-- anonymous screen served by server routes; no anon ever reads wall_feed
-- directly). wall_retract / wall_unhide are callable by authenticated users
-- and CHECK couple/coordinator membership INTERNALLY.
-- ============================================================================

BEGIN;

-- ── wall_ingest ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wall_ingest(p_source_table TEXT, p_source_id UUID)
RETURNS SETOF public.wall_feed
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event  UUID;
  v_key    TEXT;
  v_state  TEXT;
  v_hidden TIMESTAMPTZ;
  v_whide  TIMESTAMPTZ;
  v_w      INTEGER;
  v_h      INTEGER;
  v_type   TEXT;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT pp.event_id, pp.r2_object_key, pp.moderation_state, pp.hidden_at,
           pp.wall_hidden_at, pp.width_px, pp.height_px, pp.photo_type
      INTO v_event, v_key, v_state, v_hidden, v_whide, v_w, v_h, v_type
      FROM public.papic_photos pp WHERE pp.photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT gc.event_id, gc.r2_object_key, gc.moderation_state, gc.hidden_at,
           gc.wall_hidden_at, NULL, NULL, 'photo'
      INTO v_event, v_key, v_state, v_hidden, v_whide, v_w, v_h, v_type
      FROM public.papic_guest_captures gc WHERE gc.capture_id = p_source_id;
  ELSE
    RETURN;
  END IF;

  IF v_event IS NULL OR v_key IS NULL OR v_hidden IS NOT NULL
     OR v_whide IS NOT NULL OR v_type IS DISTINCT FROM 'photo' THEN
    RETURN;  -- missing / hidden / clip (photo collage only in Phase 1)
  END IF;

  -- G0 — the event owns the Live Wall SKU.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_software_activations_v2 a
    WHERE a.event_id = v_event AND a.service_code = 'LIVE_WALL'
  ) THEN RETURN; END IF;

  -- G1 — NSFW allowlist (un-disableable; 'unscreened' never projects).
  IF v_state IS DISTINCT FROM 'clean' THEN RETURN; END IF;

  -- FB — fail-closed FaceBlock ship gate (P2 replaces with baked blur).
  IF EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.event_id = v_event AND g.faceblock_enabled
      AND g.deleted_at IS NULL
  ) THEN RETURN; END IF;

  -- G2 — photo-consent veto via tagged guests.
  IF EXISTS (
    SELECT 1 FROM public.photo_tags pt
    JOIN public.guests g ON g.guest_id = pt.guest_id
    WHERE pt.source_table = p_source_table AND pt.source_id = p_source_id
      AND g.photo_consent = FALSE
  ) THEN RETURN; END IF;

  -- P1 safe key = the original (see header; P2 = blur derivative).
  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos SET wall_safe_r2_key = v_key
      WHERE photo_id = p_source_id AND wall_safe_r2_key IS NULL;
  ELSE
    UPDATE public.papic_guest_captures SET wall_safe_r2_key = v_key
      WHERE capture_id = p_source_id AND wall_safe_r2_key IS NULL;
  END IF;

  INSERT INTO public.wall_feed (event_id, source_table, source_id, wall_safe_r2_key, width_px, height_px)
  VALUES (v_event, p_source_table, p_source_id, v_key, v_w, v_h)
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN QUERY
    SELECT wf.* FROM public.wall_feed wf
    WHERE wf.source_table = p_source_table AND wf.source_id = p_source_id
      AND wf.wall_hidden_at IS NULL;
END;
$$;

-- ── wall_visible_photos — the single audited reader ────────────────────────
-- Re-checks the fail-closed conditions at READ time (a missed retraction
-- cascade still fails closed on the next read).
CREATE OR REPLACE FUNCTION public.wall_visible_photos(p_event_id UUID, p_since TIMESTAMPTZ DEFAULT '-infinity')
RETURNS SETOF public.wall_feed
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wf.* FROM public.wall_feed wf
  WHERE wf.event_id = p_event_id
    AND wf.wall_hidden_at IS NULL
    AND wf.sort_at > p_since
    AND NOT EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.event_id = p_event_id AND g.faceblock_enabled AND g.deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.photo_tags pt
      JOIN public.guests g2 ON g2.guest_id = pt.guest_id
      WHERE pt.source_table = wf.source_table AND pt.source_id = wf.source_id
        AND g2.photo_consent = FALSE
    )
    AND (
      (wf.source_table = 'papic_photos' AND EXISTS (
        SELECT 1 FROM public.papic_photos pp
        WHERE pp.photo_id = wf.source_id AND pp.hidden_at IS NULL AND pp.wall_hidden_at IS NULL
      ))
      OR
      (wf.source_table = 'papic_guest_captures' AND EXISTS (
        SELECT 1 FROM public.papic_guest_captures gc
        WHERE gc.capture_id = wf.source_id AND gc.hidden_at IS NULL AND gc.wall_hidden_at IS NULL
      ))
    )
  ORDER BY wf.sort_at ASC
  LIMIT 300;
$$;

-- ── wall_retract / wall_unhide — the couple/coordinator kill switch ────────
CREATE OR REPLACE FUNCTION public.wall_retract(p_source_table TEXT, p_source_id UUID, p_also_gallery BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT event_id INTO v_event FROM public.papic_photos WHERE photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT event_id INTO v_event FROM public.papic_guest_captures WHERE capture_id = p_source_id;
  ELSE
    RETURN FALSE;
  END IF;
  IF v_event IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate this wall';
  END IF;

  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos
      SET wall_hidden_at = NOW(),
          hidden_at = CASE WHEN p_also_gallery THEN COALESCE(hidden_at, NOW()) ELSE hidden_at END
      WHERE photo_id = p_source_id;
  ELSE
    UPDATE public.papic_guest_captures
      SET wall_hidden_at = NOW(),
          hidden_at = CASE WHEN p_also_gallery THEN COALESCE(hidden_at, NOW()) ELSE hidden_at END
      WHERE capture_id = p_source_id;
  END IF;

  UPDATE public.wall_feed SET wall_hidden_at = NOW()
    WHERE source_table = p_source_table AND source_id = p_source_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.wall_unhide(p_source_table TEXT, p_source_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT event_id INTO v_event FROM public.papic_photos WHERE photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT event_id INTO v_event FROM public.papic_guest_captures WHERE capture_id = p_source_id;
  ELSE
    RETURN FALSE;
  END IF;
  IF v_event IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate this wall';
  END IF;

  -- Wall-only un-hide (the durable gallery hidden_at is NOT touched here —
  -- restoring a gallery-hidden photo is a gallery decision, not a wall one).
  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos SET wall_hidden_at = NULL WHERE photo_id = p_source_id;
  ELSE
    UPDATE public.papic_guest_captures SET wall_hidden_at = NULL WHERE capture_id = p_source_id;
  END IF;
  UPDATE public.wall_feed SET wall_hidden_at = NULL
    WHERE source_table = p_source_table AND source_id = p_source_id;
  RETURN TRUE;
END;
$$;

-- ── wall_claim_display — single-use screen claim (code → session) ──────────
CREATE OR REPLACE FUNCTION public.wall_claim_display(p_event_id UUID, p_code TEXT)
RETURNS SETOF public.wall_display_sessions
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.wall_display_sessions
    SET claimed_at = NOW()
    WHERE event_id = p_event_id
      AND display_code = UPPER(TRIM(p_code))
      AND revoked_at IS NULL
      AND claimed_at IS NULL
      AND expires_at > NOW()
    RETURNING *;
$$;

-- ── grants: service-role-only for the feed path; authenticated for the
--    self-checking kill switch ───────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.wall_ingest(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_visible_photos(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_claim_display(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_retract(TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wall_unhide(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wall_retract(TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wall_unhide(TEXT, UUID) TO authenticated;

COMMIT;
