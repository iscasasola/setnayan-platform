-- ============================================================================
-- Song Bank — iTunes preview/artwork cache columns + 390-song seed expansion
-- ============================================================================
-- Design lock: Onboarding_Style_and_Song_Bank_2026-06-04.md §5 (Song Bank) +
-- §5.4 (DB-cache the iTunes data). Builds on the master-songlist foundation
-- (20260731000000_master_song_list_foundation.sql) — does NOT redefine the
-- songs/vendor_songs/event_song_picks tables or their RLS; only:
--
--   1. ADDS three nullable cache columns to public.songs:
--        apple_track_id BIGINT · preview_url TEXT · artwork_url TEXT
--      The onboarding Song Bank looks a song up on Apple/iTunes ONCE (keyless
--      client JSONP), then a server action UPSERTs the resolved values here. The
--      preview path then PREFERS this cached row over a live call → production
--      trends to near-zero live iTunes lookups (wedding songs repeat heavily).
--      All nullable: a song with no cache yet simply resolves live (unchanged).
--
--   2. GROWS the curated seed from the original MUSIC100 to the full 390-song
--      hand list (the onboarding picker's founding repertoire — PH OPM classics
--      + 2020s, deep Taylor Swift + Bruno Mars incl. "Risk It All", golden
--      classics, and the latest TikTok-era first-dance staples). Source = the
--      verified prototype list (Onboarding_Wedding_Flow_2026-06-01.html · 390
--      rows · 0 duplicates · 0 malformed). Seeded source='seed' +
--      is_curated_pick=TRUE so they populate the picker's default browse.
--
-- ADDITIVE + IDEMPOTENT: ADD COLUMN IF NOT EXISTS, a guarded index, and an
-- INSERT … ON CONFLICT (normalized_key) DO NOTHING that re-seeds all 390 (the
-- original 100 collapse as no-ops). Safe whether or not the foundation seed ran,
-- and safe to re-run. No app behavior change lands with the migration alone.
--
-- Why NOT a UNIQUE constraint on apple_track_id: the canonical dedup-key
-- decision (Apple track ID vs normalized title|artist) is an OPEN owner decision
-- (spec §7.1) and explicitly out of scope here. Two title/artist rows may resolve
-- to the same iTunes track ("Perfect" vs "Perfect - Ed Sheeran"); a unique
-- constraint would pre-empt that decision. The non-unique index below just speeds
-- the cache lookup.
--
-- No conflict with the owned-AI-music rule (that governs Setnayan-RENDERED
-- video). iTunes previews are taste/reference clips Apple hosts — we neither host
-- nor license them. Render music stays the owned/Pakanta catalogue, untouched.
-- ============================================================================

-- ── 1 · iTunes preview/artwork cache columns (all nullable, additive) ───────
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS apple_track_id BIGINT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS preview_url     TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS artwork_url     TEXT;

COMMENT ON COLUMN public.songs.apple_track_id IS
  'Apple/iTunes Search trackId resolved on first preview lookup (Song Bank §5.4 cache). Nullable — NULL = not resolved yet. NOT unique: the canonical dedup-key decision (spec §7.1) is out of scope, and multiple title/artist rows may map to one track.';
COMMENT ON COLUMN public.songs.preview_url IS
  'Cached 30-sec Apple-hosted preview URL (Song Bank §5.4). Populated by the onboarding cache-upsert server action on first lookup so the preview path prefers this over a live JSONP call. Nullable; client falls back to a live lookup when NULL.';
COMMENT ON COLUMN public.songs.artwork_url IS
  'Cached album artwork URL (Apple, upscaled 300x300) paired with preview_url from the same single iTunes lookup (Song Bank §5.4). Nullable.';

-- Speeds the cache read (find a song already carrying a resolved track id);
-- partial so it stays tiny until the cache fills. NOT unique — see header.
CREATE INDEX IF NOT EXISTS songs_apple_track_id_idx
  ON public.songs (apple_track_id) WHERE apple_track_id IS NOT NULL;

-- ── 2 · Grow the curated seed to the full 390-song hand list ────────────────
-- Runs against the foundation table; ON CONFLICT (normalized_key) DO NOTHING so
-- the original 100 are no-ops and only the ~290 new rows insert. Exact titles
-- match the onboarding picker constant so couple-pick / vendor-repertoire
-- identity is shared. The list is dollar-quoted so apostrophes need no escaping.
--
-- The non-admin guard (songs_nonadmin_guard_trg) would, in a migration context
-- (no JWT → auth.uid() NULL → is_admin() FALSE), strip is_curated_pick→FALSE and
-- force source→'vendor', defeating the curated seed. The foundation seed dodged
-- this by running BEFORE the trigger existed; here the trigger already exists, so
-- DISABLE it for the seed (then re-enable). DISABLE TRIGGER takes ACCESS
-- EXCLUSIVE only on public.songs for the seed's duration — fine for an admin
-- migration; the re-enable is unconditional so the guard is never left off.
ALTER TABLE public.songs DISABLE TRIGGER songs_nonadmin_guard_trg;

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
(I've Had) The Time of My Life|Medley & Warnes
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
Mine|Taylor Swift
Enchanted|Taylor Swift
You Belong with Me|Taylor Swift
Fearless|Taylor Swift
Today Was a Fairytale|Taylor Swift
Paper Rings|Taylor Swift
Sparks Fly|Taylor Swift
Ours|Taylor Swift
Begin Again|Taylor Swift
Everything Has Changed|Taylor Swift
Invisible String|Taylor Swift
King of My Heart|Taylor Swift
New Year's Day|Taylor Swift
Daylight|Taylor Swift
Stay Stay Stay|Taylor Swift
Long Live|Taylor Swift
Speak Now|Taylor Swift
Willow|Taylor Swift
Wildest Dreams|Taylor Swift
Style|Taylor Swift
Delicate|Taylor Swift
ME!|Taylor Swift
Cardigan|Taylor Swift
Lavender Haze|Taylor Swift
Count on Me|Bruno Mars
Versace on the Floor|Bruno Mars
Talking to the Moon|Bruno Mars
It Will Rain|Bruno Mars
Treasure|Bruno Mars
When I Was Your Man|Bruno Mars
Rest of My Life|Bruno Mars
24K Magic|Bruno Mars
That's What I Like|Bruno Mars
Locked Out of Heaven|Bruno Mars
Uptown Funk|Mark Ronson & Bruno Mars
Leave the Door Open|Silk Sonic
Grenade|Bruno Mars
Our First Time|Bruno Mars
Beautiful Girl|Jose Mari Chan
Please Be Careful with My Heart|Jose Mari Chan
A Love to Last a Lifetime|Jose Mari Chan
So It's You|Basil Valdez
Ngayon at Kailanman|Basil Valdez
Panalangin|APO Hiking Society
When I Met You|APO Hiking Society
Ewan|APO Hiking Society
Sana Maulit Muli|Gary Valenciano
Each Passing Night|Gary Valenciano
Pangarap Ko Ang Ibigin Ka|Regine Velasquez
Your Song|Parokya ni Edgar
Harana|Parokya ni Edgar
So Slow|Freestyle
This Time|Freestyle
Before I Let You Go|Freestyle
Rainbow|South Border
Love of My Life|South Border
Hanggang Ngayon|Kyla
I'll Never Go|Erik Santos
This Is the Moment|Erik Santos
Dahil Sa'Yo|Iñigo Pascual
Binibini|Zack Tabudlo
Give Me Your Forever|Zack Tabudlo
Nangangamba|Zack Tabudlo
Leaves|Ben&Ben
Pagtingin|Ben&Ben
Lifetime|Ben&Ben
Sa Susunod na Habang Buhay|Ben&Ben
Sa Ngalan ng Pag-ibig|December Avenue
Kung 'Di Rin Lang Ikaw|December Avenue
Huling Sandali|December Avenue
Summer Song|Silent Sanctuary
214|Rivermaya
Minsan Lang Kita Iibigin|Ariel Rivera
Sana Kahit Minsan|Ariel Rivera
Ikaw at Ako|TJ Monterde
Sandali|TJ Monterde
Tulad Mo|TJ Monterde
Akin Ka Na Lang|Morissette
Buwan|Juan Karlos
Take All the Love|Arthur Nery
Tingin|Cup of Joe
Musika|Dionela
Pasilyo|SunKissed Lola
Dilaw|Maki
Mahika|Adie
Ikaw Lang|Nobita
Sinisinta|Over October
Tagpuan|Moira Dela Torre
Malaya|Moira Dela Torre
Babalik Sa'Yo|Moira Dela Torre
Tell Me Your Name|Christian Bautista
Bitiw|Sponge Cola
Could It Be|Raymond Lauchengco
Be My Lady|Martin Nievera
Maging Sino Ka Man|Rey Valera
Ligaya|Eraserheads
Tuloy Pa Rin|Neocolours
(Everything I Do) I Do It for You|Bryan Adams
Have You Ever Really Loved a Woman|Bryan Adams
You Are the Reason|Calum Scott
You're Beautiful|James Blunt
I Won't Give Up|Jason Mraz
Halo|Beyoncé
Love on Top|Beyoncé
Ordinary People|John Legend
Stay with You|John Legend
Tenerife Sea|Ed Sheeran
Haven't Met You Yet|Michael Bublé
On Bended Knee|Boyz II Men
Always and Forever|Heatwave
Let's Stay Together|Al Green
Lovely Day|Bill Withers
Just the Two of Us|Grover Washington Jr.
Here Comes the Sun|The Beatles
Something|The Beatles
In My Life|The Beatles
How Deep Is Your Love|Bee Gees
More Than Words|Extreme
Faithfully|Journey
Open Arms|Journey
I Want to Know What Love Is|Foreigner
You're the Inspiration|Chicago
Hard to Say I'm Sorry|Chicago
Hello|Lionel Richie
I Just Called to Say I Love You|Stevie Wonder
You Are the Sunshine of My Life|Stevie Wonder
I Will Always Love You|Whitney Houston
My Heart Will Go On|Celine Dion
To Love You More|Celine Dion
When I Fall in Love|Nat King Cole
Unforgettable|Nat King Cole
(They Long to Be) Close to You|The Carpenters
We've Only Just Begun|The Carpenters
Top of the World|The Carpenters
I Need to Know|Marc Anthony
Back at One|Brian McKnight
Marry Your Daughter|Brian McKnight
Dance with My Father|Luther Vandross
Like I'm Gonna Lose You|Meghan Trainor
There's Nothing Holdin' Me Back|Shawn Mendes
Señorita|Shawn Mendes & Camila Cabello
One Call Away|Charlie Puth
Marvin Gaye|Charlie Puth
Flying Without Wings|Westlife
My Love|Westlife
I Lay My Love on You|Westlife
If I Let You Go|Westlife
I Knew I Loved You|Savage Garden
Yellow|Coldplay
Something Just Like This|Coldplay
A Sky Full of Stars|Coldplay
Sugar|Maroon 5
She Will Be Loved|Maroon 5
Sunday Morning|Maroon 5
Through the Years|Kenny Rogers
Lady|Kenny Rogers
This Kiss|Faith Hill
Tennessee Whiskey|Chris Stapleton
Lovesong|Adele
The First Time Ever I Saw Your Face|Roberta Flack
When a Man Loves a Woman|Percy Sledge
What a Wonderful World|Louis Armstrong
La Vie en Rose|Louis Armstrong
Come Away with Me|Norah Jones
From the Start|Laufey
From the Ground Up|Dan + Shay
The Joker and the Queen|Ed Sheeran & Taylor Swift
Our Song|Taylor Swift
Fifteen|Taylor Swift
The Best Day|Taylor Swift
Sweet Nothing|Taylor Swift
Finesse|Bruno Mars
Smokin Out the Window|Silk Sonic
Today My Life Begins|Bruno Mars
Marikit|Juan Caoile & Kyle Zagado
Sila|SUD
Sundo|Imago
Akap|Imago
Jopay|Mayonnaise
Kahit Isang Saglit|Martin Nievera
Forever's Not Enough|Sarah Geronimo
Till I Met You|Angeline Quinto
Pantropiko|BINI
Salamin, Salamin|BINI
Ere|Juan Karlos
Imahe|Magnus Haven
Multo|Cup of Joe
Uhaw|Dilaw
Kiss Me|Sixpence None the Richer
Kiss Me|Ed Sheeran
I Get to Love You|Ruelle
Yours|Russell Dickerson
Bless the Broken Road|Rascal Flatts
My Wish|Rascal Flatts
I Cross My Heart|George Strait
Now and Forever|Richard Marx
Glory of Love|Peter Cetera
You and Me|Lifehouse
Chasing Cars|Snow Patrol
I Choose You|Sara Bareilles
I Do|Colbie Caillat
Just a Kiss|Lady A
Sea of Love|Cannons
The Night We Met|Lord Huron
Make You Mine|PUBLIC
Golden Hour|JVKE
Beautiful Things|Benson Boone
I Wanna Be Yours|Arctic Monkeys
505|Arctic Monkeys
Sunsetz|Cigarettes After Sex
Sweet|Cigarettes After Sex
Apocalypse|Cigarettes After Sex
Heavenly|Cigarettes After Sex
I Like Me Better|Lauv
Paris in the Rain|Lauv
Watermelon Sugar|Harry Styles
Late Night Talking|Harry Styles
Sweet Creature|Harry Styles
Falling Like the Stars|James Arthur
Naked|James Arthur
Can I Be Him|James Arthur
Cupid|FIFTY FIFTY
Beautiful|Bazzi
Mine|Bazzi
Electric Love|BØRNS
Angel|Jack Johnson
Banana Pancakes|Jack Johnson
Get You|Daniel Caesar
Always|Daniel Caesar
Pink + White|Frank Ocean
Love Someone|Lukas Graham
7 Years|Lukas Graham
Dive|Ed Sheeran
Shivers|Ed Sheeran
Hold On|Chord Overstreet
Heaven|Kane Brown
Thank God|Kane Brown & Katelyn Brown
Forever After All|Luke Combs
The Kind of Love We Make|Luke Combs
Forever and Ever, Amen|Randy Travis
It's Your Love|Tim McGraw & Faith Hill
My Best Friend|Tim McGraw
Lover of Mine|5 Seconds of Summer
This Town|Niall Horan
Lost Without You|Freya Ridings
Like Crazy|Jimin
Beside You|keshi
Valentine|Laufey
Sofia|Clairo
Can I Call You Tonight?|Dayglow
Strawberries & Cigarettes|Troye Sivan
The One|Kodaline
Love You Anymore|Michael Bublé
My Universe|Coldplay & BTS
Heat Waves|Glass Animals
Cigarette Daydreams|Cage the Elephant
Ophelia|The Lumineers
Ho Hey|The Lumineers
Sure Thing|Miguel
Adorn|Miguel
Sweet Disposition|The Temper Trap
About You|The 1975
Fallingforyou|The 1975
Robbers|The 1975
Work Song|Hozier
Like Real People Do|Hozier
Someone New|Hozier
Sweater Weather|The Neighbourhood
Tennessee Orange|Megan Moroney
Palagi|TJ Monterde
With You|TJ Monterde
Habang Buhay|Zack Tabudlo
Pano|Zack Tabudlo
Misteryoso|Cup of Joe
Patutunguhan|Cup of Joe
Estranghero|Cup of Joe
Maginhawa|Janine Teñoso
Dahan|Daniel Padilla
Nasa Iyo Na Ang Lahat|Daniel Padilla
Higa|Arthur Nery
Kundiman|Silent Sanctuary
Saan|Matthaios
Dito|SB19
Mapa|SB19
Tibok|Mayonnaise
Liwanag sa Dilim|Rivermaya
You'll Be Safe Here|Rivermaya
Selos|Shaira
Bumigay|Rob Deniel
Risk It All|Bruno Mars
$songs$), E'\n')) AS l
WHERE btrim(l) <> '' AND l LIKE '%|%'
ON CONFLICT (normalized_key) DO NOTHING;

-- Defensive: ensure every source='seed' row is flagged curated (a no-op if the
-- foundation seed already did, but covers a re-run where the trigger had earlier
-- stripped the flag). Still inside the trigger-disabled window so it sticks.
UPDATE public.songs
   SET is_curated_pick = TRUE
 WHERE source = 'seed' AND is_curated_pick IS DISTINCT FROM TRUE;

-- Re-enable the guard — unconditional, so the non-admin INSERT/UPDATE protection
-- is restored even if the seed above changes in future.
ALTER TABLE public.songs ENABLE TRIGGER songs_nonadmin_guard_trg;
