-- Budget "Build" — tighten budget_builds RLS to COUPLE-ONLY (owner-confirmed 2026-06-09).
-- Design: Budget_Build_Services_Takeover_2026-06-08.md; review row in DECISION_LOG 2026-06-09.
--
-- These are the couple's FINANCIAL snapshots. The original policies (migration
-- 20260926000000) scoped SELECT/UPDATE/DELETE via current_event_ids(), which returns
-- events for ALL member types — so a helper/coordinator on the event could read or
-- delete a couple's budget builds. Only INSERT was couple-only. Owner: "why would we
-- want it to be seen by other?" → scope read/update/delete to member_type='couple'
-- too (and pin created_by on the upsert UPDATE). Zero functional regression: the
-- only writer/reader is the couple-facing takeover, and INSERT was already couple-only.
--
-- NOTE: the sibling budget_allocation_decisions table inherits the same looser
-- pattern; that one is a separate, owner-flagged follow-up (it is a shipped analytics
-- table with established read paths + a Layer-2 de-identified design — not changed here).

-- Couple-only read (was: current_event_ids()).
DROP POLICY IF EXISTS couple_reads_budget_builds ON public.budget_builds;
CREATE POLICY couple_reads_budget_builds ON public.budget_builds
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

-- Couple-only update (the upsert path) + created_by pinned to the writer.
DROP POLICY IF EXISTS couple_updates_budget_builds ON public.budget_builds;
CREATE POLICY couple_updates_budget_builds ON public.budget_builds
  FOR UPDATE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND created_by = auth.uid()
  );

-- Couple-only delete (was: current_event_ids()).
DROP POLICY IF EXISTS couple_deletes_budget_builds ON public.budget_builds;
CREATE POLICY couple_deletes_budget_builds ON public.budget_builds
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

-- INSERT policy (couple_inserts_budget_builds) is already couple-only — left as-is.
