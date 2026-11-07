-- seat_assignment_placed_by
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Additive + idempotent (ADD COLUMN IF NOT EXISTS · the
-- CHECK is added only when it is not there yet); inherits
-- event_seat_assignments' existing RLS — no policy changes.
--
-- ⚖ OWNER 2026-10-29 (DECISION_LOG "GUESTS ANSWERS (owner ~14:40)", answer 4,
-- *"ok"*): add WHO PLACED EACH SEAT — Auto arrange vs the couple — so a seat can
-- say why the guest sits there ("You placed Ana here · yesterday" ·
-- "Table 3 · Auto arrange") and the swap sheet can say it for both people.
--
-- ── WHY A COLUMN, AND NOT A FLAG THAT EXISTS (Rule 0) ──────────────────────
--   · `locked` (20270211861238) means PINNED — the solver keeps it fixed. A
--     couple places most seats without pinning them, and Auto arrange's own
--     seats are never locked, so `locked` cannot say who placed a seat.
--   · `created_at` is when the row was FIRST made; a moved seat keeps it.
-- So two facts have no home:
--   1. `placed_by` — 'couple' (the couple or anyone working on their seat plan,
--      by hand: a drop, a pick, a swap, a table made with its guests) or 'auto'
--      (Auto arrange, Auto-seat, Fill around locked seats, the draft, the live
--      reconcile). NULL = not recorded (every row before this file, and any
--      writer that does not say) — the seat then says nothing, never a guess.
--   2. `placed_at` — when that placement was written. NULL with `placed_by`.

BEGIN;

ALTER TABLE public.event_seat_assignments
  ADD COLUMN IF NOT EXISTS placed_by TEXT,
  ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'event_seat_assignments_placed_by_check'
       AND conrelid = 'public.event_seat_assignments'::regclass
  ) THEN
    ALTER TABLE public.event_seat_assignments
      ADD CONSTRAINT event_seat_assignments_placed_by_check
      CHECK (placed_by IS NULL OR placed_by IN ('couple', 'auto'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_seat_assignments.placed_by IS
  'Who placed this seat (owner 2026-10-29): couple = by hand (drop, pick, swap, a table made with its guests) · auto = Auto arrange / Auto-seat / Fill around locked / the draft / the live reconcile · NULL = not recorded (the seat says nothing). Drives the seat''s "why here" line (lib/seat-why.ts).';
COMMENT ON COLUMN public.event_seat_assignments.placed_at IS
  'When placed_by was written. NULL when placed_by is NULL.';

COMMIT;
