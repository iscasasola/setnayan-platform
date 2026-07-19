-- ============================================================================
-- Iteration 0017 — Patiktok · booth clip guest tagging
-- ============================================================================
-- Created via `pnpm migration:new` (prefix auto-allocated to sort last).
-- KEEP IDEMPOTENT — every statement below is ADD COLUMN IF NOT EXISTS /
-- CREATE INDEX IF NOT EXISTS.
--
-- Until now a booth-recorded clip (`patiktok_source_clips`) could only carry a
-- free-text `performer_label` — there was no real link to WHO is in the clip.
-- The booth tagging flow (pick-from-list / scan place-card QR / scan table QR /
-- type a name) needs a durable reference so the reel + gallery can attribute a
-- clip to a guest the same way Papic does (guests.qr_token / event_tables).
--
-- This adds:
--   • guest_id   — the tagged guest (place-card QR or guest-list pick), nullable.
--   • table_id   — a table-QR group tag (group shot at a table), nullable.
--   • tag_source — HOW the tag was set, for analytics + later face-tag merge.
--
-- All nullable: a clip can still be KEPT untagged (untagged-still-delivered
-- guarantee — tagging is enrichment, never a gate). ON DELETE SET NULL so
-- removing a guest/table never orphans or drops the footage. Adding columns
-- does NOT alter the table's existing RLS (event-member read/insert/update).
-- ============================================================================

ALTER TABLE public.patiktok_source_clips
  ADD COLUMN IF NOT EXISTS guest_id   UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_id   UUID REFERENCES public.event_tables(table_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tag_source TEXT
    CHECK (tag_source IS NULL OR tag_source IN
      ('guest_select', 'qr_scan', 'table_qr', 'manual_text', 'auto_face'));

COMMENT ON COLUMN public.patiktok_source_clips.guest_id IS
  'Tagged guest (place-card QR scan or guest-list pick). Nullable — clips can be kept untagged. ON DELETE SET NULL.';
COMMENT ON COLUMN public.patiktok_source_clips.table_id IS
  'Table-QR group tag (group shot attributed to a table). Nullable. ON DELETE SET NULL.';
COMMENT ON COLUMN public.patiktok_source_clips.tag_source IS
  'How the tag was set: guest_select | qr_scan | table_qr | manual_text | auto_face (auto_face reserved for the Papic face-tag enrichment).';

-- Lookups by tagged guest (e.g. "this guest's booth clips" on the gallery).
CREATE INDEX IF NOT EXISTS patiktok_source_clips_event_guest_idx
  ON public.patiktok_source_clips (event_id, guest_id)
  WHERE guest_id IS NOT NULL;
