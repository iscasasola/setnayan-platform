-- ============================================================================
-- A HOST WHO IS ADDED IS TOLD.
--
-- Owner, 2026-09-28: "creating someone a host needs no approval from their
-- side. they will be auto accepted" — and it "should show on her setnayan
-- account and not just email".
--
-- The companion migration (20271251336140) makes an added host a host at once.
-- This one adds the notification type that tells them, so the event does not
-- simply appear on their home with no word about who put it there.
--
-- Its own file because Postgres refuses to USE an enum value inside the
-- transaction that added it; nothing here uses it.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'host_added';
