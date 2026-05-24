-- ============================================================================
-- 20260524100000_iteration_0016_schedule_block_parent.sql
--
-- Adds `parent_block_id` self-FK on `event_schedule_blocks` so the wizard
-- Card 15 (Create Schedule) can model two-level hierarchy:
--
--   Ceremony           (parent_block_id IS NULL)
--   └─ Procession      (parent_block_id = Ceremony's block_id)
--   └─ Opening prayer  (parent_block_id = Ceremony's block_id)
--   └─ Vows…           (parent_block_id = Ceremony's block_id)
--   Cocktail Hour      (parent_block_id IS NULL, no children)
--   Reception          (parent_block_id IS NULL)
--   └─ Grand entrance  (parent_block_id = Reception's block_id)
--   └─ First dance     (parent_block_id = Reception's block_id)
--   ...
--   After Party        (parent_block_id IS NULL, no children)
--
-- Owner directive 2026-05-24 (verbatim):
--   "Ceremony - Parts of the ceremony
--    Cocktail Hour
--    Reception - Parts of the Reception
--    After Party
--    Can be rearranged, add a new schedule, Can be deleted"
--
-- Why a self-FK rather than a separate parts table:
--   1. Parts ARE schedule blocks — same shape (label, start_at, end_at,
--      sort_order, is_public, location, notes). Splitting them into a
--      sibling table would force every read site (Card 15, /schedule
--      deep-edit page, /[slug] public landing, day-of guest 0031,
--      upcoming-items home aggregator, activity feed) to UNION two
--      tables. Self-FK keeps a single source of truth.
--   2. The ON DELETE CASCADE means deleting the Ceremony parent
--      automatically removes its child parts. No app-layer cleanup needed.
--   3. Existing rows stay flat (parent_block_id NULL); behavior unchanged
--      for pre-2026-05-24 events. Card 15 + /schedule will progressively
--      adopt the hierarchy as hosts edit their schedules.
--
-- The depth is intentionally one-level (parent → children). No
-- grandchildren. PH wedding-day timelines don't have nested-nested
-- ritual structure; a flat parts list under a parent block covers every
-- canonical pattern (Catholic 12-part ceremony, Reception 14-part program,
-- Muslim 5-part nikah, etc.).
--
-- Index on (event_id, parent_block_id, sort_order) supports the canonical
-- read pattern: "give me the children of parent X within event Y, ordered
-- by sort_order." Single index covers both the top-level read
-- (parent_block_id IS NULL) and per-parent children reads.
--
-- Idempotent · safe to re-run.
--
-- Reversal recipe:
--   ALTER TABLE public.event_schedule_blocks DROP COLUMN parent_block_id;
--   DROP INDEX IF EXISTS event_schedule_blocks_parent_idx;
-- ============================================================================

BEGIN;

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS parent_block_id UUID
    REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE;

-- Defensive CHECK · a block can't be its own parent (depth-1 hierarchy).
-- Self-FK enforces existence; this CHECK enforces structure.
DO $$ BEGIN
  ALTER TABLE public.event_schedule_blocks
    ADD CONSTRAINT event_schedule_blocks_no_self_parent
    CHECK (parent_block_id IS NULL OR parent_block_id <> block_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Composite index supporting both reads:
--   · top-level: WHERE event_id = X AND parent_block_id IS NULL ORDER BY sort_order
--   · per-parent: WHERE event_id = X AND parent_block_id = Y ORDER BY sort_order
CREATE INDEX IF NOT EXISTS event_schedule_blocks_parent_idx
  ON public.event_schedule_blocks(event_id, parent_block_id, sort_order);

COMMENT ON COLUMN public.event_schedule_blocks.parent_block_id IS
  'Self-FK for two-level hierarchy (2026-05-24 owner directive). NULL = top-level wedding-day block (Ceremony / Cocktail Hour / Reception / After Party). Non-NULL = part within a parent (e.g., Procession within Ceremony). ON DELETE CASCADE so removing a parent removes all its parts.';

COMMIT;
