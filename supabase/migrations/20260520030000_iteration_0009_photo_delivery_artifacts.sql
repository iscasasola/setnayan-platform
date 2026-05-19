-- ============================================================================
-- 20260520030000_iteration_0009_photo_delivery_artifacts.sql
--
-- PR 4 of 5 for V1 iteration 0009 Photo Delivery.
-- Spec corpus: 0009_photo_delivery/0009_photo_delivery.md
--
-- Adds the join table that tracks per-photo upload state for each release
-- run. The 0009 spec originally placed delivered_to_drive_at / drive_file_id
-- / delivery_attempts / delivery_last_error directly on a unified `photos`
-- table — that table doesn't exist (shipped instead is iteration-specific
-- `papic_photos` per 0012 PR #151), so the per-photo state lives in this
-- join table keyed by (event_id, source_table, source_photo_id).
--
-- Why a join table instead of columns on papic_photos:
--   • Keeps iteration boundaries clean — Photo Delivery state doesn't
--     pollute the Papic capture schema.
--   • Lets Photo Delivery later source from other tables (e.g. a future
--     `photographer_uploads`) without another schema migration.
--   • Re-deliveries skip artifacts where drive_file_id IS NOT NULL via
--     the unique (event_id, source_table, source_photo_id) index.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS · CREATE INDEX IF NOT EXISTS).
-- RLS enabled with no policies — server-side service role only. The panel
-- never reads this table directly (it polls photo_delivery_jobs progress
-- counters which the worker keeps in sync).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.photo_delivery_artifacts (
  artifact_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID NOT NULL
                     REFERENCES public.photo_delivery_jobs(job_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL
                     REFERENCES public.events(event_id) ON DELETE CASCADE,
  source_table       TEXT NOT NULL DEFAULT 'papic_photos'
                     CHECK (source_table IN ('papic_photos')),
                     -- V1: papic_photos only. CHECK widens when a new
                     -- source table joins (e.g. photographer_uploads).
  source_photo_id    UUID NOT NULL,
  r2_object_key      TEXT NOT NULL,
  size_bytes         BIGINT,
  drive_file_id      TEXT,
  uploaded_at        TIMESTAMPTZ,
  attempt_count      INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_text    TEXT,
  last_error_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_delivery_artifacts_job
  ON public.photo_delivery_artifacts(job_id);

-- Worker query: "next batch of artifacts to upload for this event".
-- Filters drive_file_id IS NULL + attempt_count < 5; covers the hot path.
CREATE INDEX IF NOT EXISTS idx_photo_delivery_artifacts_pending
  ON public.photo_delivery_artifacts(event_id, attempt_count, created_at)
  WHERE drive_file_id IS NULL;

-- Re-delivery dedupe: one canonical artifact row per (event, source photo).
-- Re-releases re-use existing rows; previously-uploaded photos (drive_file_id
-- set) get skipped by the worker.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_photo_delivery_artifacts_source
  ON public.photo_delivery_artifacts(event_id, source_table, source_photo_id);

COMMENT ON TABLE public.photo_delivery_artifacts IS
  '0009 Photo Delivery — per-photo upload state. Join row between photo_delivery_jobs and the source-table photo. Re-release re-uses existing artifacts; worker skips rows where drive_file_id IS NOT NULL.';
COMMENT ON COLUMN public.photo_delivery_artifacts.r2_object_key IS
  '0009 Photo Delivery — denormalized from the source row at enqueue time so the worker doesn''t need to re-join papic_photos every tick.';
COMMENT ON COLUMN public.photo_delivery_artifacts.attempt_count IS
  '0009 Photo Delivery — incremented on every upload failure. Worker stops retrying at attempt_count >= 5 (matches the spec''s 5-retry cap).';

ALTER TABLE public.photo_delivery_artifacts ENABLE ROW LEVEL SECURITY;
-- No policies in this PR. Server-side service role only.

COMMIT;
