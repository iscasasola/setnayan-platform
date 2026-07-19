-- get_pending_inquiry_basics — 4 non-identifying event fields for a MASKED lead.
--
-- Why: a vendor is NOT an event_members row while the inquiry is still pending,
-- and public.events has only member/moderator SELECT policies, so a direct read
-- (or embedded join) on events returns NULL under the vendor's RLS session. The
-- masked vendor lead therefore has no way to see even the decision-useful, non-
-- identifying basics of the inquiry before deciding to accept.
--
-- Owner-approved 2026-07-11 (Vendor_Customer_Master_Build_Plan_2026-07-11.md,
-- Phase 1 / PR 1): expose ONLY four non-identifying fields on a PENDING lead —
--   event_date · region (slug) · event_type · setnayan_ai_active
-- This SUPERSEDES the pre-accept-blank aspect of the 2026-07-03 disclosure
-- ladder. It deliberately does NOT return the couple's name (display_name),
-- email, phone, venue, monogram, love_story, or any other event column. Full
-- event details STILL gate behind accept (see get_vendor_event_brief).
--
-- Gate (both conditions required):
--   1. the thread is 'pending' (masked lead only — never leaks post-accept rows), and
--   2. the thread's vendor_profile_id is one the CALLER owns/admins, resolved via
--      public.current_vendor_profile_ids() (owner + admin team members). A vendor
--      can therefore only read basics for its OWN pending inquiries.
--
-- SECURITY DEFINER + SET search_path = public runs the body with the definer's
-- rights (bypassing events RLS) but the WHERE clause is the whole security
-- boundary — keep it. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.get_pending_inquiry_basics(p_thread_id uuid)
RETURNS TABLE(
  event_date          date,
  region              text,
  event_type          text,
  setnayan_ai_active  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.event_date,
    e.region,
    e.event_type::text,
    COALESCE(e.setnayan_ai_active, false)
  FROM public.chat_threads t
  JOIN public.events e ON e.event_id = t.event_id
  WHERE t.thread_id = p_thread_id
    AND t.inquiry_status = 'pending'
    AND t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
$$;

COMMENT ON FUNCTION public.get_pending_inquiry_basics(uuid) IS
  'Masked-lead inquiry basics (owner-approved 2026-07-11, Vendor_Customer_Master PR 1). Returns ONLY event_date/region/event_type/setnayan_ai_active, and ONLY for a PENDING chat_thread owned by the calling vendor org (current_vendor_profile_ids()). Never returns name/email/phone/venue; full details still gate behind accept (get_vendor_event_brief).';

REVOKE EXECUTE ON FUNCTION public.get_pending_inquiry_basics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_inquiry_basics(uuid) TO authenticated;
