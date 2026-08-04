-- ============================================================================
-- WHOSE DATE IS IT? — provenance for an auto-finalised wedding date.
--
-- THE LIVE BUG THIS UNBLOCKS: `finalizeVendor` can finalise the event date when
-- locking a vendor collapses the candidate set to one. `revertVendorToConsidering`
-- undoes the lock, un-archives the picks it displaced and revives the inquiries
-- it displaced — and leaves the DATE behind. Permanently: the date write is
-- guarded `.is('event_date', null)`, so a later correct value can never replace
-- a wrong one. A couple ends up married to a date derived from a supplier they
-- no longer use.
--
-- WHY A STAMP AND NOT INFERENCE. Inferring it (`event_date ∈ date_candidates AND
-- date_status = 'locked'`) was tried and REFUTED: the couple's own deliberate
-- pick through `lockEventDate` produces a byte-identical fingerprint, so
-- inference would erase choices the couple made on purpose. Provenance has to be
-- written down at the moment it is created, in the SAME statement as the date.
--
-- ⚠ NO FOREIGN KEY, DELIBERATELY. The obvious shape — a FK to
-- `event_vendors(vendor_id) ON DELETE SET NULL`, copying
-- `event_vendors.archived_by_lock_of` — is WRONG here: two of the three exit
-- paths HARD-DELETE the very row the FK would point at, so Postgres would null
-- the stamp at the exact moment the clear needs to read it. That is the same
-- shape as the `ON DELETE SET NULL` FK that silently re-armed erased people's
-- Papic QR codes (closed in #4032). Plain uuid; read the stamp BEFORE the delete.
--
-- ⚠ NOT IN LOCKED_COLUMNS. `finalizeVendor`'s date write runs on the USER's
-- client, so denying `authenticated` this column would make the whole guarded
-- UPDATE fail 42501. Forging the stamp grants nothing: the clear ALSO requires
-- that no confirmed vendor remains on the event.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS date_forced_by_lock_of UUID;

COMMENT ON COLUMN public.events.date_forced_by_lock_of IS
  'The event_vendors.vendor_id whose lock auto-finalised event_date, written in the '
  'same statement as the date. NULL = the couple chose this date (onboarding, '
  'lockEventDate, updateEventDate, Save-the-Date backfill, Locked-QR claim) and no '
  'vendor exit may clear it. Intentionally NOT a foreign key: the exit paths '
  'hard-delete the referenced row, and ON DELETE SET NULL would erase the stamp '
  'exactly when it is needed.';

-- Only ever read alongside a non-null event_date, so the index is partial.
CREATE INDEX IF NOT EXISTS events_date_forced_by_lock_of_idx
  ON public.events (date_forced_by_lock_of)
  WHERE date_forced_by_lock_of IS NOT NULL;

-- ---- post-condition -------------------------------------------------------
-- A migration that merges green while creating nothing is a failure mode this
-- repo has already been bitten by.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'events'
      AND column_name  = 'date_forced_by_lock_of'
  ) THEN
    RAISE EXCEPTION
      'Migration 20271106090000 did not create events.date_forced_by_lock_of — an '
      'auto-finalised date would stay unattributable and could never be undone.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'events_date_forced_by_lock_of_idx'
  ) THEN
    RAISE EXCEPTION 'Migration 20271106090000 did not create its index.';
  END IF;
END $$;

COMMIT;
