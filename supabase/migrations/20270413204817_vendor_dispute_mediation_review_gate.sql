-- ============================================================================
-- 20270413204817_vendor_dispute_mediation_review_gate.sql
--
-- Stand-up-for-yourself dispute mediation — a neutral team reviews the record
-- BEFORE a dispute touches a vendor's rating.
--
-- THE BUG THIS FIXES (silent demotion):
--   vendor_disputes.counts_toward_demotion defaulted to TRUE and every dispute
--   is born status='open'. The dispute-counter cron + count_vendor_disputes_30d
--   both counted rows WHERE counts_toward_demotion = TRUE AND status IN
--   ('open','resolved_for_couple'). So an UNREVIEWED, freshly-filed dispute
--   counted toward the 3-in-30-days demote-to-coming_soon trigger — a vendor
--   could be demoted purely on unproven, un-adjudicated accusations, before any
--   admin looked at the record. That is the opposite of "neutral review first."
--
-- THE FIX (review is now the GATE):
--   1. counts_toward_demotion now DEFAULTS to FALSE. A new dispute never counts
--      until an admin resolves it against the vendor (resolved_for_couple).
--   2. Existing OPEN disputes are backfilled to FALSE (they were never reviewed;
--      they must not silently demote). Already-adjudicated rows are untouched.
--   3. count_vendor_disputes_30d is tightened to count ONLY
--      status='resolved_for_couple' AND counts_toward_demotion = TRUE. An 'open'
--      dispute can NEVER count now, even if a legacy row still has the flag TRUE
--      — the neutral-team review is the hard gate. (The admin resolve action
--      sets counts_toward_demotion = TRUE only for the resolved_for_couple lane;
--      resolved_for_vendor / withdrawn set it FALSE.)
--
-- STAND-UP-FOR-YOURSELF (vendor mediation):
--   4. Two vendor-writable columns — vendor_contest (the vendor's side of the
--      story) + vendor_contested_at — let a vendor formally contest a dispute
--      filed against them, from /vendor-dashboard/disputes. A narrow RLS UPDATE
--      policy + a column-guard trigger let a vendor set ONLY those two columns
--      on their OWN dispute rows; every other column (status, the demotion flag,
--      resolution notes, …) stays admin/service-role only. The vendor's contest
--      is surfaced to the neutral team in /admin/disputes.
--
-- Additive throughout: no columns dropped, no status values removed. The cron
-- inline query is aligned to the helper in app code in the same PR.
-- ============================================================================

BEGIN;

-- ── 1. New disputes don't count until reviewed ──────────────────────────────
ALTER TABLE public.vendor_disputes
  ALTER COLUMN counts_toward_demotion SET DEFAULT FALSE;

-- ── 2. Backfill: an unreviewed (open) dispute must not silently demote.
--    Rows an admin already adjudicated (resolved_for_couple / resolved_for_vendor
--    / withdrawn) keep whatever the admin decided.
UPDATE public.vendor_disputes
   SET counts_toward_demotion = FALSE,
       updated_at = NOW()
 WHERE status = 'open'
   AND counts_toward_demotion = TRUE;

-- ── 3. Vendor mediation columns ─────────────────────────────────────────────
ALTER TABLE public.vendor_disputes
  ADD COLUMN IF NOT EXISTS vendor_contest      TEXT,
  ADD COLUMN IF NOT EXISTS vendor_contested_at TIMESTAMPTZ;

-- ── 4. Tighten the rolling-window counter: review is the gate ────────────────
-- Only disputes an admin RESOLVED against the vendor (resolved_for_couple) AND
-- explicitly marked as counting (counts_toward_demotion) feed the demotion
-- trigger. An 'open' (unreviewed) dispute can never reach this count.
CREATE OR REPLACE FUNCTION public.count_vendor_disputes_30d(
  v_vendor_profile_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.vendor_disputes
   WHERE vendor_profile_id = v_vendor_profile_id
     AND counts_toward_demotion = TRUE
     AND status = 'resolved_for_couple'
     AND created_at >= NOW() - INTERVAL '30 days'
$$;

-- Rebuild the partial index so it matches the new counting predicate exactly
-- (the cron + the couple-favor gate now both filter on resolved_for_couple).
DROP INDEX IF EXISTS public.vendor_disputes_rolling_idx;
CREATE INDEX IF NOT EXISTS vendor_disputes_rolling_idx
  ON public.vendor_disputes(vendor_profile_id, created_at)
  WHERE counts_toward_demotion = TRUE
    AND status = 'resolved_for_couple';

-- ── 5. Let a vendor contest their own dispute — but ONLY the two contest
--    columns. RLS opens the UPDATE to the vendor who owns the profile; the
--    column-guard trigger reverts any attempt to touch anything else (status,
--    the demotion flag, resolution notes, …) for a non-service-role caller.
--    Mirrors guard_pax_finalize_columns (20261214000000).
DROP POLICY IF EXISTS vendor_disputes_vendor_contest ON public.vendor_disputes;
CREATE POLICY vendor_disputes_vendor_contest
  ON public.vendor_disputes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_disputes.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR vendor_disputes.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_disputes.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR vendor_disputes.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  );

CREATE OR REPLACE FUNCTION public.guard_vendor_dispute_contest_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The neutral team (service-role admin client) may change anything. A vendor
  -- (any non-service-role caller) may set ONLY vendor_contest +
  -- vendor_contested_at; every other column is reverted to its prior value, so
  -- a vendor can never self-clear the demotion flag, flip status, or edit the
  -- resolution the team recorded.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.dispute_id              := OLD.dispute_id;
    NEW.public_id               := OLD.public_id;
    NEW.vendor_profile_id       := OLD.vendor_profile_id;
    NEW.payout_id               := OLD.payout_id;
    NEW.order_id                := OLD.order_id;
    NEW.opened_by_user_id       := OLD.opened_by_user_id;
    NEW.category                := OLD.category;
    NEW.description             := OLD.description;
    NEW.status                  := OLD.status;
    NEW.resolved_at             := OLD.resolved_at;
    NEW.resolution_notes        := OLD.resolution_notes;
    NEW.counts_toward_demotion  := OLD.counts_toward_demotion;
    NEW.created_at              := OLD.created_at;
    -- vendor_contest + vendor_contested_at + updated_at are the only mutable
    -- fields on the vendor path.
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_vendor_dispute_contest_columns_trg ON public.vendor_disputes;
CREATE TRIGGER guard_vendor_dispute_contest_columns_trg
  BEFORE UPDATE ON public.vendor_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_dispute_contest_columns();

COMMIT;
