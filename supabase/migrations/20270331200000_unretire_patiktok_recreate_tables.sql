-- ============================================================================
-- Iteration 0017 — Patiktok · UN-RETIRE (reverse the 2026-06-29 product cut)
-- ============================================================================
-- Owner directive 2026-07-01: un-retire Patiktok. The 2026-06-29 retirement
-- (migration 20270319615897_retire_patiktok_drop_tables_and_skus.sql) DROPped
-- the 5 Patiktok-only product tables (all empty in prod at cut) and DELETEd the
-- 6 legacy per-day/overage service_catalog rows. This migration FORWARD-recreates
-- the 5 product tables so the record → render → download pipeline works again.
--
-- WHAT THIS DOES NOT DO (by owner decision, 2026-07-01):
--   • Does NOT re-seed the dead dual-tier per-day pricing
--     (patiktok_setnayan_daily ₱999 / patiktok_personal_daily ₱1,999 /
--     patiktok_video_overage ₱49). That whole pricing axis is RETIRED. Patiktok
--     is now a SINGLE admin-managed SKU keyed `PATIKTOK_COMPILER`, priced in the
--     authoritative V2 retail catalog (`platform_retail_catalog_v2`) — never
--     hardcoded. The retirement migration never touched that row, so the price
--     survives; this migration only re-asserts is_active so the buy CTA renders.
--   • Does NOT re-add Patiktok to any bundle. `bundles_granting_sku()` stays as
--     the retirement migration left it (MEDIA_PACK WITHOUT PATIKTOK_COMPILER);
--     entitlements.ts BUNDLE_CHILD_SKUS is unchanged. Keeps lint:entitlement-gates
--     green (Complete = 16) — Patiktok is an à-la-carte SKU, not a bundle child.
--   • Does NOT recreate `patiktok_music_tracks` — that table was KEPT (renamed to
--     `reel_music_tracks` at retirement, 30 rows + beat_grid + RLS preserved).
--     The render-jobs FK below references the kept `reel_music_tracks(track_slug)`,
--     NOT the old name.
--
-- TikTok auto-post (path-A per-couple OAuth) ships DORMANT — the oauth tables are
-- recreated so the code path is ready, but the buy/record/render/download flow
-- never requires a TikTok grant. The OAuth routes self-disable when
-- TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI are unset (they stay unset until the
-- owner registers the app + clears TikTok's Content-Posting-API audit).
--
-- IDEMPOTENT — every CREATE is IF NOT EXISTS, every policy is DROP+CREATE, the
-- catalog re-assert is a guarded UPDATE. Re-applies cleanly.
--
-- FK targets verified unchanged since the 2027-03 originals: events(event_id),
-- auth.users(id), public.guests(guest_id), public.event_tables(table_id),
-- public.reel_music_tracks(track_slug). Helpers current_event_ids() + is_admin()
-- + event_members(member_type) all present.
--
-- Source CREATE bodies copied verbatim from the originals (still in the ledger):
--   20260516230000_iteration_0017_patiktok.sql               (render_jobs base)
--   20270114810727_iteration_0017_patiktok_capture_render.sql (source_clips,
--                                  render_job_clips, render_jobs ALTER columns)
--   20270304574000_iteration_0017_patiktok_clip_tagging.sql   (clip tag columns)
--   20260516250000_iteration_0017_patiktok_music.sql          (music_track_slug)
--   20260516240000_iteration_0017_patiktok_oauth.sql          (oauth tables)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) patiktok_render_jobs — couple-facing render-job queue
--    (base 20260516230000 + 20270114810727 output/render columns
--     + 20260516250000 music_track_slug, repointed to reel_music_tracks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patiktok_render_jobs (
  job_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  template_slug   TEXT NOT NULL,
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  duration_sec    INTEGER NOT NULL CHECK (duration_sec BETWEEN 1 AND 30),
  performer_count INTEGER NOT NULL DEFAULT 1 CHECK (performer_count >= 1),
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  output_url      TEXT,
  failure_reason  TEXT,
  -- Folded from 20270114810727 (real output + render mode + delivery stamp).
  render_mode     TEXT NOT NULL DEFAULT 'client_webcodecs'
                  CHECK (render_mode IN ('client_webcodecs','client_mediarecorder','server_ffmpeg')),
  output_bucket     TEXT,
  output_object_key TEXT,
  output_bytes      BIGINT,
  delivered_at      TIMESTAMPTZ,
  -- Folded from 20260516250000 — references the KEPT reel_music_tracks (the old
  -- patiktok_music_tracks was renamed at retirement, NOT dropped).
  music_track_slug  TEXT REFERENCES public.reel_music_tracks(track_slug) ON DELETE SET NULL,
  enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_render_jobs IS
  'Iteration 0017 Patiktok — per-event render-on-demand jobs (un-retired 2026-07-01). Client-side WebCodecs render PUTs to R2; a service-role action finalizes the row. music_track_slug -> reel_music_tracks (the kept owned-AI catalogue).';
COMMENT ON COLUMN public.patiktok_render_jobs.render_mode IS
  'How the reel was encoded. Default client_webcodecs (owner-locked 2026-06-18); client_mediarecorder is the fallback for browsers without WebCodecs; server_ffmpeg reserved for a future server path.';
COMMENT ON COLUMN public.patiktok_render_jobs.output_object_key IS
  'R2 object key of the rendered MP4 (bucket in output_bucket). Resolved to a public URL at read via publicUrlFor. Supersedes the Phase 1 output_url placeholder.';
COMMENT ON COLUMN public.patiktok_render_jobs.delivered_at IS
  'When the "your Patiktok reel is ready" email went out. NULL until delivered.';

CREATE INDEX IF NOT EXISTS patiktok_render_jobs_event_status_enqueued_idx
  ON public.patiktok_render_jobs (event_id, status, enqueued_at);

ALTER TABLE public.patiktok_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_member_reads_patiktok_render_jobs ON public.patiktok_render_jobs;
CREATE POLICY event_member_reads_patiktok_render_jobs ON public.patiktok_render_jobs
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS couple_inserts_patiktok_render_jobs ON public.patiktok_render_jobs;
CREATE POLICY couple_inserts_patiktok_render_jobs ON public.patiktok_render_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS admin_updates_patiktok_render_jobs ON public.patiktok_render_jobs;
CREATE POLICY admin_updates_patiktok_render_jobs ON public.patiktok_render_jobs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2) patiktok_source_clips — one row per booth-recorded clip
--    (base 20270114810727 + 20270304574000 guest/table tagging columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patiktok_source_clips (
  clip_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  template_slug   TEXT,
  captured_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  r2_bucket       TEXT NOT NULL DEFAULT 'setnayan-media',
  r2_object_key   TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'video/webm',
  duration_sec    NUMERIC(6,2) CHECK (duration_sec IS NULL OR duration_sec > 0),
  width           INTEGER,
  height          INTEGER,
  size_bytes      BIGINT,
  performer_label TEXT,
  status          TEXT NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploading','uploaded','included','discarded','failed')),
  -- Folded from 20270304574000 — booth guest tagging (all nullable;
  -- untagged-still-delivered guarantee). ON DELETE SET NULL never orphans footage.
  guest_id        UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  table_id        UUID REFERENCES public.event_tables(table_id) ON DELETE SET NULL,
  tag_source      TEXT
                  CHECK (tag_source IS NULL OR tag_source IN
                    ('guest_select', 'qr_scan', 'table_qr', 'manual_text', 'auto_face')),
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_source_clips IS
  'Iteration 0017 Patiktok — booth-recorded source clips (one row per recording). The client-side WebCodecs renderer stitches the included clips into the 9:16 reel. r2_object_key points at the uploaded clip on R2.';
COMMENT ON COLUMN public.patiktok_source_clips.guest_id IS
  'Tagged guest (place-card QR scan or guest-list pick). Nullable — clips can be kept untagged. ON DELETE SET NULL.';
COMMENT ON COLUMN public.patiktok_source_clips.table_id IS
  'Table-QR group tag (group shot attributed to a table). Nullable. ON DELETE SET NULL.';
COMMENT ON COLUMN public.patiktok_source_clips.tag_source IS
  'How the tag was set: guest_select | qr_scan | table_qr | manual_text | auto_face (auto_face reserved for the Papic face-tag enrichment).';

CREATE INDEX IF NOT EXISTS patiktok_source_clips_event_status_captured_idx
  ON public.patiktok_source_clips (event_id, status, captured_at);
CREATE INDEX IF NOT EXISTS patiktok_source_clips_event_guest_idx
  ON public.patiktok_source_clips (event_id, guest_id)
  WHERE guest_id IS NOT NULL;

ALTER TABLE public.patiktok_source_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_member_reads_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY event_member_reads_patiktok_source_clips ON public.patiktok_source_clips
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS event_member_inserts_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY event_member_inserts_patiktok_source_clips ON public.patiktok_source_clips
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS event_member_updates_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY event_member_updates_patiktok_source_clips ON public.patiktok_source_clips
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS admin_all_patiktok_source_clips ON public.patiktok_source_clips;
CREATE POLICY admin_all_patiktok_source_clips ON public.patiktok_source_clips
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) patiktok_render_job_clips — ordered job → clip junction (20270114810727)
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
-- 4) TikTok OAuth grants + CSRF state (20260516240000) — DORMANT path-A.
--    Recreated so the per-couple auto-post code path is ready, but the
--    record/render/download flow never requires a grant; the OAuth routes
--    self-disable until TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI are set.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patiktok_oauth_grants (
  grant_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  granted_by        UUID NOT NULL REFERENCES auth.users(id),
  tiktok_open_id    TEXT NOT NULL,
  tiktok_union_id   TEXT,
  tiktok_handle     TEXT,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT NOT NULL,
  scope             TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ,
  revoked_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_oauth_grants IS
  'Iteration 0017 Patiktok — per-event TikTok OAuth grants (path-A auto-post). DORMANT: gated behind TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI env, unset until TikTok Content-Posting-API audit clears. One active grant per event; revoke_at NULL filter applies.';

CREATE UNIQUE INDEX IF NOT EXISTS patiktok_oauth_grants_one_active_per_event
  ON public.patiktok_oauth_grants (event_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.patiktok_oauth_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_member_reads_oauth_grants ON public.patiktok_oauth_grants;
CREATE POLICY event_member_reads_oauth_grants ON public.patiktok_oauth_grants
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS admin_writes_oauth_grants ON public.patiktok_oauth_grants;
CREATE POLICY admin_writes_oauth_grants ON public.patiktok_oauth_grants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.patiktok_oauth_state (
  state_token   TEXT PRIMARY KEY,
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  initiated_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patiktok_oauth_state_created_idx
  ON public.patiktok_oauth_state (created_at);

ALTER TABLE public.patiktok_oauth_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_reads_oauth_state ON public.patiktok_oauth_state;
CREATE POLICY admin_reads_oauth_state ON public.patiktok_oauth_state
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5) Re-establish the single Patiktok SKU in the authoritative V2 retail catalog.
-- ----------------------------------------------------------------------------
-- ⚠ Patiktok is one admin-managed SKU keyed PATIKTOK_COMPILER. The retirement
-- migration (20270319615897) did NOT touch platform_retail_catalog_v2, but a
-- separate POST-MERGE MANUAL MCP CLEANUP on 2026-06-29 DELETED the residual
-- PATIKTOK_COMPILER retail row (see the project_setnayan_patiktok_retired memory).
-- So in prod the row is GONE — a bare UPDATE would no-op and the buy CTA would
-- have no price. This re-INSERTs it (ON CONFLICT DO UPDATE → idempotent whether
-- the row was deleted, exists, or is inactive) and the ADMIN OWNS THE PRICE from
-- here. The seed value re-establishes the LAST admin-set price before deletion
-- (retail_price_php = 1499, the holistic-pass value at 20270103020000) so the
-- catalog is non-empty on day one; this is the catalog SEED, not a code-side
-- hardcoded charge — the charge is always re-resolved from THIS row server-side,
-- and the admin can reprice it in /admin at any time (pricing_admin_managed).
-- ⚠ OWNER SIGN-OFF: this re-seed reverses a deliberate manual deletion AND picks
-- ₱1,499 as the restart price — confirm the intended Patiktok price.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able,
   is_active, description, billing_period)
VALUES
  ('PATIKTOK_COMPILER', 'Patiktok', 1499, 0, false, true,
   'TikTok-style mimic-station booth — unlimited 9:16 vertical recordings of guests, compiled into post-ready reels with Setnayan-owned music.',
   'one_time')
ON CONFLICT (service_code) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = TRUE,
  description = EXCLUDED.description,
  billing_period = EXCLUDED.billing_period,
  updated_at = NOW();
-- NOTE the ON CONFLICT path deliberately does NOT overwrite retail_price_php — if
-- the row already exists (e.g. an env where it was never MCP-deleted), the admin's
-- current price is preserved; only a fresh INSERT uses the 1499 restart seed.
