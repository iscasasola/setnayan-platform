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
  | 'prelude'
  | 'processional'
  | 'ceremony'
  | 'recessional'
  | 'grand_entrance'
  | 'cocktail_hour'
  | 'first_dance'
  | 'parents_dance'
  | 'dinner'
  | 'open_floor'
  | 'banned_songs';

/** Canonical render order · matches the wedding-day timeline (prelude first,
 *  banned_songs at the end, so the host scrolls through the day
 *  chronologically before the don't-play list).
 *
 *  ⚠ ELEVEN since 2026-07-30 (owner: "add all three" — migration
 *  20271022150821). `prelude` · `grand_entrance` · `recessional` were added
 *  because the shipped eight had no guest arrival, no couple-into-the-reception
 *  and no walk-out — the last of which couples were squeezing into `ceremony`.
 *  The DB enum is ordered to match, so raw SQL reads the night in sequence too.
 *
 *  ⚠⚠ ADDING A SLOT MEANS ADDING IT TO `groupPicksBySlot`'s Record literal as
 *  well. That function does `out[row.slot_type].push(row)` against a hardcoded
 *  object, so a slot it does not name dereferences `undefined` and THROWS. The
 *  `Record<PlaylistSlotType, …>` types below make `tsc` catch it; the Record
 *  inside that function is typed too, so extend the union FIRST and let the
 *  compiler walk you to every site. */
export const PLAYLIST_SLOT_TYPES: ReadonlyArray<PlaylistSlotType> = [
  'prelude',
  'processional',
  'ceremony',
  'recessional',
  'grand_entrance',
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
  prelude: 'Guest arrival',
  processional: 'Processional',
  ceremony: 'Ceremony',
  recessional: 'Recessional',
  grand_entrance: 'Grand entrance',
  cocktail_hour: 'Cocktail hour',
  first_dance: 'First dance',
  parents_dance: 'Parents dance',
  dinner: 'Dinner',
  open_floor: 'Open floor',
  banned_songs: "Don't play these",
};

/** Per-slot helper copy for the empty state. */
export const PLAYLIST_SLOT_HINTS: Record<PlaylistSlotType, string> = {
  prelude:
    'What plays while guests find their seats, before anything begins. Soft and unhurried — nobody is listening yet, and that is the point.',
  recessional:
    'The walk back out, married. Most couples pick something brighter than they came in to — this is the first minute of the celebration.',
  grand_entrance:
    'Your entrance into the reception. The one moment the whole room is standing and looking at the door, so pick the song you want that memory attached to.',
  processional:
    "Your bridal entrance music. Most couples pick one anthem — a song that signals 'here she comes.'",
  ceremony:
    'Music during the ceremony itself — readings, the signing, the candle and veil. 3–6 songs is typical. (The walk out has its own moment now.)',
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

/* ══════════════════════════════════════════════════════════════════════════
 * THE VIBE PER MOMENT  (Song Desk PR 4 · owner-locked 2026-07-30)
 *
 * A couple who cannot name songs for dinner can still say "jazz". The six names
 * are FROZEN exactly as the artwork that already shipped reads them
 * (`public/onboarding/prefs/music_{acoustic,classical,jazz,opm,pop,showband}.webp`
 * — which was, per RULE 0, the only thing that existed: no enum, no column, no
 * reader anywhere in `lib` or `app`).
 *
 * ALONGSIDE the picks, never instead of them. The owner's own example is a slot
 * carrying both: *"jazz for dinner, but you must play Through the Years."* So this
 * is a separate sparse table (`event_playlist_slot_vibes`), not a column on a pick
 * row and not a rival list — a moment may have a vibe with no songs, songs with
 * no vibe, or both.
 *
 * NO SEVENTH VALUE FOR "let the band decide" — the owner declined it, and rightly:
 * the ABSENCE of a vibe already means exactly that, so spending a value on it
 * would create two ways to say one thing.
 * ══════════════════════════════════════════════════════════════════════════ */

export type PlaylistVibe = 'acoustic' | 'classical' | 'jazz' | 'opm' | 'pop' | 'showband';

/** Render order — acoustic→showband, quietest to loudest, which is how a couple
 *  scans them. Matches the CHECK constraint in migration 20271022150821. */
export const PLAYLIST_VIBES: ReadonlyArray<PlaylistVibe> = [
  'acoustic',
  'classical',
  'jazz',
  'opm',
  'pop',
  'showband',
];

/** Couple-facing labels. "OPM" stays capitalised — it is an acronym every
 *  Filipino couple reads instantly, and spelling it out would be condescending. */
export const PLAYLIST_VIBE_LABELS: Record<PlaylistVibe, string> = {
  acoustic: 'Acoustic',
  classical: 'Classical',
  jazz: 'Jazz',
  opm: 'OPM',
  pop: 'Pop',
  showband: 'Showband',
};

/** One vibe per moment, or nothing. Absent key = the couple said nothing. */
export type SlotVibeMap = Partial<Record<PlaylistSlotType, PlaylistVibe>>;

const VALID_VIBES = new Set<string>(PLAYLIST_VIBES);
const VALID_SLOTS_FOR_VIBE = new Set<string>(PLAYLIST_SLOT_TYPES);

/**
 * Read the couple's vibe per moment for one event.
 *
 * Returns `{}` on denial or error — and unlike a playlist read, that conflation is
 * safe here: a vibe is decoration on top of the picks, so "we could not load the
 * vibes" and "they set none" lead to the same correct render (nothing). The picks
 * read is the one that must distinguish them, and it does
 * ({@link PlaylistPicksResult}).
 *
 * Rows carrying an unknown slot or vibe are dropped rather than trusted — the
 * table stores `slot_type` as TEXT (the migration could not reference the three
 * enum labels it had just added), so this reader is where that text is validated.
 */
export async function fetchSlotVibes(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SlotVibeMap> {
  const { data, error } = await supabase
    .from('event_playlist_slot_vibes')
    .select('slot_type, vibe')
    .eq('event_id', eventId);
  if (error || !data) {
    if (error) console.error('fetchSlotVibes failed:', error.message);
    return {};
  }
  const out: SlotVibeMap = {};
  for (const row of data as { slot_type: unknown; vibe: unknown }[]) {
    const slot = row.slot_type;
    const vibe = row.vibe;
    if (typeof slot !== 'string' || typeof vibe !== 'string') continue;
    if (!VALID_SLOTS_FOR_VIBE.has(slot) || !VALID_VIBES.has(vibe)) continue;
    out[slot as PlaylistSlotType] = vibe as PlaylistVibe;
  }
  return out;
}

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
  /**
   * OPTIONAL resolved catalogue identity, for CROSSING only (migration
   * 20271022319040). `song_label`/`artist` stay the display truth — nothing
   * renders from the joined row. NULL = uncatalogued, and every consumer keeps
   * its normalised-text fallback.
   */
  song_id: number | null;
};

const SELECT =
  'pick_id,public_id,event_id,slot_type,song_label,artist,notes,sort_order,created_by_user_id,created_at,updated_at,song_id';

/**
 * The result of a playlist read, with "denied" distinguishable from "empty".
 *
 * ⚠ THIS SHAPE EXISTS BECAUSE THE OLD ONE CAUSED A BUG. `fetchPlaylistPicks`
 * used to swallow every error into `[]`, which reads fine on the couple's own
 * editor — nothing to show is nothing to show — but the vendor song desk turned
 * that same empty array into a SENTENCE: *"they haven't set out the night moment
 * by moment yet."* Two RLS gaps (crew and day-of grantees, both fixed in
 * migration 20271020710612) meant the desk stated that confidently to the people
 * who most needed the list, and a swallowed error is why it read as a fact about
 * the couple instead of a failure on our side.
 *
 * So callers now get told which happened. `failed` is not "show an error page" —
 * it is "do not assert anything about what the couple did".
 */
export type PlaylistPicksResult = {
  rows: PlaylistPickRow[];
  /** The read errored or was denied. `rows` is empty but means nothing. */
  failed: boolean;
};

/** Fetch all playlist picks for an event · ordered by slot then sort_order.
 *  Never throws: a failed read comes back as `{ rows: [], failed: true }` so a
 *  day-of surface can degrade without claiming the couple did nothing. */
export async function fetchPlaylistPicks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PlaylistPicksResult> {
  const { data, error } = await supabase
    .from('event_playlist_picks')
    .select(SELECT)
    .eq('event_id', eventId)
    .order('slot_type', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) {
    // Couple side and music-vendor side both hit RLS · log only · don't throw.
    console.error('fetchPlaylistPicks failed:', error.message);
    return { rows: [], failed: true };
  }
  return { rows: (data ?? []) as PlaylistPickRow[], failed: false };
}

/** Group picks by slot for render. Picks within a slot stay sort_order-
 *  ordered from the fetch. Slots with no picks return an empty array. */
export function groupPicksBySlot(
  rows: ReadonlyArray<PlaylistPickRow>,
): Record<PlaylistSlotType, PlaylistPickRow[]> {
  // Built FROM the canonical list rather than hand-written. The old hand-written
  // literal was the trap flagged for PR 6: `out[row.slot_type].push(row)` against
  // an object missing a slot dereferences `undefined` and THROWS — so adding a
  // slot to the enum while forgetting this object would have crashed the couple's
  // playlist studio on the first grand-entrance pick, and crashed it at render
  // rather than showing an empty section. Deriving the keys makes that
  // impossible for every slot added after this one.
  const out = Object.fromEntries(
    PLAYLIST_SLOT_TYPES.map((slot) => [slot, [] as PlaylistPickRow[]]),
  ) as Record<PlaylistSlotType, PlaylistPickRow[]>;
  for (const row of rows) {
    // Still guarded: a row carrying a slot outside the known set (a stale client,
    // a hand-written SQL insert) is dropped rather than thrown on. A day-of
    // surface must not die on one ragged row.
    out[row.slot_type]?.push(row);
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
