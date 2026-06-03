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
