-- ============================================================================
-- 20261230000000_event_category_build_state.sql
-- Build Phase 3d — the 3-State Solver (Build_3State_Solver_2026-06-16.md).
--
-- One per-(event, plan_group_id) row holding the build control's state:
--   'locked'   — fixed to a concrete pick (pinned_vendor_id for a taxonomy row;
--                the value lives on events for the Date/Budget/Location rows)
--   'auto'     — the solver fills this on [Build]
--   'excluded' — left out of the build (also the implicit default)
--
-- CONSOLIDATES the two prior mechanisms into one tri-state:
--   budget_category_flags (the Flag marker, no state column) + event_build_picks
--   (the pinned vendor). Those tables are NOT dropped here — the new surface
--   reads/writes this table only behind the BUILD_3STATE_ENABLED flag, so the
--   live Build (flags + picks) is untouched until the flag is flipped and the
--   old tables are retired in a later, separate migration.
--
-- The three dimension rows (Date / Budget / Location) reuse reserved
-- plan_group_id keys; their locked value persists on events
-- (event_date / estimated_budget_centavos / region), so pinned_vendor_id is
-- NULL for them.
--
-- DARK + ADDITIVE: nothing reads this table while BUILD_3STATE_ENABLED is off,
-- so applying it is a no-op for the live Build.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_category_build_state (
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  plan_group_id    TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'excluded'
                     CHECK (state IN ('locked', 'auto', 'excluded')),
  -- The Locked pick for a taxonomy row (one of the category's quoted inquiries).
  -- ON DELETE SET NULL: removing the vendor from the shortlist clears the pin
  -- but keeps the row's state, rather than cascading the whole control away.
  pinned_vendor_id UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  set_by           UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, plan_group_id)
);

CREATE INDEX IF NOT EXISTS event_category_build_state_event_id_idx
  ON public.event_category_build_state(event_id);

COMMENT ON TABLE public.event_category_build_state IS
  'Per-category 3-state build control (Locked/Auto/Excluded) for the Phase-3d Build solver (Build_3State_Solver_2026-06-16.md). Consolidates budget_category_flags + event_build_picks into one tri-state; pinned_vendor_id holds the Locked taxonomy pick (NULL for Date/Budget/Location dimension rows, whose value lives on events). Couple-own under RLS. Consumed only behind BUILD_3STATE_ENABLED.';

ALTER TABLE public.event_category_build_state ENABLE ROW LEVEL SECURITY;

-- Couple reads their own event's build state.
DROP POLICY IF EXISTS couple_reads_event_category_build_state ON public.event_category_build_state;
CREATE POLICY couple_reads_event_category_build_state ON public.event_category_build_state
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

-- Couple sets a category's state for their own event; stamped with their uid.
DROP POLICY IF EXISTS couple_inserts_event_category_build_state ON public.event_category_build_state;
CREATE POLICY couple_inserts_event_category_build_state ON public.event_category_build_state
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND set_by = auth.uid()
  );

-- Couple changes a category's state / pinned vendor (upsert → UPDATE on conflict).
DROP POLICY IF EXISTS couple_updates_event_category_build_state ON public.event_category_build_state;
CREATE POLICY couple_updates_event_category_build_state ON public.event_category_build_state
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
  );

-- Couple clears a category's state (Reset → all Excluded deletes the rows).
DROP POLICY IF EXISTS couple_deletes_event_category_build_state ON public.event_category_build_state;
CREATE POLICY couple_deletes_event_category_build_state ON public.event_category_build_state
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );
