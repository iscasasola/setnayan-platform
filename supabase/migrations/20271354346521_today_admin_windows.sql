-- today_admin_windows
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ⚙ TODAY v3 PART 5 — THE FIVE NUMBERS, EACH AN ADMIN SETTING (owner 19 Nov 2026 on the drawing `Today, tap opens a
-- card` v3.5: *"Yes, all your picks"*; DECISION_LOG 2026-11-19 "TODAY v3 RULED AS A WHOLE" — "The five numbers · each an
-- admin setting"):
--   1 · "Few inquiries" (Grow, stage 3): fewer than 3 in 28 days            → grow_few_inquiries_28d   (20271350875090)
--   2 · "Few bookings" (Grow, stage 4): fewer than 1 in a month             → grow_few_bookings_month  (20271350875090)
--   3 · Shared photos count as accepted after 7 days of silence            → story_photo_silence_days (20271353451673)
--   4 · "Soon" for an inquiry or a booking ask: within 24 hours             → today_soon_ask_hours     (NEW, here)
--   5 · "Soon" for an event beyond tomorrow: within 7 days                  → today_soon_event_days    (NEW, here)
--
-- Same home and pattern as the grow lines: the one platform_settings row, edited on Admin › Settings, NULL = not set =
-- that rule is off. The owner RULED the five numbers, so each is filled with its ruled value ONLY WHERE IT IS STILL
-- BLANK — a number an admin already set is never overwritten, and every one stays editable (or blank-able) on Admin ›
-- Settings. No new table, so no new RLS.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS today_soon_ask_hours INTEGER,
  ADD COLUMN IF NOT EXISTS today_soon_event_days INTEGER;

ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_today_soon_ask_hours_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_today_soon_ask_hours_range
  CHECK (today_soon_ask_hours IS NULL OR (today_soon_ask_hours > 0 AND today_soon_ask_hours <= 720));
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_today_soon_event_days_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_today_soon_event_days_range
  CHECK (today_soon_event_days IS NULL OR (today_soon_event_days > 0 AND today_soon_event_days <= 60));

-- The ruled values, only where still blank.
UPDATE public.platform_settings
   SET grow_few_inquiries_28d   = COALESCE(grow_few_inquiries_28d, 3),
       grow_few_bookings_month  = COALESCE(grow_few_bookings_month, 1),
       story_photo_silence_days = COALESCE(story_photo_silence_days, 7),
       today_soon_ask_hours     = COALESCE(today_soon_ask_hours, 24),
       today_soon_event_days    = COALESCE(today_soon_event_days, 7)
 WHERE id = 1;

COMMENT ON COLUMN public.platform_settings.today_soon_ask_hours IS
  'Today v3 — a booking ask turns amber "Soon" when its window closes within this many hours. NULL = not set: no such row is coloured. Owner-ruled 24 (2026-11-19), editable on Admin › Settings.';
COMMENT ON COLUMN public.platform_settings.today_soon_event_days IS
  'Today v3 — "Soon" for a booked event beyond tomorrow, within this many days. NULL = not set. Owner-ruled 7 (2026-11-19), editable on Admin › Settings.';
