-- ============================================================================
-- 20260520040000_iteration_0009_notification_types.sql
--
-- PR 5 of 5 for V1 iteration 0009 Photo Delivery.
-- Spec corpus: 0009_photo_delivery/0009_photo_delivery.md § Notification on completion
--
-- Adds two notification_type enum values fired by the release worker
-- when a job finalizes:
--   • photo_delivery_complete — every couple member is notified + emailed
--     with a link back to /dashboard/[event-id]/add-ons/photo-delivery
--   • photo_delivery_failed   — same fan-out, with an error context line
--     pointing at the panel's failure state for retry/disconnect controls
--
-- ALTER TYPE ... ADD VALUE cannot run inside an explicit transaction
-- block, so this migration is intentionally bare (matches the prior
-- 20260517020000_notification_type_force_majeure_filed.sql pattern).
-- IF NOT EXISTS keeps it idempotent across re-runs.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'photo_delivery_complete';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'photo_delivery_failed';
