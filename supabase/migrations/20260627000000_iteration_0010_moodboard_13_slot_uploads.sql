-- ============================================================================
-- 20260627000000_iteration_0010_moodboard_13_slot_uploads.sql
-- Iteration 0010 Moodboard · Card 15 "Set your inspiration mood board" —
-- 13 NAMED SLOTS × 2 photos each = 26 upload slots total.
--
-- Why this migration (vs PR #543's free-form + URL paste):
--   Owner directive 2026-05-25 verbatim: "Make the upload. you keep
--   deferring this. We want upload photo. no url. just upload up to
--   photos 2 for each." 13 named slots covering the locked 3 pillars
--   per CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars":
--     Location feel (6 slots): venue, tunnel, stage, table, ceiling, overall
--     Palette       (1 slot):  palette
--     Dress codes   (6 slots): groom, bride, principal_sponsor, entourage,
--                              parents, guests
--
-- This SUPERSEDES the free-form + URL-paste UX shipped in PR #543
-- (migration 20260625000000). The underlying table stays — we extend it
-- with two columns + uniqueness so each slot/position pair is single-row,
-- and we nuke the few hours of URL-paste leftover rows so the new
-- NOT NULL slot_key constraint can land cleanly.
--
-- See also:
--   - CLAUDE.md 2026-05-25 row "Mood Board · 13-slot upload UX (supersedes
--     PR #543's URL-paste + free-form upload)" — this row.
--   - 0010_mood_board.md § "Visual preview pillars" — canonical 3-pillar lock.
--   - CLAUDE.md 2026-05-24 row "V1 SCOPE EXPANSION · Moodboard becomes
--     multi-source + stylist-finalized brain" — owner_kind architecture
--     locked V1.x post-pilot; this migration stays inside the V1
--     couple-inspiration slice.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: nuke leftover URL-paste + free-form rows from the few hours
-- PR #543 was live. Pilot launches 2026-06-01 so there's no real
-- couple data to preserve here — only the owner's testing churn.
-- We delete unconditionally before the slot_key column lands so the
-- NOT NULL constraint can apply on the now-empty table.
-- ----------------------------------------------------------------------------
DELETE FROM public.event_inspiration_assets;

-- ----------------------------------------------------------------------------
-- Step 2: add slot_key + slot_position columns + CHECK constraints +
-- UNIQUE constraint. 13 slot_keys × 2 positions = 26 unique rows per
-- event (max). Each (event_id, slot_key, slot_position) is single-row,
-- replacing the prior free-form "any-number-of-items-with-ordering"
-- shape with a structured slotted shape.
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_inspiration_assets
  ADD COLUMN IF NOT EXISTS slot_key TEXT,
  ADD COLUMN IF NOT EXISTS slot_position SMALLINT;

-- Backfill defensive (already DELETEd above, so this is a no-op when run
-- a second time — but if someone reverts the DELETE we don't want
-- orphaned NULL slot rows to block the NOT NULL set below).
UPDATE public.event_inspiration_assets
SET    slot_key      = COALESCE(slot_key, 'overall'),
       slot_position = COALESCE(slot_position, 1)
WHERE  slot_key IS NULL OR slot_position IS NULL;

ALTER TABLE public.event_inspiration_assets
  ALTER COLUMN slot_key      SET NOT NULL,
  ALTER COLUMN slot_position SET NOT NULL;

-- CHECK constraints on the 13-slot enum + 2-position cap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_inspiration_assets_slot_key_check'
  ) THEN
    ALTER TABLE public.event_inspiration_assets
      ADD CONSTRAINT event_inspiration_assets_slot_key_check
      CHECK (slot_key IN (
        'venue','tunnel','stage','table','ceiling','overall',
        'palette',
        'groom','bride','principal_sponsor','entourage','parents','guests'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_inspiration_assets_slot_position_check'
  ) THEN
    ALTER TABLE public.event_inspiration_assets
      ADD CONSTRAINT event_inspiration_assets_slot_position_check
      CHECK (slot_position IN (1, 2));
  END IF;
END $$;

-- UNIQUE (event_id, slot_key, slot_position) — one row per (event, slot,
-- position). Soft-deleted rows (removed_at IS NOT NULL) DO NOT count
-- toward the unique constraint because we want hosts to be able to
-- re-upload to a slot after removing a prior photo. The partial unique
-- index achieves that.
CREATE UNIQUE INDEX IF NOT EXISTS event_inspiration_assets_slot_unique
  ON public.event_inspiration_assets (event_id, slot_key, slot_position)
  WHERE removed_at IS NULL;

-- Fast lookup of active slots per event (the primary query the UI fires).
CREATE INDEX IF NOT EXISTS idx_event_inspiration_assets_active_slots
  ON public.event_inspiration_assets (event_id, slot_key, slot_position)
  WHERE removed_at IS NULL;

COMMIT;
