-- ============================================================================
-- Master song list + vendor repertoire + couple song picks — FOUNDATION
-- ============================================================================
-- Design lock: Vendor_Compatibility_and_Master_Songlist_2026-06-03.md
-- (owner 2026-06-03: "the bands/singers/orchestra will place the songs they
-- have. and that will be compiled as our master song list." + "we check which
-- band/orchestra has those [the couple's chosen songs] on their songlist …
-- higher compatibility but we never limit the other vendors … below 90%
-- compatibility we notify these are the next best options.")
--
-- THE MODEL. Songs are a SHARED master catalogue, not free text on each vendor:
--   • songs            — one deduped canonical record per (title, artist).
--   • vendor_songs     — each music vendor ↔ the master songs they perform
--                        ("Your repertoire" capture, PR 2).
--   • event_song_picks — the couple ↔ the master songs they want
--                        (onboarding music picker → master, PR 3).
-- Music-vendor compatibility (PR 4) is then a clean set overlap:
--   |event_song_picks ∩ vendor_songs| / |event_song_picks|.
--
-- WHY foundation-only (no app behavior change): this lands the canonical
-- storage + seeds the master from the existing curated MUSIC100 (the top-100
-- Filipino-wedding songs the onboarding picker already uses — so couple picks
-- and vendor repertoires share identity). The capture UI (PR 2), the picker→
-- master wiring (PR 3), and the score (PR 4) activate on top. Additive + safe
-- on the live pilot — nothing reads/writes these yet.
--
-- No conflict with the owned-AI-music rule: that governs Setnayan-RENDERED
-- video. A band's live-performance repertoire is a different thing — real song
-- titles are correct here.
-- ============================================================================

-- ── 1 · songs (master catalogue) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.songs (
  song_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           TEXT NOT NULL,
  artist          TEXT NOT NULL DEFAULT '',
  -- Immutable dedup key — "perfect|ed sheeran". UNIQUE → ON CONFLICT no-op so
  -- many vendors adding the same song collapse to one canonical record.
  normalized_key  TEXT GENERATED ALWAYS AS (
                    lower(btrim(title)) || '|' || lower(btrim(artist))
                  ) STORED,
  source          TEXT NOT NULL DEFAULT 'vendor'
                    CHECK (source IN ('seed', 'vendor', 'couple', 'admin')),
  -- TRUE = part of the curated onboarding picker set (the MUSIC100 seed). Only
  -- admins may mint curated/seed/admin songs (guarded by the trigger below) so
  -- a vendor can't pollute every couple's picker.
  is_curated_pick BOOLEAN NOT NULL DEFAULT FALSE,
  genre_tags      TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS songs_normalized_key_uq
  ON public.songs (normalized_key);
CREATE INDEX IF NOT EXISTS songs_curated_pick_idx
  ON public.songs (is_curated_pick) WHERE is_curated_pick;

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Public read — the picker (anon onboarding visitors included) + the
-- marketplace match read both need the catalogue.
DROP POLICY IF EXISTS songs_public_select ON public.songs;
CREATE POLICY songs_public_select
  ON public.songs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Any authenticated user may ADD a song (vendors building a repertoire,
-- couples free-typing a pick). The trigger forces source/is_curated_pick to
-- safe values for non-admins, so "compile from submissions" can't be abused.
DROP POLICY IF EXISTS songs_authenticated_insert ON public.songs;
CREATE POLICY songs_authenticated_insert
  ON public.songs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Edit / delete shared records is admin-only (the 0023 dedup/merge tool).
DROP POLICY IF EXISTS songs_admin_update ON public.songs;
CREATE POLICY songs_admin_update
  ON public.songs FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS songs_admin_delete ON public.songs;
CREATE POLICY songs_admin_delete
  ON public.songs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── 1a · SEED the master from the curated MUSIC100 ─────────────────────────
-- Runs BEFORE the guard trigger so the seed's source='seed' + is_curated_pick
-- =TRUE stick. Dollar-quoted blob → apostrophes need no escaping. Exact titles
-- match the onboarding picker constant so identity is shared.
INSERT INTO public.songs (title, artist, source, is_curated_pick)
SELECT btrim(split_part(l, '|', 1)), btrim(split_part(l, '|', 2)), 'seed', TRUE
FROM unnest(string_to_array(btrim($songs$
Ikaw|Yeng Constantino
Perfect|Ed Sheeran
A Thousand Years|Christina Perri
Beautiful in White|Shane Filan
Forevermore|Side A
Kahit Maputi Na Ang Buhok Ko|Moira Dela Torre
Thinking Out Loud|Ed Sheeran
Can't Help Falling in Love|Elvis Presley
All of Me|John Legend
Especially for You|MYMP
Now That I Have You|Side A
Hawak Kamay|Yeng Constantino
Marry You|Bruno Mars
Marry Me|Train
Til My Heartaches End|Ella Mae Saison
Just the Way You Are|Bruno Mars
I'm Yours|Jason Mraz
You Are My Song|Martin Nievera
The Way You Look at Me|Christian Bautista
Since I Found You|Christian Bautista
Araw-Araw|Ben&Ben
Pagsamo|Arthur Nery
With a Smile|Eraserheads
Buko|Jireh Lim
Tuwing Umuulan|Basil Valdez
Saan Darating Ang Umaga|Rey Valera
Sa'Yo|Silent Sanctuary
Say You Won't Let Go|James Arthur
Make You Feel My Love|Adele
From This Moment On|Shania Twain
I Don't Want to Miss a Thing|Aerosmith
Truly Madly Deeply|Savage Garden
Endless Love|Lionel Richie & Diana Ross
At Last|Etta James
Lucky|Jason Mraz & Colbie Caillat
I Do (Cherish You)|98 Degrees
Eternal Flame|The Bangles
The Power of Love|Celine Dion
Because You Loved Me|Celine Dion
Got to Believe in Magic|David Pomeranz
On the Wings of Love|Jeffrey Osborne
Two Less Lonely People in the World|Air Supply
Could I Have This Dance|Anne Murray
The Time of My Life|Medley & Warnes
I Finally Found Someone|Barbra Streisand
Always|Atlantic Starr
Kailan|MYMP
You|Basil Valdez
Maybe This Time|Sarah Geronimo
Pangako|Regine Velasquez
The Prayer|Celine Dion & Andrea Bocelli
When You Say Nothing at All|Ronan Keating
Everything|Michael Bublé
L-O-V-E|Nat King Cole
Better Together|Jack Johnson
First Day of My Life|Bright Eyes
Speechless|Dan + Shay
10,000 Hours|Dan + Shay & Justin Bieber
Die a Happy Man|Thomas Rhett
Lover|Taylor Swift
Love Story|Taylor Swift
Amazed|Lonestar
This I Promise You|NSYNC
I Swear|All-4-One
Wonderful Tonight|Eric Clapton
Your Song|Elton John
Have I Told You Lately|Rod Stewart
Grow Old With You|Adam Sandler
God Gave Me You|Blake Shelton
Can You Feel the Love Tonight|Elton John
Unchained Melody|The Righteous Brothers
Stand by Me|Ben E. King
Isn't She Lovely|Stevie Wonder
Signed, Sealed, Delivered|Stevie Wonder
Sway|Michael Bublé
Fly Me to the Moon|Frank Sinatra
The Way You Look Tonight|Frank Sinatra
Can't Take My Eyes Off You|Frankie Valli
You're Still the One|Shania Twain
Photograph|Ed Sheeran
Until I Found You|Stephen Sanchez
A Whole New World|Peabo Bryson & Regina Belle
My Girl|The Temptations
How Sweet It Is|James Taylor
Die With a Smile|Bruno Mars & Lady Gaga
Best Part|Daniel Caesar & H.E.R.
Adore You|Harry Styles
At My Worst|Pink Sweat$
Beautiful Crazy|Luke Combs
Heaven|Bryan Adams
Crazy Little Thing Called Love|Queen
Three Times a Lady|Commodores
Tadhana|Up Dharma Down
Mundo|IV of Spades
Tahanan|Adie
Paraluman|Adie
Maybe the Night|Ben&Ben
Kathang Isip|Ben&Ben
Bakit Ngayon Ka Lang|Ariel Rivera
Kahit Kailan|South Border
$songs$), E'\n')) AS l
WHERE btrim(l) <> '' AND l LIKE '%|%'
ON CONFLICT (normalized_key) DO NOTHING;

-- Guard: non-admins can't mint curated/seed/admin songs (would pollute every
-- couple's picker). Created AFTER the seed so the seed's flags persist.
CREATE OR REPLACE FUNCTION public.songs_nonadmin_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.is_curated_pick := FALSE;
    IF NEW.source NOT IN ('vendor', 'couple') THEN
      NEW.source := 'vendor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS songs_nonadmin_guard_trg ON public.songs;
CREATE TRIGGER songs_nonadmin_guard_trg
  BEFORE INSERT OR UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.songs_nonadmin_guard();

COMMENT ON TABLE public.songs IS
  'Master song catalogue — compiled from vendor repertoire submissions, deduped on normalized_key (title|artist). Seeded from the curated MUSIC100 (is_curated_pick=TRUE). The couple picker + vendor repertoires reference these IDs so music-vendor compatibility = set overlap. Design: Vendor_Compatibility_and_Master_Songlist_2026-06-03.';

-- ── 2 · vendor_songs (each music vendor's repertoire) ──────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_songs (
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  song_id           BIGINT NOT NULL
                    REFERENCES public.songs(song_id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, song_id)
);

-- Reverse lookup: which vendors play song X (the overlap join).
CREATE INDEX IF NOT EXISTS vendor_songs_song_idx ON public.vendor_songs (song_id);

ALTER TABLE public.vendor_songs ENABLE ROW LEVEL SECURITY;

-- Public read — couples + the marketplace match read a vendor's repertoire.
DROP POLICY IF EXISTS vendor_songs_public_select ON public.vendor_songs;
CREATE POLICY vendor_songs_public_select
  ON public.vendor_songs FOR SELECT
  TO anon, authenticated
  USING (true);

-- A vendor manages their own repertoire (canonical current_vendor_ids idiom).
DROP POLICY IF EXISTS vendor_songs_owner_write ON public.vendor_songs;
CREATE POLICY vendor_songs_owner_write
  ON public.vendor_songs FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.vendor_songs IS
  'A music vendor''s repertoire — vendor_profile_id ↔ master songs they perform. Built in the 0022 "Your repertoire" capture. The vendor side of the music compatibility overlap.';

-- ── 3 · event_song_picks (the couple's wanted songs) ───────────────────────
CREATE TABLE IF NOT EXISTS public.event_song_picks (
  event_id   UUID NOT NULL
             REFERENCES public.events(event_id) ON DELETE CASCADE,
  song_id    BIGINT NOT NULL
             REFERENCES public.songs(song_id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'onboarding'
             CHECK (source IN ('onboarding', 'editor', 'import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, song_id)
);

CREATE INDEX IF NOT EXISTS event_song_picks_song_idx ON public.event_song_picks (song_id);

ALTER TABLE public.event_song_picks ENABLE ROW LEVEL SECURITY;

-- Host-scoped — hosts read + write their own event's picks; admins all. Same
-- canonical current_event_ids() idiom as event_vendor_preferences.
DROP POLICY IF EXISTS event_song_picks_host_select ON public.event_song_picks;
CREATE POLICY event_song_picks_host_select
  ON public.event_song_picks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_song_picks_host_write ON public.event_song_picks;
CREATE POLICY event_song_picks_host_write
  ON public.event_song_picks FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.event_song_picks IS
  'The couple''s wanted songs (from the onboarding music picker → master, plus later edits). Supersedes the display-only events.music_playlist_seed for matching. The couple side of the music compatibility overlap.';
