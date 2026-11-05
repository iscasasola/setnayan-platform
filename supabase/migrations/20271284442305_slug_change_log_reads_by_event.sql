-- 20271284442305_slug_change_log_reads_by_event.sql
--
-- ⚡ THE MAKER ASKS slug_change_log BY EVENT, AND NOTHING COULD FIND IT FAST (2026-10-23, the speed pass).
--
-- `lib/event-slug-rename.server.ts` `eventHasRenamed` runs on every open of the Event Hub Maker:
--     select id from slug_change_log where entity_type = 'event' and entity_id = $1 limit 1
-- The table's only index is `LOWER(old_slug)` (20260513050000_iteration_0002_invitation.sql) — the redirect lookup —
-- so this read scans the whole log. The log only grows (every slug rotation, events and shops), so the scan grows
-- with it. One plain btree on the two columns the read filters on.
--
-- Idempotent, additive, no data change, no RLS change (an index carries no policy). Applied by the pipeline only
-- (`supabase db push --include-all`); never by hand.
CREATE INDEX IF NOT EXISTS slug_change_log_entity_idx
  ON public.slug_change_log (entity_type, entity_id);
