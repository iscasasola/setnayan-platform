-- notification_type_payment_rail_down
-- ============================================================================
-- 💳 THE ADMINS ARE TOLD, ONCE, WHEN MAYA WILL NOT OPEN (owner 2026-11-21,
-- DECISION_LOG "BDO QR IS NOT AN OPTION — ONLY THE SAFETY ROUTE WHEN MAYA IS
-- OFF" + the v3 drawing: "Maya is busy — pay by BDO QR. Nothing has been
-- charged."). Payers who cannot open Maya land on the BDO QR at once; the
-- admins get ONE notice per outage window (sender: lib/maya-busy.server.ts,
-- deduped on platform_settings.maya_busy_noticed_at).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271348269771_notification_type_seal_awarded.sql).
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_rail_down';
