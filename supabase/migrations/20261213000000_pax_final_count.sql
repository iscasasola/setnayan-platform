-- ============================================================================
-- 20261213000000_pax_final_count.sql
--
-- ADAPTIVE PAX PRICING — Phase 7 (auto-finalize at the guest-list edit deadline).
--
-- Owner decision #6 (2026-06-13): the guest count auto-finalizes at
-- events.guest_list_edit_deadline; after that the binding pax is frozen and the
-- price is final. Phase 1 added the deadline + guest_count_locked_at (timestamp)
-- columns but NOT the frozen VALUE. This adds events.final_pax: the locked count
-- the live-pax reads return once finalized, so post-deadline guest churn (late
-- RSVPs, accepted claims) can never move a vendor's binding cost.
--
-- Set once, by the app's lazy ensureFinalized() at/after the deadline =
-- max(estimated_pax floor, headcount on headcount_basis at lock time). NULL =
-- not yet finalized. Inherits events RLS (column add); no behavior change until
-- a couple sets a deadline and it passes.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS final_pax INTEGER
    CHECK (final_pax IS NULL OR final_pax > 0);

COMMENT ON COLUMN public.events.final_pax IS
  'The frozen binding guest count, stamped at guest_list_edit_deadline alongside guest_count_locked_at = max(estimated_pax, headcount at lock). The vendor-facing live pax returns this once finalized so late churn never moves a booked cost. NULL = not finalized. Adaptive Pax Pricing Phase 7, 2026-06-13.';

COMMIT;
