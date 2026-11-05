-- a_trade_starts_on_its_usual_chapters
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- 📖 A TRADE STARTS ON ITS USUAL CHAPTERS (owner 2026-11-03/04; approved prototype "Event chapters — 4 Nov 2026",
-- frame 5: *"the moment a supplier is booked, one sheet asks 'Which chapters will they serve?', prefilled from the
-- trade's default parts (Admin › Categories: caterer = Cocktail + Reception). The host confirms."*).
--
-- ONE FACT, ON THE CATEGORY, edited by an admin with no deploy — the `one_per_event` pattern (20271296971721):
--   · `service_categories.default_chapters` — the default chapters (`prep` · `ceremony` · `cocktail_reception` ·
--     `after_party`, the keys of `DEFAULT_CHAPTER_LABELS`, apps/web/lib/schedule.ts) a booking of this category is
--     PREFILLED with. Empty = no suggestion.
--   · A booking (`event_vendors.category`, coarse) belongs to the tier-2 category FILED under that coarse value
--     (`service_categories.coarse_category`) — the same join the one-per-event switch makes. Read by
--     apps/web/lib/trade-chapters.ts.
--   · It is only a PREFILL. The host confirms; the chapters a supplier is on stay `responsible_vendor_ids`, written
--     only by `set_supplier_where`. Nothing here writes a booking or a chapter.
--
-- THE BACKFILL — only on the run that ADDS the column, so an admin's later choice is never overwritten. A prefill the
-- host sees and confirms, never a price; the owner's own example is catering = Cocktail + Reception. Every other row is
-- a starting point for Admin › Categories, surfaced on the PR.
--
-- RLS: unchanged — a new column on `service_categories` carries its policies (public read, admin write).
-- Held by apps/web/tests/db/a-trade-starts-on-its-usual-chapters.db.test.ts.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'default_chapters'
  ) THEN
    ALTER TABLE public.service_categories ADD COLUMN default_chapters TEXT[] NOT NULL DEFAULT '{}';

    UPDATE public.service_categories c
       SET default_chapters = v.chapters
      FROM (VALUES
        ('catering',          ARRAY['cocktail_reception']),
        ('stations',          ARRAY['cocktail_reception']),
        ('food_truck',        ARRAY['cocktail_reception']),
        ('food_cart',         ARRAY['cocktail_reception']),
        ('mobile_bar',        ARRAY['cocktail_reception']),
        ('coffee_espresso',   ARRAY['cocktail_reception']),
        ('mocktail',          ARRAY['cocktail_reception']),
        ('cake',              ARRAY['cocktail_reception']),
        ('dessert',           ARRAY['cocktail_reception']),
        ('reception',         ARRAY['cocktail_reception']),
        ('ceremony_venue',    ARRAY['ceremony']),
        ('choir',             ARRAY['ceremony']),
        ('orchestra',         ARRAY['ceremony']),
        ('hmua',              ARRAY['prep']),
        ('grooming',          ARRAY['prep']),
        ('brides_attire',     ARRAY['prep']),
        ('grooms_attire',     ARRAY['prep']),
        ('bridal_car',        ARRAY['prep', 'ceremony']),
        ('florist',           ARRAY['ceremony', 'cocktail_reception']),
        ('stylist_decorator', ARRAY['ceremony', 'cocktail_reception']),
        ('photo_video',       ARRAY['prep', 'ceremony', 'cocktail_reception', 'after_party']),
        ('editorial',         ARRAY['prep', 'ceremony', 'cocktail_reception', 'after_party']),
        ('live_band',         ARRAY['cocktail_reception']),
        ('dj',                ARRAY['cocktail_reception', 'after_party']),
        ('wedding_singer',    ARRAY['ceremony', 'cocktail_reception']),
        ('performers',        ARRAY['cocktail_reception']),
        ('lights_sound',      ARRAY['cocktail_reception']),
        ('led_wall',          ARRAY['cocktail_reception']),
        ('host_mc',           ARRAY['cocktail_reception']),
        ('photo_booth',       ARRAY['cocktail_reception'])
      ) AS v(id, chapters)
     WHERE c.id = v.id;
  END IF;
END $$;

ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_default_chapters_check;
ALTER TABLE public.service_categories
  ADD CONSTRAINT service_categories_default_chapters_check
  CHECK (default_chapters <@ ARRAY['prep', 'ceremony', 'cocktail_reception', 'after_party']::text[]);

COMMENT ON COLUMN public.service_categories.default_chapters IS
  'The default chapters a booking of this category is PREFILLED with when the host is asked "Which chapters will they '
  'serve?" (keys of DEFAULT_CHAPTER_LABELS: prep, ceremony, cocktail_reception, after_party). Edited on Admin › '
  'Categories. Only a suggestion — the host confirms; set_supplier_where writes. 2026-11-04.';

COMMIT;
