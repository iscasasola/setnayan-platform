-- ============================================================================
-- 20271284663331_small_copies_of_old_photos.sql
-- SMALL COPIES OF OLD PHOTOS — owner 2026-10-23 ("yes"): the photos uploaded
-- before the browser learned to shrink them are served at full size. Measured
-- that day on the live Discover page: one event's cover (its Main background,
-- `events/<id>/std-background/…-Prenup7.jpg`) is 4,320 KB — the page's largest
-- paint and 81 % of its bytes (shots-2026-10-23/speed/SPEED.md, cause 1).
--
-- Production data changes only through the pipeline or an OWNER action, so this
-- ships the TOOL, not the change: Admin › Papic storage › "Make small copies of
-- old photos" lists the oversized originals (a dry-run count first) and, only
-- when an admin presses it, writes a web-size copy BESIDE each original (same
-- folder, `….web.jpg`), points the cover at the copy, and records the pair here.
-- The original is never deleted or moved; prints keep reading it
-- (`lib/print-set.server.ts` swaps the copy back for the original at print size).
--
-- Scope, first pass: the event cover = the hero row's Main background
-- (`invitation_widgets.config_json -> 'main'`, `{kind:'photo', media:'r2://…'}`),
-- for a picture in that event's own folder of the public media bucket. (The
-- Save-the-Date film's own upload was folded into the Main background by
-- 20271277600211; the hero photo column `landing_page_hero_image_url` is printed
-- at full size and is not touched here.)
--
--   media_web_copies            one row per copy made — the ledger: which
--                               original, which copy, both sizes, who pressed.
--                               RLS on, NO grant to any browser role: the admin
--                               page reads it with the service role behind
--                               requireAdmin (no exposure-surface widening).
--   media_web_copy_candidates() the covers still pointing at an original in the
--                               event's folder that has no copy yet.
--   apply_media_web_copy()      points ONE cover at its copy — only if the cover
--                               still names that original (a couple who changed
--                               it meanwhile is left alone) — and writes the
--                               ledger row in the same statement's transaction.
--
-- Both functions: SECURITY DEFINER, EXECUTE for service_role only. Idempotent:
-- a second press finds nothing (the cover names the copy, which is excluded),
-- and the ledger's UNIQUE (event_id, source, original_ref) holds one row each.
-- Applied ONLY by the pipeline (`supabase db push --include-all`).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.media_web_copies (
  id              BIGSERIAL PRIMARY KEY,
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Where the pointer lives. One source in this first pass; the CHECK names it.
  source          TEXT NOT NULL,
  original_ref    TEXT NOT NULL,
  web_ref         TEXT NOT NULL,
  original_bytes  BIGINT NOT NULL,
  web_bytes       BIGINT NOT NULL,
  made_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  made_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT media_web_copies_source_chk CHECK (source IN ('hero.main')),
  CONSTRAINT media_web_copies_refs_chk CHECK (
    original_ref LIKE 'r2://setnayan-media/events/%'
    AND web_ref LIKE 'r2://setnayan-media/events/%'
    AND web_ref <> original_ref
  ),
  CONSTRAINT media_web_copies_smaller_chk CHECK (original_bytes > 0 AND web_bytes > 0 AND web_bytes < original_bytes),
  CONSTRAINT media_web_copies_one_copy UNIQUE (event_id, source, original_ref)
);

ALTER TABLE public.media_web_copies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.media_web_copies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.media_web_copies_id_seq FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.media_web_copies IS
  'Small copies of old photos (owner 2026-10-23): one row per web-size copy written beside an oversized original. '
  'The original is never deleted; the cover points at web_ref, prints swap back to original_ref. Service role only '
  '(Admin › Papic storage, behind requireAdmin).';

CREATE INDEX IF NOT EXISTS media_web_copies_web_ref_idx ON public.media_web_copies (event_id, web_ref);

-- ── the covers that still point at an original with no copy ─────────────────
CREATE OR REPLACE FUNCTION public.media_web_copy_candidates(p_limit INTEGER DEFAULT 200)
RETURNS TABLE (event_id UUID, original_ref TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.event_id, w.config_json -> 'main' ->> 'media'
    FROM public.invitation_widgets w
   WHERE w.widget_type = 'hero'
     AND jsonb_typeof(w.config_json) = 'object'
     AND jsonb_typeof(w.config_json -> 'main') = 'object'
     AND w.config_json -> 'main' ->> 'kind' = 'photo'
     -- a picture in THIS event's own folder of the public media bucket
     AND (w.config_json -> 'main' ->> 'media') LIKE 'r2://setnayan-media/events/' || w.event_id::text || '/%'
     -- never a copy of a copy
     AND (w.config_json -> 'main' ->> 'media') NOT LIKE '%.web.jpg'
     AND NOT EXISTS (
       SELECT 1 FROM public.media_web_copies c
        WHERE c.event_id = w.event_id
          AND c.source = 'hero.main'
          AND c.original_ref = w.config_json -> 'main' ->> 'media'
     )
   ORDER BY w.event_id
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;

REVOKE ALL ON FUNCTION public.media_web_copy_candidates(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_web_copy_candidates(INTEGER) TO service_role;

-- ── point one cover at its copy, and record it ──────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_media_web_copy(
  p_event_id       UUID,
  p_original_ref   TEXT,
  p_web_ref        TEXT,
  p_original_bytes BIGINT,
  p_web_bytes      BIGINT,
  p_made_by        UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder TEXT := 'r2://setnayan-media/events/' || p_event_id::text || '/';
  v_moved  INTEGER;
BEGIN
  -- The copy sits beside the original, in the same event's folder, and is smaller — or nothing happens.
  IF p_original_ref IS NULL OR p_web_ref IS NULL
     OR p_original_ref NOT LIKE v_folder || '%'
     OR p_web_ref NOT LIKE v_folder || '%'
     OR p_web_ref NOT LIKE '%.web.jpg'
     OR p_web_ref = p_original_ref
     OR COALESCE(p_original_bytes, 0) <= 0
     OR COALESCE(p_web_bytes, 0) <= 0
     OR p_web_bytes >= p_original_bytes THEN
    RETURN FALSE;
  END IF;

  UPDATE public.invitation_widgets w
     SET config_json = jsonb_set(w.config_json, '{main,media}', to_jsonb(p_web_ref))
   WHERE w.event_id = p_event_id
     AND w.widget_type = 'hero'
     AND w.config_json -> 'main' ->> 'kind' = 'photo'
     AND w.config_json -> 'main' ->> 'media' = p_original_ref;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  -- The couple changed their cover since the list was read: leave it, record nothing.
  IF v_moved = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.media_web_copies (event_id, source, original_ref, web_ref, original_bytes, web_bytes, made_by)
  VALUES (p_event_id, 'hero.main', p_original_ref, p_web_ref, p_original_bytes, p_web_bytes, p_made_by)
  ON CONFLICT (event_id, source, original_ref)
  DO UPDATE SET web_ref = EXCLUDED.web_ref, web_bytes = EXCLUDED.web_bytes, made_at = now(), made_by = EXCLUDED.made_by;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_media_web_copy(UUID, TEXT, TEXT, BIGINT, BIGINT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_media_web_copy(UUID, TEXT, TEXT, BIGINT, BIGINT, UUID) TO service_role;

COMMIT;
