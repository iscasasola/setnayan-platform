-- papic captures unscreened sweep idx
-- ============================================================================
-- Sweep-support partial indexes for the CRON-FREE NSFW re-screen heal
-- (lib/nsfw-screen.ts · reScreenAllStuckCaptures → lib/papic-nsfw-rescreen-sweep.ts).
--
-- screenCapture() is fail-open + fire-and-forget, so a capture whose first screen
-- dropped stays moderation_state='unscreened'. The global heal discovers those
-- rows across BOTH capture tables with:
--     WHERE moderation_state = 'unscreened' AND created_at < <now - 15 min>
-- 'unscreened' is a TRANSIENT state — rows leave it for 'clean'/'nsfw_blocked'
-- almost immediately — so a PARTIAL index on just that set stays tiny and makes
-- the periodic discovery scan cheap (no seq-scan over the whole table as it
-- grows). `created_at` is the index key so the `< cutoff` range + oldest-first
-- ordering are index-served; `event_id` rides along (INCLUDE) so the discovery
-- SELECT is covered.
--
-- Additive + idempotent (CREATE INDEX IF NOT EXISTS). No column/table/RLS change.
-- ============================================================================

CREATE INDEX IF NOT EXISTS papic_photos_unscreened_sweep_idx
  ON public.papic_photos (created_at)
  INCLUDE (event_id)
  WHERE moderation_state = 'unscreened';

CREATE INDEX IF NOT EXISTS papic_guest_captures_unscreened_sweep_idx
  ON public.papic_guest_captures (created_at)
  INCLUDE (event_id)
  WHERE moderation_state = 'unscreened';
