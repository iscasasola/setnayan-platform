-- ============================================================================
-- AN INVITATION REACHES THE ACCOUNT.
--
-- Owner, 2026-09-28: "if they have an account. it must show on their event
-- page. as incoming requests." — "You are invited to {user name}'s {event
-- name} {event type} event. (YES/NO)". Approved prototype the same day
-- (incoming-requests-delta.html): the request on the Events page AND a row in
-- the bell.
--
-- This file only adds the notification type (Postgres refuses to USE an enum
-- value inside the transaction that added it). 20271252896804 writes it.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_invitation';
