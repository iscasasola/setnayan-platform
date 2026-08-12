-- wall_ingest_follows_the_free_wall
--
-- 🚨 THE WALL WAS FREED FOR EVERYONE AND COULD NEVER RECEIVE A PHOTO.
--
-- PR #4370 made the Live Photo Wall free for every event by short-circuiting the
-- APP-side entitlement predicates (FREE_FOR_ALL_SKUS in lib/entitlements.ts). It
-- freed the READER. The only WRITER — this function, the sole path that inserts
-- into public.wall_feed — was still gated on a completely different mechanism:
--
--     -- G0 — the event owns the Live Wall SKU.
--     IF NOT EXISTS (SELECT 1 FROM public.event_software_activations_v2 a
--                    WHERE a.event_id = v_event AND a.service_code = 'LIVE_WALL')
--     THEN RETURN; END IF;
--
-- So every couple's wall switched ON and stayed permanently EMPTY: the venue
-- screen sits blank after the code is entered, and every guest's phone shows a
-- Live Photo Wall panel promising "photos appear here the moment they're taken"
-- while nothing ever arrives. Worse than the paid wall it replaced, which at
-- least stayed hidden.
--
-- MEASURED IN PRODUCTION, not inferred: 5 events, 14 clean photos, but only 2
-- rows in event_software_activations_v2 for LIVE_WALL and 8 rows in wall_feed —
-- and those 8 were hand-seeded by scripts/seed-sample-event-maria-jose-wall.sql,
-- not ingested. An event holding 13 clean, non-hidden, photo-type captures had
-- ZERO wall_feed rows. G0 is the only gate that explains that.
--
-- 🔑 THE APP-SIDE GATES MOVED OFF event_software_activations_v2 IN THE 2026-06-15
-- "dead-unlock repair" AND THIS SQL WRITER WAS NEVER MOVED WITH THEM. Five
-- separate docblocks record the app-side move; none of them reached here. Nothing
-- couple-facing writes that table any more, so the row it demands is one no
-- ordinary event can obtain — and deactivating the catalog row removed even the
-- theoretical purchase that might once have written it.
--
-- ✅ WHAT THIS CHANGES: G0 is REMOVED. Every other gate is preserved BYTE FOR BYTE
-- and still runs, in the same order:
--   • the missing / hidden / wall-hidden / not-a-photo early return,
--   • G1 — the un-disableable NSFW allowlist ('unscreened' never projects),
--   • FB v2 — FaceBlock events fail CLOSED without a baked blur derivative,
--   • G2 — the per-guest photo-consent veto.
-- Nothing about privacy, moderation or consent is loosened. Entitlement is the
-- ONLY thing that stops being checked here, because the wall is free for every
-- event and there is no longer an entitlement to check. Per-event visibility
-- (events.live_photo_wall_visibility) is enforced by the READER
-- (wall_visible_photos + the loaders), which is untouched.
--
-- ⚠ IF THE WALL EVER BECOMES PAID AGAIN, BOTH HALVES MUST COME BACK TOGETHER:
-- restore a G0 here AND remove LIVE_WALL from FREE_FOR_ALL_SKUS. Restoring only
-- one reproduces exactly one of the two failures this pair has now caused —
-- either a wall nobody can see, or a wall everybody sees and nothing fills.
-- 🔑 ASK "WHAT ELSE GATES THIS?" — a reader and a writer that gate on different
-- mechanisms will not both follow one flip.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.
CREATE OR REPLACE FUNCTION public.wall_ingest(p_source_table text, p_source_id uuid)
RETURNS SETOF public.wall_feed
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- G0 REMOVED 2026-08-12 — the Live Photo Wall is FREE for every event (owner
  -- 2026-08-11: "live photo wall FREE"). It required a row in
  -- event_software_activations_v2 that nothing couple-facing writes any more, so
  -- with the wall switched on for everyone it made the wall permanently empty for
  -- everyone. See this migration's header. Entitlement now lives ONLY in the app
  -- layer (lib/entitlements.ts FREE_FOR_ALL_SKUS).

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
$function$;
