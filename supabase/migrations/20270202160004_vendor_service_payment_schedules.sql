-- ============================================================================
-- 20270202160004_vendor_service_payment_schedules.sql
--
-- Vendor Transaction Lifecycle · Phase 2 · PR-A — the PAYMENT SCHEDULE a vendor
-- defines at service-create (stage 0).
--
-- A schedule is a reusable TEMPLATE attached to one vendor_services row: a
-- downpayment (seq 0) plus payment 1…X (seq 1..N). Each installment carries
--   • an amount, expressed as EITHER a % of the total (percent_bps, basis
--     points: 5000 = 50%) OR a fixed PHP figure (amount_centavos), and
--   • an anchored due date: due_anchor ∈ {on_lock, before_event} offset by
--     due_offset_days. ("on_lock" = relative to when the booking locks;
--     "before_event" = days before the event date — resolved by the reader.)
--
-- Schedule is OPTIONAL — a service may carry zero rows. The vendor editor
-- persists rows as a replace-all set per service on save; couples read them for
-- display (the workspace render is PR-B). Additive: no behaviour change to any
-- existing flow.
--
-- WHAT THIS IS (and is NOT)
-- -------------------------
-- A schedule TEMPLATE describing HOW a couple would pay, defined up front. It is
-- DISTINCT from any actual payment record / lock / confirm — those land in
-- PR-B/C/D. This migration touches ONLY the new schedule table.
--
-- RLS mirrors vendor_service_links (20261014000000) exactly — the closest
-- analog (a child of vendor_services keyed by vendor_service_id with a
-- denormalized vendor_profile_id):
--   • owner + admin write: a vendor manages rows only under a service they own;
--     admins can manage any.
--   • public read gated on the parent service being active AND its vendor
--     published — the SAME visibility vendor_payment_methods' couple surface
--     uses (booked + published vendor). Not looser.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_service_payment_schedules — one row per installment
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_service_payment_schedules (
  schedule_item_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The service this installment belongs to.
  vendor_service_id UUID NOT NULL
                    REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  -- Denormalized owner — keeps the owner/public RLS a single-table subquery
  -- (no join through vendor_services), exactly like vendor_service_links.
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- 0 = downpayment, 1..X = payment N. Ordering / reorder key.
  seq               INT NOT NULL CHECK (seq >= 0),
  label             TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  -- 'percent' → percent_bps carries the share; 'fixed' → amount_centavos.
  amount_kind       TEXT NOT NULL CHECK (amount_kind IN ('percent','fixed')),
  percent_bps       INT CHECK (percent_bps IS NULL OR (percent_bps >= 0 AND percent_bps <= 10000)),
  amount_centavos   BIGINT CHECK (amount_centavos IS NULL OR amount_centavos >= 0),
  -- 'on_lock' = relative to booking lock · 'before_event' = days before the
  -- event date. NULL = no anchored due date (pay-anytime installment).
  due_anchor        TEXT CHECK (due_anchor IS NULL OR due_anchor IN ('on_lock','before_event')),
  due_offset_days   INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The chosen amount_kind must carry its own payload.
  CONSTRAINT vendor_service_payment_schedules_amount_chk CHECK (
    (amount_kind = 'percent' AND percent_bps IS NOT NULL)
    OR (amount_kind = 'fixed' AND amount_centavos IS NOT NULL)
  ),
  -- One installment per (service, seq) — the reorder key stays unique.
  UNIQUE (vendor_service_id, seq)
);

CREATE INDEX IF NOT EXISTS vendor_service_payment_schedules_service_idx
  ON public.vendor_service_payment_schedules (vendor_service_id, seq);

CREATE INDEX IF NOT EXISTS vendor_service_payment_schedules_vendor_idx
  ON public.vendor_service_payment_schedules (vendor_profile_id);

ALTER TABLE public.vendor_service_payment_schedules ENABLE ROW LEVEL SECURITY;

-- Public read — couples browsing a vendor's card / workspace (PR-B) see the
-- schedule. Gated exactly like vendor_service_links_public_read: the anchor
-- service must be active AND its vendor published.
DROP POLICY IF EXISTS vendor_service_payment_schedules_public_read
  ON public.vendor_service_payment_schedules;
CREATE POLICY vendor_service_payment_schedules_public_read
  ON public.vendor_service_payment_schedules FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
    AND vendor_service_id IN (
      SELECT vendor_service_id FROM public.vendor_services
      WHERE is_active = TRUE
    )
  );

-- Owner + admin write (mirrors vendor_service_links_owner_write). A vendor can
-- only create/edit/delete schedule rows under a service they own; admins manage
-- any.
DROP POLICY IF EXISTS vendor_service_payment_schedules_owner_write
  ON public.vendor_service_payment_schedules;
CREATE POLICY vendor_service_payment_schedules_owner_write
  ON public.vendor_service_payment_schedules FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

COMMIT;
