-- gift_notification_type
-- ============================================================================
-- Admin "early wedding gift" — comp-grant fulfillment bridge (PR 1).
-- ============================================================================
-- Adds the 'gift' value to the notification_type enum so a fulfilled admin
-- comp grant can drop an in-app "early wedding gift from the Setnayan Team"
-- notification (the unread bell + the gift reveal pop-up in PR 2). NOT on the
-- email/push allowlists in lib/notification-emit.ts — the reveal is the delight.
--
-- Idempotent. ALTER TYPE ... ADD VALUE runs as its own statement (not used in
-- the same txn it's added in), so applying statement-by-statement is safe.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'gift';
