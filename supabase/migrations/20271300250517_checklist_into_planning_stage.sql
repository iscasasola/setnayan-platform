-- ============================================================================
-- 20271300250517_checklist_into_planning_stage.sql
-- CHECKLIST MERGES INTO PLANNING STAGE (owner ruled 2026-11-01; corpus
-- SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §9 · DECISION_LOG
-- "CHECKLIST MERGES INTO PLANNING STAGE").
--
-- One lead-up list in Schedule › Planning Stage. Two columns, nothing else:
--
--   1. event_checklist_items.due_date_set — the date the HOST set on a task.
--      NULL = the task still sits where the template puts it
--      (event date − due_offset_days, runway-compressed — lib/checklist.ts
--      `dueDateForItem`). A task therefore STARTS at its offset and moves with
--      the event date until somebody edits it; from then on it keeps the date
--      they chose. Read and written only through lib/preparation.ts
--      (`fetchPreparationAgenda`) and checklist-actions `setChecklistTaskDate`.
--
--   2. event_preparation_items.completed_at — a hand-added Planning Stage row
--      (task · meeting · payment) gains a done tick. NULL = open.
--
-- RLS UNCHANGED. Both tables already gate writes to the columns added here:
--   · event_checklist_items  — couple_writes_checklist (couple members + admin).
--   · event_preparation_items — event_prep_items_couple_all (the couple) and
--     event_prep_items_vendor_update (a supplier, on its OWN rows only).
-- No new policy, no new grant beyond the table's existing column privileges.
--
-- Additive, nullable, idempotent. Applied by the pipeline (db push), never by
-- hand.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_checklist_items
  ADD COLUMN IF NOT EXISTS due_date_set DATE;

COMMENT ON COLUMN public.event_checklist_items.due_date_set IS
  'The date the host set on this task in Planning Stage. NULL = the template date (event date minus due_offset_days, runway-compressed). Owner 2026-11-01: Checklist merges into Planning Stage.';

ALTER TABLE public.event_preparation_items
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_preparation_items.completed_at IS
  'When this hand-added Planning Stage row was ticked done. NULL = still open. Owner 2026-11-01: Checklist merges into Planning Stage — manual rows gain done.';

COMMIT;
