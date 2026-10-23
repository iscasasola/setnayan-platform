-- A FREE-FEE WINDOW CARRIES ITS REASON (DECISION_LOG 2026-09-23, money switch #3).
--
-- Ruling, verbatim: *"A PROMOTION CARRIES A REASON, AND IT IS REQUIRED TO OPEN A
-- WINDOW (not to close one). In a year the audit row shows money was waived for
-- three weeks; without it, not why."* — and it is the one money-switch answer
-- that cannot be added back later, because a missing history stays missing.
--
-- The window is ONE window on `platform_settings` (`booking_fee_free_from`,
-- `booking_fee_free_until`, migration 20271240512825), edited only from
-- /admin/launch-offer (`saveLaunchOffer` intent `window`). The reason sits
-- beside it, and the action copies it into the `admin_audit_log` row.
--
-- ⚠ WHY "REQUIRED TO OPEN" IS NOT A CHECK HERE. The admin action refuses to
-- save a window without a reason. A SQL CHECK of "a window needs a reason"
-- would be stronger on paper and dangerous in fact: if production already holds
-- a window opened before this column existed, the row would violate it, and
-- EVERY later `platform_settings` update — booking-fee rates, payment details,
-- feature flags — would start failing. Only the length is bounded here.
--
-- Grants: re-stated as every `platform_settings` migration does (anon holds
-- nothing on this table; authenticated may SELECT — so, like the rest of the
-- row, a signed-in user can read this text. Write it for the audit, not as a
-- secret).

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_free_reason TEXT;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_booking_fee_free_reason_length;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_booking_fee_free_reason_length CHECK (
    booking_fee_free_reason IS NULL
    OR char_length(booking_fee_free_reason) BETWEEN 1 AND 500
  );

COMMENT ON COLUMN public.platform_settings.booking_fee_free_reason IS
  'Why the free-fee window (booking_fee_free_from/until) was opened. Required by the admin action to OPEN a window, cleared to NULL when the window is closed (DECISION_LOG 2026-09-23 #3). Not a SQL CHECK on purpose — see the migration header.';

REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
