-- ============================================================================
-- 20260907000000_notification_types_cross_actor_signals.sql
-- Cross-actor interaction audit (2026-06-07) — close the silent one-way breaks
-- where a couple action changed the couple↔vendor relationship but never
-- reached the vendor. Each value below is consumed at runtime by an
-- emitNotification() call added in the same PR; the migration only adds the
-- enum values (no in-migration usage), so ADD VALUE is safe.
--
-- New values:
--   • booking_confirmed  — couple finalizes/locks a MARKETPLACE vendor
--                          (finalizeVendor). Previously SILENT: the vendor
--                          could be "booked" via event_vendors (couple-only
--                          RLS) and never learn of it. The #1 break.
--                          → app/dashboard/[eventId]/vendors/actions.ts
--   • review_received     — couple posts a vendor review (submitCoupleReview).
--                          Previously SILENT, while the vendor Reviews page
--                          claimed "we notify you via email" — now true.
--                          → app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts
--   • booking_cancelled   — host cancels a pre-downpayment booking
--                          (cancelBookingAsHost). Was email-only via a direct
--                          sendEmail() because this enum value didn't exist;
--                          now consolidated onto the canonical dual-channel
--                          emitNotification() (in-app + email).
--                          → app/dashboard/[eventId]/vendors/actions.ts
--   • dispute_filed       — couple files a force-majeure flag scoped to a
--                          specific vendor (fileForceMajeureFlag). The admin
--                          fan-out (force_majeure_filed) already existed; this
--                          tells the NAMED vendor a flag concerns them.
--                          → app/dashboard/[eventId]/disputes/actions.ts
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent and re-run safe. Matches
-- the pattern in 20260514012000_notification_type_additions.sql and
-- 20260517020000_notification_type_force_majeure_filed.sql.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_filed';
