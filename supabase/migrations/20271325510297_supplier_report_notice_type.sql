-- supplier_report_notice_type
-- 🚩 REPORT = SUBJECT · NOTE · ORIGIN (owner 2026-11-08, DECISION_LOG row of that name; THE ONE BUILD §5.4 / §9 #16).
-- A supplier's Report from a picked client lands in the shipped /admin/help inbox (help_messages, with its origin —
-- migration 20271325290605) and tells every Setnayan admin IN THE APP ONLY: "admin in-app notice only, no email"
-- (§5.4). The shipped /help form notifies with `chat_message`, which IS on EMAIL_ENABLED_TYPES — so a Report gets its
-- own type, deliberately NOT on that allowlist. Its own file because a new enum value cannot be used in the
-- transaction that adds it (same shape as 20271314517155). Idempotent.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'supplier_report';
