-- Budget Planner — behavioral capture (Layer 1 · operational / identified).
-- Design: Budget_Planner_Allocation_Engine_2026-06-05.md §6/§7 (spec corpus).
--
-- One row per service LEAF per saved budget-plan snapshot. Records the engine's
-- median-derived DEFAULT (the anchor) vs the couple's FINAL number, plus the
-- revealed-preference signals (pin order, what got auto-reduced to fund a pin) and
-- the segment context (budget / region / pax / event_type). This is the raw feed
-- the future DE-IDENTIFIED analytical layer (Layer 2) aggregates — "how real
-- couples prioritize money across services," owner-designated as the product EDGE
-- and a MOST-PROTECTED data class (2026-06-05). [[project_setnayan_behavioral_data_edge]]
--
-- PROTECTION (privacy-by-design — do not weaken without owner sign-off):
--   • This table is the IDENTIFIED layer. It is couple-OWN-ONLY under RLS.
--   • Admins INTENTIONALLY get NO RLS read here. Raw per-couple financial decisions
--     are never browsable from the authed admin client; the de-identified Layer 2 +
--     a gated, audited service-role export path are the only admin routes (design §7).
--     => deliberately NO is_admin() policy below. Do not add one.
--   • RA 10173 erasure: ON DELETE CASCADE from events drops a couple's rows on
--     account/event deletion; couples may also delete their own rows directly.
--   • Layer 2 (de-identified, segment-keyed) + the cron-free on-write rollup land in
--     a follow-on migration; this PR ships only the operational capture table.
--
-- No application code reads or writes this table yet (the engine `lib/budget-
-- allocation.ts` is pure + DB-agnostic). The planner UI write-path lands in 0007.

CREATE TABLE IF NOT EXISTS public.budget_allocation_decisions (
  decision_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Groups every leaf row saved together in one plan snapshot. The app passes ONE
  -- shared id per save; the default only covers ad-hoc single-row inserts.
  snapshot_id            UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  recorded_by            UUID REFERENCES auth.users(id),
  canonical_service      TEXT NOT NULL,

  -- The engine's median-derived DEFAULT (anchor) vs the couple's FINAL choice.
  recommended_amount_php INTEGER CHECK (recommended_amount_php IS NULL OR recommended_amount_php >= 0),
  final_amount_php       INTEGER CHECK (final_amount_php IS NULL OR final_amount_php >= 0),
  recommended_share_bp   INTEGER CHECK (recommended_share_bp IS NULL OR recommended_share_bp BETWEEN 0 AND 10000),
  final_share_bp         INTEGER CHECK (final_share_bp IS NULL OR final_share_bp BETWEEN 0 AND 10000),

  -- Revealed-preference signals.
  was_pinned             BOOLEAN NOT NULL DEFAULT FALSE,                 -- couple explicitly set this leaf
  pin_order              INTEGER CHECK (pin_order IS NULL OR pin_order >= 1), -- 1 = first leaf touched
  auto_reduced_for_pin   BOOLEAN NOT NULL DEFAULT FALSE,                 -- shrank to fund another pin (a "cut")

  -- Denormalized segment context (Layer-1 raw; Layer-2 buckets + de-identifies these).
  total_budget_php       INTEGER CHECK (total_budget_php IS NULL OR total_budget_php >= 0),
  region                 TEXT,
  pax                    INTEGER CHECK (pax IS NULL OR pax >= 0),
  event_type             TEXT,

  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.budget_allocation_decisions IS
  'Budget Planner Layer-1 behavioral capture (operational/identified): per-leaf default-vs-final + pin signals + segment context per saved plan snapshot. Couple-own-only under RLS; admins have NO blanket read by design (gated service-role export only). Feeds the future de-identified Layer-2 analytics. RA 10173 erasable. Design: Budget_Planner_Allocation_Engine_2026-06-05.md.';

CREATE INDEX IF NOT EXISTS budget_allocation_decisions_event_recorded_idx
  ON public.budget_allocation_decisions (event_id, recorded_at DESC);

-- Supports the future Layer-2 rollup that aggregates by leaf across events.
CREATE INDEX IF NOT EXISTS budget_allocation_decisions_leaf_idx
  ON public.budget_allocation_decisions (canonical_service);

ALTER TABLE public.budget_allocation_decisions ENABLE ROW LEVEL SECURITY;

-- Couple reads only their own event's rows (canonical event-scoped pattern).
DROP POLICY IF EXISTS couple_reads_budget_allocation_decisions ON public.budget_allocation_decisions;
CREATE POLICY couple_reads_budget_allocation_decisions ON public.budget_allocation_decisions
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Couple inserts snapshots for their own event; rows are stamped with their uid.
DROP POLICY IF EXISTS couple_inserts_budget_allocation_decisions ON public.budget_allocation_decisions;
CREATE POLICY couple_inserts_budget_allocation_decisions ON public.budget_allocation_decisions
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    AND recorded_by = auth.uid()
  );

-- Couple may erase their own rows (RA 10173). Snapshots are otherwise immutable —
-- a revised plan is a NEW snapshot, so there is deliberately no UPDATE policy.
DROP POLICY IF EXISTS couple_deletes_budget_allocation_decisions ON public.budget_allocation_decisions;
CREATE POLICY couple_deletes_budget_allocation_decisions ON public.budget_allocation_decisions
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));
