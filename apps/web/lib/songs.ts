import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Master song list + vendor repertoire helpers.
 *
 * Design: Vendor_Compatibility_and_Master_Songlist_2026-06-03 (corpus).
 * Schema: migration 20260731000000_master_song_list_foundation.sql —
 *   songs(song_id, title, artist, normalized_key UNIQUE, source, is_curated_pick)
 *   vendor_songs(vendor_profile_id, song_id)
 *
 * A band / singer / orchestra / DJ adds the songs they perform; new songs join
 * the deduped master catalogue. A couple's onboarding picks reference the same
 * master, so music-vendor compatibility = the overlap of the two sets.
 */

export type Song = { song_id: number; title: string; artist: string };

/**
 * A Song Bank row carrying the DB-cached iTunes preview/artwork (Song Bank §5.4,
 * migration 20260823000000). `previewUrl`/`artworkUrl` are present only once the
 * song has been looked up and cached; null until then (the client falls back to
 * a live iTunes JSONP lookup). The onboarding picker reads these so production
 * trends to near-zero live calls.
 */
export type SongBankRow = Song & {
  appleTrackId: number | null;
  previewUrl: string | null;
  artworkUrl: string | null;
};

type SongBankDbRow = {
  song_id: number;
  title: string;
  artist: string;
  apple_track_id: number | null;
  preview_url: string | null;
  artwork_url: string | null;
};

const SONG_BANK_COLS = 'song_id, title, artist, apple_track_id, preview_url, artwork_url';

function toSongBankRow(r: SongBankDbRow): SongBankRow {
  return {
    song_id: r.song_id,
    title: r.title,
    artist: r.artist,
    appleTrackId: r.apple_track_id,
    previewUrl: r.preview_url,
    artworkUrl: r.artwork_url,
  };
}

/**
 * Canonical taxonomy keys (the `program`-folder music tiles, `lib/taxonomy.ts`)
 * whose vendors perform a song repertoire. Choreographer / host-MC / performers
 * are `program` too but aren't song acts — excluded. The "Your repertoire"
 * surface is gated to vendors carrying at least one of these in `services[]`.
 */
export const MUSIC_CANONICALS: ReadonlySet<string> = new Set([
  'live_band',
  'choir',
  'orchestra',
  'wedding_singer',
  'dj',
]);

export function isMusicVendor(services: readonly string[] | null | undefined): boolean {
  return !!services?.some((s) => MUSIC_CANONICALS.has(s));
}

/**
 * The dedup key — must match the SQL generated column exactly:
 *   lower(btrim(title)) || '|' || lower(btrim(artist))
 */
function normalizedKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

/** A music vendor's saved repertoire (newest first). */
export async function fetchVendorSongs(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Song[]> {
  const { data, error } = await supabase
    .from('vendor_songs')
    .select('song_id, created_at, songs(song_id, title, artist)')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown[]).flatMap((row) => {
    const r = row as { songs: unknown };
    const s = (Array.isArray(r.songs) ? r.songs[0] : r.songs) as Song | undefined;
    return s ? [{ song_id: s.song_id, title: s.title, artist: s.artist }] : [];
  });
}

/** Search the master catalogue by title (public-read). Curated picks first. */
export async function searchSongs(supabase: SupabaseClient, q: string): Promise<Song[]> {
  const safe = q.replace(/[%,()]/g, ' ').trim();
  if (!safe) return [];
  const { data } = await supabase
    .from('songs')
    .select('song_id, title, artist')
    .ilike('title', `%${safe}%`)
    .order('is_curated_pick', { ascending: false })
    .order('title', { ascending: true })
    .limit(25);
  return (data ?? []) as Song[];
}

/** The curated picks (the seeded MUSIC100) — the default browse list. */
export async function fetchCuratedSongs(supabase: SupabaseClient): Promise<Song[]> {
  const { data } = await supabase
    .from('songs')
    .select('song_id, title, artist')
    .eq('is_curated_pick', true)
    .order('song_id', { ascending: true })
    .limit(60);
  return (data ?? []) as Song[];
}

// ── Song Bank picker reads (with the §5.4 iTunes cache) ──────────────────────
// The onboarding music step (Onboarding_Style_and_Song_Bank_2026-06-04 §5)
// browses + searches the master `songs` table — NOT a hardcoded array — and
// shows each song's cached preview/artwork when present. These return the cache
// columns so the client prefers them over a live iTunes lookup.

/** How many curated songs to hand the onboarding picker's default browse. The
 *  full 390-song seed is the catalogue; the picker preloads a generous slice
 *  (picked-jump-to-top + the ≥10 gate operate over what's loaded) and the search
 *  reaches the rest. */
export const SONG_BANK_CURATED_LIMIT = 390;

/** Curated browse list for the onboarding picker (seed songs), with iTunes
 *  cache. Ordered by song_id so the seed's deliberate ordering (top wedding
 *  songs first) is preserved. */
export async function fetchSongBankCurated(
  supabase: SupabaseClient,
  limit = SONG_BANK_CURATED_LIMIT,
): Promise<SongBankRow[]> {
  const { data } = await supabase
    .from('songs')
    .select(SONG_BANK_COLS)
    .eq('is_curated_pick', true)
    .order('song_id', { ascending: true })
    .limit(limit);
  return ((data ?? []) as SongBankDbRow[]).map(toSongBankRow);
}

/** Search the master catalogue by title OR artist (public-read), with the iTunes
 *  cache. Curated picks first, then alphabetical. Powers the onboarding Song Bank
 *  search box — searching the WHOLE bank, not just the curated slice. */
export async function searchSongBank(
  supabase: SupabaseClient,
  q: string,
  limit = 40,
): Promise<SongBankRow[]> {
  // Strip the PostgREST wildcard (`*`) too, not just `%`, so a literal one the
  // couple types can't widen the match.
  const safe = q.replace(/[%*,()]/g, ' ').trim();
  if (!safe) return [];
  // Title OR artist match — a couple may search "Bruno Mars" (artist) as readily
  // as a title. NOTE: a raw PostgREST `or()` string uses `*` as the ilike
  // wildcard, NOT `%` — a bare `%` here is treated literally / URL-mangled, so the
  // search returned NOTHING. (The single-column `.ilike()` method elsewhere can
  // use `%`; only the raw `.or()` filter needs `*`.)
  const { data } = await supabase
    .from('songs')
    .select(SONG_BANK_COLS)
    .or(`title.ilike.*${safe}*,artist.ilike.*${safe}*`)
    .order('is_curated_pick', { ascending: false })
    .order('title', { ascending: true })
    .limit(limit);
  return ((data ?? []) as SongBankDbRow[]).map(toSongBankRow);
}

/**
 * Cache a song's resolved iTunes preview/artwork onto its master row (Song Bank
 * §5.4). Called the first time a song is looked up live so every later
 * user/session reads the cache instead of hitting iTunes — production trends to
 * near-zero live calls. Resolves the row by normalized_key and UPDATEs only the
 * three cache columns; it does NOT create a song (the picker only shows seeded
 * songs, which already exist) and never overwrites an existing cache. MUST run
 * with a service-role (admin) client — the `songs` UPDATE policy is admin-only.
 * Best-effort: returns silently on any miss/error (caching must never disrupt
 * the picker).
 */
export async function cacheSongItunes(
  admin: SupabaseClient,
  input: { title: string; artist: string; appleTrackId: number | null; previewUrl: string; artworkUrl: string },
): Promise<void> {
  const title = input.title.trim();
  const artist = input.artist.trim();
  if (!title || !input.previewUrl) return;
  const nk = normalizedKey(title, artist);

  // Only cache a song that already exists AND isn't cached yet (idempotent — a
  // race or a re-lookup is a no-op). One round-trip find, one conditional update.
  const { data: found } = await admin
    .from('songs')
    .select('song_id, preview_url')
    .eq('normalized_key', nk)
    .maybeSingle();
  if (!found?.song_id || (found as { preview_url: string | null }).preview_url) return;

  await admin
    .from('songs')
    .update({
      apple_track_id: input.appleTrackId && input.appleTrackId > 0 ? input.appleTrackId : null,
      preview_url: input.previewUrl,
      artwork_url: input.artworkUrl || null,
    })
    .eq('song_id', found.song_id)
    .is('preview_url', null); // don't clobber a value written by a concurrent caller
}

/**
 * Resolve a song to its master `song_id`, creating it if new. Uses
 * select-then-insert (NOT upsert-on-conflict): the `songs` UPDATE policy is
 * admin-only, so an upsert that fell through to DO UPDATE would be RLS-denied.
 * `songs` allows authenticated INSERT (deduped by the normalized_key unique
 * index + the non-admin guard trigger forcing source='vendor'). Returns null
 * on empty title or an unrecoverable error.
 */
export async function findOrCreateSongId(
  supabase: SupabaseClient,
  title: string,
  artist: string,
): Promise<number | null> {
  const t = title.trim();
  const a = artist.trim();
  if (!t) return null;
  const nk = normalizedKey(t, a);

  const { data: found } = await supabase
    .from('songs')
    .select('song_id')
    .eq('normalized_key', nk)
    .maybeSingle();
  if (found?.song_id) return found.song_id as number;

  const { data: inserted } = await supabase
    .from('songs')
    .insert({ title: t, artist: a })
    .select('song_id')
    .maybeSingle();
  if (inserted?.song_id) return inserted.song_id as number;

  // Insert lost a race (another vendor added the same song) → re-select.
  const { data: again } = await supabase
    .from('songs')
    .select('song_id')
    .eq('normalized_key', nk)
    .maybeSingle();
  return (again?.song_id as number) ?? null;
}

/**
 * Sync a couple's chosen songs (the onboarding "Title|Artist" picks) into
 * event_song_picks — the couple side of the music compatibility overlap. Each
 * label resolves to (or creates) a master song; picks upsert idempotently.
 * Intended to run with a service-role client during the onboarding commit
 * (RLS bypass) — and to be wrapped by the caller so it can never fail the
 * commit (e.g. before migration 20260731000000 is pushed).
 */
export async function syncEventSongPicks(
  client: SupabaseClient,
  eventId: string,
  picks: readonly string[],
): Promise<void> {
  if (!picks?.length) return;
  const rows: { event_id: string; song_id: number; source: string }[] = [];
  for (const lbl of picks) {
    if (typeof lbl !== 'string' || !lbl.includes('|')) continue;
    const [title, artist = ''] = lbl.split('|');
    const songId = await findOrCreateSongId(client, title ?? '', artist);
    if (songId) rows.push({ event_id: eventId, song_id: songId, source: 'onboarding' });
  }
  if (!rows.length) return;
  await client
    .from('event_song_picks')
    .upsert(rows, { onConflict: 'event_id,song_id', ignoreDuplicates: true });
}

/** The couple's chosen song_ids (the match query set). Empty on no picks / error. */
export async function fetchEventSongPickIds(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from('event_song_picks')
    .select('song_id')
    .eq('event_id', eventId);
  if (error || !data) return [];
  return (data as { song_id: number }[]).map((r) => r.song_id);
}

/**
 * Per-vendor count of how many of `pickIds` each vendor performs — the music
 * compatibility overlap numerator. One batched query (vendors × picks both
 * bounded), so cheap even for a 100-vendor candidate pool. Vendors with no
 * matching repertoire are simply absent from the map (caller treats as 0).
 */
export async function fetchVendorSongOverlaps(
  supabase: SupabaseClient,
  vendorIds: readonly string[],
  pickIds: readonly number[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!vendorIds.length || !pickIds.length) return out;
  const { data, error } = await supabase
    .from('vendor_songs')
    .select('vendor_profile_id, song_id')
    .in('vendor_profile_id', vendorIds as string[])
    .in('song_id', pickIds as number[]);
  if (error || !data) return out;
  for (const r of data as { vendor_profile_id: string }[]) {
    out.set(r.vendor_profile_id, (out.get(r.vendor_profile_id) ?? 0) + 1);
  }
  return out;
}

// ── Admin dedup / merge (the 0023 master-catalogue hygiene tool) ──────────────

export type AdminSong = {
  song_id: number;
  title: string;
  artist: string;
  source: string;
  is_curated_pick: boolean;
};

/** Admin master-catalogue list, searchable by title (all sources/flags shown). */
export async function fetchSongsAdmin(
  supabase: SupabaseClient,
  q: string,
): Promise<AdminSong[]> {
  let query = supabase
    .from('songs')
    .select('song_id, title, artist, source, is_curated_pick')
    .order('title', { ascending: true })
    .limit(150);
  const safe = q.replace(/[%,()]/g, ' ').trim();
  if (safe) query = query.ilike('title', `%${safe}%`);
  const { data } = await query;
  return (data ?? []) as AdminSong[];
}

/**
 * Merge a duplicate master song into the canonical one: re-point every vendor
 * repertoire + couple pick from `dupId` to `canonicalId` (idempotent — skips
 * links the target already has), then delete the now-orphaned dup row. Run with
 * a service-role client (the `songs` DELETE policy is admin-only; this bypasses
 * RLS). Sequential rather than a SQL function to avoid another migration — safe
 * to re-run if interrupted.
 */
export async function mergeSongs(
  admin: SupabaseClient,
  dupId: number,
  canonicalId: number,
): Promise<void> {
  if (dupId === canonicalId) return;

  const { data: vs } = await admin
    .from('vendor_songs')
    .select('vendor_profile_id')
    .eq('song_id', dupId);
  if (vs && vs.length) {
    await admin.from('vendor_songs').upsert(
      (vs as { vendor_profile_id: string }[]).map((r) => ({
        vendor_profile_id: r.vendor_profile_id,
        song_id: canonicalId,
      })),
      { onConflict: 'vendor_profile_id,song_id', ignoreDuplicates: true },
    );
    await admin.from('vendor_songs').delete().eq('song_id', dupId);
  }

  const { data: ep } = await admin
    .from('event_song_picks')
    .select('event_id, source')
    .eq('song_id', dupId);
  if (ep && ep.length) {
    await admin.from('event_song_picks').upsert(
      (ep as { event_id: string; source: string }[]).map((r) => ({
        event_id: r.event_id,
        song_id: canonicalId,
        source: r.source,
      })),
      { onConflict: 'event_id,song_id', ignoreDuplicates: true },
    );
    await admin.from('event_song_picks').delete().eq('song_id', dupId);
  }

  await admin.from('songs').delete().eq('song_id', dupId);
}
