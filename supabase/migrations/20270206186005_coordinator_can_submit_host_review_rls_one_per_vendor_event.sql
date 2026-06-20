-- coordinator can submit host review rls one per vendor event
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ============================================================================
-- Vendor lifecycle — coordinator can submit the host ★ review.
--
-- The host ★ review of a vendor (one row in `vendor_reviews` = the host's
-- verdict on a vendor for an event) was gated DB-side to the COUPLE only:
-- the INSERT/UPDATE/DELETE policies all required `couple_user_id = auth.uid()`
-- AND `event_id IN (SELECT current_couple_event_ids())`, and
-- current_couple_event_ids() filters strictly to member_type='couple'. So a
-- delegated coordinator's write was rejected by Postgres regardless of app code.
--
-- Owner-locked semantics: ONE host review per (vendor, event), submittable by
-- the COUPLE *or* a COORDINATOR of that event. It is the host's verdict — the
-- coordinator acts on the couple's behalf; the review is attributed to the
-- EVENT/couple, not to the individual coordinator.
--
-- This migration:
--   1. Adds helper `current_couple_or_coordinator_event_ids()` — mirrors the
--      shape/security of `current_couple_event_ids()` but admits
--      member_type IN ('couple','coordinator').
--   2. Relaxes the review write policies (INSERT/UPDATE/DELETE) to use the new
--      helper, while KEEPING the completion/handshake + no-open-dispute gate on
--      INSERT intact (rewritten verbatim from 20270101000000, only the event-id
--      membership subquery swapped).
--   3. Swaps the UNIQUE from (vendor_profile_id, event_id, couple_user_id) to
--      (vendor_profile_id, event_id) so exactly one host review exists per
--      vendor-event regardless of which host (couple or coordinator) submitted.
--      Verified prod has zero duplicate (vendor, event) rows before the swap.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper — events where the caller is a couple OR coordinator member.
--    Mirrors current_couple_event_ids() exactly (SECURITY DEFINER, STABLE,
--    SET search_path = public, SETOF UUID) — only the member_type filter widens.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_couple_or_coordinator_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id FROM public.event_members
  WHERE user_id = auth.uid()
    AND member_type IN ('couple', 'coordinator');
$$;

GRANT EXECUTE ON FUNCTION public.current_couple_or_coordinator_event_ids() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Relax the review write policies — couple OR coordinator of the event.
--    The single INSERT policy is the handshake-gated one from 20270101000000;
--    we replace it, keeping every completion/handshake + no-dispute condition
--    and only swapping the couple-only event-id subquery for the new helper.
-- ----------------------------------------------------------------------------

-- INSERT — host (couple or coordinator) of the event, AND the per-vendor
-- completion handshake is satisfied AND there's no open non-delivery dispute.
DROP POLICY IF EXISTS vendor_reviews_couple_insert ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_insert
  ON public.vendor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    couple_user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = vendor_reviews.event_id
        -- vendor-scoped: correlate to the vendor being reviewed.
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
          -- … or the legacy delivered/complete path (kept for safety).
          OR ev.status IN ('delivered', 'complete')
        )
    )
  );

-- UPDATE — host (couple or coordinator) of the event can edit ratings + body,
-- but not vendor_reply (vendor_reply stays NULL on a host edit; the trigger
-- also locks it once set). Relaxed from couple-only to couple-or-coordinator.
DROP POLICY IF EXISTS vendor_reviews_couple_update ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_update
  ON public.vendor_reviews FOR UPDATE
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_or_coordinator_event_ids()))
  WITH CHECK (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    AND vendor_reply IS NULL
    AND vendor_reply_at IS NULL
  );

-- DELETE — host (couple or coordinator) of the event can retract the review.
DROP POLICY IF EXISTS vendor_reviews_couple_delete ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_delete
  ON public.vendor_reviews FOR DELETE
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_or_coordinator_event_ids()));

-- ----------------------------------------------------------------------------
-- 3. One host review per (vendor, event) — swap the UNIQUE.
--    Old: UNIQUE (vendor_profile_id, event_id, couple_user_id) — would let a
--    couple AND a coordinator each leave one (different couple_user_id).
--    New: UNIQUE (vendor_profile_id, event_id) — one host verdict per booking.
--    Safe: prod verified to hold zero duplicate (vendor, event) rows.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  DROP CONSTRAINT IF EXISTS vendor_reviews_vendor_profile_id_event_id_couple_user_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vendor_reviews'::regclass
      AND conname = 'vendor_reviews_vendor_profile_id_event_id_key'
  ) THEN
    ALTER TABLE public.vendor_reviews
      ADD CONSTRAINT vendor_reviews_vendor_profile_id_event_id_key
      UNIQUE (vendor_profile_id, event_id);
  END IF;
END $$;

COMMENT ON FUNCTION public.current_couple_or_coordinator_event_ids() IS
  'Events where auth.uid() is an event_members row with member_type IN (couple,coordinator). Mirrors current_couple_event_ids() but admits the delegated coordinator. Used by the vendor_reviews host-review write policies.';

COMMIT;
