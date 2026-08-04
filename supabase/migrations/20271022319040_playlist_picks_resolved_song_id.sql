-- ============================================================================
-- THE PLAYLIST LEARNS WHICH SONG IT MEANS.  (Song Desk PR 3, half 1 of 2)
--
-- Owner-answered 2026-07-30: "onboarding feeds the studio" — the couple's flat
-- onboarding picks pre-fill an Unsorted tray in the playlist studio, and the
-- vendor matcher reads BOTH lists. Both halves of that answer need one thing the
-- schema does not have: a way to say that a studio pick and an onboarding pick
-- are THE SAME SONG.
--
-- ── WHY THIS COLUMN, AND WHY NOW ───────────────────────────────────────────
--
-- `event_song_picks` stores a resolved `song_id`. `event_playlist_picks` stores
-- FREE TEXT (`song_label` + nullable `artist`) and never resolved anything. So
-- every cross-table question has been answered by normalising strings:
--
--   • PR 2's `buildHostPlaylist` crosses the playlist against the band's
--     repertoire by normalised title, with a documented "blank artist matches any
--     same-title song" rule that is knowingly generous;
--   • PR 3's tray has to ask "is this onboarding pick already in the studio?",
--     which is the same fuzzy question a second time;
--   • the matcher would have to resolve free text to `song_id`s on every read to
--     count a first-dance song toward a vendor's "% match".
--
-- Three consumers, one missing join. So resolve ONCE at write time instead of
-- three times at read time. `findOrCreateSongId()` (lib/songs.ts) already does
-- exactly this for onboarding — same `normalized_key`, same dedup, same
-- authenticated-INSERT path on `songs`.
--
-- **AND THE TABLE IS EMPTY.** Prod holds zero real `event_playlist_picks` rows
-- (only a 2026-07-30 test fixture), so the backfill below is free and total. A
-- month from now this same change needs a migration that reconciles thousands of
-- hand-typed labels against a 391-row catalogue, and every unresolvable row is a
-- permanent NULL. Doing it while the cost is zero is the entire argument.
--
-- ── NULLABLE, DELIBERATELY — this is an INDEX, not a constraint ─────────────
--
-- `song_id` stays NULLABLE and the text columns stay authoritative for DISPLAY.
-- A couple may type a song that is not in the catalogue and never will be (a
-- family composition, a mis-spelling they prefer), and that pick must still
-- render exactly as they typed it. So:
--
--   • `song_label`/`artist` remain the display truth — nothing reads the joined
--     `songs` row to render a pick;
--   • `song_id` is an OPTIONAL identity used only for CROSSING (tray dedup,
--     repertoire match, matcher counting);
--   • a NULL means "we could not name it", and every consumer keeps its existing
--     text fallback. PR 2's fuzzy rule is not deleted — it becomes the second
--     pass rather than the only one.
--
-- ⚠ `ON DELETE SET NULL`, not CASCADE: retiring a catalogue song must never
-- delete the couple's pick. And no NOT NULL, no unique — two picks may legitimately
-- name the same song (the same track in two moments).
--
-- ── RA 10173 ───────────────────────────────────────────────────────────────
--
-- Adds no subject-identifying column (a `songs` FK is catalogue data), so the
-- erasure/export guardrails' classification of this table is unchanged.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_playlist_picks
  ADD COLUMN IF NOT EXISTS song_id BIGINT REFERENCES public.songs(song_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_playlist_picks.song_id IS
  'OPTIONAL resolved identity for CROSSING only — the tray''s "already placed?" '
  'check, the band''s repertoire match, and the vendor matcher. `song_label`/'
  '`artist` remain the DISPLAY truth and are never replaced by the joined row. '
  'NULL = uncatalogued (a family composition, a spelling they prefer), and every '
  'consumer keeps its normalised-text fallback. Resolved at write time by '
  'findOrCreateSongId() (lib/songs.ts) — the same normalized_key as onboarding, so '
  'a studio pick and an onboarding pick of one song get the same id. Added '
  '2026-07-30 while the table was empty; ON DELETE SET NULL so retiring a '
  'catalogue song never deletes a couple''s pick.';

-- Partial index: every consumer asks "which picks resolved to a song", never
-- "which are NULL", so the NULLs are dead weight in the index.
CREATE INDEX IF NOT EXISTS event_playlist_picks_song_id_idx
  ON public.event_playlist_picks (event_id, song_id)
  WHERE song_id IS NOT NULL;

-- ── Backfill · exact normalised match only ─────────────────────────────────
-- Uses the SAME key the generated column on `songs` uses
-- (`lower(btrim(title)) || '|' || lower(btrim(artist))`), so this agrees with
-- `findOrCreateSongId` and `resolve_song_id` by construction rather than by
-- coincidence.
--
-- ⚠ EXACT ONLY, on purpose. The looser "blank artist matches any same-title
-- song" rule that PR 2 applies at READ time is fine there — it is a display hint
-- a musician can eyeball, and it shows the matched artist so a wrong guess is
-- visible. Writing a guess into a stored id is a different act: it would be
-- invisible afterwards and would silently feed the vendor MATCH SCORE, which is
-- money-adjacent. A row that needs a guess keeps its NULL and keeps the read-time
-- fallback.
UPDATE public.event_playlist_picks p
   SET song_id = s.song_id
  FROM public.songs s
 WHERE p.song_id IS NULL
   AND s.normalized_key = lower(btrim(p.song_label)) || '|' || lower(btrim(coalesce(p.artist, '')));

-- ── Post-conditions ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_nullable TEXT;
  v_delrule  TEXT;
BEGIN
  SELECT is_nullable INTO v_nullable FROM information_schema.columns
  WHERE table_schema='public' AND table_name='event_playlist_picks' AND column_name='song_id';
  IF v_nullable IS NULL THEN
    RAISE EXCEPTION 'event_playlist_picks.song_id was not added';
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION 'song_id must stay NULLABLE — an uncatalogued pick is legitimate';
  END IF;

  -- The FK must not be able to delete a couple's pick.
  SELECT rc.delete_rule INTO v_delrule
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage k ON k.constraint_name = rc.constraint_name
  WHERE k.table_schema='public' AND k.table_name='event_playlist_picks' AND k.column_name='song_id';
  IF v_delrule IS DISTINCT FROM 'SET NULL' THEN
    RAISE EXCEPTION 'song_id FK delete rule is % — must be SET NULL', v_delrule;
  END IF;
END $$;

COMMIT;
