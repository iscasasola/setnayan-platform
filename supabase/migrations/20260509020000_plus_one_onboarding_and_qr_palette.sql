-- 0002 v2 — locked 2026-05-09
-- Three additions on top of the prior 0001/0002 schema:
--   1. +1 onboarding write-back column on guests
--   2. QR palette finalization columns on events
--   3. Monogram source split (auto-generated vs uploaded) on events
-- All additive; no existing data is touched.
-- IF NOT EXISTS guards make this safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. +1 onboarding — TBA +1s self-identify their name on first QR scan
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE guests ADD COLUMN IF NOT EXISTS plus_one_name_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN guests.plus_one_name_confirmed_at IS
  'Set when a TBA +1 confirms their identity via the onboarding screen. NULL means the name was set by the couple at row creation (no onboarding needed) OR the TBA hasn''t scanned yet. Distinguishes couple-entered names from guest-self-identified names for the activity feed.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. QR palette finalization — couples lock their palette before QR colors derive
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS palette_finalized_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_color_dark        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_color_light       TEXT;

COMMENT ON COLUMN events.palette_finalized_at IS
  'Timestamp the couple flipped "Lock palette" on the Dress Code widget. Until set, QR generator uses safe black-on-white. Once set, QR colors derive from the locked palette (cached on qr_color_dark/light).';

COMMENT ON COLUMN events.qr_color_dark IS
  'Cached pattern-color hex (e.g. "#1A1A1A") derived from the locked palette OR set explicitly by the couple via the QR Code Widget. Must clear ≥4:1 contrast against qr_color_light. NULL = use safe default.';

COMMENT ON COLUMN events.qr_color_light IS
  'Cached background-color hex derived alongside qr_color_dark. NULL = use safe default.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Monogram source — auto-generated SVG vs couple-uploaded asset
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS monogram_source TEXT NOT NULL DEFAULT 'auto_generated';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_monogram_source_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_monogram_source_check
      CHECK (monogram_source IN ('auto_generated', 'uploaded'));
  END IF;
END $$;

ALTER TABLE events ADD COLUMN IF NOT EXISTS monogram_uploaded_url    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS monogram_uploaded_format TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_monogram_uploaded_format_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_monogram_uploaded_format_check
      CHECK (monogram_uploaded_format IS NULL OR monogram_uploaded_format IN ('svg', 'png'));
  END IF;
END $$;

ALTER TABLE events ADD COLUMN IF NOT EXISTS monogram_uploaded_at     TIMESTAMPTZ;

COMMENT ON COLUMN events.monogram_source IS
  '''auto_generated'' (default) reads from monogram_svg. ''uploaded'' reads from monogram_uploaded_url. Couples switch via the downstream Hero Monogram editor; switching cache-busts all guest QRs (?v=monogram_updated_at).';

COMMENT ON COLUMN events.monogram_uploaded_url IS
  'R2 signed URL of a couple-uploaded monogram asset. SVG (any size ≤1MB) or transparent/white PNG (≥800×800). Used at QR center + hero + print sheet + OG image when monogram_source = ''uploaded''.';
