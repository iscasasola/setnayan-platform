-- The shared pool blurs and keeps too — the last surface still vetoing.
--
-- Owner ruling 2 of 2026-08-17: *"Withdrawal BLURS and KEEPS the photo, not
-- hides it. Deliberately SOFTER than today, so one guest opting out cannot
-- delete a table of ten people's group shot."*
--
-- ── THE SAME DEFECT, IN A THIRD PLACE ──────────────────────────────────────
-- `guest_pool_gallery` — the whole-pool browse other guests use — carried the
-- SAME two-rules-for-one-promise split the venue wall did:
--
--   FaceBlock         → blur-and-KEEP.  `CASE WHEN v_fb THEN wall_safe_r2_key
--                       ELSE display_r2_key END`, gated on a real bake.
--   Withdrawn consent → VETO.  `AND NOT EXISTS (… photo_consent = FALSE)` —
--                       the capture dropped outright, blurred copy or not.
--
-- So a guest who opted out was REMOVED from the shared pool rather than blurred
-- in it, and everybody else in that frame lost the photo with them. The venue
-- wall was corrected on 2026-08-24 and the public event page on 2026-08-18;
-- this is the last of the three.
--
-- ── ONE PREDICATE, NOT A THIRD COPY OF THE RULE ────────────────────────────
-- 🔑 The blur rule now lives in `papic_capture_needs_blur` (same wave). Both
-- wall functions ask it; this asks it too. Re-inlining the condition here would
-- have been the fourth copy — and the pool is precisely where the two reasons
-- had already drifted apart into different shapes.
--
-- The predicate folds them correctly and keeps their SHAPES:
--   FaceBlock  — event-wide (TRUE for every capture on the event)
--   Withdrawal — per-photo, via tags
-- which is why `v_fb` disappears from the row logic entirely: on a FaceBlock
-- event the predicate is TRUE for every row, reproducing the old event-wide
-- behaviour exactly, while a withdrawal now colours only its own photos.
--
-- ── THE WEB COPY, NOT THE FULL-SIZE JPEG ───────────────────────────────────
-- `wall_safe_r2_key` is a full-size blurred JPEG built for a projector. Serving
-- it to a phone was the exact cost the AVIF pipeline exists to avoid (measured
-- in this repo: display avg 96 KB, max 780 KB). The blurred WEB copies added
-- earlier in this wave are preferred, with the projector file as the fallback
-- for rows baked before they existed:
--   COALESCE(safe_display_r2_key, wall_safe_r2_key)
-- Both are blurred. The fallback is heavier, never barer.
--
-- ⚠ A CLIP THAT NEEDS BLURRING IS STILL DROPPED, NOT SERVED. There is no video
-- blur — `lib/face-blur.ts` bakes stills only — so a clip of somebody who opted
-- out has no safe form and must not appear. That was already true for FaceBlock
-- events and is now true for withdrawals as well: the guard below admits only
-- `photo_type = 'photo'` when a blur is required.
--
-- ⚖ MONOTONE: this can only ever show LESS than before, or the same thing
-- blurred. Nothing that was hidden becomes visible unblurred.
--   • no blur needed     → unchanged
--   • needs blur + bake  → the blurred web copy (previously: nothing)
--   • needs blur, no bake→ withheld (unchanged)
--   • clip needing blur  → withheld (unchanged)

CREATE OR REPLACE FUNCTION public.guest_pool_gallery(
  p_guest_id uuid,
  p_before timestamp with time zone DEFAULT 'infinity'::timestamp with time zone,
  p_limit integer DEFAULT 60
)
RETURNS TABLE(
  source_table text, source_id uuid, media_type text, display_r2_key text,
  thumb_r2_key text, poster_r2_key text, clip_web_r2_key text,
  captured_at timestamp with time zone, linked boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event UUID;
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

  RETURN QUERY
  SELECT * FROM (
    SELECT
      'papic_photos'::text                                        AS source_table,
      pp.photo_id                                                 AS source_id,
      pp.photo_type                                               AS media_type,
      -- Needs a blur ⇒ serve ONLY a blurred derivative; the un-blurred
      -- thumb/display/poster/clip_web must never escape. The web copy is
      -- preferred over the projector-sized JPEG; both are blurred.
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_photos', pp.photo_id)
           THEN COALESCE(pp.safe_display_r2_key, pp.wall_safe_r2_key)
           ELSE pp.display_r2_key END                             AS display_r2_key,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_photos', pp.photo_id)
           THEN pp.safe_thumb_r2_key
           ELSE pp.thumb_r2_key END                               AS thumb_r2_key,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_photos', pp.photo_id)
           THEN NULL ELSE pp.poster_r2_key END                    AS poster_r2_key,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_photos', pp.photo_id)
           THEN NULL ELSE pp.clip_web_r2_key END                  AS clip_web_r2_key,
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
      -- Needs a blur ⇒ a baked STILL with a blurred copy, or nothing. A clip
      -- has no safe form (no video blur exists) and is dropped.
      AND (NOT public.papic_capture_needs_blur(v_event, 'papic_photos', pp.photo_id) OR (
        pp.photo_type = 'photo'
        AND pp.faceblock_baked_at IS NOT NULL
        AND COALESCE(pp.safe_display_r2_key, pp.wall_safe_r2_key) IS NOT NULL
      ))

    UNION ALL

    SELECT
      'papic_guest_captures'::text,
      gc.capture_id,
      gc.media_type,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_guest_captures', gc.capture_id)
           THEN COALESCE(gc.safe_display_r2_key, gc.wall_safe_r2_key)
           ELSE gc.display_r2_key END,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_guest_captures', gc.capture_id)
           THEN gc.safe_thumb_r2_key
           ELSE gc.thumb_r2_key END,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_guest_captures', gc.capture_id)
           THEN NULL ELSE gc.poster_r2_key END,
      CASE WHEN public.papic_capture_needs_blur(v_event, 'papic_guest_captures', gc.capture_id)
           THEN NULL ELSE gc.clip_web_r2_key END,
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
      AND (NOT public.papic_capture_needs_blur(v_event, 'papic_guest_captures', gc.capture_id) OR (
        gc.media_type = 'photo'
        AND gc.faceblock_baked_at IS NOT NULL
        AND COALESCE(gc.safe_display_r2_key, gc.wall_safe_r2_key) IS NOT NULL
      ))
  ) pool
  WHERE pool.captured_at < p_before
  ORDER BY pool.captured_at DESC, pool.source_id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 60), 1), 60);
END;
$function$;

COMMENT ON FUNCTION public.guest_pool_gallery(uuid, timestamptz, integer) IS
  'Shared-pool browse for a cookie-validated guest. Owns every gate: the couple toggle, the strict clean allowlist, hidden_at, and the blur rule via papic_capture_needs_blur — a capture needing a blur serves ONLY a blurred derivative (the web copy, falling back to the projector-sized one), and a CLIP needing a blur is dropped because no video blur exists. Withdrawal BLURS AND KEEPS here as of 2026-08-24 (owner ruling 2026-08-17); it used to veto the capture outright, which removed everyone else in the frame too. Returns web-copy keys only, never the geo-bearing r2_object_key.';

REVOKE ALL ON FUNCTION public.guest_pool_gallery(uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_pool_gallery(uuid, timestamptz, integer) TO service_role;
