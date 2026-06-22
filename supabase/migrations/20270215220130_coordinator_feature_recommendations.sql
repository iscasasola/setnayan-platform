-- Coordinator "recommend a feature" prompt (owner 2026-06-22).
--
-- A booked coordinator (an accepted event delegate / moderator) can suggest a
-- paid Studio add-on to the couple; the couple sees a "Suggested by your
-- coordinator" badge in the Studio hub and can buy or dismiss it.
--
-- One recommendation per (event, add-on). The coordinator is an event_MODERATOR
-- (role wedding_planner_external), NOT a member_type='coordinator' row — so the
-- coordinator side gates on current_moderator_event_ids() and the couple side on
-- current_couple_event_ids(). Money stays walled off: the coordinator can create
-- + read recommendations but has NO write path to status (buy/dismiss is couple-
-- only), and this table holds no payment data.

CREATE TABLE IF NOT EXISTS public.coordinator_feature_recommendations (
  id                     BIGSERIAL PRIMARY KEY,
  recommendation_id      UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  event_id               UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  recommended_by_user_id UUID NOT NULL,
  addon_key              TEXT NOT NULL,
  note                   TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'dismissed', 'purchased')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at            TIMESTAMPTZ,
  UNIQUE (event_id, addon_key)
);

CREATE INDEX IF NOT EXISTS coordinator_feature_recommendations_event_idx
  ON public.coordinator_feature_recommendations (event_id);

ALTER TABLE public.coordinator_feature_recommendations ENABLE ROW LEVEL SECURITY;

-- ── Coordinator (event delegate / moderator) ──────────────────────────────
-- May create a recommendation for an event they're an accepted delegate of,
-- stamped with their own uid; and read recommendations on those events.
DROP POLICY IF EXISTS cfr_moderator_insert ON public.coordinator_feature_recommendations;
CREATE POLICY cfr_moderator_insert ON public.coordinator_feature_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_moderator_event_ids())
    AND recommended_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS cfr_moderator_select ON public.coordinator_feature_recommendations;
CREATE POLICY cfr_moderator_select ON public.coordinator_feature_recommendations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

-- ── Couple (event owner) ──────────────────────────────────────────────────
-- May read recommendations on their event and resolve them (dismiss / mark
-- purchased). The couple owns every status transition after creation. The
-- UPDATE has no column guard, so a couple could in theory rewrite any column on
-- THEIR OWN event's row (including status='purchased') — but that's inert:
-- entitlement is sourced from the orders table (never this decorative status),
-- and no code reads 'purchased' here. The coordinator has NO update path at all.
DROP POLICY IF EXISTS cfr_couple_select ON public.coordinator_feature_recommendations;
CREATE POLICY cfr_couple_select ON public.coordinator_feature_recommendations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS cfr_couple_update ON public.coordinator_feature_recommendations;
CREATE POLICY cfr_couple_update ON public.coordinator_feature_recommendations
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ── Admin observability ───────────────────────────────────────────────────
DROP POLICY IF EXISTS cfr_admin_select ON public.coordinator_feature_recommendations;
CREATE POLICY cfr_admin_select ON public.coordinator_feature_recommendations
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No DELETE policy: rows are resolved by status (dismissed), never deleted, so
-- a dismissed suggestion can't silently reappear. CASCADE handles event teardown.

-- Consistency with the sibling current_couple_event_ids() grant (a no-op given
-- Postgres' default EXECUTE-to-PUBLIC, but makes the privilege explicit).
GRANT EXECUTE ON FUNCTION public.current_moderator_event_ids() TO authenticated;
