import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Playlist Builder lib · types + helpers for the couple-built song list
 * that syncs to the booked DJ/band's per-vendor workspace.
 *
 * Owner directive 2026-05-24 · "create your song list" = playlist builder
 * for the booked DJ/band (NOT Pakanta · the custom songwriter SKU). Free
 * utility · couples pick songs by slot · vendor reads through the
 * music-vendor RLS policy on event_playlist_picks.
 *
 * 7 canonical slot types follow the PH wedding-day spine:
 *   processional → ceremony → cocktail_hour → first_dance → parents_dance
 *   → dinner → open_floor → banned_songs
 *
 * Banned songs is the only "anti-pick" slot · the rest are positive picks.
 */

export type PlaylistSlotType =
  | 'processional'
  | 'ceremony'
  | 'cocktail_hour'
  | 'first_dance'
  | 'parents_dance'
  | 'dinner'
  | 'open_floor'
  | 'banned_songs';

/** Canonical render order · matches the wedding-day timeline (processional
 *  before banned_songs at the end, so the host scrolls through the day
 *  chronologically before the don't-play list). */
export const PLAYLIST_SLOT_TYPES: ReadonlyArray<PlaylistSlotType> = [
  'processional',
  'ceremony',
  'cocktail_hour',
  'first_dance',
  'parents_dance',
  'dinner',
  'open_floor',
  'banned_songs',
];

/** Friendly display labels per slot. Polite editorial voice per
 *  [[feedback_setnayan_no_dev_text_post_launch]] · no engineering jargon. */
export const PLAYLIST_SLOT_LABELS: Record<PlaylistSlotType, string> = {
  processional: 'Processional',
  ceremony: 'Ceremony',
  cocktail_hour: 'Cocktail hour',
  first_dance: 'First dance',
  parents_dance: 'Parents dance',
  dinner: 'Dinner',
  open_floor: 'Open floor',
  banned_songs: "Don't play these",
};

/** Per-slot helper copy for the empty state. */
export const PLAYLIST_SLOT_HINTS: Record<PlaylistSlotType, string> = {
  processional:
    "Your bridal entrance music. Most couples pick one anthem — a song that signals 'here she comes.'",
  ceremony:
    'Music during the ceremony itself — readings, signing of the contract, recessional. 3–6 songs is typical.',
  cocktail_hour:
    'Background playlist while guests gather, drink, and find their seats. Keep it bright and conversational.',
  first_dance:
    'The couple\'s first dance song. Most pick one; some pick two and choreograph a transition.',
  parents_dance:
    'Father-daughter and mother-son dances. Pick one each, or pick a single song that covers both.',
  dinner:
    'Music while everyone eats. Slower and quieter than the open-floor playlist.',
  open_floor:
    'The main dance-floor playlist. As long or short as you want — your DJ fills any gaps with crowd-readers.',
  banned_songs:
    "Songs you do NOT want played. Ex's wedding song, that one cheesy 90s ballad, anything off-vibe. Be specific.",
};

export type PlaylistPickRow = {
  pick_id: string;
  public_id: string;
  event_id: string;
  slot_type: PlaylistSlotType;
  song_label: string;
  artist: string | null;
  notes: string | null;
  sort_order: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

const SELECT =
  'pick_id,public_id,event_id,slot_type,song_label,artist,notes,sort_order,created_by_user_id,created_at,updated_at';

/** Fetch all playlist picks for an event · ordered by slot then sort_order.
 *  Returns an empty array on RLS denial or query error · the editor
 *  surface renders cleanly with empty per-slot sections. */
export async function fetchPlaylistPicks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PlaylistPickRow[]> {
  const { data, error } = await supabase
    .from('event_playlist_picks')
    .select(SELECT)
    .eq('event_id', eventId)
    .order('slot_type', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) {
    // Couple side and music-vendor side both hit RLS · log only · don't
    // throw. Empty array degrades cleanly.
    console.error('fetchPlaylistPicks failed:', error.message);
    return [];
  }
  return (data ?? []) as PlaylistPickRow[];
}

/** Group picks by slot for render. Picks within a slot stay sort_order-
 *  ordered from the fetch. Slots with no picks return an empty array. */
export function groupPicksBySlot(
  rows: ReadonlyArray<PlaylistPickRow>,
): Record<PlaylistSlotType, PlaylistPickRow[]> {
  const out: Record<PlaylistSlotType, PlaylistPickRow[]> = {
    processional: [],
    ceremony: [],
    cocktail_hour: [],
    first_dance: [],
    parents_dance: [],
    dinner: [],
    open_floor: [],
    banned_songs: [],
  };
  for (const row of rows) {
    out[row.slot_type].push(row);
  }
  return out;
}

/** Total pick count across all slots EXCEPT banned_songs. Used by the
 *  add-ons grid tile + by the music-vendor workspace summary chip
 *  ("{N} songs picked" feels off-tone if "Don't play these" picks count
 *  too — banned songs are anti-picks). */
export function countPositivePicks(
  rows: ReadonlyArray<PlaylistPickRow>,
): number {
  return rows.filter((r) => r.slot_type !== 'banned_songs').length;
}
