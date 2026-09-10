-- a_render_key_is_its_own
-- ============================================================================
-- A STORAGE KEY A BROWSER CAN CAUSE TO BE WRITTEN MAY NAME ONLY THAT ROW'S OWN
-- OBJECT — so no row can be used to have the SERVER sign, copy or publish
-- somebody else's private file. (Write side. The serve side re-checks the same
-- rule in the app: lib/moodboard-render-keys.ts, lib/site-media-ref.ts — both
-- halves ship together.)
--
-- ── 1 · MOOD BOARD RENDERS (event_renders.image_key · gallery_image_key) ────
-- Measured on production 2026-09-10 by reading the live objects, not these
-- files' ancestors:
--   • moodboard_finish_render(render_id, p_image_key) and
--     moodboard_attach_gallery_copy(render_id, p_gallery_image_key) are
--     SECURITY DEFINER, GRANT EXECUTE TO authenticated, and checked ONLY that
--     the caller "may act" on the render's event and that the key was not blank.
--   • moodboard_render_caller_may_act admits ANY event_members row — couple,
--     guest, vendor, coordinator — with no member_type filter, and
--     moodboard_begin_render(…, p_credits => 0) makes a render row for nothing.
--   • Every key is then SERVED with the admin R2 credentials, from the PRIVATE
--     setnayan-thread-files bucket — the same bucket that holds couples'
--     payment-proof screenshots and chat attachments:
--       – the couple's own gallery and the admin all-creations page presign
--         image_key;
--       – the cross-couple inspiration pool presigns gallery_image_key for
--         OTHER couples, and "pick" COPIES that object into the PUBLIC media
--         bucket under the picker's own folder.
--   So one member could stamp `payment-proof/…` (or `chat/<thread>/…`) onto a
--   render and be handed a signed link to a stranger's file — or, with share
--   consent (which the same gate lets any member give), have it copied into the
--   public bucket for good.
--
-- THE TOOL, AND WHY IT IS AN EQUALITY, NOT A PREFIX TEST:
--   The only legitimate writer (app/dashboard/[eventId]/studio/mood-board/
--   render-actions.ts, via lib/moodboard-render-keys.ts) mints exactly
--     image_key          renders/<event_id>/<render_id>.(png|jpg|webp)
--     gallery_image_key  render-gallery/<event_id>/<render_id>.jpg
--   so the rule is "the key IS the one this row would have minted" — compared
--   byte-for-byte, with no trimming, no case folding and no pattern language.
--   An allow-list of ONE string cannot be bypassed by a leading space, an
--   `R2://`, a `..` segment or a unicode lookalike: none of them is equal.
--   (#5414's review found a deny-list on 'r2://' beaten by exactly those.)
--
--   Held TWICE, on purpose:
--     a. both RPCs RETURN FALSE on any other key — the refusal the app already
--        treats as a failed render (and refunds) or a missing gallery copy;
--     b. a named CHECK on the table, so NO writer — service role, a future
--        function, a hand-run UPDATE — can store one. That is also what makes
--        moodboard_set_render_featured unable to promote a forged render: a
--        forged key cannot be on any row to be featured.
--
-- ── 2 · EVENT WEBSITE MEDIA (events: hero photo, hero film, site music,
--        our_photos, the Save-the-Date upload background) ────────────────────
-- `authenticated` holds column UPDATE on all five (information_schema.
-- column_privileges, production, 2026-09-10) and couple_can_update_event
-- admits the couple of ANY event — i.e. anyone, since anyone can create an
-- event. The server actions pin some of them (site-chrome, Save-the-Date) and
-- not others (hero photo and living hero accept any 'r2://'), but a PATCH to
-- /rest/v1/events bypasses every action. The PUBLIC wedding site, the
-- editorial, the showcase and the OG images then resolve these through
-- displayUrlForStoredAsset, which presigns ANY bucket it is named — and the
-- Save-the-Date background is additionally READ, resized and re-written next
-- to the original before being presigned. So a couple could point their own
-- hero at `r2://setnayan-thread-files/…` or `r2://setnayan-vendor-verification/
-- …` and their public page would hand every visitor a signed URL to it.
--
-- THE TOOL: an allow-list CHECK. Every legitimate writer uploads to the PUBLIC
-- media bucket (FileUpload bucket="media", the living-hero studio, the
-- Pakanta deliverer), and the resolvers pass a plain http(s) or relative URL
-- through untouched (seeded samples use `/demo/…`) — so a value must BEGIN
-- with exactly one of
--     r2://setnayan-media/     https://     http://     /
-- or be blank. Anchored at the first character with no trimming, so the
-- resolver's own `trim()` can never turn an accepted value into a different
-- ref: whatever passes starts with a non-space character that trim() leaves
-- alone. Pinned by BUCKET, not by event folder, deliberately: the media bucket
-- is served unsigned to the public anyway, so a folder pin buys no secrecy —
-- and the living hero files under `living-heroes/`, which a folder pin would
-- break. The DELETE side's folder pin is #5414's (cleanup-delete-scope.ts).
--
-- Measured 2026-09-10, production: event_renders 0 rows; events holds exactly
-- ONE site-media value (site music, under its own events/<id>/ folder) — so
-- both constraints validate with no backfill and no row becomes un-updatable.
--
-- NOT CHANGED HERE (named): who may start a render / give share consent
-- (moodboard_render_caller_may_act's missing member_type filter) is a product
-- question left to the owner; this migration only pins the keys.
--
-- REVERSIBLE (do not): DROP the three constraints and restore the two
-- functions from 20271201395665 / 20271202349564.
-- ============================================================================

BEGIN;

-- ── 1a · the table refuses a key that is not the row's own ──────────────────
ALTER TABLE public.event_renders
  DROP CONSTRAINT IF EXISTS event_renders_image_key_is_its_own;
ALTER TABLE public.event_renders
  ADD CONSTRAINT event_renders_image_key_is_its_own
  CHECK (
    image_key IS NULL
    OR image_key IN (
      'renders/' || event_id::text || '/' || render_id::text || '.png',
      'renders/' || event_id::text || '/' || render_id::text || '.jpg',
      'renders/' || event_id::text || '/' || render_id::text || '.webp'
    )
  );

ALTER TABLE public.event_renders
  DROP CONSTRAINT IF EXISTS event_renders_gallery_image_key_is_its_own;
ALTER TABLE public.event_renders
  ADD CONSTRAINT event_renders_gallery_image_key_is_its_own
  CHECK (
    gallery_image_key IS NULL
    OR gallery_image_key = 'render-gallery/' || event_id::text || '/' || render_id::text || '.jpg'
  );

-- ── 1b · finish: refuse, as FALSE, any key but the one this render mints ────
CREATE OR REPLACE FUNCTION public.moodboard_finish_render(
  p_render_id UUID,
  p_image_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_own      TEXT;
BEGIN
  IF p_render_id IS NULL OR btrim(COALESCE(p_image_key, '')) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT r.event_id INTO v_event_id
    FROM public.event_renders r
   WHERE r.render_id = p_render_id
     FOR UPDATE;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(v_event_id) THEN
    RETURN FALSE;
  END IF;

  -- 🔑 THE KEY IS THIS RENDER'S OWN OR IT IS NOTHING. Equality against the
  -- three names the writer can mint — no trim, no prefix test, no pattern.
  v_own := 'renders/' || v_event_id::text || '/' || p_render_id::text || '.';
  IF p_image_key NOT IN (v_own || 'png', v_own || 'jpg', v_own || 'webp') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_renders
     SET image_key    = p_image_key,
         completed_at = NOW()
   WHERE render_id    = p_render_id
     AND image_key    IS NULL          -- never overwrite a delivered image
     AND failed_at    IS NULL;         -- never revive a refunded render

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.moodboard_finish_render(UUID, TEXT) IS
  'MB8. Attaches the R2 key to an in-flight render. Refuses (FALSE) any key '
  'that is not exactly renders/<event_id>/<render_id>.(png|jpg|webp) — the one '
  'object this render may name — so no member can point a render at another '
  'file in the private bucket. Also refuses on a row that already has an image '
  'or that has been failed and refunded. Idempotent.';

-- ── 1c · attach the gallery copy: the same rule for the watermarked key ─────
CREATE OR REPLACE FUNCTION public.moodboard_attach_gallery_copy(
  p_render_id         UUID,
  p_gallery_image_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_render_id IS NULL OR btrim(COALESCE(p_gallery_image_key, '')) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT r.event_id INTO v_event_id
    FROM public.event_renders r
   WHERE r.render_id = p_render_id
     FOR UPDATE;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(v_event_id) THEN
    RETURN FALSE;
  END IF;

  -- 🔑 The pool presigns this key for OTHER couples and "pick" copies it into
  -- the public bucket — so it may name only this render's own marked copy.
  IF p_gallery_image_key IS DISTINCT FROM
     ('render-gallery/' || v_event_id::text || '/' || p_render_id::text || '.jpg') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_renders
     SET gallery_image_key = p_gallery_image_key
   WHERE render_id         = p_render_id
     AND gallery_image_key IS NULL       -- never orphan the first copy
     AND image_key         IS NOT NULL   -- there has to be something to mark
     AND failed_at         IS NULL;      -- a refunded render is not a library entry

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.moodboard_attach_gallery_copy(UUID, TEXT) IS
  'MB9. Records the R2 key of the WATERMARKED gallery copy of a delivered '
  'render. The only writer of event_renders.gallery_image_key. Refuses (FALSE) '
  'any key that is not exactly render-gallery/<event_id>/<render_id>.jpg, on a '
  'render with no image, on a failed one, and on one that already has a '
  'gallery copy (overwriting would orphan the first object).';

-- CREATE OR REPLACE keeps the ACL; restated so the grant shape is readable
-- here and cannot silently widen (tests/db/anon-rpc-surface.db.test.ts).
REVOKE ALL ON FUNCTION public.moodboard_finish_render(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_attach_gallery_copy(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moodboard_finish_render(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_attach_gallery_copy(UUID, TEXT) TO authenticated, service_role;

-- ── 2 · event website media may name only the PUBLIC media bucket ──────────
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_site_media_names_only_the_public_bucket;
ALTER TABLE public.events
  ADD CONSTRAINT events_site_media_names_only_the_public_bucket
  CHECK (
    (landing_page_hero_image_url IS NULL
      OR landing_page_hero_image_url ~ '^(r2://setnayan-media/|https?://|/| *$)')
    AND (landing_page_hero_video_r2_key IS NULL
      OR landing_page_hero_video_r2_key ~ '^(r2://setnayan-media/|https?://|/| *$)')
    AND (site_bg_music_r2_key IS NULL
      OR site_bg_music_r2_key ~ '^(r2://setnayan-media/|https?://|/| *$)')
    -- Every top-level string in the gallery — the only elements any reader
    -- resolves (loaders.ts, editor, section-content all filter to strings).
    AND (our_photos IS NULL
      OR NOT jsonb_path_exists(
        our_photos,
        '$[*] ? (@.type() == "string" && !(@ like_regex "^(r2://setnayan-media/|https?://|/| *$)"))'
      ))
    -- The Save-the-Date background is read only when kind = 'upload' and
    -- value is a string (lib/std-backgrounds.ts resolveStdBackground).
    AND (std_background IS NULL
      OR jsonb_typeof(std_background) <> 'object'
      OR (std_background ->> 'kind') IS DISTINCT FROM 'upload'
      OR jsonb_typeof(std_background -> 'value') IS DISTINCT FROM 'string'
      OR (std_background ->> 'value') ~ '^(r2://setnayan-media/|https?://|/| *$)')
  );

COMMENT ON CONSTRAINT events_site_media_names_only_the_public_bucket ON public.events IS
  'The couple-writable website media (hero photo, hero film, site music, '
  'our_photos, the Save-the-Date upload background) may name only the PUBLIC '
  'media bucket, a plain http(s) URL, or a relative path. The public site '
  'presigns these with the admin R2 credentials and presigns ANY bucket named, '
  'so without this a couple could make their own page serve a signed link to a '
  'private file (payment proofs, chat files, government IDs). Anchored at the '
  'first character with no trimming, so the resolver''s trim() cannot turn an '
  'accepted value into a different ref.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor, read-only):
--   SELECT conname FROM pg_constraint
--    WHERE conname IN ('event_renders_image_key_is_its_own',
--                      'event_renders_gallery_image_key_is_its_own',
--                      'events_site_media_names_only_the_public_bucket');   -- 3 rows
--   SELECT pg_get_functiondef('public.moodboard_finish_render(uuid,text)'::regprocedure)
--          LIKE '%renders/%';                                              -- t
--   SELECT pg_get_functiondef('public.moodboard_attach_gallery_copy(uuid,text)'::regprocedure)
--          LIKE '%render-gallery/%';                                       -- t
-- ============================================================================
