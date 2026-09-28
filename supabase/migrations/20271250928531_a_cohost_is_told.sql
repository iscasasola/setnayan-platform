-- ============================================================================
-- A CO-HOST IS TOLD.
--
-- Owner, 2026-09-28: when a joined guest is made a co-host they get
-- "You are now a co-host for {user name}'s {event name} {event type} event.
--  You have access to the following: … (CONFIRM)".
--
-- The companion migration (20271251336140) writes that notice from the
-- database, at the moment the seat becomes live — whichever door made it live
-- (the co-host's Access pick, the guest's YES, the guest linking an account).
--
-- Its own file because Postgres refuses to USE an enum value inside the
-- transaction that added it; nothing here uses it.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cohost_added';
