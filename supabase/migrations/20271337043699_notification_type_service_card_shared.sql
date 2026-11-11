-- notification_type_service_card_shared
-- ============================================================================
-- SHARE A SERVICE CARD TO A CLIENT EVENT (owner 2026-11-11, DECISION_LOG 🔗,
-- verbatim: "Share does not share to anyone. It is share to an client event. To
-- enter to a chat. That is notified so the client can see."). The Share icon
-- under a card on Shop › Services posts the card into one client event's chat
-- (the shipped offerServiceCore) and the client's hosts are told IN THE APP.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271329965074_notification_type_supplier_request_answered.sql).
--
-- ⛔ IN-APP ONLY. It is NOT on the email allowlist (lib/notification-emit.ts) —
-- owner rule 2026-10-11: no new emails without his word. Held by
-- apps/web/lib/a-shared-card-never-emails.test.ts.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'service_card_shared';
