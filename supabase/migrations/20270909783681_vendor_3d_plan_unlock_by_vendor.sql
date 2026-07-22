-- vendor_3d_plan_unlock_by_vendor
-- ============================================================================
-- 3D Plan unlock — a VENDOR-ENABLED COUPLE DISCOUNT. Owner-locked 2026-07-22:
--
--   • A booked vendor with an ACTIVE paid 3D Booth add-on (₱1,500/28d — the
--     entitlement vendor_profiles.booth_addon_expires_at, helper
--     isVendor3dBoothActive) can "unlock the 3D Plan upgrade" for a couple they
--     are genuinely booked with (event_vendors, contracted-or-further). The
--     ₱1,500 add-on is the vendor's charge; unlocks are UNLIMITED.
--   • Unlocking does NOT gift SEATING_3D for free. It marks the event ELIGIBLE
--     for a DISCOUNTED ₱1,000 SEATING_3D (vs the standard ₱2,999 catalog price).
--     The COUPLE then buys SEATING_3D via the normal apply-then-pay checkout —
--     the server-authoritative price resolver (lib/v2-catalog.ts
--     resolvePaxPricedOrderCentavos → lib/vendor-3d-plan-unlock.ts) reads THIS
--     table and charges ₱1,000 instead of ₱2,999. Both sides pay.
--   • The couple keeps full control of what they publish — this only affects
--     what they're ELIGIBLE TO BUY, never grants or publishes anything.
--
-- SAFETY / SCOPE:
--   • BOOKED-VENDORS-ONLY, their OWN couples — the write path (the vendor server
--     action) rejects a non-booked event; this table just RECORDS the unlock +
--     attributes it to the vendor.
--   • IDEMPOTENT PER EVENT — UNIQUE(event_id): once ANY booked vendor has
--     unlocked the 3D Plan discount for an event it stays unlocked; a second
--     unlock (same or different vendor) is a no-op. The FIRST unlocker keeps the
--     attribution.
--
-- This is NOT a parallel entitlement: it does NOT feed eventSkuActive() and
-- confers no free access. It is purely a per-event discount-eligibility +
-- attribution record. The couple's SEATING_3D ownership still flows through the
-- one existing orders path (apply-then-pay → paid/fulfilled).
--
-- RLS at CREATE TABLE (§ house rule). Writes come only from the vendor server
-- action via the service-role admin client (RLS-bypassed); there is no
-- vendor/couple write policy — reads only, so the couple + the paying vendor can
-- each see "who unlocked" for the couple-facing acknowledgement + the vendor's
-- own-events view.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================

BEGIN;

-- ── per-event unlock (discount-eligibility) + attribution ────────────────────
-- Keyed by vendor_profile_id (the marketplace vendor identity), matching how
-- event_vendors.marketplace_vendor_id + current_vendor_profile_ids() resolve a
-- booked vendor org — the SAME identity the photo-challenge sponsorship uses.
CREATE TABLE IF NOT EXISTS public.event_vendor_3d_plan_unlocks (
  id                  BIGSERIAL PRIMARY KEY,
  unlock_id           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Attribution: the vendor ORG that unlocked the 3D Plan discount for this
  -- couple. Keyed by the vendor ORG (not the acting team member) — same as the
  -- photo-challenge sponsorship precedent, and it keeps this an org record with
  -- NO account-holder PII (data minimization · RA 10173 export stays clean).
  vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  unlocked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotency PER EVENT: one unlock per event, first booked vendor wins the
  -- attribution. A second unlock (any vendor) hits this UNIQUE → ON CONFLICT
  -- DO NOTHING in the server action makes it a clean no-op.
  UNIQUE (event_id)
);

COMMENT ON TABLE public.event_vendor_3d_plan_unlocks IS
  '3D Plan vendor-enabled couple discount (owner 2026-07-22): a booked vendor with an ACTIVE 3D Booth add-on unlocked the DISCOUNTED ₱1,000 SEATING_3D for this couple (vs standard ₱2,999). One row per event (UNIQUE event_id · idempotent · first unlocker attributed). Read by lib/vendor-3d-plan-unlock.ts eventHasVendor3dPlanUnlock, which the checkout price resolver consults. NOT an entitlement — confers no free access; the couple still buys SEATING_3D via the normal apply-then-pay path.';

CREATE INDEX IF NOT EXISTS idx_event_vendor_3d_plan_unlocks_vendor
  ON public.event_vendor_3d_plan_unlocks (vendor_profile_id);

ALTER TABLE public.event_vendor_3d_plan_unlocks ENABLE ROW LEVEL SECURITY;

-- The paying vendor org reads its OWN unlocks (so the client-event UI shows
-- "unlocked / not yet unlocked" and a vendor can see the couples they've unlocked).
DROP POLICY IF EXISTS event_vendor_3d_plan_unlocks_vendor_read
  ON public.event_vendor_3d_plan_unlocks;
CREATE POLICY event_vendor_3d_plan_unlocks_vendor_read
  ON public.event_vendor_3d_plan_unlocks
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- The couple / coordinator of the event may read (the couple-facing "your 3D Plan
-- upgrade was unlocked by <vendor>" acknowledgement). Read-only.
DROP POLICY IF EXISTS event_vendor_3d_plan_unlocks_member_read
  ON public.event_vendor_3d_plan_unlocks;
CREATE POLICY event_vendor_3d_plan_unlocks_member_read
  ON public.event_vendor_3d_plan_unlocks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = event_vendor_3d_plan_unlocks.event_id
      AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  ));

DROP POLICY IF EXISTS event_vendor_3d_plan_unlocks_admin_all
  ON public.event_vendor_3d_plan_unlocks;
CREATE POLICY event_vendor_3d_plan_unlocks_admin_all
  ON public.event_vendor_3d_plan_unlocks
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'event_vendor_3d_plan_unlocks'
--  ORDER BY ordinal_position;
-- -- Expected: id, unlock_id, event_id, vendor_profile_id, unlocked_at, created_at.
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'event_vendor_3d_plan_unlocks';
-- -- Expected: PK + unlock_id unique + event_id unique + vendor index.
--
-- SELECT polname FROM pg_policy
--  WHERE polrelid = 'public.event_vendor_3d_plan_unlocks'::regclass;
-- -- Expected: vendor_read · member_read · admin_all.
-- ============================================================================
