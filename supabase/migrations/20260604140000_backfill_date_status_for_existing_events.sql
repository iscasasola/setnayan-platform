-- Phase 0 Date Selection — belt-and-suspenders backfill for events whose
-- event_date is set but date_status remained 'undecided'.
--
-- Why this exists. Migration 20260604020000_phase_0_date_selection.sql added
-- the events.date_status column with a one-time UPDATE pass that flipped any
-- event with a non-null event_date from 'undecided' → 'locked'. That backfill
-- ran cleanly on rows that existed at apply time. But two follow-on paths
-- have surfaced events whose event_date is populated while date_status
-- stayed 'undecided':
--
--   (a) Events that crashed mid-save during the Phase 0 lock-this-date flow
--       (an earlier session screenshot caught the Step 3 error path which
--       persisted event_date but never reached the date_status update).
--   (b) Events whose event_date was edited via paths outside the Phase 0
--       lock flow (e.g. the EventMetaLine pencil edit, the
--       /dashboard/[eventId]/settings field, or direct admin Supabase
--       Studio writes) which write event_date but not date_status.
--
-- The owner-reported symptom on 2026-05-22 (Task #67) was AuspiciousChip
-- rendering "PHASE 0 · Pick your date" on event home while EventMetaLine
-- directly below it correctly rendered the host's real wedding date and
-- countdown. The auspicious-chip.tsx component now reads event_date directly
-- so the surface stays right regardless of date_status drift, but this
-- migration also re-syncs date_status so any downstream reader that filters
-- on date_status='locked' sees consistent state across the column pair.
--
-- Idempotent. Only updates rows where event_date IS NOT NULL AND date_status
-- has not yet been promoted out of 'undecided'. Running this twice is a
-- no-op. Pattern mirrors the original migration's lines 100-102.
--
-- Per CLAUDE.md 2026-05-22 owner directive Task #67: "asking for a date
-- even if we already have a date. please make sure the date follows the
-- upper function and not the second one."

UPDATE public.events
  SET date_status = 'locked'
  WHERE event_date IS NOT NULL
    AND (date_status = 'undecided' OR date_status IS NULL);

-- No-op when nothing matched. Postgres reports row count via the result
-- which the migration runner logs for audit.
