-- ============================================================================
-- 20261212000000_pax_change_audit.sql
--
-- ADAPTIVE PAX PRICING — Phase 6 (HQ audit of pax-driven cost changes).
--
-- Phase 5 lets a vendor Accept/Decline a surcharge when the couple's live pax
-- moves a booked cost. Because that can move real pesos on a live booking, the
-- architect mandate (HQ visibility) wants an append-only trail so a mediator
-- can answer "why did this vendor cost jump?" during a dispute (DECISION_LOG
-- 2026-06-13 admin_surface). This table is that trail; every accept/decline
-- writes one row from the vendor confirm action.
--
-- HQ-read only: it backs the /admin/pax-changes surface + dispute mediation. No
-- couple/vendor read — the parties already see the live state on their own
-- surfaces. Writes come from the service-role admin client inside the confirm
-- actions (which bypass RLS), so there is intentionally NO insert policy. No
-- foreign keys: an audit row must survive even if the booking/event is later
-- removed (history preservation > referential cascade). Internal bigserial PK
-- (no public S89 id — this is an internal log, never user-addressed).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pax_change_audit (
  audit_id            BIGSERIAL PRIMARY KEY,
  event_id            UUID NOT NULL,
  -- event_vendors.vendor_id (the booking row the cost lives on).
  event_vendor_id     UUID NOT NULL,
  -- The vendor who made the decision (event_vendors.marketplace_vendor_id).
  vendor_profile_id   UUID,
  action              TEXT NOT NULL CHECK (action IN ('accept', 'decline')),
  -- Live pax at the decision, the surcharge floor it was measured from, and
  -- the count last decided on before this row.
  live_pax            INTEGER,
  quote_base_pax      INTEGER,
  prev_pax            INTEGER,
  -- The vendor's per-guest rate at decision time + before/after surcharge and
  -- booking total. On 'decline' the totals match (price held).
  rate_php            INTEGER,
  prev_surcharge_php  INTEGER,
  new_surcharge_php   INTEGER,
  prev_total_php      NUMERIC(12, 2),
  new_total_php       NUMERIC(12, 2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pax_change_audit IS
  'Append-only HQ trail of pax-driven vendor cost changes (Adaptive Pax Pricing Phase 6). One row per Accept/Decline of a surcharge. Admin-read only; written by the service-role confirm actions. No FKs (history outlives bookings).';

ALTER TABLE public.pax_change_audit ENABLE ROW LEVEL SECURITY;

-- HQ-only read (disputes / the /admin/pax-changes surface). The canonical
-- admin gate. Writes bypass RLS via the service-role admin client → no INSERT
-- policy by design.
CREATE POLICY pax_change_audit_admin_read
  ON public.pax_change_audit
  FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS pax_change_audit_event_idx
  ON public.pax_change_audit (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pax_change_audit_vendor_idx
  ON public.pax_change_audit (vendor_profile_id, created_at DESC);

COMMIT;
