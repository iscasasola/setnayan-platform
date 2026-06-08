-- ============================================================================
-- 20260918000100_token_purchase_notification_types.sql
-- Two new notification_type enum values for the vendor token-purchase flow:
--   vendor_token_purchase_pending — admin-facing: a vendor started a purchase
--       awaiting payment confirmation (deep-links to /admin/token-purchases).
--   vendor_tokens_credited        — vendor-facing: their purchase was confirmed
--       and tokens landed (deep-links to /vendor-dashboard/tokens).
-- Mirrored in apps/web/lib/notifications.ts (union + label + tone).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_token_purchase_pending';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_tokens_credited';
