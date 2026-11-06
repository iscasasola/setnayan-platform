-- found_you_lead_notice_type
-- 🕵️ FOUND-YOU (DECISION_LOG 2026-07-27, built 2026-11-05): the supplier's lead alert — "<couple> found you on
-- Setnayan on <date>" — sent when the couple approves a supplier who joined from their link AND the found-check
-- (`found_you_check_at_claim`, migration 20271313372071) says the couple had already seen that shop here first.
-- Sent by answerClaimAccess (app/dashboard/[eventId]/access-requests/actions.ts). In-app only — NOT on
-- EMAIL_ENABLED_TYPES (owner: no new emails). Its own file because a new enum value cannot be used in the
-- transaction that adds it. Idempotent.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'found_you_lead';
