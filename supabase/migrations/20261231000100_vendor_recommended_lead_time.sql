-- Setnayan AI §4 — last-minute START becomes VENDOR-OWNED, per service.
--
-- Owner refinement 2026-06-16 (revises the locked platform-START model in
-- What_Is_Setnayan_AI_2026-06-08.md §4): the month when "last-minute" begins
-- for a service is no longer a platform per-leaf value (planning_deadlines
-- kind='last_minute_start'). It is now the VENDOR's per-service RECOMMENDED
-- LEAD TIME — the normal/comfortable lead for regular effort ("book by here,
-- no rush"). That recommended lead time is the START of the vendor's own
-- last-minute range, which runs down to the existing per-service hard cutoff
-- (vendor_services.last_minute_end_months).
--
-- The three vendor-declared points per service:
--   1. RECOMMENDED LEAD TIME  — recommended_lead_time_months (THIS column, NEW).
--      The last-minute START. NULL → no lead requirement → no last-minute range
--      → the service is always bookable whenever the schedule permits.
--   2. LAST-MINUTE RANGE      — [recommended_lead_time_months → last_minute_end_months].
--      Still doable, a rush. Keeps the existing AI-only visibility + optional
--      0–100% surcharge (last_minute_surcharge_pct) layered on this range.
--   3. HARD CUTOFF (latest accept) — last_minute_end_months (existing). Past it
--      = not enough prep time = not bookable.
--
-- Additive + nullable + idempotent: one new nullable NUMERIC column with a
-- non-negative CHECK. NULL is the default for every existing row → no service
-- has a recommended lead time today → the last-minute mechanic stays inert
-- (every zone resolves to 'normal'), so production behavior is unchanged until
-- a vendor fills in a recommended lead time. Fractional allowed (0.5 ≈ 2 weeks).
--
-- The platform planning_deadlines kind='last_minute_start' data is NOT removed:
-- it is retired only as the DRIVER of the last-minute START, and may serve as a
-- soft fallback for a service whose recommended_lead_time_months is NULL. With
-- both NULL (today's state) the default behavior is identical to today.

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS recommended_lead_time_months NUMERIC;

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_recommended_lead_time_months_check;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_recommended_lead_time_months_check
  CHECK (recommended_lead_time_months IS NULL OR recommended_lead_time_months >= 0);

COMMENT ON COLUMN public.vendor_services.recommended_lead_time_months IS
  'Vendor''s recommended lead time (months, fractional): the normal/comfortable lead for regular effort. This is the START of the vendor''s last-minute range, running down to last_minute_end_months. NULL → no recommended lead time → no last-minute range → always bookable whenever the schedule permits. Replaces planning_deadlines kind=''last_minute_start'' as the last-minute-START driver (Setnayan AI §4, vendor-owned refinement 2026-06-16).';
