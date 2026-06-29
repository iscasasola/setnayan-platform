-- vendor_date_waitlist
-- Booked-Out Waitlist (Wave 4 vendor benefit).
--
-- When a couple's intended date is unavailable on a vendor's public profile,
-- they can join this per-(vendor, date) waitlist. The vendor sees who is
-- waiting on the Calendar surface; when a slot frees up (a block is removed,
-- or the vendor clicks "a slot opened") the matching pending rows flip to
-- 'notified', notified_at is stamped, and the couple gets an email.
--
-- Email-only (no SMS) · cron-free (notify fires from the block-delete server
-- action via Next 15 after(), and from the vendor's one-click action — never
-- a poller).
--
-- RLS at CREATE TABLE time (canonical helpers, prod):
--   • couple owns own rows        (user_id = auth.uid())
--   • vendor reads its own        (vendor_profile_id IN current_vendor_profile_ids())
--   • admin                       (is_admin())
--
-- Idempotent. No drops of data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_date_waitlist (
  waitlist_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID
                     REFERENCES public.events(event_id) ON DELETE SET NULL,
  requested_date     DATE NOT NULL,
  user_id            UUID NOT NULL
                     REFERENCES public.users(user_id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'notified', 'converted', 'cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at        TIMESTAMPTZ
);

-- One live waitlist row per (couple, vendor, date) — a couple re-joining the
-- same date is an idempotent no-op rather than a duplicate. Partial unique so a
-- cancelled row never blocks a fresh re-join.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_date_waitlist_unique_active
  ON public.vendor_date_waitlist (user_id, vendor_profile_id, requested_date)
  WHERE status IN ('pending', 'notified');

-- The vendor-queue + notify-on-free hot path: pending rows for a (vendor, date).
CREATE INDEX IF NOT EXISTS vendor_date_waitlist_vendor_date_pending_idx
  ON public.vendor_date_waitlist (vendor_profile_id, requested_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS vendor_date_waitlist_user_idx
  ON public.vendor_date_waitlist (user_id);

ALTER TABLE public.vendor_date_waitlist ENABLE ROW LEVEL SECURITY;

-- INSERT: a signed-in couple can add a waitlist row for themselves only.
DROP POLICY IF EXISTS vendor_date_waitlist_couple_insert
  ON public.vendor_date_waitlist;
CREATE POLICY vendor_date_waitlist_couple_insert
  ON public.vendor_date_waitlist FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: couple reads its own rows; vendor reads rows for its own profile;
-- admin reads everything.
DROP POLICY IF EXISTS vendor_date_waitlist_select
  ON public.vendor_date_waitlist;
CREATE POLICY vendor_date_waitlist_select
  ON public.vendor_date_waitlist FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  );

-- UPDATE: the couple can cancel its own row (used for the couple-side leave
-- action). Vendor-side status flips ('pending' → 'notified') run through the
-- service-role admin client in the server action, which bypasses RLS, so no
-- vendor UPDATE policy is needed here. Admin retains full control.
DROP POLICY IF EXISTS vendor_date_waitlist_couple_update
  ON public.vendor_date_waitlist;
CREATE POLICY vendor_date_waitlist_couple_update
  ON public.vendor_date_waitlist FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

COMMENT ON TABLE public.vendor_date_waitlist IS
  'Booked-Out Waitlist (Wave 4 vendor benefit). Per-(couple, vendor, date) signups created from /v/[slug] when the couple''s intended date is unavailable. Vendor sees the queue on /vendor-dashboard/calendar and notifies waiters when a slot frees up (one-click, or auto on block removal). status: pending → notified → converted/cancelled. Email-only, cron-free (notify fires from the block-delete action via after()).';

COMMIT;
