-- ============================================================================
-- Iteration 0017 — Patiktok · Capture + Render foundation
-- ============================================================================
-- Created via `pnpm migration:new` (prefix auto-allocated to sort last).
-- KEEP IDEMPOTENT — every statement below is IF NOT EXISTS / DROP+CREATE POLICY.
--
-- Phase 1 (20260516230000) shipped `patiktok_render_jobs` (the queue) + RLS but
-- left two holes the render pipeline cannot work without:
--
--   1. There was NOWHERE to store the booth-recorded source clips — no table,
--      no R2 key references. A render job had a template + duration + music but
--      no actual footage to stitch.
--   2. `patiktok_render_jobs` could only record a single placeholder
--      `output_url` string; it had no R2 key, no byte size, no delivery stamp,
--      and no notion of HOW the reel was rendered.
--
-- This migration closes both holes so the real pipeline can land:
--
--   • `patiktok_source_clips`      — one row per booth recording, pointing at an
--                                     R2 object (the uploaded clip).
--   • `patiktok_render_job_clips`  — ordered junction: which clips a given
--                                     render job stitched, in what order.
--   • ALTER `patiktok_render_jobs` — output R2 key/bucket/size + render mode +
--                                     delivery stamp.
--
-- Render-host decision (owner-locked 2026-06-18): renders run CLIENT-SIDE via
-- WebCodecs + mp4-muxer (₱0 server compute — honors the "marginal cost = R2
-- only" rule). The booth tablet / couple browser encodes the 9:16 MP4 and PUTs
-- it to R2; a server action (service role) mints the presigned PUT and
-- finalizes the job row. Couples therefore never UPDATE `patiktok_render_jobs`
-- directly — writes stay admin/service-role, matching Phase 1.
--
-- TikTok auto-post stays deferred (blocked on TikTok's verified-app audit); the
-- shipping slice is record → render → download.
--
-- Spec source of truth: 0017_patiktok/0017_patiktok.md § Render pipeline.

-- ----------------------------------------------------------------------------
-- 1) patiktok_source_clips — one row per booth-recorded clip
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patiktok_source_clips (
  clip_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Template loaded on the booth when this clip was shot (informational; the
  -- render job carries the authoritative template_slug). Nullable so a clip
  -- can be recorded before a template is chosen.
  template_slug   TEXT,
  -- The event member (couple / coordinator running the booth) who captured it.
  -- Nullable to leave room for the future printable-booth-QR session (phase 4.2)
  -- where a phone with no Setnayan account uploads via a scoped token.
  captured_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- R2 location of the recorded clip. Defaults to the public media bucket under
  -- a `patiktok/clips/{event_id}/…` prefix; resolved at read via publicUrlFor.
  r2_bucket       TEXT NOT NULL DEFAULT 'setnayan-media',
  r2_object_key   TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'video/webm',
  duration_sec    NUMERIC(6,2) CHECK (duration_sec IS NULL OR duration_sec > 0),
  width           INTEGER,
  height          INTEGER,
  size_bytes      BIGINT,
  -- Optional guest/performer label captured at the booth.
  performer_label TEXT,
  status          TEXT NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploading','uploaded','included','discarded','failed')),
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_source_clips IS
  'Iteration 0017 Patiktok — booth-recorded source clips (one row per recording). The client-side WebCodecs renderer stitches the included clips into the 9:16 reel. r2_object_key points at the uploaded clip on R2.';

CREATE INDEX IF NOT EXISTS patiktok_source_clips_event_status_captured_idx
  ON public.patiktok_source_clips (event_id, status, captured_at);

ALTER TABLE public.patiktok_source_clips ENABLE ROW LEVEL SECURITY;

-- Event members (couple + coordinators) read their own event's clips.
DROP POLICY IF EXISTS event_member_reads_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY event_member_reads_patiktok_source_clips ON public.patiktok_source_clips
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Event members capture (INSERT) and curate (UPDATE: mark included/discarded)
-- clips on their own event. Booth operation is event-member-scoped so a
-- coordinator can run the station, not just the couple.
DROP POLICY IF EXISTS event_member_inserts_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY event_member_inserts_patiktok_source_clips ON public.patiktok_source_clips
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS event_member_updates_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY event_member_updates_patiktok_source_clips ON public.patiktok_source_clips
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

-- Admin: full control (review queue, failure triage).
DROP POLICY IF EXISTS admin_all_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY admin_all_patiktok_source_clips ON public.patiktok_source_clips
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2) patiktok_render_job_clips — ordered job → clip junction
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patiktok_render_job_clips (
  job_id      UUID NOT NULL REFERENCES public.patiktok_render_jobs(job_id) ON DELETE CASCADE,
  clip_id     UUID NOT NULL REFERENCES public.patiktok_source_clips(clip_id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, clip_id)
);

COMMENT ON TABLE public.patiktok_render_job_clips IS
  'Iteration 0017 Patiktok — ordered junction recording which source clips a render job stitched, and in what order (sort_order).';

CREATE INDEX IF NOT EXISTS patiktok_render_job_clips_job_order_idx
  ON public.patiktok_render_job_clips (job_id, sort_order);

ALTER TABLE public.patiktok_render_job_clips ENABLE ROW LEVEL SECURITY;

-- Read/insert are scoped through the parent render job's event membership.
DROP POLICY IF EXISTS event_member_reads_patiktok_render_job_clips ON public.patiktok_render_job_clips;
CREATE POLICY event_member_reads_patiktok_render_job_clips ON public.patiktok_render_job_clips
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT job_id FROM public.patiktok_render_jobs
      WHERE event_id IN (SELECT public.current_event_ids())
    )
  );

DROP POLICY IF EXISTS event_member_inserts_patiktok_render_job_clips ON public.patiktok_render_job_clips;
CREATE POLICY event_member_inserts_patiktok_render_job_clips ON public.patiktok_render_job_clips
  FOR INSERT TO authenticated
  WITH CHECK (
    job_id IN (
      SELECT job_id FROM public.patiktok_render_jobs
      WHERE event_id IN (SELECT public.current_event_ids())
    )
  );

DROP POLICY IF EXISTS admin_all_patiktok_render_job_clips ON public.patiktok_render_job_clips;
CREATE POLICY admin_all_patiktok_render_job_clips ON public.patiktok_render_job_clips
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) ALTER patiktok_render_jobs — real output + render mode + delivery
-- ----------------------------------------------------------------------------
-- `output_url` (Phase 1) stays for backward-compat, but the canonical pointer
-- is now `output_object_key` resolved to a public URL at read time (R2
-- store-keys-resolve-at-read pattern). The placeholder write is retired.
ALTER TABLE public.patiktok_render_jobs
  ADD COLUMN IF NOT EXISTS render_mode TEXT NOT NULL DEFAULT 'client_webcodecs'
    CHECK (render_mode IN ('client_webcodecs','client_mediarecorder','server_ffmpeg')),
  ADD COLUMN IF NOT EXISTS output_bucket TEXT,
  ADD COLUMN IF NOT EXISTS output_object_key TEXT,
  ADD COLUMN IF NOT EXISTS output_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.patiktok_render_jobs.render_mode IS
  'How the reel was encoded. Default client_webcodecs (owner-locked 2026-06-18); client_mediarecorder is the fallback for browsers without WebCodecs; server_ffmpeg reserved for a future server path.';
COMMENT ON COLUMN public.patiktok_render_jobs.output_object_key IS
  'R2 object key of the rendered MP4 (bucket in output_bucket). Resolved to a public URL at read via publicUrlFor. Supersedes the Phase 1 output_url placeholder.';
COMMENT ON COLUMN public.patiktok_render_jobs.delivered_at IS
  'When the "your Patiktok reel is ready" email went out. NULL until delivered.';
