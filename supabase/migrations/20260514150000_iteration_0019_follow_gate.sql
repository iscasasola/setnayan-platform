-- ============================================================================
-- 20260514150000_iteration_0019_follow_gate.sql
-- Iteration 0019 — follow-before-message gate.
--
-- Adds `vendor_follows` (couple → vendor one-way follow) and adds a
-- RESTRICTIVE INSERT policy on `chat_threads` so couples can only create a
-- thread with a vendor they follow. The existing `chat_threads_member_write`
-- policy stays in place; restrictive policies AND with permissive ones, so
-- the net effect is: INSERT requires (couple-of-event) AND (follows vendor).
--
-- Vendor-side note: the existing `chat_threads_member_write` policy lets
-- vendors INSERT into chat_threads. The new restrictive policy blocks that
-- for vendors because they can't satisfy the follower check (auth.uid() is
-- the vendor's user, which is not a couple of the event). This enforces the
-- "vendor-passive cold threads" invariant locked in 0019 § Gate.
--
-- An existing thread survives an un-follow: the gate only fires at INSERT,
-- so DELETE on vendor_follows does not cascade to threads.
--
-- Idempotent: every CREATE wrapped in IF NOT EXISTS or a DO block.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_follows table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_follows (
  follower_user_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  followed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_user_id, vendor_profile_id)
);

CREATE INDEX IF NOT EXISTS vendor_follows_by_vendor
  ON public.vendor_follows (vendor_profile_id, followed_at DESC);

ALTER TABLE public.vendor_follows ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. vendor_follows RLS
--    Follower owns the row (SELECT / INSERT / DELETE). Vendors can SELECT
--    rows that point at their own vendor_profile_id so they can see who
--    follows them on their dashboard.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS vendor_follows_follower_select ON public.vendor_follows;
CREATE POLICY vendor_follows_follower_select
  ON public.vendor_follows FOR SELECT
  TO authenticated
  USING (follower_user_id = auth.uid());

DROP POLICY IF EXISTS vendor_follows_vendor_select ON public.vendor_follows;
CREATE POLICY vendor_follows_vendor_select
  ON public.vendor_follows FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_follows_follower_insert ON public.vendor_follows;
CREATE POLICY vendor_follows_follower_insert
  ON public.vendor_follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_user_id = auth.uid());

DROP POLICY IF EXISTS vendor_follows_follower_delete ON public.vendor_follows;
CREATE POLICY vendor_follows_follower_delete
  ON public.vendor_follows FOR DELETE
  TO authenticated
  USING (follower_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. RESTRICTIVE follow gate on chat_threads INSERT
--
--    Restrictive policies AND with the existing permissive
--    chat_threads_member_write. Net effect on INSERT:
--      (couple-of-event OR vendor-of-profile)   -- existing permissive
--      AND
--      (auth.uid() follows vendor_profile_id)   -- this restrictive
--    Vendors can't satisfy the follow row (their auth.uid() is never a
--    follower for their own profile in normal product flow), so they're
--    blocked from cold-creating threads.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS chat_threads_follow_gate ON public.chat_threads;
CREATE POLICY chat_threads_follow_gate
  ON public.chat_threads
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id
      FROM public.vendor_follows
      WHERE follower_user_id = auth.uid()
    )
  );

COMMIT;
