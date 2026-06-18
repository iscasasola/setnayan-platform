-- Editorial quality scan columns
-- Adds scan_status + scan_flags to event_editorial so the admin review
-- queue can track which editorials have been checked before unlocking
-- for the couple. Three-layer check: OpenAI Moderation (free) catches
-- vulgarity; LanguageTool (free) catches grammar; admin resolves flags.

ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending','scanning','clean','flagged','admin_cleared','skipped')),
  ADD COLUMN IF NOT EXISTS scan_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scan_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlocked_for_couple_at TIMESTAMPTZ;

-- Fast admin queue fetch (only active-review rows)
CREATE INDEX IF NOT EXISTS event_editorial_scan_queue_idx
  ON public.event_editorial(scan_status, scan_completed_at DESC)
  WHERE scan_status IN ('flagged','scanning','pending');

COMMENT ON COLUMN public.event_editorial.scan_status IS
  'pending=not yet scanned · scanning=in progress · clean=no flags (auto-unlocked) · flagged=needs admin review · admin_cleared=admin resolved all red flags · skipped=scan errored, auto-unlocked';

COMMENT ON COLUMN public.event_editorial.scan_flags IS
  'Array of ScanFlag objects: {id, field, label, original, type, severity, suggestion?, status, admin_edit?, resolved_by?, resolved_at?}';
