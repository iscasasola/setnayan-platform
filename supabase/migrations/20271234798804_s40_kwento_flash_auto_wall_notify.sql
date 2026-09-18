-- s40_kwento_flash_auto_wall_notify
--
-- The `kwento_flash_auto_walled` notification type has existed since
-- migration 20261227000000 (Kwento Monumental Upgrade, Flash tier) but was
-- NEVER EMITTED -- the intake route (app/api/papic/kwento/route.ts) auto-
-- walls a clean Flash caption via wall_approve_caption() and returns, with
-- no emitNotification call anywhere in that branch. lib/notifications.ts's
-- own comment describes it as "informational coordinator-only count shown
-- in the live console... Logged as a notification row for the audit trail"
-- -- a documented intent that was never wired (S40 orphan sweep,
-- notice-no-emitter class).
--
-- Mirrors the existing events.last_kwento_notify_at debounce
-- (20271011120000) exactly, on its own column: a live reception can auto-
-- wall dozens of clean Flash captures in a few minutes, and this is an
-- audit-trail notice, not a per-message alert, so it is batched the same
-- way the flagged-Story notify already is.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS last_kwento_flash_wall_notify_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.last_kwento_flash_wall_notify_at IS
  'Debounce stamp for kwento_flash_auto_walled notifications to the couple/delegates. '
  'Written before the send so concurrent requests cannot both notify. Separate from '
  'last_kwento_notify_at (the flagged-Story debounce) so a busy reception auto-walling '
  'many clean Flash captures cannot delay the more important flagged-Story review nudge.';

COMMIT;
