/**
 * SETS — the band's own view of the night. (Song Desk PR 5, the last of the stream)
 *
 * Owner, verbatim 2026-07-27: *"this is where we can set songlist for different
 * sets. so the band can set 1/2/3/4/5/6 sets, and name the x number of songs per
 * set."* A band thinks in sets — "Set 2, dinner, eight songs" — not in positions 9
 * through 16 of a flat list.
 *
 * ── WHAT THE TWO OWNER ANSWERS DELETED FROM THIS MODULE ────────────────────
 *
 * Both of PR 5's blocking questions were answered 2026-07-30, and each answer
 * removed work rather than adding it:
 *
 *   • requests are ALWAYS ON, not a mode ⇒ no "only during the sets I choose",
 *     so a set has NO relationship to the request window at all;
 *   • an accepted request is NOT filed into a set ⇒ no `fromRequestId`, no
 *     set-picker in the accept flow. "Accept means we'll play it", full stop.
 *
 * ── THE ANCHOR IS THE HOST'S VOCABULARY ────────────────────────────────────
 *
 * 🚨 Each set carries a `slot_type` from `PlaylistSlotType` — the SAME eleven
 * values the couple's playlist uses. The contract's warning is the design: if the
 * band's sets say "After Party" while the host's picks say `open_floor`, the two
 * lists can never be compared, which destroys the point of having both. The set's
 * `name` is the band's own label and is never parsed or matched on.
 *
 * PURE, NO I/O — same reason as `lib/song-desk.ts`: the interesting part is a
 * decision (which host picks does this set cover, and which of them can this act
 * actually play), and a decision is only trustworthy when a test holds it down.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Song } from '@/lib/songs';
import { PLAYLIST_SLOT_LABELS, type PlaylistSlotType } from '@/lib/playlist';

/** The hard bound from the owner's brief: "1/2/3/4/5/6 sets". */
export const MAX_SETS = 6;

/** One song a band placed in a set, by hand. */
export type SetSong = {
  setSongId: string;
  songId: number;
  title: string;
  /** May be '' — the catalogue row may carry no artist. */
  artist: string;
  position: number;
};

/** A set as stored. */
export type VendorSetRow = {
  set_id: string;
  position: number;
  name: string;
  slot_type: PlaylistSlotType;
};

/** A set as the desk renders it. */
export type VendorSet = {
  setId: string;
  position: number;
  /** The band's own label ("Slow burn"). */
  name: string;
  slot: PlaylistSlotType;
  /** The couple-facing name of the moment this set covers. */
  slotLabel: string;
  songs: SetSong[];
  /**
   * Songs the COUPLE asked for in this set's moment that the set does not
   * contain yet.
   *
   * ⚠ This is the entire reason a set carries a `slot_type`. Without the shared
   * vocabulary the two lists sit side by side and no one can tell whether the
   * band's "Slow burn" actually covers what the couple asked for at dinner.
   * Titles, not ids, because the host's picks are free text the couple typed —
   * they may name a song that is not in the catalogue at all.
   */
  missingFromHost: string[];
};

/**
 * Build the band's sets, each crossed against the couple's picks for its moment.
 *
 * Tolerant like the rest of the desk: any list may be null, ragged rows are
 * dropped, and a set with no songs is still a set (a band names its sets before
 * filling them).
 */
export function buildVendorSets(input: {
  sets: readonly VendorSetRow[] | null | undefined;
  /** All set songs across all of this act's sets, joined to the catalogue. */
  setSongs: readonly (SetSong & { setId: string })[] | null | undefined;
  /** The couple's per-moment picks, already grouped — `groupPicksBySlot`. */
  hostPicksBySlot: Partial<Record<PlaylistSlotType, { song_label: string; song_id: number | null }[]>>;
}): VendorSet[] {
  const songsBySet = new Map<string, SetSong[]>();
  for (const s of input.setSongs ?? []) {
    if (!s || typeof s.setId !== 'string' || typeof s.songId !== 'number') continue;
    const bucket = songsBySet.get(s.setId);
    const entry: SetSong = {
      setSongId: s.setSongId,
      songId: s.songId,
      title: s.title,
      artist: s.artist ?? '',
      position: s.position,
    };
    if (bucket) bucket.push(entry);
    else songsBySet.set(s.setId, [entry]);
  }

  const out: VendorSet[] = [];
  for (const row of input.sets ?? []) {
    if (!row || typeof row.set_id !== 'string') continue;
    if (!(row.slot_type in PLAYLIST_SLOT_LABELS)) continue; // a slot we don't know isn't renderable
    const songs = (songsBySet.get(row.set_id) ?? []).sort(
      (a, b) => a.position - b.position || a.title.localeCompare(b.title),
    );

    const placedIds = new Set(songs.map((s) => s.songId));
    const placedTitles = new Set(songs.map((s) => s.title.trim().toLowerCase()));
    const hostPicks = input.hostPicksBySlot[row.slot_type] ?? [];
    const missingFromHost: string[] = [];
    for (const pick of hostPicks) {
      if (!pick || typeof pick.song_label !== 'string') continue;
      // Resolved id first (PR 3 gave playlist picks one), then the title — the
      // same two-pass shape the repertoire crossing uses, for the same reason: a
      // pick the couple typed may never have resolved.
      if (typeof pick.song_id === 'number' && placedIds.has(pick.song_id)) continue;
      if (placedTitles.has(pick.song_label.trim().toLowerCase())) continue;
      missingFromHost.push(pick.song_label.trim());
    }

    out.push({
      setId: row.set_id,
      position: row.position,
      name: row.name,
      slot: row.slot_type,
      slotLabel: PLAYLIST_SLOT_LABELS[row.slot_type],
      songs,
      missingFromHost,
    });
  }

  // Set order is the band's own numbering — 1 through 6, the running order of
  // the night as they play it.
  return out.sort((a, b) => a.position - b.position);
}

/**
 * The next free set number, or null when the band already has six.
 *
 * Returns the lowest UNUSED position rather than max+1, so deleting Set 3 of 4
 * and adding again refills the gap instead of jumping to 5 — a band renumbering
 * their night by hand is not a thing anyone should have to do.
 */
export function nextSetPosition(existing: readonly { position: number }[] | null | undefined): number | null {
  const taken = new Set((existing ?? []).map((s) => s.position));
  for (let i = 1; i <= MAX_SETS; i += 1) {
    if (!taken.has(i)) return i;
  }
  return null;
}

/** Songs in the act's repertoire that are not yet in this set — the picker's list. */
export function repertoireAvailableForSet(input: {
  repertoire: readonly Song[] | null | undefined;
  setSongs: readonly SetSong[] | null | undefined;
}): Song[] {
  const placed = new Set((input.setSongs ?? []).map((s) => s.songId));
  const seen = new Set<number>();
  const out: Song[] = [];
  for (const s of input.repertoire ?? []) {
    if (!s || typeof s.song_id !== 'number' || !s.title) continue;
    if (placed.has(s.song_id) || seen.has(s.song_id)) continue;
    seen.add(s.song_id);
    out.push(s);
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/* ── The reads. Separate from the pure model above, same file because they are
 *    the only consumers of these two tables and splitting them would mean two
 *    files nobody can read without the other. ─────────────────────────────── */

/**
 * This act's sets for one booking, with their songs.
 *
 * Under the CALLER'S OWN client — RLS on both tables (migration 20271022422205)
 * admits the vendor org and day-of grantees, and a set is not the paid part, so
 * there is no entitlement question RLS cannot answer here. Returns empty on
 * denial or error: a band with no sets and a band who cannot read them both see
 * "no sets yet", and unlike the couple's playlist there is nothing here we would
 * otherwise assert about someone else.
 */
export async function fetchVendorEventSets(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<{ sets: VendorSetRow[]; songs: (SetSong & { setId: string })[] }> {
  const { data: setRows, error } = await supabase
    .from('vendor_event_sets')
    .select('set_id, position, name, slot_type')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .order('position', { ascending: true });
  if (error || !setRows || setRows.length === 0) {
    if (error) console.error('fetchVendorEventSets failed:', error.message);
    return { sets: [], songs: [] };
  }
  const sets = setRows as VendorSetRow[];

  const { data: songRows } = await supabase
    .from('vendor_event_set_songs')
    .select('set_song_id, set_id, position, song_id, songs(song_id, title, artist)')
    .in('set_id', sets.map((s) => s.set_id))
    .order('position', { ascending: true });

  const songs = ((songRows ?? []) as unknown[]).flatMap((row) => {
    const r = row as {
      set_song_id: string;
      set_id: string;
      position: number;
      song_id: number;
      songs: unknown;
    };
    const s = (Array.isArray(r.songs) ? r.songs[0] : r.songs) as
      | { title?: string; artist?: string }
      | undefined;
    const title = s?.title?.trim();
    if (!title) return []; // a set song whose catalogue row vanished is not renderable
    return [
      {
        setId: r.set_id,
        setSongId: r.set_song_id,
        songId: r.song_id,
        title,
        artist: s?.artist?.trim() ?? '',
        position: r.position,
      },
    ];
  });

  return { sets, songs };
}

/**
 * The same set list, read by the COUPLE for their own event (owner 2026-08-06).
 *
 * Two deliberate differences from `fetchVendorEventSets` above, and both matter:
 *
 * 1 · NO `vendor_profile_id` FILTER, and the column is SELECTED. A couple has no
 *     vendor id, and with several acts booked the caller must be able to tell
 *     whose set is whose — the vendor reader omits that column because a vendor
 *     is only ever reading their own.
 *
 * 2 · 🚨 IT REPORTS FAILURE INSTEAD OF SWALLOWING IT. `fetchVendorEventSets`
 *     returns `{sets:[],songs:[]}` on error by design, justified in its own
 *     docblock by "the vendor is reading their own". That justification does not
 *     transfer. Here a refused read and an empty set list are the SAME VALUE, and
 *     rendering the empty one would tell the couple "your band hasn't built a set
 *     list yet" — a confident, false claim about someone else's work, on the day
 *     they might be checking it. So `failed` comes back and the caller says
 *     "we couldn't load this" instead. Same contract as `fetchPlaylistPicks`.
 */
export async function fetchEventSetsForHost(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{
  sets: (VendorSetRow & { vendor_profile_id: string })[];
  songs: (SetSong & { setId: string })[];
  failed: boolean;
}> {
  const { data: setRows, error } = await supabase
    .from('vendor_event_sets')
    .select('set_id, position, name, slot_type, vendor_profile_id')
    .eq('event_id', eventId)
    .order('position', { ascending: true });

  if (error) {
    console.error('fetchEventSetsForHost failed:', error.message);
    return { sets: [], songs: [], failed: true };
  }
  const sets = (setRows ?? []) as (VendorSetRow & { vendor_profile_id: string })[];
  if (sets.length === 0) return { sets: [], songs: [], failed: false };

  const { data: songRows, error: songError } = await supabase
    .from('vendor_event_set_songs')
    .select('set_song_id, set_id, position, song_id, songs(song_id, title, artist)')
    .in(
      'set_id',
      sets.map((s) => s.set_id),
    )
    .order('position', { ascending: true });

  if (songError) {
    // The sets read but their songs did not. Showing set names with no songs
    // would read as "the band made empty sets", which is worse than saying so.
    console.error('fetchEventSetsForHost songs failed:', songError.message);
    return { sets: [], songs: [], failed: true };
  }

  const songs = ((songRows ?? []) as unknown[]).flatMap((row) => {
    const r = row as {
      set_song_id: string;
      set_id: string;
      position: number;
      song_id: number;
      songs: unknown;
    };
    const s = (Array.isArray(r.songs) ? r.songs[0] : r.songs) as
      | { title?: string; artist?: string }
      | undefined;
    const title = s?.title?.trim();
    if (!title) return []; // a set song whose catalogue row vanished is not renderable
    return [
      {
        setId: r.set_id,
        setSongId: r.set_song_id,
        songId: r.song_id,
        title,
        artist: s?.artist?.trim() ?? '',
        position: r.position,
      },
    ];
  });

  return { sets, songs, failed: false };
}
