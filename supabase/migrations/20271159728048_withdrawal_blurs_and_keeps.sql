-- Withdrawing photo consent BLURS the photo and KEEPS it. It no longer hides it.
--
-- Owner ruling 2 of 2026-08-17, verbatim: "Withdrawal BLURS and KEEPS the photo,
-- not hides it. Deliberately SOFTER than today, so one guest opting out cannot
-- delete a table of ten people's group shot."
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
-- The wall applied TWO DIFFERENT RULES to what is one promise:
--
--   FaceBlock         → blur-and-KEEP. The photo projects once a baked blur
--                       derivative exists; un-baked is withheld (fail-closed).
--   Withdrawn consent → VETO. `wall_ingest` names it itself — "G2 —
--                       photo-consent veto via tagged guests" — and excluded the
--                       photo whether or not a blurred copy existed.
--
-- So a guest who withdrew was REMOVED from the wall rather than blurred on it,
-- and every other person in that frame lost the photo with them. That is the
-- outcome the owner ruled against, and it is what production does today.
--
-- A BLURRED COPY WAS ALREADY BEING MADE FOR THEM AND THEN THROWN AWAY.
-- `lib/face-blur.ts` counts `photo_consent = FALSE` guests as a bake trigger in
-- their own right — deliberately NOT gated on owning the wall SKU, so the ruling
-- would reach events that never bought one. That half shipped and is correct.
-- The read path then discarded its output. The producer was already right; only
-- the consumer still vetoed, which is why this migration is small.
--
-- ── WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT ───────────────────────────
-- The withdrawal clause becomes the SAME shape as the FaceBlock clause: a photo
-- tagged with a withdrawn guest must carry a baked blur derivative to project.
-- Un-baked ⇒ still withheld. FAIL-CLOSED IS PRESERVED EXACTLY — at no point does
-- this migration let an unblurred photo of a withdrawn guest onto the wall. The
-- only behaviour that changes is that a BLURRED one may now appear.
--
-- THIS IS A DELIBERATE REDUCTION IN ONE PERSON'S PROTECTION, MADE ON PURPOSE.
-- Before: their photo was gone from the wall. After: it can appear with every
-- detected face blurred into the pixels. The owner weighed exactly this and
-- chose it, because the alternative lets one guest delete a group shot of ten.
-- It is NOT a security fix and must not be described as one.
--
-- NOT TOUCHED:
--   • The FaceBlock clause. Unchanged, character for character.
--   • The NSFW allowlist (G1) — 'unscreened' still never projects.
--   • The hidden / wall_hidden checks, the ORDER BY, the LIMIT 300.
--   • `g2.photo_consent = FALSE` keeps its exact predicate — no `deleted_at`
--     filter is added. Adding one would WIDEN what projects, which is a
--     different decision wearing a tidy-up's clothes.
--   • The couple's own album. These two functions are the venue wall only;
--     ruling 1 keeps the couple's gallery unblurred, and the public event page
--     is a separate surface handled separately.
--
-- Signature, return type, language, volatility, security and search_path are
-- IDENTICAL for both functions — body corrections only, so PostgREST argument
-- resolution and every existing call site are unaffected.

-- ---------------------------------------------------------------------------
-- 1. wall_visible_photos — the READ path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wall_visible_photos(
  p_event_id uuid,
  p_since timestamp with time zone DEFAULT '-infinity'::timestamp with time zone
)
RETURNS SETOF public.wall_feed
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- G2 (owner ruling 2, 2026-08-17) — a photo tagged with a guest who has
    -- WITHDRAWN photo consent must carry a baked blur derivative to project.
    -- This replaced an outright veto: the photo used to be removed from the wall
    -- entirely, taking everyone else in the frame with it.
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.photo_tags pt
        JOIN public.guests g2 ON g2.guest_id = pt.guest_id
        WHERE pt.source_table = wf.source_table AND pt.source_id = wf.source_id
          AND g2.photo_consent = FALSE
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
$function$;

COMMENT ON FUNCTION public.wall_visible_photos(uuid, timestamptz) IS
  'Venue-wall read path. A photo projects only when the NSFW screen passed, it is not hidden, and - for BOTH a FaceBlock event and any photo tagged with a guest who withdrew photo consent - it carries a baked blur derivative. Withdrawal BLURS AND KEEPS (owner ruling 2026-08-17); it used to veto the photo outright, which removed everyone else in the frame too. Un-baked is still withheld in both cases: fail-closed.';

-- ---------------------------------------------------------------------------
-- 2. wall_ingest — the WRITE path. Same rule, same place in the sequence.
-- ---------------------------------------------------------------------------
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
  v_wd     BOOLEAN;
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
  -- everyone. Entitlement now lives ONLY in the app layer
  -- (lib/entitlements.ts FREE_FOR_ALL_SKUS).

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

  -- G2 (owner ruling 2, 2026-08-17) — a photo tagged with a guest who WITHDREW
  -- photo consent must carry a baked blur derivative, exactly like FaceBlock.
  -- This was an outright veto (`… THEN RETURN`), which removed the photo from the
  -- wall and every other person in the frame with it. Un-baked is still withheld,
  -- so the change can only ever surface a BLURRED photo, never a bare one.
  v_wd := EXISTS (
    SELECT 1 FROM public.photo_tags pt
    JOIN public.guests g ON g.guest_id = pt.guest_id
    WHERE pt.source_table = p_source_table AND pt.source_id = p_source_id
      AND g.photo_consent = FALSE
  );
  IF v_wd AND (v_baked IS NULL OR v_safe IS NULL) THEN RETURN; END IF;

  -- Safe key: a baked derivative always wins; otherwise original-as-safe.
  -- Reaching this line un-baked now implies BOTH v_fb and v_wd are FALSE — the
  -- two guards above return otherwise — so the COALESCE can only fall back to
  -- the original on a photo nobody has asked to be blurred.
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

COMMENT ON FUNCTION public.wall_ingest(text, uuid) IS
  'Venue-wall write path. Admits a photo only when the NSFW screen passed and - for BOTH a FaceBlock event and any photo tagged with a guest who withdrew photo consent - a baked blur derivative exists. Withdrawal BLURS AND KEEPS (owner ruling 2026-08-17); the previous G2 vetoed the photo outright. Un-baked is withheld in both cases, so an unblurred photo of a withdrawn guest can never enter the feed.';

-- Grants re-asserted rather than assumed. CREATE OR REPLACE preserves the
-- existing ACL, but this must also be correct if it is ever the first statement
-- to create these functions on a fresh database. Matches production exactly:
-- EXECUTE to service_role only; never anon, never authenticated.
REVOKE ALL ON FUNCTION public.wall_visible_photos(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_ingest(text, uuid)                FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_visible_photos(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.wall_ingest(text, uuid)                TO service_role;
