-- ============================================================================
-- 20270825364600_coordinator_p3_broadcasts.sql
-- Coordinator P3 — day-of broadcast backend (Coordinator_Role_Feature_Spec
-- 2026-07-18 §P3: "wire the coordinator-broadcast-card.tsx stub to
-- coordinator_broadcasts … RLS: coordinator+couple write, members read").
--
-- One table, deliberately minimal: a broadcast is an immutable, event-scoped
-- announcement ("Dinner is moving up 15 minutes — head to the ballroom")
-- composed by the couple or their coordinator on the wedding day and read by
-- everyone on the event via the 0031 day-of grid. No acknowledgments table in
-- this slice — the spec names `broadcast_acknowledgments` as an option, but
-- the shipped card has no ack affordance, so it stays deferred until the UI
-- earns it (prefer-minimal).
--
-- RLS (canonical patterns only, RLS_Policy_Pattern.md §5 — no invented ones):
--   read   — Pattern B member read (`current_event_ids()`: couple + guests +
--            any event member — the day-of surface's existing read model)
--            + delegate read (`current_moderator_event_ids()`, the same pair
--            used by coordinator_feature_recommendations, 20270215220130)
--            + admin observability.
--   write  — INSERT only. Couple via `current_couple_event_ids()` (Pattern B
--            write); coordinator via the schedule-'edit' delegate grant
--            (`moderator_area_level(event_id,'schedule') = 'edit'`) — the
--            exact authority that already owns the run-of-show
--            (event_schedule_blocks_moderator_write, 20261129003000). Both
--            must stamp their own uid.
--   no UPDATE / DELETE — a sent broadcast is immutable (it may already be on
--            guests' screens); event teardown CASCADEs.
--
-- The sender_role label is display-only chrome ("Your coordinator" vs "The
-- couple" attribution on the card); authority comes from RLS, never from it.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.coordinator_broadcasts (
  id                BIGSERIAL PRIMARY KEY,
  broadcast_id      UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  sender_user_id    UUID NOT NULL,
  sender_role       TEXT NOT NULL DEFAULT 'coordinator'
                      CHECK (sender_role IN ('couple', 'coordinator')),
  body              TEXT NOT NULL
                      CHECK (length(body) >= 1 AND length(body) <= 500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coordinator_broadcasts_event_created_idx
  ON public.coordinator_broadcasts (event_id, created_at DESC);

ALTER TABLE public.coordinator_broadcasts ENABLE ROW LEVEL SECURITY;

-- ── Read — everyone on the event (Pattern B member read) ────────────────────
DROP POLICY IF EXISTS coordinator_broadcasts_member_read ON public.coordinator_broadcasts;
CREATE POLICY coordinator_broadcasts_member_read ON public.coordinator_broadcasts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- ── Read — event delegates (coordinator is an event_moderator, not a member) ─
DROP POLICY IF EXISTS coordinator_broadcasts_moderator_read ON public.coordinator_broadcasts;
CREATE POLICY coordinator_broadcasts_moderator_read ON public.coordinator_broadcasts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

-- ── Write — couple (Pattern B write), own uid stamped ───────────────────────
DROP POLICY IF EXISTS coordinator_broadcasts_couple_insert ON public.coordinator_broadcasts;
CREATE POLICY coordinator_broadcasts_couple_insert ON public.coordinator_broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND sender_user_id = auth.uid()
  );

-- ── Write — coordinator holding the schedule-'edit' delegate grant ──────────
DROP POLICY IF EXISTS coordinator_broadcasts_moderator_insert ON public.coordinator_broadcasts;
CREATE POLICY coordinator_broadcasts_moderator_insert ON public.coordinator_broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.moderator_area_level(event_id, 'schedule') = 'edit'
    AND sender_user_id = auth.uid()
  );

-- ── Admin observability ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS coordinator_broadcasts_admin_read ON public.coordinator_broadcasts;
CREATE POLICY coordinator_broadcasts_admin_read ON public.coordinator_broadcasts
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.coordinator_broadcasts IS
  'Coordinator P3: immutable day-of announcements (couple + schedule-edit coordinator write, every event member reads) rendered by the 0031 day-of grid''s broadcast card.';
COMMENT ON COLUMN public.coordinator_broadcasts.sender_role IS
  'Display attribution only (couple | coordinator). Authority is enforced by RLS, never by this label.';

COMMIT;
