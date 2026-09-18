-- 20271234083820 · retired ends nobody calls (S37)
--
-- S26's both-ends guard (#5625) ranked each object below as an orphan: a
-- function with no caller, or a table with no writer. Each was re-measured
-- 2026-09-18 against origin/main AND production and is the leftover end of a
-- feature that was retired or replaced. Choice for every one: DELETE THE END
-- NOBODY NEEDS. Nothing here held a row in production (measured the same day):
--
--   couple_briefs · vendor_bid_submissions · derive_brief_token_cost()
--     The bid/RFP marketplace, which charged vendors tokens per bid. Retired
--     with the token economy (20271120530202). No reader, no writer. 0 rows each.
--   papic_photo_challenge_sponsorships
--     The ₱400 per-event Challenge. Replaced by the 28-day subscription
--     (vendor_profiles.papic_challenge_expires_at); its last read was removed
--     in 20271182071895, which marked it RETIRED and left the drop to its own
--     decision. This is that decision. 0 rows.
--   vendor_release_history
--     An audit trail for soft-hold releases whose writers never shipped. The
--     inquiry lifecycle now lives on chat_threads.inquiry_status and is never
--     hard-deleted, which removed the reason for it. 0 rows.
--   release_event_lead_holds(uuid,text) · sweep_ghosted_lead_holds(interval)
--     Lead-token hold housekeeping. Every caller went with the hold retirement
--     (43996627c); lead_token_holds has 0 rows and nothing creates one.
--   user_holds_founder_seat(uuid)
--     Anon-callable boolean with no caller; founder logic runs on
--     event_host_holds_founder_seat(uuid). Dropping it narrows the anon surface.
--   register_guest_claim_otp_attempt(uuid)
--     The email-OTP guest claim, replaced by Invite/Join v2 (optimistic admit +
--     name match, no OTP). Its routes were deleted; this was left as a tombstone,
--     and had drifted to anon-executable in production.
--   report_guest_capture(uuid,uuid,text,text)
--     Never called by any app code since it was written. Reporting runs through
--     the couple's moderation page, askToTakeMyPhotoDown and lib/reports.ts. It
--     took the reporter's identity from an anon caller's argument.
--
-- Deliberately NOT CASCADE: if anything unexpected depends on one of these,
-- the push fails loudly instead of silently taking a dependant with it.

DROP TABLE IF EXISTS public.vendor_bid_submissions;
DROP TABLE IF EXISTS public.couple_briefs;
DROP FUNCTION IF EXISTS public.derive_brief_token_cost();

DROP TABLE IF EXISTS public.papic_photo_challenge_sponsorships;
DROP TABLE IF EXISTS public.vendor_release_history;

DROP FUNCTION IF EXISTS public.release_event_lead_holds(uuid, text);
DROP FUNCTION IF EXISTS public.sweep_ghosted_lead_holds(interval);
DROP FUNCTION IF EXISTS public.user_holds_founder_seat(uuid);
DROP FUNCTION IF EXISTS public.register_guest_claim_otp_attempt(uuid);
DROP FUNCTION IF EXISTS public.report_guest_capture(uuid, uuid, text, text);
