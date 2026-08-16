-- ============================================================================
-- A fourth audience for a celebration: the people you invited who have accounts
-- ============================================================================
-- Owner, 2026-08-15: "it is the owner's choice if they want this in public or
-- link only or tagged accounts only (no tagged account means it is private for
-- them)." Asked directly who counts as tagged, the owner chose: ANYONE ON THE
-- GUEST LIST WHO HAS AN ACCOUNT.
--
-- `landing_page_visibility` has been public | unlisted | private. This adds
-- 'invited_accounts' and nothing else.
--
-- ⚠ WHY NOT THE WORD "tagged". `events.live_photo_wall_visibility` ALREADY has a
-- value literally called 'tagged_only', meaning something different (which
-- guests' faces appear on the venue wall) — and its own 2026-08-12 decision row
-- records that the name promised a filter that existed nowhere. Two columns on
-- ONE table carrying the same word for two different rules is how the next
-- reader gets it wrong. The value says what it actually does.
--
-- 🔴 THE DANGEROUS PART OF THIS CHANGE IS NOT THIS FILE. `canViewSlugEvent()`
-- opened with `if (visibility !== 'private') return true;` and has 31 callers,
-- so a new value would have been treated as FULLY PUBLIC everywhere. The
-- application change in this PR converts that to an allow-list FIRST. A
-- migration that widens an enum is only as safe as the readers that test it by
-- exclusion — this is the same shape as the `.neq(…, 'private')` listing leak
-- fixed hours earlier on this column.
--
-- No backfill: every existing row keeps the value it has. The default stays
-- 'private'.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname  = 'events_landing_page_visibility_check'
  ) THEN
    ALTER TABLE public.events DROP CONSTRAINT events_landing_page_visibility_check;
  END IF;
END $$;

ALTER TABLE public.events
  ADD CONSTRAINT events_landing_page_visibility_check
  CHECK (landing_page_visibility = ANY (ARRAY[
    'public'::text,
    'unlisted'::text,
    'invited_accounts'::text,
    'private'::text
  ]));

COMMENT ON COLUMN public.events.landing_page_visibility IS
  'Who may open this celebration''s public page. '
  '''public'' = anyone, and it may be listed on /realstories + the sitemap. '
  '''unlisted'' = link only; never listed, never in the sitemap. '
  '''invited_accounts'' = only signed-in accounts belonging to someone on this '
  'event''s guest list (guests.email -> people -> people.claimed_by_user_id), '
  'plus hosts and moderators; everyone else gets the same locked page a '
  'stranger gets. With nobody matched it is effectively private, which is the '
  'owner''s stated rule, NOT a fault. '
  '''private'' = hosts + guests holding a redeemed guest-session cookie only. '
  'Owner 2026-08-15. Readers MUST test this column by allow-list; an exclusion '
  'test (!= private) silently admits every value added after it.';
