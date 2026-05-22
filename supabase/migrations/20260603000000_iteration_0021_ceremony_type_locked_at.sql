-- ============================================================================
-- 20260603000000_iteration_0021_ceremony_type_locked_at.sql
--
-- Iteration 0021 + 0043 follow-up: add a "host explicitly confirmed" stamp
-- to `events.ceremony_type` without breaking the wedding-fields-consistency
-- invariant from 20260521080000.
--
-- WHY:
--   Task #37 (2026-05-22) — owner asked for a visible religion / ceremony
--   indicator on event home with a one-time "set then immutable" semantic
--   matching iteration 0000's event_type lock. The existing 0043 columns
--   default `ceremony_type` to 'catholic' on wedding rows so the
--   biconditional CHECK (`events_wedding_fields_consistency`) is always
--   satisfied — but that means we cannot use NULL to signal "host hasn't
--   picked yet" without dropping the invariant the rest of the platform
--   (vendor matching · faith filters · brain RAG) depends on.
--
--   Adding a separate `ceremony_type_locked_at TIMESTAMPTZ` column lets the
--   chip distinguish "default value silently inherited at create-time" from
--   "host saved their choice, now immutable." The vendor-matching layer
--   keeps reading `ceremony_type` (always non-NULL on weddings); the chip
--   reads `ceremony_type_locked_at` to gate the UI state.
--
-- WHAT:
--   1. ADD COLUMN ceremony_type_locked_at TIMESTAMPTZ NULL on `events`.
--   2. ADD COLUMN ceremony_type_locked_by UUID NULL referencing
--      public.users(user_id) ON DELETE SET NULL.
--   3. Idempotent — IF NOT EXISTS pattern.
--   4. NO backfill — every existing wedding row stays at NULL so hosts can
--      explicitly confirm via the chip on event home. This is correct for
--      Claire & Ice and for any other early-launch wedding row that
--      inherited the silent 'catholic' default. New events created via the
--      iteration 0043 picker stamp the column at insert-time (handled in
--      the create-event server action update that ships with Task #37).
--
-- Non-wedding event_types have `ceremony_type IS NULL` per the
-- 20260521080000 biconditional and therefore should also have
-- `ceremony_type_locked_at IS NULL`. We add a CHECK to enforce that:
-- "locked stamp is meaningful only when ceremony_type is non-NULL." This
-- prevents future ad-hoc inserts from stamping a lock against a NULL
-- ceremony_type.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. New columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ceremony_type_locked_at TIMESTAMPTZ;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ceremony_type_locked_by UUID
  REFERENCES public.users(user_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 2. Integrity — locked_at requires non-NULL ceremony_type
-- ----------------------------------------------------------------------------

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_lock_requires_ceremony_type;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_lock_requires_ceremony_type
  CHECK (
    ceremony_type_locked_at IS NULL
    OR ceremony_type IS NOT NULL
  );

-- ----------------------------------------------------------------------------
-- 3. Helpful index — admin surfaces will filter "unlocked weddings" to
--    surface the new chip CTA in segment dashboards. Partial index keeps
--    it tiny since the locked majority gets filtered out.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS events_ceremony_type_unlocked_idx
  ON public.events (event_type, ceremony_type)
  WHERE ceremony_type_locked_at IS NULL
    AND ceremony_type IS NOT NULL;

COMMENT ON COLUMN public.events.ceremony_type_locked_at IS
  'When the host explicitly confirmed ceremony_type via the event-home chip. '
  'NULL = value inherited from picker default at create-time, host has not '
  'confirmed yet. Set this once → ceremony_type becomes immutable (per Task '
  '#37 / iteration 0021 § 13). Non-wedding event_types stay NULL.';

COMMENT ON COLUMN public.events.ceremony_type_locked_by IS
  'User who confirmed ceremony_type via the chip. Nullable for backfill / '
  'admin-set rows.';

COMMIT;
