-- ============================================================================
-- 20261220000000_homepage_hero_frame_keys.sql
-- Store the hero scrub's frame R2 object KEYS as the source of truth.
--
-- Why: the homepage hero (20261217000000) stored only the public frame URLs.
-- When R2_PUBLIC_URL is the S3 API endpoint (its current prod value), those
-- URLs are NOT browser-loadable (SigV4-only → HTTP 400) and the scrub paints
-- blank. Storing the raw R2 keys decouples storage from URL shape: the read
-- path (lib/hero-video.ts) builds display URLs at render time —
--   • short-lived PRESIGNED GETs today (works with the existing R2 creds, no
--     public bucket needed; the homepage is force-dynamic so they regenerate
--     each render and never expire), and
--   • clean PUBLIC URLs automatically once R2_PUBLIC_URL points at the media
--     bucket's public domain (media.setnayan.com / r2.dev).
--
-- Backfills the existing published row by deriving each key from its stored
-- URL (everything after '/setnayan-media/'). Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.homepage_hero_config
  ADD COLUMN IF NOT EXISTS frame_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill keys from the already-stored frame URLs (.../setnayan-media/<key>),
-- preserving order. Runs only when frame_keys is still empty.
UPDATE public.homepage_hero_config h
SET frame_keys = (
  SELECT jsonb_agg(split_part(u, '/setnayan-media/', 2) ORDER BY ord)
  FROM jsonb_array_elements_text(h.frame_urls) WITH ORDINALITY AS t(u, ord)
)
WHERE id = 1
  AND jsonb_array_length(h.frame_keys) = 0
  AND jsonb_array_length(h.frame_urls) > 0;

COMMIT;
