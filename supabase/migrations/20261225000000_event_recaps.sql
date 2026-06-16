-- ============================================================================
-- Auto-Recap — the "living recap" keepsake (Living Memories pillar · produce-
-- the-keepsake row · 2026-06-15).
--
-- The recap itself is ASSEMBLED ON THE FLY from data that already exists (the
-- couple's love story, their curated gallery, the Papic wall-safe photo stream,
-- the wall-approved Kwento voices). The ONLY new durable state is "has the
-- couple published the PUBLIC recap, and when?" — one row per event.
--
-- Privacy posture (load-bearing): publishing exposes a PUBLIC page that reads
-- ONLY public-safe sources — the couple's own curated `our_photos`, the
-- face-blurred wall-safe derivatives (moderation_state='clean' +
-- wall_safe_r2_key, fail-closed via the existing wall pipeline), and the
-- Kwentos the couple one-tap approved to the wall (wall_eligible=TRUE). The
-- couple's UNBLURRED masters never touch this surface — those live only in the
-- couple-private Kwento Magazine. The public page is rendered by a service-role
-- route, NOT anon RLS, mirroring the Live Wall / Editorial door.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_recaps (
  recap_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One recap per event. ON DELETE CASCADE so a removed event takes its recap.
  event_id        uuid NOT NULL UNIQUE REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- draft       — never published (default)
  -- published   — couple turned the public recap on
  -- unpublished — taken back down (by the couple, or by an admin for RA 10173
  --               recourse); distinct from 'draft' so the history is legible.
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'unpublished')),
  published_at    timestamptz,
  -- Who took it down, when status='unpublished' (couple self-serve vs admin
  -- takedown). NULL while draft/published.
  unpublished_by  text CHECK (unpublished_by IN ('couple', 'admin')),
  -- Forward room for couple knobs (cover pick, section toggles) without a
  -- migration. Empty default = "auto everything".
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- The admin oversight list + the vendor "they published their recap" surface
-- both query the small published set — partial index keeps that read cheap.
CREATE INDEX IF NOT EXISTS idx_event_recaps_published
  ON public.event_recaps (published_at DESC)
  WHERE status = 'published';

-- RLS at CREATE time (canonical lock). Public reads NEVER go through RLS — the
-- public page uses the service-role admin client behind the published gate, so
-- there is intentionally no `TO anon` policy.
ALTER TABLE public.event_recaps ENABLE ROW LEVEL SECURITY;

-- Couple + coordinator (+ admin) can SEE the recap row (drives the dashboard
-- surface + the linked-vendor visibility query, which runs service-role anyway).
CREATE POLICY event_recaps_select ON public.event_recaps
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_recaps.event_id
        AND m.user_id = auth.uid()
        AND m.member_type IN ('couple', 'coordinator')
    )
  );

-- Only the COUPLE writes (publish/unpublish is their privacy call); admin can
-- write for takedown. Coordinator is read-only here by design.
CREATE POLICY event_recaps_write ON public.event_recaps
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_recaps.event_id
        AND m.user_id = auth.uid()
        AND m.member_type = 'couple'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_recaps.event_id
        AND m.user_id = auth.uid()
        AND m.member_type = 'couple'
    )
  );

COMMENT ON TABLE public.event_recaps IS
  'Auto-Recap publish state (one row per event). The recap content is assembled on the fly from existing data; this row only tracks public-publish status. Public page reads public-safe sources only (our_photos + wall-safe derivatives + wall-approved Kwentos), rendered service-role behind the published gate.';
