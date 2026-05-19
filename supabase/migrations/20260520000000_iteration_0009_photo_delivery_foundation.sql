-- ============================================================================
-- 20260520000000_iteration_0009_photo_delivery_foundation.sql
--
-- PR 1 of 5 for V1 iteration 0009 Photo Delivery (Google Drive).
-- Spec corpus: 0009_photo_delivery/0009_photo_delivery.md
-- Engineering brief: ENGINEERING_BRIEF.md at the 0009 worktree root
-- CLAUDE.md decision log: 2026-05-18 "V1.5+ → V1 promotion" row promoted 0009
--                         from deferred to V1; this migration lays the schema.
--
-- Schema foundation for the couple-facing "Release to Drive" flow:
--   • OAuth-connected Google Drive account stored per event (refresh token
--     encrypted; access token cached with expiry).
--   • Drive folder created on first connect and remembered for redelivery.
--   • photo_delivery_status state machine on events drives the panel UI
--     (idle → connected → releasing → uploading → paused | complete | failed).
--   • photo_delivery_jobs table holds per-release run state (file/byte totals,
--     in-progress file pointer, error counters); the frontend polls or
--     subscribes to its newest row for progress.
--
-- Scope explicitly EXCLUDED from this PR (lands in later PRs):
--   (a) `photos` table extensions (delivered_to_drive_at · drive_file_id ·
--       delivery_attempts · delivery_last_error). The `photos` table does
--       not exist in main yet — it ships with the Papic (0012) photos
--       pipeline. When `photos` lands, a follow-up migration adds these
--       four columns.
--   (b) AES-256-GCM helper (`apps/web/lib/encryption.ts`) — PR 2.
--   (c) OAuth start + callback routes reusing the shared Drive OAuth client
--       wired for Papic — PR 3.
--   (d) Cloudflare Queue worker that streams R2 → Drive resumable upload —
--       PR 4.
--   (e) Status polling/SSE + redeliver + disconnect + email templates — PR 5.
--
-- Backwards compatibility:
--   - events ALTER is purely additive (new nullable / defaulted cols).
--   - All idempotent (ADD COLUMN IF NOT EXISTS · CREATE TABLE IF NOT EXISTS).
--   - No DROP, no destructive change. Safe to re-run.
--
-- RLS:
--   - photo_delivery_jobs enables RLS but ships with NO policies in this PR.
--     Server-side service-role writes only until PR 5 wires couple-side reads
--     (couple sees their own event's jobs · admin sees all). Blocking reads
--     by default keeps oauth state + folder ids out of any accidental
--     anon/auth query before policies are designed.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Extend events with Drive connection state + delivery progress
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS photo_delivery_provider            TEXT,
  ADD COLUMN IF NOT EXISTS photo_delivery_oauth_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS photo_delivery_oauth_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_delivery_folder_id           TEXT,
  ADD COLUMN IF NOT EXISTS photo_delivery_folder_name         TEXT,
  ADD COLUMN IF NOT EXISTS photo_delivery_account_email       TEXT,
  ADD COLUMN IF NOT EXISTS photo_delivery_status              TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS photo_delivery_progress_pct        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_delivery_started_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_delivery_completed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_delivery_failed_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photos_released_at                 TIMESTAMPTZ;

-- CHECK constraints applied via DO blocks (idempotent — skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_photo_delivery_provider_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_photo_delivery_provider_check
      CHECK (photo_delivery_provider IS NULL OR photo_delivery_provider IN (
        'google_drive', 'dropbox', 'onedrive', 'icloud'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_photo_delivery_status_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_photo_delivery_status_check
      CHECK (photo_delivery_status IN (
        'idle', 'connected', 'releasing', 'uploading', 'paused', 'complete', 'failed'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_photo_delivery_progress_pct_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_photo_delivery_progress_pct_check
      CHECK (photo_delivery_progress_pct BETWEEN 0 AND 100);
  END IF;
END $$;

COMMENT ON COLUMN public.events.photo_delivery_provider IS
  '0009 Photo Delivery — destination provider for the release. V1 = google_drive only; dropbox/onedrive/icloud reserved for V1.5+.';
COMMENT ON COLUMN public.events.photo_delivery_oauth_token_encrypted IS
  '0009 Photo Delivery — AES-256-GCM-encrypted refresh token (via ENCRYPTION_KEY env). Plaintext access tokens are NOT persisted; they live in the worker memory for the duration of a job.';
COMMENT ON COLUMN public.events.photo_delivery_oauth_expires_at IS
  '0009 Photo Delivery — access token expiry hint from the most recent refresh. Worker re-refreshes on every job start regardless.';
COMMENT ON COLUMN public.events.photo_delivery_folder_id IS
  '0009 Photo Delivery — Drive folder ID created by Setnayan on first connect. Persisted so redelivery hits the same folder.';
COMMENT ON COLUMN public.events.photo_delivery_folder_name IS
  '0009 Photo Delivery — display name of the Drive folder, e.g. "Setnayan · Maria & Juan Wedding · 2026-10-24".';
COMMENT ON COLUMN public.events.photo_delivery_account_email IS
  '0009 Photo Delivery — Google account email captured from OAuth userinfo. Displayed in the panel masked ("m••• @ gmail.com").';
COMMENT ON COLUMN public.events.photo_delivery_status IS
  '0009 Photo Delivery — state machine driving the panel UI. idle → connected → releasing → uploading → (paused | complete | failed).';
COMMENT ON COLUMN public.events.photo_delivery_progress_pct IS
  '0009 Photo Delivery — coarse percentage 0-100 mirrored from the active photo_delivery_jobs row. Updated per-file for responsive UI.';
COMMENT ON COLUMN public.events.photos_released_at IS
  '0009 Photo Delivery — set when the couple clicks "Release to Drive". Trigger flag for the upload worker; non-null = a release has been issued at least once.';

-- ----------------------------------------------------------------------------
-- 2. photo_delivery_jobs — one row per release run (queued / running / done)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.photo_delivery_jobs (
  job_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL
                        REFERENCES public.events(event_id) ON DELETE CASCADE,
  triggered_by_user_id  UUID NOT NULL
                        REFERENCES public.users(user_id),
  status                TEXT NOT NULL CHECK (status IN (
                          'queued', 'running', 'paused', 'complete', 'failed', 'cancelled'
                        )),
  total_files           INTEGER NOT NULL CHECK (total_files >= 0),
  uploaded_files        INTEGER NOT NULL DEFAULT 0 CHECK (uploaded_files >= 0),
  failed_files          INTEGER NOT NULL DEFAULT 0 CHECK (failed_files >= 0),
  total_bytes           BIGINT  NOT NULL CHECK (total_bytes >= 0),
  uploaded_bytes        BIGINT  NOT NULL DEFAULT 0 CHECK (uploaded_bytes >= 0),
  current_file          TEXT,
  current_segment       TEXT,
  last_error_text       TEXT,
  last_error_at         TIMESTAMPTZ,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  notification_sent_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_photo_delivery_jobs_event
  ON public.photo_delivery_jobs(event_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_photo_delivery_jobs_active
  ON public.photo_delivery_jobs(event_id)
  WHERE status IN ('queued', 'running', 'paused');

COMMENT ON TABLE public.photo_delivery_jobs IS
  '0009 Photo Delivery — one row per Release-to-Drive run. Frontend polls or subscribes to the newest row per event_id for progress. Re-delivery skips files where photos.drive_file_id IS NOT NULL AND photos.updated_at < this row''s started_at (logic in PR 4 worker).';
COMMENT ON COLUMN public.photo_delivery_jobs.triggered_by_user_id IS
  '0009 Photo Delivery — couple member who clicked Release. Used in admin debug + audit trail; no RLS dependency.';
COMMENT ON COLUMN public.photo_delivery_jobs.current_file IS
  '0009 Photo Delivery — display-name of the file currently uploading. Worker updates per file so the UI can show "Uploading IMG_0473.jpg · 12 of 4218".';
COMMENT ON COLUMN public.photo_delivery_jobs.last_error_text IS
  '0009 Photo Delivery — most recent Drive API error message (truncated to 500 chars by the worker). Cleared when status flips back to running.';

ALTER TABLE public.photo_delivery_jobs ENABLE ROW LEVEL SECURITY;
-- No policies in this PR (see header). Server-side service role only.

COMMIT;
