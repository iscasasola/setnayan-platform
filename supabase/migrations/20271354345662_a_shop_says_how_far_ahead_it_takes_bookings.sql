-- ============================================================================
-- HOW FAR AWAY A SHOP TAKES BOOKINGS — "At least" and "At most" (owner 2026-11-19, DECISION_LOG
-- "HOW FAR AWAY A SHOP TAKES BOOKINGS: AT LEAST AND AT MOST, EMPTY AT MOST = 3 YEARS"; approved drawing
-- `prototypes/schedule_questions_placement_2026-11-19.html` §5, "OK all").
--
-- Owner, verbatim: "how far away min max: from 7 days - 2 years." · "at least and at most" ·
-- "if at most is not set. you can book up to 3 years from now".
--
-- One shop setting, every card, in Clients ⚙ › Teams and days:
--   1. vendor_profiles.booking_min_days   — At least: days of notice before the event. NULL = the same day is
--                                            allowed (gap D). The drawing's picks are 0 · 3 · 7 · 14 · 30.
--   2. vendor_profiles.booking_max_months — At most: how far ahead, in months. NULL = 3 years (36 months), which
--                                            replaces the fixed `CHECK_DATE_MONTHS_AHEAD = 37` in lib/check-a-date.ts.
--                                            The drawing's picks are 6 · 12 · 24 · 36.
--
-- The rule is read in TypeScript (`lib/booking-window.ts`), by the couple's date checks — Check a date
-- (`lib/check-a-date.server.ts`), Find (`lib/bench-bookable-days.server.ts`) — and by the ask (`finalizeVendor`),
-- where a card's own "Order at least N days before" can only make its card STRICTER than the shop's At least.
-- `service_cards_unbookable_on` is deliberately NOT redefined: it mirrors the lock's calendar refusals, held line by
-- line by `lib/h6-mirrors-the-booking-path.test.ts`; the window is a statement about dates, not about the calendar.
--
-- Written by the shop's own session (vendor_profiles_owner, FOR ALL on its own row — the same door the waiting-list
-- settings use). Read by the shop's team and couples through `authenticated`; never by anon (the table-level grant
-- would hand a new column to anon, so the readers are named — the paused_at pattern, 20271350091032).
-- Idempotent.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS booking_min_days INT;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS booking_max_months INT;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_booking_min_days_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_booking_min_days_check
  CHECK (booking_min_days IS NULL OR booking_min_days BETWEEN 0 AND 30);

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_booking_max_months_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_booking_max_months_check
  CHECK (booking_max_months IS NULL OR booking_max_months BETWEEN 1 AND 36);

COMMENT ON COLUMN public.vendor_profiles.booking_min_days IS
  'At least: how many days before the event a couple must book this shop, for every card (owner 2026-11-19, '
  'Clients ⚙ › Teams and days). NULL or 0 = the same day is allowed. A card''s own order_lead_days can only be '
  'stricter. Read by lib/booking-window.ts.';
COMMENT ON COLUMN public.vendor_profiles.booking_max_months IS
  'At most: how many months ahead a couple can book this shop, for every card (owner 2026-11-19, Clients ⚙ › Teams '
  'and days). NULL = 3 years (36 months). Read by lib/booking-window.ts.';

GRANT SELECT (booking_min_days) ON public.vendor_profiles TO authenticated;
GRANT SELECT (booking_max_months) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (booking_min_days) ON public.vendor_profiles FROM anon;
REVOKE SELECT (booking_max_months) ON public.vendor_profiles FROM anon;
