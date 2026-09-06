-- Promo free windows · EVENT-DATE-RANGE filter for couple windows (owner ask
-- 2026-09-05, G5): "give for events — (a) for an event dated on a specific
-- date, (c) for any event." (b) — a NAMED event — already shipped via
-- comp_grants.event_id (PR #5193); this migration is (a) and (c) only.
--
-- 🔑 DESIGN CHOICE: two nullable DATE columns on the EXISTING all_couples
-- audience, NOT a new audience_type value. (c) "any event" must keep working
-- exactly as it does today (no date filter). (a) "an event dated on/in a
-- range" is the SAME audience (all couples) with an added filter — not a
-- disjoint cohort. A new audience value would force every all_couples window,
-- present and future, into one bucket or the other; nullable columns let
-- all_couples optionally carry a date filter, which is the natural fit.
--
--   event_date_from / event_date_to (DATE, both nullable):
--     • both NULL           → applies to any event (today's behavior, unchanged).
--     • either/both set     → only an event whose events.event_date falls
--                              within the set bound(s) (inclusive) qualifies.
--                              An event with event_date IS NULL (not yet
--                              locked) never qualifies for a date-filtered
--                              window — unknown means excluded, never assumed
--                              included.
--     • meaningful ONLY for audience_type='all_couples' — a CHECK below keeps
--       them NULL for every vendor / segment audience (there is no "event" on
--       a vendor cohort).
--
-- Resolved statelessly at gate time in lib/promo-free-windows.ts
-- (coupleWindowCoversEvent), mirroring the vendor cohort resolution pattern
-- (vendorQualifiedAt) already in that file — no per-event row, no job, no
-- trigger. Everything stays behind env PROMO_FREE_WINDOWS_ENABLED (default
-- OFF); readers short-circuit before any DB read while it is off.

BEGIN;

ALTER TABLE public.promo_free_windows
  ADD COLUMN IF NOT EXISTS event_date_from DATE,
  ADD COLUMN IF NOT EXISTS event_date_to DATE;

ALTER TABLE public.promo_free_windows
  DROP CONSTRAINT IF EXISTS promo_free_windows_event_date_order;
ALTER TABLE public.promo_free_windows
  ADD CONSTRAINT promo_free_windows_event_date_order
  CHECK (
    event_date_from IS NULL OR event_date_to IS NULL
    OR event_date_to >= event_date_from
  );

ALTER TABLE public.promo_free_windows
  DROP CONSTRAINT IF EXISTS promo_free_windows_event_date_couples_only;
ALTER TABLE public.promo_free_windows
  ADD CONSTRAINT promo_free_windows_event_date_couples_only
  CHECK (
    audience_type = 'all_couples'
    OR (event_date_from IS NULL AND event_date_to IS NULL)
  );

COMMENT ON COLUMN public.promo_free_windows.event_date_from IS
  'Inclusive lower bound on events.event_date for this window to cover an event. NULL = no lower bound. Meaningful ONLY for audience_type=''all_couples''; a vendor/segment audience must keep this NULL (no "event" concept on a vendor cohort). An event with event_date IS NULL (not yet locked) never qualifies for a date-filtered window — unknown means excluded, never assumed included. See coupleWindowCoversEvent in lib/promo-free-windows.ts.';

COMMENT ON COLUMN public.promo_free_windows.event_date_to IS
  'Inclusive upper bound on events.event_date for this window to cover an event. NULL = no upper bound. Both NULL = applies to any event (the pre-existing, unfiltered "for any event" behavior). Meaningful ONLY for audience_type=''all_couples''. See coupleWindowCoversEvent in lib/promo-free-windows.ts.';

COMMIT;
