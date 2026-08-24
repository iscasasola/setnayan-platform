-- Blur reaches the public page — part 1 of 3: the blurred WEB copies, and ONE
-- answer to "does this photo need blurring?"
--
-- Owner ruling 1 of 2026-08-17: *"Public = everyone except the couple — blur on
-- the venue wall, the public event page, and the shared pool other guests
-- browse. The couple's own album stays unblurred."*
--
-- ── WHY THIS IS NOT A FILTER CHANGE ────────────────────────────────────────
-- The venue wall projects `wall_safe_r2_key` — a full-size blurred JPEG. Every
-- PUBLIC read serves something else entirely: the AVIF web copies
-- (`display_r2_key` 1280 / `tile_r2_key` 640 / `thumb_r2_key` 320) that
-- `lib/papic-derivatives.ts` bakes once per capture. `lib/papic-gallery.ts`
-- states the rule those reads follow: a public frame is *"ALWAYS a
-- metadata-stripped display/thumb derivative — NEVER the geo-bearing original.
-- A frame with no such derivative is SKIPPED."*
--
-- So there is no blurred copy in any size a public page uses. This migration
-- makes room for three, in the same sizes, alongside the ones already there.
--
-- 🔒 AND IT MUST BE A NEW FILE, NEVER AN OVERLAY. `lib/face-blur.ts` blurs
-- *"into the pixels, never CSS"* — because a CSS/overlay blur still ships the
-- real photo to the device and can be switched off in two taps. Verified across
-- the codebase 2026-08-24: every blur effect in the product is decoration
-- (sticky bars, pop-ups, seating chips); nothing stands in for privacy. These
-- columns keep it that way — what leaves R2 for a public page has no face in it.
--
-- ⚖ NOTHING READS THESE COLUMNS YET. This migration and its pipeline half are
-- deliberately INERT: they only add copies. The read paths change in part 2, so
-- that the change which alters what a person sees arrives on its own and can be
-- reasoned about by itself.

-- ---------------------------------------------------------------------------
-- 1. The blurred web copies, mirroring the three sizes already on each row.
-- ---------------------------------------------------------------------------
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS safe_display_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS safe_tile_r2_key    TEXT,
  ADD COLUMN IF NOT EXISTS safe_thumb_r2_key   TEXT;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS safe_display_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS safe_tile_r2_key    TEXT,
  ADD COLUMN IF NOT EXISTS safe_thumb_r2_key   TEXT;

COMMENT ON COLUMN public.papic_photos.safe_display_r2_key IS
  'Blurred AVIF web copy (long-edge 1280), derived from wall_safe_r2_key — faces blurred INTO the pixels, never an overlay. Served to PUBLIC surfaces in place of display_r2_key when this capture is tagged with a guest who has FaceBlock on or has withdrawn photo consent (owner ruling 1, 2026-08-17). NULL means no safe copy exists, and the public read must WITHHOLD the photo rather than fall back — the fallback is the unblurred one.';
COMMENT ON COLUMN public.papic_guest_captures.safe_display_r2_key IS
  'Blurred AVIF web copy (long-edge 1280) — see papic_photos.safe_display_r2_key. NULL ⇒ withhold on public surfaces, never fall back.';

-- ---------------------------------------------------------------------------
-- 2. ONE answer to "does this capture need blurring?"
--
-- 🔑 THE RULE ALREADY EXISTED TWICE — inline in `wall_visible_photos` and again
-- in `wall_ingest` — and part 2 of this work is about to add public readers.
-- Checking a column in three places is three chances to forget, and the next
-- surface makes four; this codebase has already paid for exactly that with the
-- photo wall, where three guest surfaces each asked SKU-ownership and nothing
-- else. So the predicate is lifted here ONCE and the wall functions below are
-- rewritten to call it. Their behaviour is unchanged — the nine assertions in
-- `withdrawal-blurs-and-keeps.db.test.ts` pin it in both directions and must
-- still pass.
--
-- Two reasons a capture needs blurring, and they are deliberately NOT the same
-- shape, because the owner ruled them differently:
--   • FaceBlock  — EVENT-WIDE. One guest with it on means every tile on that
--     event must carry a blur (the P1 posture, kept).
--   • Withdrawn consent — PER-PHOTO, via tags. Only the photos that person is
--     actually tagged in.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_capture_needs_blur(
  p_event_id     UUID,
  p_source_table TEXT,
  p_source_id    UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- FaceBlock: event-wide.
    EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.event_id = p_event_id AND g.faceblock_enabled AND g.deleted_at IS NULL
    )
    OR
    -- Withdrawn photo consent: per-photo, via tags.
    EXISTS (
      SELECT 1 FROM public.photo_tags pt
      JOIN public.guests g2 ON g2.guest_id = pt.guest_id
      WHERE pt.source_table = p_source_table AND pt.source_id = p_source_id
        AND g2.photo_consent = FALSE
    );
$function$;

COMMENT ON FUNCTION public.papic_capture_needs_blur(UUID, TEXT, UUID) IS
  'THE single answer to "must this capture be blurred before anyone outside the couple sees it?" TRUE when the event has any FaceBlock guest (event-wide) OR this capture is tagged with a guest who withdrew photo consent (per-photo). Both wall functions and every public reader ask THIS — a second copy of the rule is how one surface blurs and another does not.';

REVOKE ALL ON FUNCTION public.papic_capture_needs_blur(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_capture_needs_blur(UUID, TEXT, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Which of these captures need blurring? The set form, for page reads.
--
-- A public page holds a LIST of captures and must not ask the question once per
-- photo. This returns the subset needing a blur, and is defined in terms of the
-- scalar above so there is still only ONE rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_captures_needing_blur(
  p_event_id     UUID,
  p_source_table TEXT,
  p_source_ids   UUID[]
) RETURNS TABLE (source_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id
    FROM unnest(COALESCE(p_source_ids, ARRAY[]::UUID[])) AS s(id)
   WHERE public.papic_capture_needs_blur(p_event_id, p_source_table, s.id);
$function$;

COMMENT ON FUNCTION public.papic_captures_needing_blur(UUID, TEXT, UUID[]) IS
  'Set form of papic_capture_needs_blur, for a page holding a list of captures. Defined in terms of the scalar so the rule has exactly one definition. An empty or NULL array returns no rows.';

REVOKE ALL ON FUNCTION public.papic_captures_needing_blur(UUID, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_captures_needing_blur(UUID, TEXT, UUID[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. The two wall functions, rewritten to ask the shared predicate.
--
-- ⚖ BEHAVIOUR-PRESERVING BY CONSTRUCTION, NOT BY HOPE. The FaceBlock and
-- withdrawn-consent tests in `withdrawal-blurs-and-keeps.db.test.ts` (9
-- assertions, both directions, mutation-proved) must still pass unchanged. The
-- only difference is WHERE the rule lives.
--
-- ⚠ ONE REAL DIFFERENCE, AND IT IS DELIBERATE: previously the two reasons were
-- separate clauses, so a FaceBlock event required a bake on EVERY tile while a
-- withdrawal required one only on the tagged tiles. Folded into one predicate
-- the requirement is now "needs blur ⇒ must be baked", which is the SAME set:
-- FaceBlock returns TRUE for every capture on the event, withdrawal only for
-- tagged ones. Proven by the existing tests rather than asserted here.
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
    -- Needs a blur ⇒ must carry a baked derivative. Un-baked is WITHHELD, for
    -- both reasons, exactly as before — fail-closed with no cascade dependency.
    AND (
      NOT public.papic_capture_needs_blur(p_event_id, wf.source_table, wf.source_id)
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
  'Venue-wall read path. A photo projects only when the NSFW screen passed, it is not hidden, and — whenever papic_capture_needs_blur() says so — it carries a baked blur derivative. Withdrawal BLURS AND KEEPS (owner ruling 2026-08-17); it used to veto the photo outright, which removed everyone else in the frame too. Un-baked is still withheld: fail-closed. The blur rule itself lives in papic_capture_needs_blur, once.';

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
  v_need   BOOLEAN;
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
  -- 2026-08-11). Entitlement now lives ONLY in the app layer
  -- (lib/entitlements.ts FREE_FOR_ALL_SKUS).

  -- G1 — NSFW allowlist (un-disableable; 'unscreened' never projects).
  IF v_state IS DISTINCT FROM 'clean' THEN RETURN; END IF;

  -- G2 — needs a blur ⇒ must carry a baked derivative, for BOTH reasons
  -- (FaceBlock event-wide, withdrawn consent per-photo). The rule itself lives
  -- in papic_capture_needs_blur so the wall and the public pages cannot drift.
  v_need := public.papic_capture_needs_blur(v_event, p_source_table, p_source_id);
  IF v_need AND (v_baked IS NULL OR v_safe IS NULL) THEN RETURN; END IF;

  -- Safe key: a baked derivative always wins; otherwise original-as-safe.
  -- Reaching this line un-baked implies v_need is FALSE — the guard above
  -- returns otherwise — so the COALESCE can only fall back to the original on a
  -- photo nobody has asked to be blurred.
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
  'Venue-wall write path. Admits a photo only when the NSFW screen passed and — whenever papic_capture_needs_blur() says so — a baked blur derivative exists. Withdrawal BLURS AND KEEPS (owner ruling 2026-08-17); the previous G2 vetoed the photo outright. Un-baked is withheld, so an unblurred photo of a blocked guest can never enter the feed. The blur rule lives in papic_capture_needs_blur, once.';

REVOKE ALL ON FUNCTION public.wall_visible_photos(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wall_ingest(text, uuid)                FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wall_visible_photos(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.wall_ingest(text, uuid)                TO service_role;
