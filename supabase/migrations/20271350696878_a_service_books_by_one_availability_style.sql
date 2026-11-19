-- a_service_books_by_one_availability_style
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- EVERY SERVICE BOOKS BY ONE OF SEVEN AVAILABILITY STYLES, SET ONCE ON ADMIN › CATEGORIES (Availability plan,
-- step 2; owner go 2026-11-18 "okay step 2"). The seven values and their names were ruled by the owner on
-- 2026-11-17 ("Yes, keep them"); the code's one source is apps/web/lib/availability-styles.ts, and
-- apps/web/lib/availability-styles.test.ts fails if the CHECK below and that list ever disagree.
--
--   day   AV-DAY    One booking a day
--   order AV-ORDER  Made to order
--   hour  AV-HOUR   By the hour
--   piece AV-PIECE  Rented by the piece
--   time  AV-TIME   Set times with seats
--   night AV-NIGHT  Rooms by the night
--   none  AV-NONE   Always available
--
-- NULL = NOT SET. It is never read as `day`. NOTHING IS SEEDED: the per-category list in the corpus
-- (AVAILABILITY_BY_CATEGORY_2026-11-17.md) is an unreviewed proposal, so every service starts Not set and the
-- admin page counts them.
--
-- WHY canonical_service_taxonomy AND NOT canonical_service_schemas. Both hold one row per service (PK
-- `canonical_service`). The taxonomy row carries how a service BEHAVES in the marketplace — `is_rental`,
-- `is_ph`, `phase`, `applicable_event_types` — and it is the row `getTaxonomy()` (lib/taxonomy-db.ts) already
-- reads, so the setting reaches every later reader (the card maker, the Clients calendar) through the one
-- taxonomy read. The schema row is the service's WORDS and its supplier form (names, ⓘ, fields). How a service
-- books is behaviour, not words.
--
-- RLS / GRANTS: unchanged. `canonical_service_taxonomy` keeps `canonical_service_taxonomy_read_all` (public read
-- — the card maker will read it for suppliers) and `canonical_service_taxonomy_admin_write` (admin-only write).
-- The new column inherits the table-level grants like its siblings; no non-admin can write any row of this
-- table, and the value reveals nothing a reader of the row could not already see. Recorded in the exposure
-- baseline in the same PR.

ALTER TABLE public.canonical_service_taxonomy
  ADD COLUMN IF NOT EXISTS availability_style TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'canonical_service_taxonomy_availability_style_check'
       AND conrelid = 'public.canonical_service_taxonomy'::regclass
  ) THEN
    ALTER TABLE public.canonical_service_taxonomy
      ADD CONSTRAINT canonical_service_taxonomy_availability_style_check
      CHECK (availability_style IS NULL OR availability_style IN ('day', 'order', 'hour', 'piece', 'time', 'night', 'none'));
  END IF;
END $$;

COMMENT ON COLUMN public.canonical_service_taxonomy.availability_style IS
  'How this service books — one of seven styles (owner 2026-11-17): day · order · hour · piece · time · night · none. NULL = Not set, never read as day. Set on Admin › Categories › a service › Availability. Code source: apps/web/lib/availability-styles.ts.';
