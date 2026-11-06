-- notification_type_vendor_invite_declined
-- Created via `pnpm migration:new`. Idempotent (ADD VALUE IF NOT EXISTS).
-- ============================================================================
-- THE COUPLE IS TOLD, IN THE APP, WHEN A SUPPLIER DECLINES THEIR LINK.
-- Owner, 2026-10-10 (`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`, "4-6 do as you
-- recommend"): the couple IS told when the supplier declines or never opens the
-- link. Until now `declineVendorInviteByToken` wrote `declined` and told nobody.
--
-- ⛔ IN-APP ONLY. Owner, 2026-10-11: "i thought we can manage without emails?"
-- — no new email. This type is NOT on the email allowlist.
-- ⚠ ITS OWN FILE, NOTHING ELSE IN IT: notification_type is a Postgres ENUM and a
-- value cannot be used in the transaction that adds it (the shape of
-- 20271262858364_notification_type_schedule_change_requested.sql).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_invite_declined';
