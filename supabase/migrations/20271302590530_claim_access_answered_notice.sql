-- claim_access_answered_notice
-- 🔗 The couple's answer to a supplier who joined from their link reaches that supplier (supplier gate audit G3,
-- 2026-11-02). One in-app notice per answer, sent by answerClaimAccess (app/dashboard/[eventId]/access-requests/
-- actions.ts). In-app only — not on EMAIL_ENABLED_TYPES. Idempotent.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'claim_access_answered';
