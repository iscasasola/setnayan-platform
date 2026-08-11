-- ============================================================================
-- A RETIRED ADDRESS FORWARDS FOR TWO YEARS, NOT NINETY DAYS.
--
-- The couple's address field and the person's handle field both promise that
-- changing the word keeps the old link working. The window backing that promise
-- was 90 days — shorter than the thing it exists to protect.
--
-- SAVE-THE-DATES GO OUT 6–12 MONTHS AHEAD. The printed QR on one is exactly the
-- link this window covers. A wedding that posted invitations in January and
-- corrected its address in March went dark long before the guests travelled —
-- and the couple was told, on the screen where they made the change, that it
-- would not.
--
-- Two years covers a save-the-date sent a year out, the celebration, and a year
-- of afterwards (people keep opening the link for the photos; the compressed
-- gallery is kept far longer than that). A held word costs nothing but the
-- word, and production holds SEVEN names across every wedding, shop and person
-- combined.
--
-- ⚠ THE NUMBER LIVES IN `lib/slug-forwarding.ts` AS `SLUG_FORWARDING_MONTHS`,
-- and `tests/db/slug-forwarding-window.db.test.ts` reads THIS DEFAULT out of
-- the catalog and compares the two. A guard comparing two hand-typed things is
-- not a guard; this one compares code against the database.
--
-- 🔒 THE CLOSED-SHOP HOLD IS UNTOUCHED, AND THAT IS LOAD-BEARING. A closed
-- shop's address is held for ONE YEAR (owner-locked 2026-08-10) in this same
-- table and this same column — but `lib/erasure/purge.ts` writes those rows
-- with an EXPLICIT `redirect_until` (`closedShopSlugHeldUntil()`), so it never
-- reads this default. Verified against prod before writing this migration. The
-- backfill below excludes `vendor_closed` for the same reason: extending an
-- owner-locked hold as a side effect of a different decision is precisely the
-- kind of silent change this repo keeps paying for.
-- ============================================================================

BEGIN;

ALTER TABLE public.slug_change_log
  ALTER COLUMN redirect_until SET DEFAULT (now() + '24 months'::interval);

-- Honour the longer window for renames ALREADY MADE. Someone who renamed last
-- month was promised forwarding; they were not promised the shortest window we
-- happened to have configured that day. Anchored to `changed_at` (not `now()`)
-- so the window means the same thing for every row: two years from the rename.
--
-- Only ever EXTENDS (the `<` predicate) — a row already set further out, by
-- hand or by a future rule, is left alone. Re-running is a no-op, so the
-- migration stays idempotent.
UPDATE public.slug_change_log
   SET redirect_until = changed_at + '24 months'::interval
 WHERE entity_type <> 'vendor_closed'
   AND redirect_until < changed_at + '24 months'::interval;

COMMENT ON COLUMN public.slug_change_log.redirect_until IS
  'When this retired address stops forwarding. DEFAULT 24 months (mirrors '
  'SLUG_FORWARDING_MONTHS in lib/slug-forwarding.ts; slug-forwarding-window.db.test.ts '
  'compares the two). Closed-shop holds (entity_type = ''vendor_closed'') set this '
  'EXPLICITLY to one year and do NOT read the default — owner-locked 2026-08-10.';

COMMIT;
