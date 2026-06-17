-- ============================================================================
-- 20270111000000_vendor_review_response.sql
-- Vendor review response improvements:
--   1. Relax lock_vendor_reply so vendors can edit their reply (editable, not
--      one-time). The vendor RLS policy already ensures only the profile owner
--      can update vendor_reply.
--   2. Tighten the vendor_reply character limit DB-side from 2000 → 500 to
--      match the product spec.
--   3. Add vendor_review_flags table — lets vendors flag a review as fake for
--      HQ adjudication. Single row per (review_id, reporter vendor_profile_id)
--      so a vendor can only flag a review once.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Relax lock_vendor_reply trigger to allow edits (no longer one-time-only).
--    We keep the trigger for the vendor_reply_at auto-stamp on first write
--    and the updated_at bump, but drop the immutability guard.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lock_vendor_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Stamp vendor_reply_at on the first write if the caller didn't supply one.
  IF NEW.vendor_reply IS NOT NULL AND OLD.vendor_reply IS NULL
     AND NEW.vendor_reply_at IS NULL THEN
    NEW.vendor_reply_at := NOW();
  END IF;
  -- Keep vendor_reply_at in sync whenever the reply text changes.
  IF NEW.vendor_reply IS NOT NULL
     AND NEW.vendor_reply IS DISTINCT FROM OLD.vendor_reply
     AND OLD.vendor_reply IS NOT NULL THEN
    NEW.vendor_reply_at := NOW();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Trigger is already wired from the original migration; REPLACE FUNCTION
-- above is sufficient — no need to drop/recreate the trigger itself.

-- ----------------------------------------------------------------------------
-- 2. Tighten vendor_reply length constraint: 2000 → 500 characters.
--    DROP + re-ADD because PostgreSQL does not allow ALTER CHECK in place.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  DROP CONSTRAINT IF EXISTS vendor_reviews_vendor_reply_check;

ALTER TABLE public.vendor_reviews
  ADD CONSTRAINT vendor_reviews_vendor_reply_check
  CHECK (vendor_reply IS NULL OR length(vendor_reply) <= 500);

-- ----------------------------------------------------------------------------
-- 3. vendor_review_flags — vendor-submitted fake-review signals for HQ.
--
--    A vendor can flag any review on their profile once. HQ reviews the flag
--    and may dismiss or escalate to the two-admin queue. Dismissal closes
--    the flag; escalation creates a vendor_review_appeals row for the
--    override-publish / reject flow.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_review_flags (
  flag_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id             UUID NOT NULL REFERENCES public.vendor_reviews(review_id) ON DELETE CASCADE,
  reported_by_vendor_profile_id UUID NOT NULL
                          REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  reason                TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'dismissed', 'escalated')),
  admin_note            TEXT,
  reviewed_by_admin_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One flag per (review, vendor) — a vendor can only flag a review once.
  UNIQUE (review_id, reported_by_vendor_profile_id)
);

CREATE INDEX IF NOT EXISTS vendor_review_flags_review_id_idx
  ON public.vendor_review_flags(review_id);
CREATE INDEX IF NOT EXISTS vendor_review_flags_status_idx
  ON public.vendor_review_flags(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS vendor_review_flags_vendor_profile_id_idx
  ON public.vendor_review_flags(reported_by_vendor_profile_id);

ALTER TABLE public.vendor_review_flags ENABLE ROW LEVEL SECURITY;

-- Vendor INSERT: may only flag a review that belongs to their own profile.
DROP POLICY IF EXISTS vendor_review_flags_vendor_insert ON public.vendor_review_flags;
CREATE POLICY vendor_review_flags_vendor_insert
  ON public.vendor_review_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by_vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
    )
    AND review_id IN (
      SELECT vr.review_id FROM public.vendor_reviews vr
      WHERE vr.vendor_profile_id = reported_by_vendor_profile_id
    )
  );

-- Vendor SELECT: may read their own flags.
DROP POLICY IF EXISTS vendor_review_flags_vendor_read ON public.vendor_review_flags;
CREATE POLICY vendor_review_flags_vendor_read
  ON public.vendor_review_flags FOR SELECT
  TO authenticated
  USING (
    reported_by_vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
    )
  );

-- Admin full access.
DROP POLICY IF EXISTS vendor_review_flags_admin ON public.vendor_review_flags;
CREATE POLICY vendor_review_flags_admin
  ON public.vendor_review_flags FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
