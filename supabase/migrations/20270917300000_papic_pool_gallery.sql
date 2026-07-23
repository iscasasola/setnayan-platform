-- 20270917300000_papic_pool_gallery.sql
--
-- Shared Pool Gallery + Self-Link (OnTheDay build ⑥, owner 2026-07-23):
-- guests may browse the WHOLE event Papic pool and LINK photos they're in
-- ("I'm in this" → a photo_tags row with source='manual_pick', the enum value
-- that has existed unused since 20261104000959). A linked photo then flows
-- into "Photos of you", the ZIP download, and the Story-reel set with ZERO
-- reader changes — all three read photo_tags source-agnostically.
--
-- Owner-locked shape:
--   • Couple toggle events.pool_gallery_open DEFAULT FALSE — the go-live hold
--     (migrations auto-apply on merge; FALSE = this whole file is inert).
--     When OFF guests see NOTHING (no dead door). COUPLE-only flip.
--   • Browse shows photos AND clips (poster tile + clip_web_r2_key playback);
--     SELF-LINK is PHOTOS-ONLY in V1.
--   • Cap pre-check mirrors the merged 20270916200000 live-only 20-cap
--     (count removed_at IS NULL, cap 20) so RPC and trigger always agree.
--   • Revive is allowed ONLY for the guest's OWN tombstone (removed_by='guest');
--     a couple/admin removal is FINAL (no re-assertion).
--
-- Read posture = the STRICT outbound stack (mirrors papic_vendor_challenge_photos
-- 20270911359108 + wall_visible_photos v2 20261115000604):
--   moderation_state='clean' (allowlist — 'unscreened' fails CLOSED)
--   AND hidden_at IS NULL (couple hide is retroactive on next read)
--   AND web-copy keys ONLY — NEVER r2_object_key (the geo-bearing original)
--   AND the FaceBlock baked-blur rule (FB event ⇒ only rows with a baked
--       wall_safe derivative serve, and ONLY that derivative — clips are
--       excluded entirely on FB events since clip playback can't be blurred)
--   AND the photo_consent veto (any tagged guest with photo_consent=FALSE
--       pulls the capture from the pool).
--
-- Grants: service_role ONLY — every caller is a cookie-validating Next route
-- (the papic_tag_guest_capture precedent, 20270111577244), never PostgREST.
-- photo_tags keeps its no-user-write posture: these DEFINER RPCs are the only
-- guest-side writers. No RLS changes anywhere.

BEGIN;

-- ── 1 · The couple toggle — the go-live hold ────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pool_gallery_open BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.pool_gallery_open IS
  'Couple opt-in (COUPLE-only flip): guests may browse the WHOLE Papic pool (web copies, clean-screened) and self-link photos they are in. DEFAULT FALSE is the ship gate — when FALSE the pool RPCs return empty/deny and no guest surface renders. Distinct from website_open_browse (site sections) and live_photo_wall_visibility (venue wall). Closing is RETROACTIVE on the next read.';

-- ── 2 · Pool reader — keyset-paginated, strict-allowlist, web-copies-only ───

CREATE OR REPLACE FUNCTION public.guest_pool_gallery(
  p_guest_id UUID,
  p_before   TIMESTAMPTZ DEFAULT 'infinity',
  p_limit    INT DEFAULT 60
)
RETURNS TABLE (
  source_table    TEXT,
  source_id       UUID,
  media_type      TEXT,
  display_r2_key  TEXT,
  thumb_r2_key    TEXT,
  poster_r2_key   TEXT,
  clip_web_r2_key TEXT,
  captured_at     TIMESTAMPTZ,
  linked          BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event UUID;
  v_fb    BOOLEAN;
BEGIN
  -- The guest is the capability (route-validated cookie yields p_guest_id).
  SELECT g.event_id INTO v_event
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN RETURN; END IF;

  -- COUPLE TOGGLE gate — flag off ⇒ empty (the inert hold; retroactive close).
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.event_id = v_event AND e.pool_gallery_open
  ) THEN RETURN; END IF;

  -- FaceBlock event? (wall v2 rule: FB ⇒ only baked-blur derivatives serve.)
  v_fb := EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.event_id = v_event AND g.faceblock_enabled AND g.deleted_at IS NULL
  );

  RETURN QUERY
  SELECT * FROM (
    SELECT
      'papic_photos'::text                                        AS source_table,
      pp.photo_id                                                 AS source_id,
      pp.photo_type                                               AS media_type,
      -- FB event: serve ONLY the baked-blur wall_safe derivative; the
      -- un-blurred thumb/display/poster/clip_web must never escape.
      CASE WHEN v_fb THEN pp.wall_safe_r2_key ELSE pp.display_r2_key END AS display_r2_key,
      CASE WHEN v_fb THEN NULL ELSE pp.thumb_r2_key END           AS thumb_r2_key,
      CASE WHEN v_fb THEN NULL ELSE pp.poster_r2_key END          AS poster_r2_key,
      CASE WHEN v_fb THEN NULL ELSE pp.clip_web_r2_key END        AS clip_web_r2_key,
      pp.captured_at                                              AS captured_at,
      EXISTS (
        SELECT 1 FROM public.photo_tags pt
        WHERE pt.source_table = 'papic_photos' AND pt.source_id = pp.photo_id
          AND pt.guest_id = p_guest_id AND pt.removed_at IS NULL
      )                                                           AS linked
    FROM public.papic_photos pp
    WHERE pp.event_id = v_event
      AND pp.moderation_state = 'clean'          -- strict allowlist (#3541)
      AND pp.hidden_at IS NULL                   -- couple hide, retroactive
      AND (                                      -- web copy or skip; NEVER r2_object_key
        (pp.photo_type = 'photo'
          AND (pp.thumb_r2_key IS NOT NULL OR pp.display_r2_key IS NOT NULL))
        OR
        (pp.photo_type = 'clip' AND pp.clip_web_r2_key IS NOT NULL)
      )
      AND (NOT v_fb OR (                         -- FB: baked-blur only, no clips
        pp.photo_type = 'photo'
        AND pp.faceblock_baked_at IS NOT NULL
        AND pp.wall_safe_r2_key IS NOT NULL
      ))
      AND NOT EXISTS (                           -- photo_consent veto (wall rule)
        SELECT 1 FROM public.photo_tags pt2
        JOIN public.guests g2 ON g2.guest_id = pt2.guest_id
        WHERE pt2.source_table = 'papic_photos' AND pt2.source_id = pp.photo_id
          AND g2.photo_consent = FALSE
      )

    UNION ALL

    SELECT
      'papic_guest_captures'::text,
      gc.capture_id,
      gc.media_type,
      CASE WHEN v_fb THEN gc.wall_safe_r2_key ELSE gc.display_r2_key END,
      CASE WHEN v_fb THEN NULL ELSE gc.thumb_r2_key END,
      CASE WHEN v_fb THEN NULL ELSE gc.poster_r2_key END,
      CASE WHEN v_fb THEN NULL ELSE gc.clip_web_r2_key END,
      gc.captured_at,
      EXISTS (
        SELECT 1 FROM public.photo_tags pt
        WHERE pt.source_table = 'papic_guest_captures' AND pt.source_id = gc.capture_id
          AND pt.guest_id = p_guest_id AND pt.removed_at IS NULL
      )
    FROM public.papic_guest_captures gc
    WHERE gc.event_id = v_event
      AND gc.moderation_state = 'clean'
      AND gc.hidden_at IS NULL
      AND (
        (gc.media_type = 'photo'
          AND (gc.thumb_r2_key IS NOT NULL OR gc.display_r2_key IS NOT NULL))
        OR
        (gc.media_type = 'clip' AND gc.clip_web_r2_key IS NOT NULL)
      )
      AND (NOT v_fb OR (
        gc.media_type = 'photo'
        AND gc.faceblock_baked_at IS NOT NULL
        AND gc.wall_safe_r2_key IS NOT NULL
      ))
      AND NOT EXISTS (
        SELECT 1 FROM public.photo_tags pt2
        JOIN public.guests g2 ON g2.guest_id = pt2.guest_id
        WHERE pt2.source_table = 'papic_guest_captures' AND pt2.source_id = gc.capture_id
          AND g2.photo_consent = FALSE
      )
  ) pool
  WHERE pool.captured_at < p_before
  ORDER BY pool.captured_at DESC, pool.source_id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 60), 1), 60);
END;
$$;

REVOKE ALL ON FUNCTION public.guest_pool_gallery(UUID, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_pool_gallery(UUID, TIMESTAMPTZ, INT) TO service_role;
COMMENT ON FUNCTION public.guest_pool_gallery(UUID, TIMESTAMPTZ, INT) IS
  'Pool Gallery browse: the WHOLE event Papic pool for a session guest. Empty unless events.pool_gallery_open. Strict outbound stack: clean allowlist + hidden_at NULL + web-copy keys only (never r2_object_key) + FaceBlock baked-blur-only (clips excluded on FB events) + photo_consent veto. Keyset on captured_at DESC, max 60/page. service_role only — called by cookie-validating routes.';

-- ── 3 · Self-link — "I'm in this" (PHOTOS-ONLY in V1) ───────────────────────

CREATE OR REPLACE FUNCTION public.guest_link_capture(
  p_guest_id     UUID,
  p_source_table TEXT,
  p_source_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap     CONSTANT INT := 20;  -- mirrors 20270916200000 (live-only 20-cap)
  v_event   UUID;
  v_fb      BOOLEAN;
  v_in_pool BOOLEAN := FALSE;
  v_current INT;
  v_row     public.photo_tags;
BEGIN
  IF p_source_table NOT IN ('papic_photos', 'papic_guest_captures') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_source');
  END IF;

  SELECT g.event_id INTO v_event
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_guest');
  END IF;

  -- Toggle gate: linking exists only while the pool is open (a guest can only
  -- link what the pool would show them).
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.event_id = v_event AND e.pool_gallery_open
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pool_closed');
  END IF;

  v_fb := EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.event_id = v_event AND g.faceblock_enabled AND g.deleted_at IS NULL
  );

  -- The capture must pass THE SAME pool gates the reader applies — same event,
  -- clean, not hidden, has a web copy, FB-baked when required — AND be a PHOTO
  -- (self-link is photos-only in V1; owner-cleared). The photo_consent veto is
  -- re-checked below too: a vetoed capture is invisible in the pool, and a
  -- manual_pick on it would resurface it in the LINKER's own "Photos of you"/
  -- ZIP (which don't re-apply the veto) — so linking one must fail closed.
  IF p_source_table = 'papic_photos' THEN
    SELECT TRUE INTO v_in_pool
    FROM public.papic_photos pp
    WHERE pp.photo_id = p_source_id
      AND pp.event_id = v_event
      AND pp.photo_type = 'photo'
      AND pp.moderation_state = 'clean'
      AND pp.hidden_at IS NULL
      AND (pp.thumb_r2_key IS NOT NULL OR pp.display_r2_key IS NOT NULL)
      AND (NOT v_fb OR (pp.faceblock_baked_at IS NOT NULL AND pp.wall_safe_r2_key IS NOT NULL));
  ELSE
    SELECT TRUE INTO v_in_pool
    FROM public.papic_guest_captures gc
    WHERE gc.capture_id = p_source_id
      AND gc.event_id = v_event
      AND gc.media_type = 'photo'
      AND gc.moderation_state = 'clean'
      AND gc.hidden_at IS NULL
      AND (gc.thumb_r2_key IS NOT NULL OR gc.display_r2_key IS NOT NULL)
      AND (NOT v_fb OR (gc.faceblock_baked_at IS NOT NULL AND gc.wall_safe_r2_key IS NOT NULL));
  END IF;
  IF v_in_pool IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_pool');
  END IF;

  -- photo_consent veto (mirrors the reader): any tagged non-consenting guest
  -- keeps the capture out of the pool — and out of reach of self-link.
  IF EXISTS (
    SELECT 1 FROM public.photo_tags pt
    JOIN public.guests g2 ON g2.guest_id = pt.guest_id
    WHERE pt.source_table = p_source_table AND pt.source_id = p_source_id
      AND g2.photo_consent = FALSE
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_pool');
  END IF;

  -- Serialize concurrent links on the same capture (papic_complete_mission
  -- pattern) so the cap pre-check below can't race a parallel self-link.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_id::text, 0));

  -- Existing tag for this (capture, guest) — any source, incl. tombstones.
  SELECT * INTO v_row
  FROM public.photo_tags
  WHERE source_table = p_source_table AND source_id = p_source_id
    AND guest_id = p_guest_id;
  IF FOUND THEN
    IF v_row.removed_at IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    IF v_row.removed_by = 'guest' THEN
      -- Revive the guest's OWN tombstone as a manual pick — but only if a live
      -- slot exists (revival is an insert-equivalent against the live cap).
      SELECT count(*) INTO v_current
      FROM public.photo_tags
      WHERE source_table = p_source_table AND source_id = p_source_id
        AND removed_at IS NULL;
      IF v_current >= v_cap THEN
        RETURN jsonb_build_object('ok', false, 'error', 'cap_reached', 'tag_count', v_current);
      END IF;
      UPDATE public.photo_tags
      SET removed_at = NULL, removed_by = NULL, source = 'manual_pick'
      WHERE tag_id = v_row.tag_id;
      RETURN jsonb_build_object(
        'ok', true, 'revived', true,
        'tag_count', v_current + 1, 'cap_reached', (v_current + 1) >= v_cap
      );
    END IF;
    -- A couple/admin removal is FINAL — the guest cannot re-assert.
    RETURN jsonb_build_object('ok', false, 'error', 'removed_by_host');
  END IF;

  -- Live-count pre-check, matching the 20270916200000 trigger EXACTLY
  -- (count removed_at IS NULL, cap 20). MANDATORY: the cap trigger silently
  -- skips at cap — without this an at-cap link would look like success while
  -- inserting nothing.
  SELECT count(*) INTO v_current
  FROM public.photo_tags
  WHERE source_table = p_source_table AND source_id = p_source_id
    AND removed_at IS NULL;
  IF v_current >= v_cap THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cap_reached', 'tag_count', v_current);
  END IF;

  INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
  VALUES (v_event, p_source_table, p_source_id, p_guest_id, 'manual_pick')
  ON CONFLICT (source_table, source_id, guest_id) DO NOTHING;

  -- No false success: confirm the row actually landed live (the trigger may
  -- still have truncated under a racing non-pool writer that doesn't take our
  -- advisory lock, e.g. a QR fan-out).
  IF NOT EXISTS (
    SELECT 1 FROM public.photo_tags
    WHERE source_table = p_source_table AND source_id = p_source_id
      AND guest_id = p_guest_id AND removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cap_reached', 'tag_count', v_cap);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'tag_count', v_current + 1, 'cap_reached', (v_current + 1) >= v_cap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guest_link_capture(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_link_capture(UUID, TEXT, UUID) TO service_role;
COMMENT ON FUNCTION public.guest_link_capture(UUID, TEXT, UUID) IS
  'Pool Gallery self-link ("I''m in this"): inserts a photo_tags row with source=manual_pick for the session guest. PHOTOS-ONLY in V1. Gated on events.pool_gallery_open + the same pool read gates. Live-count 20-cap pre-check matches the 20270916200000 trigger; advisory-locked; revives ONLY the guest''s own tombstone; host removal is final. service_role only.';

-- ── 4 · Unlink — tombstone the guest's OWN manual_pick only ─────────────────

CREATE OR REPLACE FUNCTION public.guest_unlink_capture(
  p_guest_id     UUID,
  p_source_table TEXT,
  p_source_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed INT;
BEGIN
  IF p_source_table NOT IN ('papic_photos', 'papic_guest_captures') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_source');
  END IF;

  -- Soft tombstone (20270131081062 pattern) pinned to the guest's OWN
  -- manual_pick — the auto_face "Not me" action stays its own path, and QR/
  -- table tags placed by others are not the guest's to remove here.
  UPDATE public.photo_tags
  SET removed_at = now(), removed_by = 'guest'
  WHERE source_table = p_source_table AND source_id = p_source_id
    AND guest_id = p_guest_id AND source = 'manual_pick' AND removed_at IS NULL;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Idempotent: 0 rows updated (already unlinked / never linked) is still ok.
  RETURN jsonb_build_object('ok', true, 'removed', v_removed > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.guest_unlink_capture(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_unlink_capture(UUID, TEXT, UUID) TO service_role;
COMMENT ON FUNCTION public.guest_unlink_capture(UUID, TEXT, UUID) IS
  'Pool Gallery unlink: soft-tombstones the session guest''s OWN manual_pick tag (removed_by=guest). Never touches QR/face/table tags or other guests'' rows. Idempotent. service_role only.';

COMMIT;
