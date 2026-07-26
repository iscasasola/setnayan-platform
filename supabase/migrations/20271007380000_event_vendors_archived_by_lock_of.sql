-- event_vendors.archived_by_lock_of — make the lock's archive sweep reversible.
-- ============================================================================
-- DEFECT THIS FIXES. Locking a vendor archives EVERY other pick in the same
-- category (finalizeVendor → `.update({archived_at})` … `.in('status',
-- ['considering','shortlisted'])`). That is correct: the couple chose, so the
-- losers should stop cluttering the tracker.
--
-- The problem is the UNDO. `revertVendorToConsidering` flips the winner back to
-- 'considering' and repairs displaced chat threads — but it does not contain a
-- single reference to `archived_at`. So the displaced picks stay archived
-- FOREVER. A couple who locks the wrong caterer by mistake and immediately
-- undoes it has silently lost every other caterer they had researched, with no
-- path back except re-adding each vendor by hand.
--
-- Un-archiving the whole category on revert is NOT a fix: it would also
-- resurrect rows the host archived deliberately, which is a different kind of
-- wrong. The sweep has to be able to name exactly what it archived.
--
-- SO: the sweep stamps the winner's vendor_id here, and the revert un-archives
-- precisely the set carrying that stamp, then clears it.
--
-- SELF-REFERENTIAL FK, ON DELETE SET NULL: if the winning row is later deleted
-- outright, the losers simply become ordinarily-archived rows rather than
-- cascading away — losing the undo link is recoverable, losing the row is not.
--
-- SAFETY. Additive, idempotent, nullable. Rows archived before this column
-- existed keep NULL and are left alone by the revert — they are indistinguishable
-- from a manual archive, and guessing would resurrect picks the host hid on
-- purpose. This is a forward fix, not a backfill.
--
-- RLS: inherited from event_vendors, unchanged — column add only.
-- ============================================================================

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS archived_by_lock_of UUID
    REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_vendors.archived_by_lock_of IS
  'When this row was archived by another vendor winning its category, the vendor_id that won. Set by finalizeVendor''s archive sweep; read and cleared by revertVendorToConsidering so an undo restores exactly what that lock displaced. NULL = archived manually, or before 2026-07-26 — never auto-restored.';

-- The revert looks up "everything this lock archived", so index that shape.
CREATE INDEX IF NOT EXISTS event_vendors_archived_by_lock_idx
  ON public.event_vendors (archived_by_lock_of)
  WHERE archived_by_lock_of IS NOT NULL;
