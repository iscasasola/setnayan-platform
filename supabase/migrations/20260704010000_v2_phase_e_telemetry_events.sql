-- =============================================================================
-- 20260704010000_v2_phase_e_telemetry_events.sql
-- V2 ARCHITECTURAL PIVOT · Phase E schema · telemetry events log table.
-- =============================================================================
--
-- WHY THIS MIGRATION
-- ------------------
-- v2.1 brief § 5 + CLAUDE.md 2026-05-22 fifth row lock the 14-token stacking
-- reward mechanic: when a vendor delivers N distinct Setnayan media services
-- on the same wedding, they earn 1 / 3 / 5 / 7 / 9 / 11 / 14 tokens (capped
-- at 14 for 7+ services). The "did this vendor deliver service X" signal is
-- proven by service-specific telemetry checkpoints — file-volume from Papic,
-- RTMP duration from Panood, WASM render from Patiktok, guest clips from
-- Pabati, Anthropic callback from SDE, transit signal from Camera Bridge,
-- WebSocket from Live Wall — 7 services total.
--
-- Phase E ships the LOGGING SUBSTRATE only. The 7 telemetry endpoints (one
-- per service) write canonical event rows into this table; the actual
-- reward-fanout (counting distinct service codes per vendor per event,
-- calculating stacking reward, granting tokens via consume_vendor_assets()
-- or token_grants_log INSERT) is deferred to V1.x post-pilot per CLAUDE.md
-- third 2026-05-28 row Phase E scope.
--
-- POSTURE — NON-DESTRUCTIVE ADDITIVE ONLY.
-- Mirrors the 20260628000000 Phase A pattern: pure CREATE statements, no
-- ALTER on V1 surfaces, no enum mutations, no column drops. Idempotent
-- via CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS + DROP POLICY
-- IF EXISTS pre-creates. Safe to re-run on any branch.
--
-- WRITE PATH — service-to-platform via INTERNAL_WORKER_SECRET header.
-- The 7 POST endpoints at /api/telemetry/<service> verify the secret then
-- INSERT through the admin client (service-role bypass). No anon/auth-uid
-- check at the SQL layer — the header check at the API layer is the gate.
-- RLS still enabled because admin reads + vendor reads-own happen through
-- the standard authenticated client.
--
-- Source-of-truth blueprint: v2.1 § 5 + § 11.
-- Decision-log: CLAUDE.md third 2026-05-28 row + 2026-05-22 fifth row.
-- =============================================================================

BEGIN;

-- =============================================================================
-- TELEMETRY EVENTS — append-only service signal log.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  event_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code              TEXT NOT NULL,
  checkpoint                TEXT NOT NULL,
  related_event_id          UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
  related_vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  payload                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at              TIMESTAMPTZ,
  token_grant_id            UUID REFERENCES public.token_grants_log(grant_id) ON DELETE SET NULL,
  CONSTRAINT telemetry_events_service_code_chk
    CHECK (service_code IN (
      'papic',
      'panood',
      'patiktok',
      'pabati',
      'sde',
      'camera_bridge',
      'live_wall'
    ))
);

COMMENT ON TABLE public.telemetry_events IS
  'V2 Phase E · service telemetry checkpoints · feeds 14-token stacking reward · CLAUDE.md 2026-05-28 third row';

COMMENT ON COLUMN public.telemetry_events.service_code IS
  '7 V2 media services: papic | panood | patiktok | pabati | sde | camera_bridge | live_wall';

COMMENT ON COLUMN public.telemetry_events.checkpoint IS
  'Service-specific checkpoint name (e.g., papic.upload_complete, panood.rtmp_session_end). Free-text by design — endpoints document their own checkpoint vocabulary.';

COMMENT ON COLUMN public.telemetry_events.payload IS
  'Service-specific JSON payload (file sizes, durations, render IDs). Endpoints log whatever they have; reward-fanout in V1.x decides which fields matter per service.';

COMMENT ON COLUMN public.telemetry_events.processed_at IS
  'NULL until the V1.x reward-fanout job (or admin manual pass) has consumed this row. Set when token_grant_id is stamped OR when admin decides the row is intentionally not-rewardable.';

COMMENT ON COLUMN public.telemetry_events.token_grant_id IS
  'Forward FK to token_grants_log when this telemetry event triggered a reward grant. NULL during Phase E logging-only window; populated during V1.x reward-fanout.';


-- Indexes for the read patterns the admin viewer + V1.x reward-fanout will use.
-- (a) service_code + received_at DESC — admin viewer "latest 50" + per-service
--     filter both walk this index. DESC ordering means the index can satisfy
--     ORDER BY received_at DESC LIMIT 50 without a sort step.
-- (b) related_event_id + received_at DESC — partial index (skip rows where
--     event_id is NULL) for the per-event reward-fanout query "how many
--     distinct service_codes did this vendor hit on this event in the last
--     N days." The partial WHERE clause keeps the index lean since
--     unattached telemetry rows are noise for reward calculation.

CREATE INDEX IF NOT EXISTS idx_telemetry_by_service
  ON public.telemetry_events (service_code, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_by_event
  ON public.telemetry_events (related_event_id, received_at DESC)
  WHERE related_event_id IS NOT NULL;


-- =============================================================================
-- RLS — service writes (via INTERNAL_WORKER_SECRET-gated admin client) +
--       admin reads all + vendor reads own.
-- =============================================================================
--
-- Policy posture:
--   • "service writes" — endpoints use the service-role admin client which
--     bypasses RLS entirely. We still declare an INSERT policy that allows
--     authenticated INSERT (no-op for the worker path · provides a
--     defense-in-depth shape so a future "trusted server-side action" wanting
--     to write telemetry doesn't have to bypass RLS).
--   • "admin reads all" — admin viewer + future reward-fanout admin job both
--     route through is_admin() check.
--   • "vendor reads own" — a vendor's analytics surface (V1.x) should let
--     them see their own telemetry footprint without seeing other vendors'.
--     Matches via the standard owner check: vendor_profiles.user_id = auth.uid()
--     for the related_vendor_profile_id row.

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telemetry_events: admin reads all" ON public.telemetry_events;
CREATE POLICY "telemetry_events: admin reads all"
  ON public.telemetry_events FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "telemetry_events: vendor reads own" ON public.telemetry_events;
CREATE POLICY "telemetry_events: vendor reads own"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (
    related_vendor_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = telemetry_events.related_vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "telemetry_events: authenticated insert" ON public.telemetry_events;
CREATE POLICY "telemetry_events: authenticated insert"
  ON public.telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMIT;
