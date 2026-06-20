-- ============================================================================
-- Wedding page private by default · public only on Save-the-Date launch
-- (owner ruling 2026-06-20: "the slug of the wedding must be private until the
--  couple launches their save-the-date video")
-- ============================================================================
--
-- The access primitive already exists: events.landing_page_visibility (TEXT,
-- CHECK in 'public'|'unlisted'|'private', added by 20260605050000). The
-- /[slug] page already shows strangers a lock screen when it's 'private' while
-- still letting signed-in hosts (preview) and cookie-bearing invited guests in.
-- The page was public only because (a) the column defaulted to 'public' and
-- (b) the Save-the-Date "launch" never flipped it. This migration fixes (a) and
-- adds the launch timestamp; the launch ACTION (app code) flips the value.
--
-- THREE changes:
--   1. Default flips to 'private' → every NEW wedding page starts private.
--   2. std_launched_at TIMESTAMPTZ — stamped when the couple launches their
--      Save-the-Date (distinguishes a deliberate launch from a manual public
--      toggle; future hook for the save_the_date_sent email + analytics).
--   3. Backfill (owner ruling): retroactively privatize EXISTING pre-launch
--      pages so the new posture is uniform — EXCEPT the public sample/showcase
--      event (is_sample), which must stay reachable. "Pre-launch" = a 'public'
--      row that hasn't been launched. Couples re-publish by launching their STD
--      (or via the manual privacy toggle). Safe now: pre-public-vendor-launch,
--      the data is overwhelmingly test/sample. 'unlisted' rows are left as-is.
--      The `std_launched_at IS NULL` guard keeps a re-run from un-launching a
--      couple who has since gone public (idempotency safety).
--
-- Apply with `supabase db push --db-url "$SUPABASE_DB_URL"` (no auto-apply).
-- ============================================================================

BEGIN;

-- 1. New events start private.
ALTER TABLE public.events
  ALTER COLUMN landing_page_visibility SET DEFAULT 'private';

-- 2. Deliberate-launch timestamp (NULL until the couple launches their STD).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_launched_at TIMESTAMPTZ;

-- 3. Backfill: privatize existing public, not-yet-launched pages; keep the
--    sample public. is_sample was added by 20270203791173.
UPDATE public.events
   SET landing_page_visibility = 'private'
 WHERE landing_page_visibility = 'public'
   AND COALESCE(is_sample, FALSE) = FALSE
   AND std_launched_at IS NULL;

COMMIT;
