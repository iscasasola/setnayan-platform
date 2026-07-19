-- vendors_blocked_on_date_rpc
-- ============================================================================
-- SCOPED service-date availability for the couple's vendor search (owner-picked
-- 2026-07-11 · privacy model). Activates the dormant "Booked your date" down-rank
-- shipped in PR #3089 WITHOUT exposing vendor calendars to couples.
--
-- THE PRIVACY PROBLEM this solves: public.vendor_calendar_blocks has no couple/
-- public SELECT policy (only vendor-owner + team-admin), so a couple's RLS-scoped
-- search read returns zero rows and every vendor reads as "available" (fail-open).
-- A blanket couple SELECT would over-expose — block_label is free text (client
-- names, personal reasons) and the full row set reveals the vendor's entire
-- schedule/booking density. Owner chose the minimal-exposure model instead:
--
-- This SECURITY DEFINER function answers ONLY "which of THESE vendors have a block
-- overlapping the couple's ONE event date?" — returning just the busy
-- vendor_profile_ids. No labels, no other dates, no block reasons, no schedule
-- density ever crosses to the couple. It reads the table under DEFINER rights
-- (bypassing RLS) but returns nothing beyond the per-date busy/free bit for the
-- exact vendor set the caller already sees in their search results.
--
-- Overlap is evaluated on the PH day (Asia/Manila) the event_date names: a vendor
-- is busy iff a block's [blocked_at, blocked_until) interval intersects that day.
-- This is a soft DOWN-RANK signal (never a hard filter), so exact TZ edges don't
-- gate bookings — matches the fail-open intent.
--
-- Idempotent (CREATE OR REPLACE). REVOKE PUBLIC/anon + GRANT authenticated only.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendors_blocked_on_date(
  p_vendor_ids uuid[],
  p_event_date date
)
RETURNS TABLE (vendor_profile_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT b.vendor_profile_id
  FROM public.vendor_calendar_blocks b
  WHERE b.vendor_profile_id = ANY (p_vendor_ids)
    AND b.blocked_at   <  ((p_event_date + 1)::timestamp AT TIME ZONE 'Asia/Manila')
    AND b.blocked_until >  ( p_event_date     ::timestamp AT TIME ZONE 'Asia/Manila');
$$;

REVOKE ALL     ON FUNCTION public.vendors_blocked_on_date(uuid[], date) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.vendors_blocked_on_date(uuid[], date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.vendors_blocked_on_date(uuid[], date) TO authenticated;

COMMENT ON FUNCTION public.vendors_blocked_on_date(uuid[], date) IS
  'Scoped service-date availability for couple vendor search (2026-07-11 · privacy model). Given a set of vendor_profile_ids + the couple''s event_date, returns ONLY the subset that have a vendor_calendar_blocks interval overlapping that PH (Asia/Manila) day. SECURITY DEFINER so it can read the owner-RLS''d table, but leaks nothing beyond the per-date busy bit — never block labels, other dates, or schedule density. Soft down-rank signal; fail-open on the caller side.';

COMMIT;
