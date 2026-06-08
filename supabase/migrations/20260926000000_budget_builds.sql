-- Budget "Build" — saved A/B/C build snapshots (Services takeover · Compare tab).
-- Design: Budget_Build_Services_Takeover_2026-06-08.md (spec corpus).
--
-- A couple can save the current computed budget plan (a basket — Lean/Fits/Stretch —
-- at a given budget + service set) into a named slot (A/B/C) from the Compare tab,
-- then compare saved builds side by side. Couple-OWN under RLS (canonical event-scoped
-- pattern, mirrors budget_allocation_decisions). Additive + idempotent; the table is
-- read/written ONLY behind the BUDGET_BUILD_ENABLED flag, so this changes nothing in
-- production until the flag is flipped. RA 10173: ON DELETE CASCADE from events.

CREATE TABLE IF NOT EXISTS public.budget_builds (
  build_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id),
  -- Slot label: one row per slot per event (A/B/C).
  label        TEXT NOT NULL CHECK (label IN ('A', 'B', 'C')),
  -- Optional human title (defaults to "Build A" etc. in the app).
  title        TEXT,
  -- The budget this build was costed against (pesos).
  budget_php   INTEGER CHECK (budget_php IS NULL OR budget_php >= 0),
  -- Which basket the couple saved.
  basket       TEXT NOT NULL DEFAULT 'fits' CHECK (basket IN ('lean', 'fits', 'stretch')),
  -- The basket total (pesos).
  total_php    INTEGER CHECK (total_php IS NULL OR total_php >= 0),
  -- Full per-category snapshot: { budgetPhp, basket, totalPhp,
  --   leaves: [{ canonicalService, label, amountPhp, rangeLowPhp, rangeHighPhp }] }.
  snapshot     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (event, slot) → re-saving a slot UPSERTs.
CREATE UNIQUE INDEX IF NOT EXISTS budget_builds_event_label_idx
  ON public.budget_builds (event_id, label);

COMMENT ON TABLE public.budget_builds IS
  'Saved A/B/C budget-build snapshots for the Services "Build" takeover Compare tab. Couple-own under RLS; consumed only behind BUDGET_BUILD_ENABLED. RA 10173 erasable (cascade from events). Design: Budget_Build_Services_Takeover_2026-06-08.md.';

ALTER TABLE public.budget_builds ENABLE ROW LEVEL SECURITY;

-- Couple reads only their own event's builds (canonical event-scoped pattern).
DROP POLICY IF EXISTS couple_reads_budget_builds ON public.budget_builds;
CREATE POLICY couple_reads_budget_builds ON public.budget_builds
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Couple inserts builds for their own event; rows are stamped with their uid.
DROP POLICY IF EXISTS couple_inserts_budget_builds ON public.budget_builds;
CREATE POLICY couple_inserts_budget_builds ON public.budget_builds
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND created_by = auth.uid()
  );

-- Couple may overwrite a slot (the upsert path) on their own event.
DROP POLICY IF EXISTS couple_updates_budget_builds ON public.budget_builds;
CREATE POLICY couple_updates_budget_builds ON public.budget_builds
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

-- Couple may delete their own builds (RA 10173 + slot freeing).
DROP POLICY IF EXISTS couple_deletes_budget_builds ON public.budget_builds;
CREATE POLICY couple_deletes_budget_builds ON public.budget_builds
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));
