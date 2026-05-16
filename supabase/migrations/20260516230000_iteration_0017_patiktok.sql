-- ============================================================================
-- Iteration 0017 — Patiktok · Phase 1
-- ============================================================================
-- Seeds the V1 SKU lock (locked 2026-05-16) into service_catalog and creates
-- the render-job tracking table that Phase 2 will populate.
--
-- V1 SKU lock (dual-tier per-day model):
--   patiktok_setnayan_daily  ₱999 / day   — videos auto-post to @SetnayanWeddings
--   patiktok_personal_daily  ₱1,999 / day — videos auto-post to couple BYO TikTok
--   patiktok_video_overage   ₱49 / +10    — soft-cap overage upsell (40-video cap)
--
-- Spec source of truth: 0017_patiktok/0017_patiktok.md § Pricing (lines 150-192).
-- Per the 2026-05-16 SKU lock the retired SKUs (₱2,499/booth/5hr · ₱999 add-station
-- · ₱499/hour · ₱1,499 custom background) are not seeded — they exist only as
-- historical reference rows in earlier migrations if at all.
--
-- This migration ships SKUs with is_active=TRUE per the 2026-05-16 owner
-- decision: couples can apply-then-pay for Patiktok today even though the
-- render pipeline is Phase 2+. Orders sit in pending_application → pending_payment
-- → active per the existing 0034 reconciliation flow.

-- ----------------------------------------------------------------------------
-- 1) SKU seed
-- ----------------------------------------------------------------------------

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, soft_cap,
   is_active, spec_corpus_ref)
VALUES
  ('patiktok_setnayan_daily',
   'Patiktok — Setnayan TikTok (per day)',
   'One day of Patiktok mimic-station booth coverage. Videos auto-post to ' ||
   'Setnayan''s master TikTok handle @SetnayanWeddings; Setnayan retains ' ||
   'ad-revenue upside if the compilation goes viral. Couple gets the post ' ||
   'link plus a downloadable MP4 with Setnayan-owned music. 40-video soft cap ' ||
   'per day; overage stacks at ₱49/+10 videos (SKU patiktok_video_overage).',
   'couple_addon', 99900, 'day',
   TRUE, FALSE, TRUE, 'couple', 40,
   TRUE, '2026-05-16 0017_patiktok.md § Pricing (dual-tier SKU lock)'),
  ('patiktok_personal_daily',
   'Patiktok — Personal TikTok (per day)',
   'One day of Patiktok mimic-station booth coverage. Couple BYO TikTok via ' ||
   'OAuth (one-time handshake at purchase, scopes user.info.basic + ' ||
   'video.upload + video.publish). Videos auto-post to the couple''s own ' ||
   'TikTok handle; couple owns all videos plus analytics plus ad-revenue ' ||
   'upside. 40-video soft cap per day; overage stacks at ₱49/+10 videos.',
   'couple_addon', 199900, 'day',
   TRUE, FALSE, TRUE, 'couple', 40,
   TRUE, '2026-05-16 0017_patiktok.md § Pricing (dual-tier SKU lock)'),
  ('patiktok_video_overage',
   'Patiktok — Video Overage (+10 videos)',
   'Extends a Patiktok booth''s daily video allotment by +10 captures. ' ||
   'Multi-stack: each ₱49 block adds 10 videos. Sold as an in-event upsell ' ||
   'at the booth dashboard when the 40-video soft cap is reached.',
   'couple_addon', 4900, 'pack',
   TRUE, FALSE, FALSE, 'couple', NULL,
   TRUE, '2026-05-16 0017_patiktok.md § Pricing (dual-tier SKU lock)')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  multi_purchase = EXCLUDED.multi_purchase,
  subscription = EXCLUDED.subscription,
  refundable = EXCLUDED.refundable,
  purchaser_role = EXCLUDED.purchaser_role,
  soft_cap = EXCLUDED.soft_cap,
  is_active = EXCLUDED.is_active,
  spec_corpus_ref = EXCLUDED.spec_corpus_ref,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 2) patiktok_render_jobs — couple-facing render-job queue
-- ----------------------------------------------------------------------------
-- Phase 1 creates the table + RLS so Phase 2 (the ffmpeg / Remotion worker)
-- can land without a schema migration. No application code reads or writes
-- this table yet — the render-form scaffold still uses a client-side mock
-- job ID.

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
  enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_render_jobs IS
  'Iteration 0017 Patiktok — per-event render-on-demand jobs. Phase 1 ships ' ||
  'the table + RLS only. Phase 2 wires the ffmpeg/Remotion worker that drains it.';

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
