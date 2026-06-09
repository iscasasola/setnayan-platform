-- Budget "Build" — per-category FLAGS ("fill this one for me").
-- Plan: Budget_Build_Pin_Solver_Plan_2026-06-09.md §12 (Lock vs Flag).
--
-- A couple FLAGS a budgeted category to have it generated/filled: the solver sources
-- from the shortlist first, else requests next-best from the marketplace (AI auto-picks
-- the best match; regular surfaces options). This table is just the marker (the request);
-- the generation writes to event_vendors 'considering' (the shortlist), not here. Couple-OWN
-- under RLS (mirrors budget_builds). Additive; read/written only behind BUDGET_BUILD_ENABLED.
-- RA 10173: ON DELETE CASCADE from events.

CREATE TABLE IF NOT EXISTS public.budget_category_flags (
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The plan-group / canonical-service key being flagged (matches the allocator leaves).
  plan_group_id  TEXT NOT NULL,
  flagged_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, plan_group_id)
);

COMMENT ON TABLE public.budget_category_flags IS
  'Per-category "fill this for me" flags for the Budget Build takeover (Lock vs Flag · plan §12). Couple-own under RLS; the marker only — generation writes to event_vendors. Consumed only behind BUDGET_BUILD_ENABLED.';

ALTER TABLE public.budget_category_flags ENABLE ROW LEVEL SECURITY;

-- Couple reads their own event's flags.
DROP POLICY IF EXISTS couple_reads_budget_category_flags ON public.budget_category_flags;
CREATE POLICY couple_reads_budget_category_flags ON public.budget_category_flags
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

-- Couple inserts flags for their own event; stamped with their uid.
DROP POLICY IF EXISTS couple_inserts_budget_category_flags ON public.budget_category_flags;
CREATE POLICY couple_inserts_budget_category_flags ON public.budget_category_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND flagged_by = auth.uid()
  );

-- Couple removes their own flags (un-flag).
DROP POLICY IF EXISTS couple_deletes_budget_category_flags ON public.budget_category_flags;
CREATE POLICY couple_deletes_budget_category_flags ON public.budget_category_flags
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );
