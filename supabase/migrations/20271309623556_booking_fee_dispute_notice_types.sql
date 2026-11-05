-- booking_fee_dispute_notice_types
-- 🕵️ FOUND-YOU DISPUTES (DECISION_LOG 2026-07-27 "FOUND-YOU DISPUTES — grace-first ladder"; owner 2026-11-05:
-- "switch on booking fee. and build dispute"). Two in-app notices, used by migration 20271310612526's flow:
--   · fee_dispute_opened   → every Setnayan admin, when a supplier's SECOND (or later) dispute waits for review;
--   · fee_dispute_answered → the supplier, when an admin accepts or rejects that dispute.
-- (The FIRST dispute is accepted on the spot and answered on the screen the supplier pressed it from.)
-- Both are IN-APP ONLY — neither is on EMAIL_ENABLED_TYPES (owner: no new emails). Their own file because a new
-- enum value cannot be used in the transaction that adds it. Idempotent.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'fee_dispute_opened';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'fee_dispute_answered';
