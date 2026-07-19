-- ============================================================================
-- 20270508316715_render_jobs.sql
--
-- Shared server-side render-job queue (owner 2026-07-03 · build-3 render host).
--
-- The free short reels render in the BROWSER (WebCodecs + mp4-muxer) and ship
-- today. The paid, heavy renders — Patiktok compilation (≤250 clips), Thank You
-- Video (5-min), AI-Highlights — need a server (FFmpeg on Cloudflare Containers).
-- Owner-approved architecture (design note 2026-07-03): ONE shared `render_jobs`
-- table that every paid SKU enqueues into; a Cloudflare Worker drains it and
-- hands each job to a Container running FFmpeg, which reads source + music + LUT
-- from R2, encodes 1080×1920 H.264, writes the MP4 back to R2, and flips the row.
--
-- This migration ships the TABLE + RLS ONLY — inert, exactly like Patiktok
-- Phase 1 (20260516230000) shipped `patiktok_render_jobs` before its worker.
-- No app code reads or writes it yet; the enqueue lib + the Worker/Container
-- (which needs Cloudflare Containers enabled on the account) land in later PRs.
-- Generalizes the proven `patiktok_render_jobs` shape into the one-queue model;
-- `patiktok_render_jobs` stays as-is until it's migrated onto this table.
--
-- RLS uses the canonical helpers (current_event_ids · is_admin) and mirrors the
-- patiktok policies exactly: event members READ, the couple INSERTS for their own
-- event, admin UPDATES. The draining Worker updates via the service role, which
-- bypasses RLS (same as every other worker/side-effect writer). Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.render_jobs (
  job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Which paid render this is (e.g. PATIKTOK_COMPILER, THANK_YOU_VIDEO,
  -- AI_HIGHLIGHT). Kept as free TEXT — SKUs are admin-managed, not a DB enum.
  sku           TEXT NOT NULL,
  requested_by  UUID NOT NULL REFERENCES auth.users(id),
  -- The render inputs the Worker/Container needs: source R2 keys, music track
  -- slug, template/LUT id, target duration, aspect. JSONB so each SKU carries
  -- its own shape without a schema change per SKU.
  spec          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  -- R2 object key of the finished MP4 in the `media` bucket (served via
  -- R2_PUBLIC_URL). Null until the render completes.
  output_key    TEXT,
  error         TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  enqueued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.render_jobs IS
  'Shared server-side render queue (owner 2026-07-03). Paid heavy renders enqueue here; a Cloudflare Worker + FFmpeg Container drains it → R2 media. Table+RLS only for now (inert); the enqueue lib + Worker/Container land in later PRs.';

-- Drainer reads by status oldest-first; per-event reads for the couple's UI.
CREATE INDEX IF NOT EXISTS render_jobs_status_enqueued_idx
  ON public.render_jobs (status, enqueued_at);
CREATE INDEX IF NOT EXISTS render_jobs_event_status_enqueued_idx
  ON public.render_jobs (event_id, status, enqueued_at);

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

-- Event members can READ their event's render jobs (progress + download).
DROP POLICY IF EXISTS event_member_reads_render_jobs ON public.render_jobs;
CREATE POLICY event_member_reads_render_jobs ON public.render_jobs
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Only the couple can enqueue, and only for their own event, as themselves.
DROP POLICY IF EXISTS couple_inserts_render_jobs ON public.render_jobs;
CREATE POLICY couple_inserts_render_jobs ON public.render_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND requested_by = auth.uid()
  );

-- Admins can UPDATE (re-run / cancel from the console). The draining Worker
-- writes via the service role, which bypasses RLS.
DROP POLICY IF EXISTS admin_updates_render_jobs ON public.render_jobs;
CREATE POLICY admin_updates_render_jobs ON public.render_jobs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
