-- ============================================================================
-- 20260513060000_iteration_0002_monogram.sql
-- Branded QR with monogram-in-the-center (closing 0002's last deferral).
--
-- V1 scope: text-based monogram (no PNG/SVG upload, no 25-frame library).
-- The auto-derived default is the first letter of each side joined by "&"
-- (e.g., "Maria & Juan" → "M & J"), computed at render time when monogram_text
-- is NULL. Couples override via the Branding section in the invitation admin.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_text TEXT,
  ADD COLUMN IF NOT EXISTS monogram_color TEXT DEFAULT '#C97B4B',  -- terracotta default
  ADD COLUMN IF NOT EXISTS monogram_updated_at TIMESTAMPTZ;

-- Color must be a 7-char hex code (#rrggbb). Keep the constraint forgiving:
-- NULL or valid hex. Application sanitizes on write.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_monogram_color_format;

ALTER TABLE public.events
  ADD CONSTRAINT events_monogram_color_format
  CHECK (monogram_color IS NULL OR monogram_color ~ '^#[0-9A-Fa-f]{6}$');

COMMIT;
