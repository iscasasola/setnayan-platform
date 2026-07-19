-- ============================================================================
-- 20270809988056_vendor_reviews_realtime.sql
--
-- Vendor "On the Day" launcher · PR-6 — LIVE review feed enablement.
--
-- The launched day-of console shows the vendor their reviews as they land
-- (apps/web/.../on-the-day/_components/live-reviews.tsx). It subscribes to the
-- BASE table public.vendor_reviews (the vendor_review_stats matview only
-- refreshes on write, so the base table is the live source). This migration
-- adds vendor_reviews to the supabase_realtime publication so postgres_changes
-- events flow.
--
-- SAFETY / INTEGRITY (council ruling): NO new access is granted. The existing
-- vendor_reviews RLS is unchanged — a vendor still only reads their own profile's
-- reviews, and reviews are still written only by the couple/coordinator of a
-- BOOKED + COMPLETED event (one host verdict per booking, no anon path). The feed
-- is therefore vendor-private, read-only, and post-completion by construction;
-- it can never become a public volume leaderboard. Realtime respects RLS, so a
-- subscriber only receives rows they may already SELECT.
--
-- Idempotent + re-run safe (guards against the table already being in the
-- publication).
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'vendor_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_reviews;
  END IF;
END $$;

COMMIT;
