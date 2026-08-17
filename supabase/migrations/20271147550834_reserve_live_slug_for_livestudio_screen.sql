-- ============================================================================
-- RESERVE 'live' — the Live Studio venue-screen page, named by the owner 2026-08-17.
--
-- ── WHY THIS IS URGENT AND THE PAGE IS NOT ─────────────────────────────────
-- The owner ruled 2026-08-17 that a Live Studio venue screen is a DIFFERENT
-- product from the Live Photo Wall (`lib/panood-screens.ts` carries the ruling),
-- and then named the screen's own page: **live**.
--
-- The PAGE does not exist yet — three things are still missing (a caller for
-- `provisionPanoodScreensAdmin`, a caller for `generateScreenPairingCode`, and
-- the route itself). The WORD, however, has to be taken now, because:
--
--   🔒 A SHOP ADDRESS IS IMMUTABLE. `business_slug` cannot be changed once
--   minted (the immutability trigger is deliberate and was NOT weakened when an
--   admin correction door was added on 2026-08-11). If a business called
--   "Live" registered before this lands, it would hold `setnayan.com/live`
--   FOREVER and the page could never exist there.
--
-- Measured in prod before writing this: ZERO events, ZERO shops and ZERO people
-- hold 'live', and it has never appeared in `slug_change_log` in either
-- direction. So taking it now strands nobody. (One shop is
-- `saysay-live-band-and-hosting-fix` — 'live' as a substring, not the slug.)
--
-- ── WHERE IT GOES, AND WHERE IT MUST NOT ───────────────────────────────────
-- `lib/reserved-slugs.ts` has TWO halves with different contracts:
--   • `ROUTE_RESERVED_SLUGS` is GENERATED from the route folders on disk and a
--     test re-reads those folders and fails if it drifts. `app/live/` does not
--     exist, so putting 'live' there would be a lie that breaks CI.
--   • `DB_MIRRORED_RESERVED_SLUGS` is the hand-authored half for words that are
--     NOT route folders — namespaces, redirect targets, defensive entries. That
--     is exactly what 'live' is today: reserved ahead of its route.
-- This migration is the DB half of that pair. `business_slug_is_reserved` is
-- compared MECHANICALLY against the TypeScript set by
-- `tests/db/vendor-business-slug-mint.db.test.ts`, so the two cannot drift.
--
-- ── THE BODY IS EXTENDED, NOT RETYPED — AND THE MIGRATION PROVES IT ────────
-- 🪤 A `CREATE OR REPLACE` of a 76-word array is a transcription hazard: drop
-- one word and a real page silently becomes claimable by a shop, permanently,
-- with every test still green. The PR-H work already learned to re-emit function
-- bodies by EXTRACTION rather than from memory.
--
-- 🪤 AND THE SELF-CHECK EARNED ITS PLACE ON ITS FIRST RUN. The obvious extraction
-- pattern — every single-quoted run of non-quote characters — returned SEVEN
-- words instead of seventy-six, and the migration REFUSED rather than replacing
-- the array with junk. The cause is the first line of the function itself:
-- `coalesce(p_slug, '')` contains an EMPTY string, and two adjacent quotes
-- desynchronise naive quote-pairing, so the scanner pairs the closing quote of
-- `''` with the opening quote of `'about'` and swallows everything between as one
-- "word". The pattern is therefore restricted to SLUG-SHAPED contents
-- (`[a-z0-9._-]+`), which cannot match a run containing spaces or parentheses, so
-- pairing self-corrects. Every real reserved word satisfies it, including
-- `manifest.json`, `sw.js`, `icon-192.svg`, `_next` and `forgot-password`.
--
-- So this migration does not ask to be trusted. It reads the CURRENT word set out
-- of `pg_proc.prosrc`, applies the replacement, reads the NEW set the same way,
-- and RAISES unless the new set is exactly the old set plus 'live'. A dropped or
-- altered word aborts the migration instead of shipping.
--
-- ⚠ `business_slug_is_reserved` is a plain (non-DEFINER) SQL function and is
-- executable by NEITHER anon NOR authenticated — verified in prod before writing.
-- So there are no role grants to re-issue after the replace, which is the usual
-- trap with `CREATE OR REPLACE` (it re-applies default privileges).
-- ============================================================================

DO $mig$
DECLARE
  v_old text[];
  v_new text[];
  v_missing text[];
  v_extra text[];
BEGIN
  -- 1. The word set as it stands, extracted from the live function body.
  SELECT array_agg(DISTINCT m[1] ORDER BY m[1])
    INTO v_old
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public',
         LATERAL regexp_matches(p.prosrc, '''([a-z0-9._-]+)''', 'g') AS m
   WHERE p.proname = 'business_slug_is_reserved';

  IF v_old IS NULL OR array_length(v_old, 1) < 60 THEN
    RAISE EXCEPTION
      'refusing to replace business_slug_is_reserved: extracted only % words from the current body — the extraction is wrong, not the function',
      COALESCE(array_length(v_old, 1), 0);
  END IF;

  -- 2. The replacement. Sections and order preserved from the shipped body.
  CREATE OR REPLACE FUNCTION public.business_slug_is_reserved(p_slug text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $fn$
    SELECT lower(coalesce(p_slug, '')) = ANY (ARRAY[
      -- auth / account / system
      'about', 'admin', 'api', 'auth', 'contact', 'dashboard', 'dpo',
      'forgot-password', 'health', 'help', 'join', 'legal', 'login', 'logout',
      'privacy', 'register', 'reset-password', 'settings', 'signup', 'support',
      'terms',
      -- routing namespaces / prefixes
      'u', 'v', 'vendor', 'vendor-dashboard', 'venue', 'venues',
      -- real top-level product / marketing routes
      'acceptable-use', 'alaala', 'blog', 'cookies', 'download', 'explore',
      'features', 'for-vendors', 'how-it-works', 'monogram', 'our-story', 'pa3d',
      'palogo', 'panood', 'papic', 'patiktok', 'pawebsite', 'pricing',
      'realstories', 'refunds', 'setnayan-ai', 'storytellers', 'tour', 'vendors',
      'waitlist', 'wall', 'why-setnayan',
      -- ⬇ ADDED 2026-08-11. Every one is a REAL top-level page that this
      -- function could previously have handed to a shop. `creators` and
      -- `open-shop` are live and in the sitemap.
      'claim', 'creators', 'demo-capture', 'dev', 'host', 'onboarding',
      'open-shop', 'pabati', 'proposals', 'prototype', 'receipts', 'samahan',
      'site-editor', 'tl', 'vendor-invite',
      -- ⬇ ADDED 2026-08-17. The Live Studio VENUE-SCREEN page, named by the
      -- owner on the day he ruled that a Live Studio screen is a different
      -- product from the Live Photo Wall. Reserved BEFORE the route exists
      -- because a shop address is immutable once minted: a business called
      -- "Live" would hold this word forever and the page could never be built.
      -- Verified in prod first — no event, shop or person holds it.
      'live',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $fn$;

  -- 3. The word set as it now stands, extracted the same way.
  SELECT array_agg(DISTINCT m[1] ORDER BY m[1])
    INTO v_new
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public',
         LATERAL regexp_matches(p.prosrc, '''([a-z0-9._-]+)''', 'g') AS m
   WHERE p.proname = 'business_slug_is_reserved';

  -- 4. Prove the change is EXACTLY "+ live", in both directions.
  SELECT array_agg(w ORDER BY w) INTO v_missing
    FROM unnest(v_old) AS w WHERE w <> ALL (v_new);
  SELECT array_agg(w ORDER BY w) INTO v_extra
    FROM unnest(v_new) AS w WHERE w <> ALL (v_old) AND w <> 'live';

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'business_slug_is_reserved LOST reserved word(s) %: a dropped word makes a real page claimable by a shop, permanently. Aborting.',
      v_missing;
  END IF;
  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION
      'business_slug_is_reserved gained unintended word(s) %: this migration reserves exactly one word. Aborting.',
      v_extra;
  END IF;
  IF NOT public.business_slug_is_reserved('live') THEN
    RAISE EXCEPTION 'business_slug_is_reserved(''live'') is still false after the replace.';
  END IF;
  IF public.business_slug_is_reserved('maria-and-jose') THEN
    RAISE EXCEPTION 'business_slug_is_reserved now reserves a REAL existing slug — the array is wrong.';
  END IF;

  RAISE NOTICE 'business_slug_is_reserved: % words -> % words (+live), no losses.',
    array_length(v_old, 1), array_length(v_new, 1);
END
$mig$;

COMMENT ON FUNCTION public.business_slug_is_reserved(text) IS
  'TRUE when a business slug collides with a reserved top-level word. Mirrors '
  'DB_MIRRORED_RESERVED_SLUGS in apps/web/lib/reserved-slugs.ts and is compared '
  'mechanically by tests/db/vendor-business-slug-mint.db.test.ts — add a word to '
  'BOTH or that test fails. ''live'' was reserved 2026-08-17 for the Live Studio '
  'venue-screen page, ahead of its route, because a shop address is immutable '
  'once minted.';
