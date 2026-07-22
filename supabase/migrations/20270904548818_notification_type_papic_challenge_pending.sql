-- notification_type: papic_challenge_pending
-- ============================================================================
-- Papic Games §3.6 (gap analysis #6): when a booked vendor submits a custom
-- photo challenge, the couple must approve it before it reaches guests — but the
-- only reveal was the self-hiding approval panel deep in the Papic studio, so a
-- paid challenge could stall unseen forever. This is the notification type that
-- alerts the couple. Couple-recipient; fired from createVendorChallengeAction.
--
-- Bare ADD VALUE (no surrounding transaction) — matches the other
-- notification_type_* migrations. The value is only USED at runtime
-- (emitNotification), never inside this migration, so PG's "can't use a new enum
-- value in the same tx it was added" rule is not engaged. Idempotent.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'papic_challenge_pending';
