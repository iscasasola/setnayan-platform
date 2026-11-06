-- fee_review_threshold
-- ============================================================================
-- THE "REVIEW THIS SUPPLIER" COUNT — admin-set, default 2, review only.
--
-- ⚖ OWNER, 2026-10-07: "flag suppliers with several booked-but-unsettled
-- events". ⚖ OWNER, 2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)",
-- answer 12): flag for review at an admin-set count of EVENTS, default 2,
-- review only. Audit `BOOKING_FEE_RULES_AUDIT_2026-10-12.md` H2 / build item 14.
--
-- One number on `platform_settings`, beside the other booking-fee knobs, read
-- by /admin/booking-fees ("Suppliers to review") and edited there. It decides
-- what an admin is SHOWN — never a penalty, never a charge.
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS fee_review_unsettled_events_min INTEGER;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_fee_review_unsettled_events_min_positive;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_fee_review_unsettled_events_min_positive
  CHECK (fee_review_unsettled_events_min IS NULL OR fee_review_unsettled_events_min >= 1);

-- The owner's default (2026-10-12 #12), only where nothing is set yet.
UPDATE public.platform_settings
   SET fee_review_unsettled_events_min = 2
 WHERE id = 1 AND fee_review_unsettled_events_min IS NULL;

COMMENT ON COLUMN public.platform_settings.fee_review_unsettled_events_min IS
  'Owner 2026-10-12 #12: a supplier is listed for REVIEW on /admin/booking-fees once this many of their events are booked on the couple''s side (booked status or a payment recorded) with no settled booking fee. Default 2. Review only — never a penalty.';

-- Re-stated after the ADD COLUMN, as every platform_settings migration since
-- 20271014400000 does: anon holds nothing on this table.
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
