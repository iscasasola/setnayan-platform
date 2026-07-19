-- ============================================================================
-- 20270825042743_coordinator_p2_schedule_responsible_party.sql
-- Coordinator P2 — filtered run-of-show (Coordinator_Whats_Next_2026-07-18 §P2).
--
-- One master `event_schedule_blocks` timeline → auto-synced per-vendor /
-- per-couple / per-guest views. The views are FILTERS over the master (pure
-- lens functions in apps/web/lib/schedule-ros.ts), never copies — so the
-- schema delta is deliberately minimal: two columns on the existing table.
--
--   • responsible_party        — free-text "who owns this row" (vendor / crew /
--                                family, e.g. "HMUA team", "Ninong Roberto").
--                                Display-only; drives nothing structural.
--   • responsible_vendor_ids   — event_vendors.vendor_id values tagged on the
--                                row. Drives the per-vendor slice ("only rows
--                                they're responsible for / tagged in").
--
-- Why a UUID[] and not a sibling join table: a wedding-day schedule is bounded
-- (~20–50 rows) and the tag is a LENS, not an integrity-bearing relation — a
-- dangling id (vendor removed from the registry) simply never matches any
-- viewer and is invisible. A join table would add a second table + 3 RLS
-- policies for zero behavioral gain at this scale.
--
-- NO new RLS: both columns ride the existing row policies —
--   couple_write (Pattern B) · moderator schedule-edit write (coordinator,
--   20261129003000) · booked-vendor full-timeline SELECT (locked D2,
--   20261130003000) · anon SELECT on is_public rows (guest site).
-- Booked vendors keep full-timeline visibility per locked D2; the per-vendor
-- view narrows at the UI layer only.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS responsible_party TEXT
    CHECK (responsible_party IS NULL OR length(responsible_party) <= 120);

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS responsible_vendor_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.event_schedule_blocks.responsible_party IS
  'Coordinator P2: free-text responsible party for this run-of-show row (vendor / crew / family). Display label only.';
COMMENT ON COLUMN public.event_schedule_blocks.responsible_vendor_ids IS
  'Coordinator P2: event_vendors.vendor_id values tagged on this row. Drives the per-vendor filtered run-of-show slice (a lens over the master, never a copy). Dangling ids are harmless — they never match a viewer.';

COMMIT;
