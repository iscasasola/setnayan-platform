-- grow_lines_on_today_are_the_owners
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🌱 TODAY v2 — THE GROW PLAN'S TWO LINES ARE THE OWNER'S NUMBERS (owner 18 Nov 2026, `Today, one task` v2, pick 1:
-- "The two 'few inquiries / few bookings' cut-offs are NOT guessed"). A supplier's Today shows stage 3 "Get inquiries"
-- when its inquiries in the last 28 days are below `grow_few_inquiries_28d`, and stage 4 "Win bookings" when its
-- bookings this month are below `grow_few_bookings_month`.
--
-- NULL = not set = that stage is OFF (its moves stay hidden until the owner sets the number). Never a default in
-- code (CLAUDE.md rule 9). Same home and pattern as `drive_speed_kmh` (20271308471868): the one platform_settings
-- row, edited on Admin › Settings, saved by the existing settings action. No new table, so no new RLS; the row's
-- existing policies and grants cover the two columns, and the Today page reads them with the service role.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS grow_few_inquiries_28d INTEGER,
  ADD COLUMN IF NOT EXISTS grow_few_bookings_month INTEGER;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_grow_few_inquiries_28d_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_grow_few_inquiries_28d_range
  CHECK (grow_few_inquiries_28d IS NULL OR (grow_few_inquiries_28d > 0 AND grow_few_inquiries_28d <= 10000));

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_grow_few_bookings_month_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_grow_few_bookings_month_range
  CHECK (grow_few_bookings_month IS NULL OR (grow_few_bookings_month > 0 AND grow_few_bookings_month <= 10000));

COMMENT ON COLUMN public.platform_settings.grow_few_inquiries_28d IS
  'Today v2 grow plan, stage 3 "Get inquiries": a shop with fewer inquiries than this in the last 28 days is shown Share your page / Print your QR. NULL = not set: the stage is off. Owner-set on Admin › Settings (2026-11-18).';
COMMENT ON COLUMN public.platform_settings.grow_few_bookings_month IS
  'Today v2 grow plan, stage 4 "Win bookings": a shop with fewer bookings than this dated this Manila month is shown Reply within 1 hour / Send your quote / Where couples pay you. NULL = not set: the stage is off. Owner-set on Admin › Settings (2026-11-18).';
