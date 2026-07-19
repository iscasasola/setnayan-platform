-- payday_cashflow_read
-- ============================================================================
-- Payday Calendar & Cash-Flow View (Wave 4 vendor "Soon" benefits) — the
-- VENDOR-SIDE READ aggregate over installment due-dates across ALL their
-- booked events.
--
-- Off-platform money — READ / AGGREGATION ONLY. No money moves, no gateway,
-- no receipt, no tax math. This just visualizes the installment due-dates the
-- vendor ALREADY has, frozen at lock in event_vendor_payment_plan.instances_json.
--
-- The plan table (20270202160005) is HOST-scoped RLS (couple-only, via
-- current_event_ids()). A vendor cannot read it directly — so this migration
-- adds a SECURITY DEFINER read function that, mirroring confirm_vendor_payment
-- (20270202160006), resolves auth.uid() → the vendor they own and only ever
-- returns plans for bookings whose event_vendors.marketplace_vendor_id is a
-- vendor_profiles row OWNED by the caller. It does NOT loosen the host-only RLS
-- on event_vendor_payment_plan; it is the single, ownership-gated read path.
--
-- Returns one row per installment across all the caller's booked events:
--   { event_name, event_date, seq, label, amount_php, due_date, confirmed }
-- where `confirmed` = a matching event_vendor_payments row exists for that
-- booking + seq with vendor_confirmed_at IS NOT NULL (the received-vs-owed
-- signal from PR-C).
--
-- BARE migration (no BEGIN/COMMIT): CREATE OR REPLACE FUNCTION is self-contained
-- + idempotent + re-run safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vendor_payday_installments()
RETURNS TABLE (
  event_vendor_id UUID,
  event_id        UUID,
  event_name      TEXT,
  event_date      DATE,
  seq             INT,
  label           TEXT,
  amount_php      NUMERIC,
  due_date        DATE,
  confirmed       BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Ownership gate (mirrors confirm_vendor_payment step (a)->(b)): start from the
  -- bookings whose marketplace_vendor_id is a vendor_profiles row the CALLER
  -- owns. A vendor who owns no profile (or member-only) simply sees no rows --
  -- there is no cross-vendor leakage because the join is rooted on
  -- vendor_profiles.user_id = auth.uid().
  SELECT
    ev.vendor_id                                   AS event_vendor_id,
    pl.event_id                                    AS event_id,
    e.display_name                                 AS event_name,
    e.event_date                                   AS event_date,
    (inst->>'seq')::INT                            AS seq,
    (inst->>'label')                               AS label,
    CASE
      WHEN inst->>'amount_php' IS NULL THEN NULL
      ELSE (inst->>'amount_php')::NUMERIC
    END                                            AS amount_php,
    CASE
      WHEN inst->>'due_date' IS NULL THEN NULL
      ELSE (inst->>'due_date')::DATE
    END                                            AS due_date,
    EXISTS (
      SELECT 1
      FROM public.event_vendor_payments p
      WHERE p.vendor_id = ev.vendor_id
        AND p.schedule_instance_seq = (inst->>'seq')::INT
        AND p.vendor_confirmed_at IS NOT NULL
    )                                              AS confirmed
  FROM public.vendor_profiles vp
  JOIN public.event_vendors ev
    ON ev.marketplace_vendor_id = vp.vendor_profile_id
  JOIN public.event_vendor_payment_plan pl
    ON pl.event_vendor_id = ev.vendor_id
  JOIN public.events e
    ON e.event_id = pl.event_id
  CROSS JOIN LATERAL jsonb_array_elements(pl.instances_json) AS inst
  WHERE vp.user_id = auth.uid();
$$;

-- Lock it down to authenticated callers only (same posture as
-- confirm_vendor_payment / clear_vendor_payment_plan).
REVOKE ALL ON FUNCTION public.vendor_payday_installments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_payday_installments() FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_payday_installments() TO authenticated;

COMMENT ON FUNCTION public.vendor_payday_installments() IS
  'Payday Calendar & Cash-Flow View (Wave 4) -- READ-ONLY vendor-scoped aggregate of installment due-dates across ALL the caller''s booked events. SECURITY DEFINER: reads the host-RLS event_vendor_payment_plan via an ownership gate (vendor_profiles.user_id = auth.uid() -> event_vendors.marketplace_vendor_id), mirroring confirm_vendor_payment. Returns one row per instances_json installment {event_name, event_date, seq, label, amount_php, due_date, confirmed (= a vendor_confirmed_at-stamped event_vendor_payments row for that booking+seq)}. No money movement; does NOT loosen the plan''s host-only RLS.';
