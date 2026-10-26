-- notification_type_service_card_check
-- ============================================================================
-- 🃏 "SAVED · WAITING FOR A QUICK CHECK" — TO THE SUPPLIER, IN THE APP ONLY
-- (owner 2026-10-26, DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN":
-- "In-app notice only (no email)").
--
-- One type for every moment the automatic card check speaks to a supplier: the
-- card is held for a look (including a photo match that lands seconds after the
-- save), and the admin's verdict — Approved · Ask to fix · Rejected. No existing
-- type says it truthfully: `vendor_status_change` is the SHOP's verification
-- state and IS on the email allowlist; this must not be emailed.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. Same shape as
-- 20271284540209_notification_type_schedule_shifted.sql: a bare
-- ADD VALUE IF NOT EXISTS, no row written, no function created.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'service_card_check';
