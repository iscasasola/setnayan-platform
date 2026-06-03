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
