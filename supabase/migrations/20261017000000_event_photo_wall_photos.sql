-- ============================================================================
-- Live Photo Wall — public event-website photo stream
-- ----------------------------------------------------------------------------
-- The Live Venue Photo Wall (SKU `LIVE_WALL` in platform_retail_catalog_v2) is
-- a paid Setnayan add-on: a live collage of event photos shown on the big
-- screen during the wedding. The recap/editorial public page surfaces it as a
-- dedicated "Live Photo Wall" section (gated on an active LIVE_WALL software
-- activation in event_software_activations_v2).
--
-- This column holds the photo stream that section renders. Each entry is a
-- stored-asset ref resolved the same way as events.our_photos
-- (lib/uploads.ts displayUrlForStoredAsset → presigns r2://, passes
-- plain/relative URLs through). Until Papic (iteration 0012) ships its live
-- tagged-photo pipeline, this is populated directly (e.g. demo events).
--
-- Additive + nullable-default → no backfill, no RLS change (the column
-- inherits events' existing row-level security).
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS photo_wall_photos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.photo_wall_photos IS
  'Live Photo Wall image stream (JSONB array of stored-asset refs: r2:// keys '
  'or plain/relative URLs). Rendered as the public recap "Live Photo Wall" '
  'section when a LIVE_WALL activation exists in event_software_activations_v2. '
  'Resolved via lib/uploads.ts displayUrlForStoredAsset, same as our_photos.';
