-- notification_type_lock_request
-- ============================================================================
-- PR-H · the five notification types the lock handshake needs.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE.
-- notification_type is a Postgres ENUM (20260513160000_iteration_0028_notifications.sql),
-- and Postgres forbids USING a newly-added enum value in the same transaction
-- that adds it. So: no BEGIN/COMMIT, no other statements. Exact shape of
-- 20270904548818_notification_type_papic_challenge_pending.sql.
--
-- Who hears what:
--   lock_request_received  → the VENDOR. "A couple has asked you to take a booking."
--   lock_request_nudge     → the VENDOR, day 5. Owner-ordered 2026-08-04 §6.3,
--                            and it echoes the 2026-06-02 lock ("the vendor is
--                            nudged not to drag it"). Email-enabled for the
--                            strongest reason there is: it exists for the vendor
--                            who never opens the app, so an in-app-only nudge
--                            would reach exactly the vendors who do not need it.
--   lock_request_agreed    → the COUPLE. The booking is real now.
--   lock_request_declined  → the COUPLE, carrying the vendor's own words.
--   lock_request_expired   → the COUPLE. Nobody answered in 7 days.
--
-- 🔑 A 'lock_request_superseded' value is deliberately NOT added. When a rival is
-- already confirmed the request closes as 'cancelled' and the couple performed
-- the act that closed it in the same session — a notification telling them what
-- they just did is noise. See the wiring migration's group_taken branch.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'lock_request_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'lock_request_nudge';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'lock_request_agreed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'lock_request_declined';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'lock_request_expired';
