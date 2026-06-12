-- ============================================================================
-- 20261115000604_wall_p2_faceblock_bake.sql
--
-- Salamisim Live Photo Wall · P2 — the server-baked FaceBlock pipeline.
--
-- P1 (20261112000545) shipped a fail-closed FaceBlock STUB: one
-- guests.faceblock_enabled guest on the event withholds EVERY photo from the
-- venue projection. P2 replaces the blanket withhold with a per-row BAKED
-- requirement: lib/face-blur.ts detects faces server-side (tiled MediaPipe
-- full-range, tfjs CPU, committed weights), blurs every detected face INTO
-- THE PIXELS, uploads the derivative, and calls wall_record_bake() to stamp:
--
--   faceblock_baked_at    — provenance: this row's wall_safe_r2_key is a real
--                           blur derivative, not the P1 original-as-safe copy
--   faceblock_faces_found — observability (how many faces were blurred)
--   wall_safe_r2_key      — now the BAKED derivative on FaceBlock events
--
-- Gate changes (both remain allowlist / fail-closed):
--   wall_ingest          FB gate: FaceBlock event ⇒ require faceblock_baked_at
--                        NOT NULL (else withhold, exactly as P1). The wall_feed
--                        row records the BAKED key, never the original.
--   wall_visible_photos  read-time: FaceBlock event ⇒ per-row baked check.
--                        A guest flipping FaceBlock ON mid-event instantly
--                        hides every un-baked tile on the next read — no
--                        cascade required, fail-closed by construction. The
--                        re-bake sweep (lib/face-blur.ts rebakeWallForEvent)
--                        restores the newest tiles as blurred derivatives.
--
-- wall_record_bake is SERVICE-ROLE-ONLY (REVOKEd from PUBLIC/anon/
-- authenticated) — only the server-side baker may declare a row safe.
-- ============================================================================

BEGIN;

-- ── bake bookkeeping on both capture tables ─────────────────────────────────
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS faceblock_baked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faceblock_faces_found SMALLINT;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS faceblock_baked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faceblock_faces_found SMALLINT;

COMMENT ON COLUMN public.papic_photos.faceblock_baked_at IS
  'Set by wall_record_bake when the FaceBlock blur derivative was baked. NULL on a FaceBlock event = withheld from the wall (fail-closed).';
COMMENT ON COLUMN public.papic_guest_captures.faceblock_baked_at IS
  'Set by wall_record_bake when the FaceBlock blur derivative was baked. NULL on a FaceBlock event = withheld from the wall (fail-closed).';

-- ── wall_record_bake — the baker's single write entry point ────────────────
CREATE OR REPLACE FUNCTION public.wall_record_bake(
  p_source_table TEXT,
  p_source_id    UUID,
  p_safe_key     TEXT,
  p_faces_found  INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_safe_key IS NULL OR LENGTH(TRIM(p_safe_key)) = 0 THEN
    RETURN FALSE;
  END IF;

  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos
      SET wall_safe_r2_key = p_safe_key,
          faceblock_baked_at = NOW(),
          faceblock_faces_found = p_faces_found
      WHERE photo_id = p_source_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    UPDATE public.papic_guest_captures
      SET wall_safe_r2_key = p_safe_key,
          faceblock_baked_at = NOW(),
          faceblock_faces_found = p_faces_found
      WHERE capture_id = p_source_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
  ELSE
    RETURN FALSE;
  END IF;

  -- Sync an existing wall_feed row so the projection serves the baked key
  -- (rowToTile reads wall_feed.wall_safe_r2_key).
  UPDATE public.wall_feed SET wall_safe_r2_key = p_safe_key
    WHERE source_table = p_source_table AND source_id = p_source_id;

  RETURN TRUE;
END;
$$;

-- ── wall_ingest v2 — FB gate becomes "require baked" ───────────────────────
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
  v_safe   TEXT;
  v_baked  TIMESTAMPTZ;
  v_fb     BOOLEAN;
  v_use    TEXT;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT pp.event_id, pp.r2_object_key, pp.moderation_state, pp.hidden_at,
           pp.wall_hidden_at, pp.width_px, pp.height_px, pp.photo_type,
           pp.wall_safe_r2_key, pp.faceblock_baked_at
      INTO v_event, v_key, v_state, v_hidden, v_whide, v_w, v_h, v_type, v_safe, v_baked
      FROM public.papic_photos pp WHERE pp.photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT gc.event_id, gc.r2_object_key, gc.moderation_state, gc.hidden_at,
           gc.wall_hidden_at, NULL, NULL, 'photo',
           gc.wall_safe_r2_key, gc.faceblock_baked_at
      INTO v_event, v_key, v_state, v_hidden, v_whide, v_w, v_h, v_type, v_safe, v_baked
      FROM public.papic_guest_captures gc WHERE gc.capture_id = p_source_id;
  ELSE
    RETURN;
  END IF;

  IF v_event IS NULL OR v_key IS NULL OR v_hidden IS NOT NULL
     OR v_whide IS NOT NULL OR v_type IS DISTINCT FROM 'photo' THEN
    RETURN;  -- missing / hidden / clip (photo collage only)
  END IF;

  -- G0 — the event owns the Live Wall SKU.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_software_activations_v2 a
    WHERE a.event_id = v_event AND a.service_code = 'LIVE_WALL'
  ) THEN RETURN; END IF;

  -- G1 — NSFW allowlist (un-disableable; 'unscreened' never projects).
  IF v_state IS DISTINCT FROM 'clean' THEN RETURN; END IF;

  -- FB v2 — FaceBlock event ⇒ this row must carry a BAKED blur derivative
  -- (lib/face-blur.ts wrote faceblock_baked_at via wall_record_bake).
  -- Un-baked ⇒ withheld, exactly as the P1 stub — fail-closed.
  v_fb := EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.event_id = v_event AND g.faceblock_enabled
      AND g.deleted_at IS NULL
  );
  IF v_fb AND (v_baked IS NULL OR v_safe IS NULL) THEN RETURN; END IF;

  -- G2 — photo-consent veto via tagged guests.
  IF EXISTS (
    SELECT 1 FROM public.photo_tags pt
    JOIN public.guests g ON g.guest_id = pt.guest_id
    WHERE pt.source_table = p_source_table AND pt.source_id = p_source_id
      AND g.photo_consent = FALSE
  ) THEN RETURN; END IF;

  -- Safe key: a baked derivative always wins; otherwise original-as-safe
  -- (the P1 rule — acceptable only because v_fb is FALSE on this path).
  v_use := COALESCE(v_safe, v_key);
  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos SET wall_safe_r2_key = v_use
      WHERE photo_id = p_source_id AND wall_safe_r2_key IS NULL;
  ELSE
    UPDATE public.papic_guest_captures SET wall_safe_r2_key = v_use
      WHERE capture_id = p_source_id AND wall_safe_r2_key IS NULL;
  END IF;

  INSERT INTO public.wall_feed (event_id, source_table, source_id, wall_safe_r2_key, width_px, height_px)
  VALUES (v_event, p_source_table, p_source_id, v_use, v_w, v_h)
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN QUERY
    SELECT wf.* FROM public.wall_feed wf
    WHERE wf.source_table = p_source_table AND wf.source_id = p_source_id
      AND wf.wall_hidden_at IS NULL;
END;
$$;

-- ── wall_visible_photos v2 — per-row baked check at read time ──────────────
CREATE OR REPLACE FUNCTION public.wall_visible_photos(p_event_id UUID, p_since TIMESTAMPTZ DEFAULT '-infinity')
RETURNS SETOF public.wall_feed
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wf.* FROM public.wall_feed wf
  WHERE wf.event_id = p_event_id
    AND wf.wall_hidden_at IS NULL
    AND wf.sort_at > p_since
    -- FB v2: on a FaceBlock event, only rows with a baked blur derivative
    -- project. A FaceBlock toggle flipping ON hides every un-baked tile on
    -- the very next read — fail-closed with no cascade dependency.
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.guests g
        WHERE g.event_id = p_event_id AND g.faceblock_enabled AND g.deleted_at IS NULL
      )
      OR (
        (wf.source_table = 'papic_photos' AND EXISTS (
          SELECT 1 FROM public.papic_photos pp
          WHERE pp.photo_id = wf.source_id AND pp.faceblock_baked_at IS NOT NULL
        ))
        OR
        (wf.source_table = 'papic_guest_captures' AND EXISTS (
          SELECT 1 FROM public.papic_guest_captures gc
          WHERE gc.capture_id = wf.source_id AND gc.faceblock_baked_at IS NOT NULL
        ))
      )
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

-- ── grants — baker write path is service-role-only ─────────────────────────
REVOKE ALL ON FUNCTION public.wall_record_bake(TEXT, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_ingest(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_visible_photos(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

COMMIT;
