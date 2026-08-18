-- ─────────────────────────────────────────────────────────────────────────────
-- LISTENING TO A SONG MUST NOT UNLIST IT
--
-- 🚨 A LIVE, ONGOING DEFECT. 93 of 391 songs (24%) had already been silently
-- removed from the couple's "most popular wedding songs" list before this ran,
-- and the ORIGINAL Top 100 batch was 62% destroyed — song ids 1..12 are Ikaw,
-- Perfect, A Thousand Years, Beautiful in White, Forevermore and
-- Kahit Maputi Na Ang Buhok Ko. It degrades further every day, top-first.
--
-- MECHANISM. `songs_nonadmin_guard()` is a BEFORE INSERT OR UPDATE ... FOR EACH
-- ROW trigger whose intent is "somebody who is not a Setnayan admin may not
-- promote their own song into the curated list". Its body did:
--
--     IF NOT public.is_admin() THEN
--       NEW.is_curated_pick := FALSE;
--       IF NEW.source NOT IN ('vendor','couple') THEN NEW.source := 'vendor';
--
-- 🔑 IN A **BEFORE** TRIGGER, `NEW` CARRIES THE EXISTING VALUE FOR EVERY COLUMN
-- THE UPDATE DID NOT NAME. So this did not merely refuse a promotion — it
-- REWROTE two columns that the statement never mentioned. Caching a song's
-- 30-second preview and cover art (`UPDATE songs SET apple_track_id,
-- preview_url, artwork_url`) therefore un-curated the song as a side effect.
--
-- That cache write runs through the service-role client, and `is_admin()` is
-- `EXISTS(users WHERE user_id = auth.uid() ...)` — under service role
-- `auth.uid()` is NULL, so it returns FALSE and the guard fires. And the cache
-- write is triggered by ordinary browsing: the song list hydrates artwork as
-- rows scroll into view.
--
-- ⇒ **LISTENING TO A SONG IS WHAT REMOVED IT FROM THE LIST**, and the most
-- popular songs sit at the top, so they hydrated — and left — first. Nothing
-- errored. The list simply got shorter and more obscure.
--
-- 🔑 THE EVIDENCE WAS DESTROYED BY THE SAME LINE. `source` was rewritten from
-- 'seed' to 'vendor' at the same moment, so the one repair already in the repo
-- (migration 20260828000000's `UPDATE songs SET is_curated_pick = TRUE WHERE
-- source = 'seed'`) now matches ZERO of the damaged rows. A guard that erases
-- the record of what it changed cannot be undone by the obvious query.
--
-- ─── THE FIX IS NOT A ROLE CHECK ────────────────────────────────────────────
-- The tempting repair is to exempt the service role. It is the wrong one twice
-- over: (a) this function is SECURITY DEFINER, so `current_user` inside it is
-- the OWNER, not the caller — the repo's usual
-- `current_user NOT IN ('authenticated','anon')` idiom would be true for
-- EVERYBODY here and would disable the guard entirely; and (b) `auth.role()`
-- differs between production (NULL) and the PGlite replay (the shim returns
-- 'anon'), so a role-based guard cannot be honestly tested.
--
-- ✅ Instead the guard now says what it always meant: a non-admin may not
-- CHANGE these two fields. On UPDATE they are pinned to their OLD values, so a
-- statement that never named them cannot alter them. This is STRICTLY STRONGER
-- than before (a non-admin previously could force `is_curated_pick` to FALSE on
-- any row it could reach) and is role-independent, so it behaves identically in
-- production and in the replay.
--
-- INSERT behaviour is unchanged: a non-admin's new song is never curated and is
-- attributed to 'vendor' unless it declares 'vendor' or 'couple'.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.songs_nonadmin_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- A non-admin may not CHANGE either field, in either direction. Pinning to
    -- OLD means a statement that never named them leaves them exactly as they
    -- were — which is the whole defect this replaces.
    NEW.is_curated_pick := OLD.is_curated_pick;
    NEW.source := OLD.source;
    RETURN NEW;
  END IF;

  -- INSERT: unchanged. Nobody promotes their own song on the way in.
  NEW.is_curated_pick := FALSE;
  IF NEW.source IS NULL OR NEW.source NOT IN ('vendor', 'couple') THEN
    NEW.source := 'vendor';
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.songs_nonadmin_guard() IS
  'Non-admins may not promote a song into the curated list. On UPDATE both '
  'is_curated_pick and source are pinned to their OLD values — a BEFORE trigger '
  'sees NEW carrying existing values for unnamed columns, so the previous '
  'unconditional assignment un-curated a song whenever anything else about it '
  'was written. Caching a preview did exactly that: 93 of 391 songs were lost '
  'from the couple browse list before 2026-08-18, most-popular first.';

-- ─── RESTORE THE DAMAGE ─────────────────────────────────────────────────────
-- Every row in `songs` came from one of the two seed batches: the table holds
-- exactly two distinct created_at values (2026-06-03 = the original 100,
-- 2026-06-05 = the 291 that followed), and no song has ever been inserted by a
-- vendor or a couple. So restoring by seed batch is exact rather than a guess.
--
-- ⚠ Deliberately NOT `WHERE source = 'seed'` — that is precisely the query the
-- damage disarmed, since the demoted rows had their source rewritten too.
-- Idempotent: re-running changes nothing once the rows are correct.
DO $restore$
DECLARE
  seed_batches CONSTANT timestamptz[] := ARRAY[
    '2026-06-03 11:40:50.977295+00'::timestamptz,
    '2026-06-05 04:52:28.303169+00'::timestamptz
  ];
  fixed integer;
BEGIN
  -- The guard is BEFORE-trigger scoped and this runs as the migration role, so
  -- it is disabled for the duration rather than relying on is_admin().
  ALTER TABLE public.songs DISABLE TRIGGER songs_nonadmin_guard_trg;

  UPDATE public.songs
     SET is_curated_pick = TRUE,
         source = 'seed'
   WHERE created_at = ANY (seed_batches)
     AND (is_curated_pick IS DISTINCT FROM TRUE OR source IS DISTINCT FROM 'seed');
  GET DIAGNOSTICS fixed = ROW_COUNT;

  ALTER TABLE public.songs ENABLE TRIGGER songs_nonadmin_guard_trg;

  RAISE NOTICE 'songs restored to the curated list: %', fixed;
END
$restore$;
