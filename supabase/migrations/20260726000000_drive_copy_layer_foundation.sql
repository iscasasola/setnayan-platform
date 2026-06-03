-- ============================================================================
-- 20260726000000_drive_copy_layer_foundation.sql
--
-- Keystone (PR 1) of the universal Google-Drive copy layer.
-- Decision: Storage_and_Drive_Copy_Architecture_2026-06-03.md + DECISION_LOG
--           2026-06-03 "Storage & Drive-copy architecture LOCKED".
--
-- The 2026-06-03 owner lock makes Cloudflare R2 the SYSTEM OF RECORD for every
-- artifact Setnayan generates, and Google Drive the couple's PERMANENT COPY of
-- six deliverables — Papic · Patiktok · Pabati · Pakanta · Monogram · QR codes.
-- (Panood is carved out: YouTube live + YouTube archive only, never Drive.)
--
-- This migration lays the generalized copy-tracking schema that ALL six feeders
-- share, replacing the photo-only model of iteration 0009 (photo_delivery_*).
-- It is purely ADDITIVE: the live 0009 Photo Delivery pilot tables are NOT
-- touched, so the pilot flow keeps working while later PRs migrate it onto this
-- layer. The lib counterpart is apps/web/lib/drive-copy.ts.
--
-- Two tables:
--   drive_copy_folders   — per-event Drive folder id cache (root + one
--                          subfolder per artifact type). `drive.file` scope
--                          can't search the couple's Drive, so we must remember
--                          every folder id we create.
--   drive_copy_artifacts — per-file copy state (which R2 object went to which
--                          Drive file id), generalizing photo_delivery_artifacts
--                          across all six artifact types.
--
-- Idempotent (CREATE TABLE/INDEX IF NOT EXISTS). RLS enabled with NO policies —
-- server-side service role only, matching the photo_delivery_artifacts /
-- photo_delivery_jobs convention. A couple-facing "synced to your Drive" read
-- surface lands in a later PR with its own scoped SELECT policy.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. drive_copy_folders — per-event Drive folder id cache
-- ----------------------------------------------------------------------------
-- `kind` = 'root' for the single per-event parent folder, plus one row per
-- artifact type for that type's subfolder. UNIQUE(event_id, kind) makes the
-- find-or-create in lib/drive-copy.ts a simple upsert.

CREATE TABLE IF NOT EXISTS public.drive_copy_folders (
  folder_row_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN (
                    'root', 'papic', 'patiktok', 'pabati', 'pakanta', 'monogram', 'qr_codes'
                  )),
  drive_folder_id TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, kind)
);

COMMENT ON TABLE public.drive_copy_folders IS
  'Drive-copy layer (2026-06-03) — per-event Google Drive folder id cache. kind=root is the event parent folder; the other kinds are per-artifact subfolders. drive.file scope cannot list the couple''s Drive, so every created folder id is remembered here.';

-- ----------------------------------------------------------------------------
-- 2. drive_copy_artifacts — per-file copy state across all six artifact types
-- ----------------------------------------------------------------------------
-- Generalizes photo_delivery_artifacts. source_table / source_ref are nullable
-- because not every artifact is row-backed (e.g. a one-off Pakanta render);
-- the canonical dedupe key is (event_id, r2_object_key) — one Drive copy per R2
-- object per event. Re-runs skip rows where drive_file_id IS NOT NULL.

CREATE TABLE IF NOT EXISTS public.drive_copy_artifacts (
  artifact_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  artifact_type    TEXT NOT NULL CHECK (artifact_type IN (
                     'papic', 'patiktok', 'pabati', 'pakanta', 'monogram', 'qr_codes'
                   )),
  source_table     TEXT,
  source_ref       TEXT,
  r2_object_key    TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  mime_type        TEXT,
  size_bytes       BIGINT,
  -- TRUE when the file copied to Drive was the high-res original (copied
  -- inside the 3-month hot window); FALSE if copied after R2 compression.
  -- Lets the couple's Drive keep the high-res original even after Setnayan
  -- compresses its own R2 copy at T+3 months.
  copied_high_res  BOOLEAN NOT NULL DEFAULT TRUE,
  drive_folder_id  TEXT,
  drive_file_id    TEXT,
  uploaded_at      TIMESTAMPTZ,
  attempt_count    INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_text  TEXT,
  last_error_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, r2_object_key)
);

-- Worker hot path: "next batch of un-copied artifacts for this event".
CREATE INDEX IF NOT EXISTS idx_drive_copy_artifacts_pending
  ON public.drive_copy_artifacts(event_id, attempt_count, created_at)
  WHERE drive_file_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_drive_copy_artifacts_event_type
  ON public.drive_copy_artifacts(event_id, artifact_type);

COMMENT ON TABLE public.drive_copy_artifacts IS
  'Drive-copy layer (2026-06-03) — per-file copy state for the six Drive-copied artifacts (papic/patiktok/pabati/pakanta/monogram/qr_codes). One canonical row per (event_id, r2_object_key); worker skips rows where drive_file_id IS NOT NULL.';
COMMENT ON COLUMN public.drive_copy_artifacts.r2_object_key IS
  'Drive-copy layer — the R2 system-of-record object that gets copied into the couple''s Drive. R2 stays the source of truth; Drive is the couple''s permanent copy.';
COMMENT ON COLUMN public.drive_copy_artifacts.copied_high_res IS
  'Drive-copy layer — TRUE if the copied bytes were the high-res original (copied within the 3-month hot window), FALSE if copied post-compression.';
COMMENT ON COLUMN public.drive_copy_artifacts.attempt_count IS
  'Drive-copy layer — incremented on every upload failure; the worker stops retrying at attempt_count >= 5 (matches the 0009 Photo Delivery retry cap).';

ALTER TABLE public.drive_copy_folders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_copy_artifacts ENABLE ROW LEVEL SECURITY;
-- No policies in this PR. Server-side service role only (folder ids + copy
-- state never reach the browser until a later couple-facing status surface
-- adds a scoped SELECT policy).

COMMIT;
