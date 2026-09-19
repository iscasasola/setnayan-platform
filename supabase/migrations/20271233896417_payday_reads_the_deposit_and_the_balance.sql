-- ─────────────────────────────────────────────────────────────────────────────
-- PAYDAY READS THE DEPOSIT AND THE BALANCE — AREA-VENDOR, 2026-09-19.
--
-- 🔴 WHAT THE OWNER SAW (2026-09-18, as the supplier Saysay): the Today page's
-- "Confirmed cash-flow" tile said "No booked installments yet." for a shop that
-- had just CONFIRMED a ₱2,000 deposit on a contracted ₱10,170 booking.
--
-- 🔑 CAUSE, measured in production: `vendor_payday_installments()` read ONE
-- source — `event_vendor_payment_plan.instances_json`, which is only written at
-- lock when the booked service carries a payment schedule. Production held
-- ZERO plan rows and 4 ledger rows in `event_vendor_payments` (one a
-- supplier-confirmed deposit) on 2026-09-19. So every money read built on this
-- function — the Today cash-flow tile, My Customers' "Ongoing payments", and
-- /payday — was empty for every supplier, and empty rendered as "none yet".
--
-- ✅ WHAT CHANGES: the plan arm is UNCHANGED. A booking with NO installments
-- (no plan row, or the `[]` direct-pay snapshot) now gets a
-- second arm built from what actually exists:
--   • one row per payment the couple logged (deposit or otherwise), confirmed
--     when the supplier confirmed it (or a dispute ruled it stands); a refused
--     payment, or a deposit the supplier declined and never acknowledged, is
--     not money received and is left out;
--   • one "Balance" row = the agreed total (`total_cost_php`) minus what was
--     logged, when that is positive. Its due date is NULL — nobody agreed one,
--     so none is invented ("don't guess": it lands under "No due date yet").
-- A logged-but-unconfirmed payment also carries a NULL due date: it has been
-- PAID, so the timeline must never flag it "overdue".
--
-- Same ownership gate (vendor_profiles.user_id = auth.uid()), same return
-- shape, so every caller reads it unchanged. Only BOOKED rows (contracted
-- onward, not archived, not voided) enter the ledger arm — a "considering"
-- card is not a booking.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vendor_payday_installments()
 RETURNS TABLE(event_vendor_id uuid, event_id uuid, event_name text, event_date date, seq integer, label text, amount_php numeric, due_date date, confirmed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- ARM 1 — the frozen installment plan (unchanged).
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
  WHERE vp.user_id = auth.uid()

  UNION ALL

  -- ARM 2 — a booking with no plan: the money actually logged, then the balance.
  SELECT
    b.vendor_id, b.event_id, b.display_name, b.event_date,
    r.seq, r.label, r.amount_php, r.due_date, r.confirmed
  FROM (
    SELECT ev.vendor_id, ev.event_id, ev.total_cost_php,
           ev.deposit_declined_at, ev.deposit_acknowledged_at,
           e.display_name, e.event_date
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev
      ON ev.marketplace_vendor_id = vp.vendor_profile_id
    JOIN public.events e
      ON e.event_id = ev.event_id
    WHERE vp.user_id = auth.uid()
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND ev.archived_at IS NULL
      AND ev.voided_by_fraud IS NOT TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.event_vendor_payment_plan pl
         WHERE pl.event_vendor_id = ev.vendor_id
           -- A plan of `[]` is the documented "no schedule / direct-pay"
           -- snapshot: it yields no Arm-1 rows, so it must not hide Arm 2.
           AND jsonb_array_length(pl.instances_json) > 0
      )
  ) b
  CROSS JOIN LATERAL (
    WITH counted AS (
      SELECT p.payment_id, p.amount_php, p.paid_at, p.created_at, p.is_deposit_record,
             (p.vendor_confirmed_at IS NOT NULL
               OR p.payment_dispute_outcome IS NOT DISTINCT FROM 'payment_stands') AS is_confirmed
        FROM public.event_vendor_payments p
       WHERE p.vendor_id = b.vendor_id
         AND (p.payment_refused_at IS NULL OR p.payment_dispute_outcome = 'payment_stands')
         AND NOT (p.is_deposit_record
                  AND b.deposit_declined_at IS NOT NULL
                  AND b.deposit_acknowledged_at IS NULL)
    )
    SELECT (1000 + row_number() OVER (ORDER BY c.paid_at, c.created_at, c.payment_id))::INT AS seq,
           CASE WHEN c.is_deposit_record THEN 'Deposit' ELSE 'Payment' END
             || CASE WHEN c.is_confirmed THEN '' ELSE ' · awaiting your confirmation' END AS label,
           c.amount_php::NUMERIC AS amount_php,
           CASE WHEN c.is_confirmed THEN c.paid_at::DATE ELSE NULL END AS due_date,
           c.is_confirmed AS confirmed
      FROM counted c
    UNION ALL
    SELECT 9999, 'Balance',
           (b.total_cost_php - COALESCE((SELECT sum(amount_php) FROM counted), 0))::NUMERIC,
           NULL::DATE, false
     WHERE b.total_cost_php IS NOT NULL
       AND b.total_cost_php - COALESCE((SELECT sum(amount_php) FROM counted), 0) > 0
  ) r;
$function$;

REVOKE ALL ON FUNCTION public.vendor_payday_installments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_payday_installments() FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_payday_installments() TO authenticated;

COMMENT ON FUNCTION public.vendor_payday_installments() IS
  'Payday Calendar & Cash-Flow View -- READ-ONLY vendor-scoped money timeline across the caller''s booked events. SECURITY DEFINER, ownership-gated (vendor_profiles.user_id = auth.uid() -> event_vendors.marketplace_vendor_id). Arm 1: one row per frozen event_vendor_payment_plan installment. Arm 2 (20271233896417): a booked row with NO installments (no plan, or an empty [] plan) returns each logged event_vendor_payments row (Deposit/Payment; confirmed when vendor-confirmed or ruled payment_stands; refused and declined-deposit rows excluded; unconfirmed rows carry no due date) plus a Balance row (total_cost_php minus logged, due date NULL) when positive. No money movement.';
