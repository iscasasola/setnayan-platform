-- ============================================================================
-- A SUPPLIER ULTRA SHARES ITS EVENT ALBUM TO THE EVENT'S STORY
-- (owner rulings, specs DECISION_LOG 2026-11-13: "Story — Supplier Ultra shares its album", "Ultra album share —
--  default", "Story — Supplier Ultra scenes"; drawn in prototypes/approved_2026-11-13/story-suppliers-fable.html v6)
--
--   1 · `vendor_event_album_shares` — ONE row per (shop, event): is this shop's private album for this event shared to
--       the event's story? OFF by default (no row = off; the album promises "Only you see this"). `asked_at` records the
--       one-time ask after the event ("Share your album to <couple>'s story?") so it is asked ONCE. Only a Supplier
--       Ultra's share is ever READ by the story — the plan is checked where the story reads (tier_state at read time),
--       so a shop that moves down a plan stops showing without anybody touching this row.
--   2 · the album holds videos too: `media_kind` ('photo' | 'video'); for a video `r2_object_key` stays the screened
--       still (what every reader already shows and the NSFW gate already checks) and `video_r2_key` is the MP4.
--   3 · the album is counted in the plan's storage: `size_bytes` on each album row, summed into
--       `vendor_storage_used_bytes` — the ONE usage read the Plan row, `/api/upload` and the filing backstop all ask.
--       Rows imported before this migration have no recorded size and count as 0 (nothing is guessed).
--
-- RLS at CREATE TABLE time; the shop's own rows only, on events it is booked on (same helpers as the album itself,
-- migration 20271211104041). The story reads with the service role, server-side, behind the Ultra + shared + screened
-- filters in app/[slug]/_components/editorial/data.ts.
-- ============================================================================
BEGIN;

-- ── 1 · the share switch ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_event_album_shares (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  shared            BOOLEAN NOT NULL DEFAULT FALSE,
  asked_at          TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, event_id)
);

CREATE INDEX IF NOT EXISTS vendor_event_album_shares_event_idx
  ON public.vendor_event_album_shares (event_id) WHERE shared;

COMMENT ON TABLE public.vendor_event_album_shares IS
  'Whether a shop''s private event album (vendor_papic_portfolio_photos) is shared to that event''s story. OFF by '
  'default (no row = off). Only a Supplier Ultra''s share is read by the story (plan checked at read time). asked_at = '
  'the one-time ask after the event. Owner 2026-11-13.';

ALTER TABLE public.vendor_event_album_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_event_album_shares_vendor_read ON public.vendor_event_album_shares;
CREATE POLICY vendor_event_album_shares_vendor_read
  ON public.vendor_event_album_shares
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())   -- once per statement, not per row (policies-ask-once-per-query)
  );

DROP POLICY IF EXISTS vendor_event_album_shares_vendor_insert ON public.vendor_event_album_shares;
CREATE POLICY vendor_event_album_shares_vendor_insert
  ON public.vendor_event_album_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

DROP POLICY IF EXISTS vendor_event_album_shares_vendor_update ON public.vendor_event_album_shares;
CREATE POLICY vendor_event_album_shares_vendor_update
  ON public.vendor_event_album_shares
  FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

REVOKE ALL ON TABLE public.vendor_event_album_shares FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vendor_event_album_shares FROM authenticated;

-- ── 2 · videos in the album ────────────────────────────────────────────────
ALTER TABLE public.vendor_papic_portfolio_photos
  ADD COLUMN IF NOT EXISTS media_kind TEXT NOT NULL DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS video_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_papic_portfolio_photos_media_kind_check'
  ) THEN
    ALTER TABLE public.vendor_papic_portfolio_photos
      ADD CONSTRAINT vendor_papic_portfolio_photos_media_kind_check
      CHECK (media_kind IN ('photo', 'video')
             AND (media_kind = 'video') = (video_r2_key IS NOT NULL)
             AND (size_bytes IS NULL OR size_bytes >= 0));
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_papic_portfolio_photos.media_kind IS
  'photo | video. For a video, r2_object_key is its screened still and video_r2_key the MP4.';
COMMENT ON COLUMN public.vendor_papic_portfolio_photos.size_bytes IS
  'Bytes stored for this album item (still + video). Counted in the shop''s plan storage (vendor_storage_used_bytes). '
  'NULL on rows imported before 2026-11-13 — counted as 0, never guessed.';

-- ── 3 · the album counts in the plan's storage ─────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_storage_used_bytes(p_vendor_profile_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT (
    COALESCE((
      SELECT SUM(COALESCE(m.size_bytes, 0))
        FROM public.supplier_media m
       WHERE m.vendor_profile_id = p_vendor_profile_id
         AND EXISTS (
           SELECT 1 FROM public.event_supplier_files f
            WHERE f.media_id = m.media_id AND f.vendor_profile_id = p_vendor_profile_id
         )
    ), 0)
    + COALESCE((
      SELECT SUM(COALESCE(a.size_bytes, 0))
        FROM public.vendor_papic_portfolio_photos a
       WHERE a.vendor_profile_id = p_vendor_profile_id
    ), 0)
  )::bigint;
$$;
REVOKE ALL ON FUNCTION public.vendor_storage_used_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_storage_used_bytes(uuid) TO service_role;

COMMENT ON FUNCTION public.vendor_storage_used_bytes(uuid) IS
  'What a shop stores against its plan''s storage allowance (owner 2026-11-13, Solo 5 GB · Pro 10 GB · Ultra 15 GB): the size of each stored copy (supplier_media) that at least one of the shop''s event_supplier_files still points at, each copy once, PLUS every item in the shop''s private event albums (vendor_papic_portfolio_photos.size_bytes — owner 2026-11-13, "counted in the supplier''s plan storage"). Service role only — the app resolves the shop from the session first.';

COMMIT;
