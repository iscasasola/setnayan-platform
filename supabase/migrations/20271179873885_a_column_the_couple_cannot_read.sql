-- Three columns a signed-in person is refused, and the whole query dies with them.
--
-- ── WHAT A PERSON HITS ──────────────────────────────────────────────────────
-- `events` revokes table-level SELECT and re-grants a PER-COLUMN allow-list
-- (20271007100000). PostgREST refuses the WHOLE query when a select names one
-- withheld column — not that column, the query. Measured against production by
-- executing it, not inferred:
--
--   SET LOCAL ROLE authenticated;
--   SELECT event_id, site_art_direction FROM public.events LIMIT 1;
--   -- ERROR: 42501: permission denied for table events
--
-- …while the identical select naming only granted columns returns cleanly. So
-- the refusal is attributable to the column, not to the role or to RLS.
--
-- Three shipped screens read one of these through the COUPLE'S OWN session:
--
--  1. site_art_direction — app/dashboard/[eventId]/website/editor/page.tsx:99.
--     The read fails, `event` is null, and the page ends `if (!event)
--     redirect(...)`. The couple presses "edit your website" and is bounced
--     back to their dashboard. Every time, with nothing said.
--
--  2. papic_guest_capture_early — studio/papic/_components/guest-cameras-choice.tsx:44.
--     `if (error || !data) return null` — the control renders NOTHING. This is
--     the switch the owner asked for on 2026-08-07 ("there should be a button
--     for the host of the event to allow guests to use the papic"). It was
--     built on 2026-08-08 and has never once appeared on screen.
--
--  3. date_forced_by_lock_of — lib/release-forced-date.ts:64, reached from three
--     call sites in dashboard/[eventId]/vendors/actions.ts, all passing the
--     user-session client. The refused read yields a null row, so `owner` is
--     undefined and the function returns 'not_forced_by_this_vendor' — a
--     benign-sounding answer meaning "nothing to do". A forced date is never
--     released, and no error is ever raised.
--
-- ── WHY THEY HAVE NO GRANT — AND IT IS NOT WHAT IT LOOKS LIKE ───────────────
-- The lock-down computes its allow-list as EVERYTHING MINUS a deny-set, and its
-- deny-set names exactly three columns: master_qr_token and the two Google
-- Drive OAuth token columns. None of these three is denied anywhere.
--
-- They are missing for two different reasons, and both are omissions:
--
--   • site_art_direction was committed at 19:27 on 2026-07-26 carrying prefix
--     20271003190000 — SIX DAYS BELOW the lock-down, which was committed at
--     13:40 the same day. Production applies out-of-order migrations
--     (`db push --include-all` exists for exactly that), so the column was
--     added AFTER the allow-list had already been computed, and nothing
--     recomputed it. **Prefix order is not apply order.**
--
--   • papic_guest_capture_early and date_forced_by_lock_of were added after the
--     lock-down and simply never carried the `GRANT SELECT (col)` line the
--     lock-down's own docblock (line 296) tells you to write.
--
-- 🔑 AND THE TWO LATER "RECOMPUTE" MIGRATIONS CANNOT HEAL ANY OF IT. Both
-- 20271008731642 and 20271025120000 rebuild the allow-list from
--     …AND has_column_privilege(role_name, 'public.events', c.column_name, 'SELECT')
-- — i.e. they re-grant only what ALREADY holds the grant, minus their new
-- deny-set. They are monotonically narrowing by construction. A column that
-- missed its grant once is unreadable forever, and every subsequent recompute
-- cements the absence. That is why this is a GRANT and not a re-run.
--
-- ── WHY THE GUARD DID NOT CATCH IT ──────────────────────────────────────────
-- scripts/lint-events-column-grants.mjs filters `f.slice(0,14) > LOCKDOWN`, so
-- it only examines migrations whose PREFIX sorts above the lock-down. The whole
-- failure mode here is a file whose prefix sorts BELOW it and which applied
-- ABOVE it — structurally invisible to a prefix cutoff. The guard is repaired in
-- this same change to check every migration regardless of prefix.
--
-- 🪤 AND THE REPLAY DISAGREES WITH PRODUCTION ON ONE OF THE THREE. The PGlite
-- replay applies in FILENAME order, so site_art_direction is added BEFORE the
-- lock-down there and lands inside the computed allow-list. Measured:
--
--     column                      replay   prod
--     site_art_direction           true    false   ← divergent
--     papic_guest_capture_early    false   false
--     date_forced_by_lock_of       false   false
--     event_date (control)         true    true
--     master_qr_token (control)    false   false
--
-- So a db test asserting the site_art_direction grant PASSES TODAY and proves
-- nothing about production — the same shape as the manpower_gigs drift. It is
-- kept as a regression guard and is labelled as one; the two non-divergent
-- columns are what the replay can honestly prove.
--
-- ── SCOPE: authenticated ONLY ───────────────────────────────────────────────
-- Deliberately NOT granted to anon. The three broken readers are all signed-in
-- surfaces; the public guest site reads art direction through the admin client
-- (app/[slug]/_lib/loaders.ts:118), so anon needs nothing. Minimal widening.
--
-- This does NOT change WHO may read a row — `events` RLS still scopes reads to
-- current_event_ids(). A column grant is necessary, never sufficient.
--
-- ⛔ AND THE UPDATE REVOKE ON papic_guest_capture_early STAYS REVOKED. Its own
-- migration (20271121501756) withheld UPDATE deliberately and correctly: events
-- UPDATE RLS is row-level, so a writable column is writable by anyone who can
-- update the row at all. That reasoning is about WRITING and says nothing about
-- reading; the host sets it through a membership-checked server action. The
-- post-condition below asserts the write stays shut.

BEGIN;

-- Snapshot anon BEFORE granting anything, so the post-condition can assert that
-- this migration widened nothing rather than assert an absolute that is only
-- true on one of the two databases (see the anon note below).
CREATE TEMP TABLE _anon_before ON COMMIT DROP AS
SELECT c AS col, has_column_privilege('anon', 'public.events', c, 'SELECT') AS had
FROM unnest(ARRAY[
  'site_art_direction', 'papic_guest_capture_early', 'date_forced_by_lock_of'
]) AS c;

GRANT SELECT (site_art_direction)        ON public.events TO authenticated;
GRANT SELECT (papic_guest_capture_early) ON public.events TO authenticated;
GRANT SELECT (date_forced_by_lock_of)    ON public.events TO authenticated;

DO $$
DECLARE
  c TEXT;
  r RECORD;
BEGIN
  -- 1. The three reads are open to a signed-in person.
  FOREACH c IN ARRAY ARRAY[
    'site_art_direction', 'papic_guest_capture_early', 'date_forced_by_lock_of'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'post-condition failed: authenticated still cannot read %', c;
    END IF;
  END LOOP;

  -- 2. anon gained NOTHING. Asserted rather than assumed — a GRANT naming the
  --    wrong role list is the easiest way to turn this fix into a disclosure.
  --
  --    🪤 THIS IS "UNCHANGED", NOT "FALSE", AND THE FIRST DRAFT GOT IT WRONG.
  --    Asserting `NOT has_column_privilege('anon', …)` blew up in the PGlite
  --    replay, because there `site_art_direction` sorts BELOW the lock-down and
  --    therefore landed inside the computed allow-list — which grants to
  --    `authenticated, anon` alike. anon legitimately holds it in the replay and
  --    does not in production. The invariant that is true on BOTH is that this
  --    migration moves anon not at all.
  FOR r IN SELECT col, had FROM _anon_before LOOP
    IF has_column_privilege('anon', 'public.events', r.col, 'SELECT') <> r.had THEN
      RAISE EXCEPTION 'post-condition failed: this migration changed anon''s read of %', r.col;
    END IF;
  END LOOP;

  -- 3. The deliberate write-lock survives the read-fix.
  IF has_column_privilege('authenticated', 'public.events',
                          'papic_guest_capture_early', 'UPDATE') THEN
    RAISE EXCEPTION 'post-condition failed: papic_guest_capture_early became writable';
  END IF;

  -- 4. The three genuine secrets are untouched.
  FOREACH c IN ARRAY ARRAY[
    'master_qr_token',
    'photo_delivery_oauth_token_encrypted',
    'photo_delivery_oauth_expires_at'
  ] LOOP
    IF has_column_privilege('authenticated', 'public.events', c, 'SELECT')
       OR has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'post-condition failed: secret % became readable', c;
    END IF;
  END LOOP;
END $$;

COMMIT;
