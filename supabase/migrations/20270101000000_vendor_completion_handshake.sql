-- Event Lifecycle Menu PR4a — per-vendor completion handshake + review-gate fix.
--
-- The After phase gates a vendor's review on a real two-party handshake
-- (§6.1): vendor marks the service complete → couple confirms received → the
-- review unlocks. Two symmetric time-outs keep either side from deadlocking the
-- other, BOTH enforced read-side (no cron — per the locked cron-free rule):
--   • M = 7 days  — after the vendor marks complete, a silent couple auto-confirms.
--   • N = 30 days — after the event, a silent vendor auto-completes (anti-gaming:
--                   a vendor can't dodge a bad review by never marking complete).
-- An open non-delivery dispute (completion_status='disputed') freezes both.
--
-- This migration ALSO fixes a pre-existing bug: vendor_reviews_couple_insert's
-- EXISTS was NOT correlated to the vendor being reviewed, so the moment ANY one
-- vendor on the event was delivered/complete the couple could review EVERY
-- vendor. The rewrite correlates on marketplace_vendor_id = vendor_profile_id.

BEGIN;

-- 1. Per-vendor completion state on event_vendors.
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS service_marked_complete_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_confirmed_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_disputed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_status              TEXT NOT NULL DEFAULT 'awaiting_vendor';

ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_completion_status_chk;
ALTER TABLE public.event_vendors
  ADD CONSTRAINT event_vendors_completion_status_chk
  CHECK (completion_status IN ('awaiting_vendor', 'vendor_marked', 'confirmed', 'auto_confirmed', 'disputed'));

-- 2. Backfill: legacy delivered/complete rows are treated as confirmed so live
--    events don't regress (their reviews stay unlocked — now per-vendor-correct).
UPDATE public.event_vendors
   SET completion_status              = 'confirmed',
       service_marked_complete_at     = COALESCE(service_marked_complete_at, updated_at),
       customer_confirmed_received_at = COALESCE(customer_confirmed_received_at, updated_at)
 WHERE status IN ('delivered', 'complete')
   AND completion_status = 'awaiting_vendor';

-- 3. Review-gate rewrite — vendor-scoped (BUG FIX) + the hybrid handshake gate.
DROP POLICY IF EXISTS vendor_reviews_couple_insert ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_insert
  ON public.vendor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    couple_user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = vendor_reviews.event_id
        -- BUG FIX: correlate to the vendor being reviewed (was missing →
        -- one delivered vendor unlocked reviews for ALL vendors on the event).
        AND ev.marketplace_vendor_id = vendor_reviews.vendor_profile_id
        -- An open non-delivery dispute freezes the gate until it resolves.
        AND ev.completion_status <> 'disputed'
        AND (
          -- Explicit two-party completion …
          ev.customer_confirmed_received_at IS NOT NULL
          OR ev.completion_status IN ('confirmed', 'auto_confirmed')
          -- … or M=7d customer auto-confirm after the vendor marked complete …
          OR (ev.service_marked_complete_at IS NOT NULL
              AND now() >= ev.service_marked_complete_at + interval '7 days')
          -- … or N=30d vendor auto-complete after the event (anti-gaming) …
          OR now() >= (
              (SELECT e.event_date FROM public.events e WHERE e.event_id = ev.event_id)
              + interval '30 days'
            )::timestamptz
          -- … or the legacy delivered/complete path (backfilled above; kept for safety).
          OR ev.status IN ('delivered', 'complete')
        )
    )
  );

COMMENT ON COLUMN public.event_vendors.service_marked_complete_at IS
  'Event Lifecycle Menu: when the VENDOR marked this service complete (handshake step 1).';
COMMENT ON COLUMN public.event_vendors.customer_confirmed_received_at IS
  'Event Lifecycle Menu: when the COUPLE confirmed they received everything (handshake step 2).';
COMMENT ON COLUMN public.event_vendors.completion_status IS
  'Event Lifecycle Menu completion state: awaiting_vendor → vendor_marked → confirmed (or auto_confirmed via M=7d/N=30d), or disputed.';

COMMIT;
