-- ============================================================================
-- 20260517020000_notification_type_force_majeure_filed.sql
-- Adds the missing `force_majeure_filed` value to the notification_type enum.
--
-- Context: the couple-side dispute filing action fans a notification out to
-- every internal/team-pool admin so the Disputes Handler picks it up
-- promptly. Until now the emit reused `order_quoted` (a copy-paste from the
-- order code path), which mislabels the admin tray as "Order quoted" with
-- the wrong tone color. Adding a dedicated value lets the admin tray render
-- the correct label + tone.
--
-- ALTER TYPE … ADD VALUE cannot run inside an explicit transaction block,
-- so this migration is intentionally bare. IF NOT EXISTS keeps it idempotent.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'force_majeure_filed';
