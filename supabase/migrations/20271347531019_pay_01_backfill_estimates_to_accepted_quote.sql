-- PAY-01 BACKFILL — a frozen 50/50 ESTIMATE becomes the accepted quote's own plan.
--
-- 🔴 What happened (live walk, 14 Nov 2026): a couple accepted a quote reading "First payment · 20% · on lock,
-- Final balance · 14 days before"; the booking froze a generic 50/50 ESTIMATED plan instead
-- (`freezePaymentPlanAtBooking` read only the service's schedule). PR #7743 fixed the freeze going forward; this
-- rewrites the plans already frozen wrong.
--
-- ⚖ OWNER RULING 2026-11-15, asked "backfill PAY-01?" and answered "Yes": rewrite payment plans frozen as the default
-- 50/50 (is_default_seeded = TRUE) on bookings that have an ACCEPTED quote, to that quote's own amounts. A plan a
-- supplier authored (is_default_seeded = FALSE) is NOT touched — whether a supplier's own schedule should lose to the
-- quote is still an OPEN owner question.
--
-- WHAT IT WRITES, mirroring `scheduleRowsFromAcceptedQuote` + `computePlanInstances` exactly:
--   · one instance per quote installment with a positive amount_centavos, in the quote's seq order, renumbered 0..n
--   · amount_php = the quote's FIXED centavos / 100 (the figure the couple read; never re-derived from a percent)
--   · amount_kind 'fixed', percent_bps NULL
--   · label = the quote's label, else 'First payment' (a downpayment) / 'Payment'
--   · due: on_lock → the lock day + offset; before_event → event_date − offset; on_event → event_date (offset 0);
--     no event date → NULL. The lock day is the day the estimate was frozen against: its own on-lock first
--     instalment's due date (the 50/50 seed dues seq 0 on the lock day), else on_lock_anchor_date, else updated_at.
--   · is_default_seeded → FALSE (the plan is no longer an estimate — the same value a re-freeze writes today)
-- NOTHING ELSE CHANGES: cleared_at / cleared_by / replot_history / on_lock_anchor_date are left as they are, and no
-- other table is written.
--
-- IDEMPOTENT: a rewritten row is no longer is_default_seeded, so a second run matches nothing.
-- 🛑 SAFETY STOP: measured 2026-11-14, 6 rows qualify (all test bookings). More than 20 RAISEs and changes nothing.

DO $$
DECLARE
  v_count INT;
BEGIN
  CREATE TEMP TABLE pay01_backfill ON COMMIT DROP AS
  WITH seeded AS (
    SELECT p.event_id,
           p.event_vendor_id,
           p.instances_json,
           e.event_date,
           COALESCE(
             CASE WHEN jsonb_typeof(p.instances_json) = 'array'
                  THEN NULLIF(p.instances_json -> 0 ->> 'due_date', '')::date END,
             p.on_lock_anchor_date::date,
             (p.updated_at AT TIME ZONE 'UTC')::date
           ) AS lock_day,
           (SELECT vp.payment_schedule
              FROM public.vendor_proposals vp
             WHERE vp.event_id = p.event_id
               AND vp.vendor_profile_id = ev.marketplace_vendor_id
               AND vp.status = 'accepted'
             ORDER BY vp.resolved_at DESC NULLS LAST
             LIMIT 1) AS sched
      FROM public.event_vendor_payment_plan p
      JOIN public.event_vendors ev ON ev.event_id = p.event_id AND ev.vendor_id = p.event_vendor_id
      JOIN public.events e ON e.event_id = p.event_id
     WHERE p.is_default_seeded
       AND ev.marketplace_vendor_id IS NOT NULL
  ),
  inst AS (
    SELECT s.event_id,
           s.event_vendor_id,
           i.value AS i,
           (i.value ->> 'amount_centavos')::numeric AS cents,
           row_number() OVER (
             PARTITION BY s.event_id, s.event_vendor_id
             ORDER BY COALESCE((i.value ->> 'seq')::numeric, 0), i.ordinality
           ) - 1 AS n,
           s.lock_day,
           s.event_date
      FROM seeded s
      CROSS JOIN LATERAL jsonb_array_elements(s.sched -> 'installments') WITH ORDINALITY AS i(value, ordinality)
     WHERE jsonb_typeof(s.sched -> 'installments') = 'array'
       AND jsonb_typeof(i.value -> 'amount_centavos') = 'number'
       AND (i.value ->> 'amount_centavos')::numeric > 0
  )
  SELECT event_id,
         event_vendor_id,
         jsonb_agg(
           jsonb_build_object(
             'seq', n,
             'label', COALESCE(NULLIF(btrim(i ->> 'label'), ''),
                               CASE WHEN (i ->> 'is_downpayment') = 'true' THEN 'First payment' ELSE 'Payment' END),
             'amount_php', trim_scale(round(cents) / 100),
             'due_date', CASE
                           WHEN i ->> 'due' = 'on_event' THEN event_date
                           WHEN i ->> 'due' = 'before_event' THEN
                             event_date - GREATEST(0, COALESCE((i ->> 'offset_days')::numeric, 0))::int
                           ELSE lock_day + GREATEST(0, COALESCE((i ->> 'offset_days')::numeric, 0))::int
                         END,
             'amount_kind', 'fixed',
             'percent_bps', NULL
           ) ORDER BY n
         ) AS new_instances
    FROM inst
   GROUP BY event_id, event_vendor_id;

  SELECT count(*) INTO v_count FROM pay01_backfill;
  IF v_count > 20 THEN
    RAISE EXCEPTION 'PAY-01 backfill: % plans would change (> 20 safety stop) — nothing was written', v_count;
  END IF;

  UPDATE public.event_vendor_payment_plan p
     SET instances_json = b.new_instances,
         is_default_seeded = FALSE,
         updated_at = now()
    FROM pay01_backfill b
   WHERE p.event_id = b.event_id
     AND p.event_vendor_id = b.event_vendor_id
     AND p.is_default_seeded;

  RAISE NOTICE 'PAY-01 backfill: % estimated plan(s) rewritten to their accepted quote', v_count;
END $$;
