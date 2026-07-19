-- social event recap source
--
-- Auto-post an event's RECAP to Setnayan's OWN Facebook Page + Instagram
-- Business account when the couple publishes their public /[slug]/recap
-- (i.e. the event has completed and they turned the recap on).
--
-- This rides the EXISTING social auto-publish pipeline (social_posts +
-- lib/social/flush.ts dispatch); it does NOT add a parallel posting path. Two
-- schema deltas only:
--
--   1. social_posts.source_type gains 'event_recap' — a recap post is composed
--      with a deterministic source_ref = event_id, so the partial-unique index
--      (source_type, source_ref) makes it compose-ONCE per event (an event can
--      never double-post its recap, even across concurrent flushes).
--
--   2. social_publish_settings.recap_autopost_enabled — a per-FEATURE toggle
--      (default TRUE) so an admin can turn recap auto-posting off independently
--      of the master autopublish switch. Compose is gated on this; dispatch
--      still respects the master switch + per-platform enabled+configured gates.
--
-- Idempotent: guarded ALTERs. RLS is unchanged (both tables are already
-- admin-only under RLS from 20261204000000_social_autopublish.sql).

BEGIN;

-- 1. Allow the new source_type. Drop + recreate the CHECK with the extra value.
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_source_type_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_source_type_check
  CHECK (source_type IN
    ('couple_creation', 'vendor_feature', 'milestone',
     'announcement', 'evergreen', 'event_recap'));

-- 2. Per-feature toggle (default ON — the recap is a marquee moment worth
--    auto-sharing; an admin can flip it OFF from the Integration/Social console
--    without touching the master switch).
ALTER TABLE public.social_publish_settings
  ADD COLUMN IF NOT EXISTS recap_autopost_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.social_publish_settings.recap_autopost_enabled IS
  'When TRUE (default), publishing an event recap composes a social_posts row (source_type=event_recap) that the flush dispatches to Setnayan''s own FB + IG. Independent of the master autopublish_enabled switch, which still gates dispatch.';

COMMIT;
