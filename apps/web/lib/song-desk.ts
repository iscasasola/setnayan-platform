/**
 * THE SONG DESK — the decision behind the music act's day-of specialization.
 *
 * Owner lock 2026-07-26: "band/singer/orchestra's song desk (requests · set
 * list · what's-next)". Two of those three were already on the live console
 * before this module existed, and rebuilding them would have been the defect,
 * not the deliverable:
 *
 *   • what's-next — `FloorClock` counts down to the next run-of-show block at
 *     the top of the console, and `RunOfShowHeader` renders the live timeline
 *     in the generic kit. Both are on the same screen, above this desk.
 *   • set list — the vendor's repertoire is authored at
 *     `/vendor-dashboard/repertoire`, and the generic kit's `setlist` module
 *     already links there. It stays in the generic kit on purpose (PR #3796:
 *     removing a live tool during free-during-launch is an owner call, not a
 *     build side effect).
 *
 * So the desk's real job is the ONE half that existed nowhere: the couple's
 * REQUESTS, and how they line up against what this act actually plays. Until
 * migration 20271013090000 a vendor could not read `event_song_picks` at all —
 * the band booked to play the songs was the one party who could not see them.
 *
 * WHAT THE DESK DECIDES. Crossing two song sets is trivial; the judgement is
 * which crossing a musician needs at 6pm on a venue floor, and in what order:
 *
 *   1. `gaps`     — REQUESTED, and you don't play it. The only actionable
 *                   group, so it sorts FIRST. Every minute before the set
 *                   starts is a minute to learn it, sub it, or tell the couple.
 *                   A desk that buried this under a tidy "your matches" list
 *                   would be decoration.
 *   2. `ready`    — requested AND in your repertoire. Your core set: what they
 *                   asked for and you can deliver. Confidence, not action.
 *   3. `spare`    — your repertoire, not requested. Filler for the gaps in the
 *                   program — deliberately last and deliberately not called
 *                   "unmatched", which would frame a working repertoire as a
 *                   failure.
 *
 * PURE, NO I/O. Same reason as `vendor-specialization-gate.ts` and
 * `vendor-dayof-frame.ts`: the interesting part is a decision, and a decision is
 * only trustworthy when a test can hold it down. The reads live in
 * `lib/songs.ts` (`fetchEventSongRequests` + `fetchVendorSongs`); the surface is
 * a thin renderer over {@link buildSongDesk}.
 *
 * THIS MODULE IS NOT A BOUNDARY. It receives two already-fetched lists. What a
 * vendor may READ is decided by RLS on `event_song_picks` / `vendor_songs`, not
 * here — hiding a row is not a boundary (2026-07-26 security review).
 *
 * SECOND MODEL, ADDED BY PR 2: {@link buildHostPlaylist} — the host's
 * moment-by-moment playlist (`event_playlist_picks`), which the band could not
 * see at all. Same repertoire, a different question, a fuzzier join; its own
 * banner further down explains why it is not just more rows on the first.
 */
import type { Song } from '@/lib/songs';
import {
  PLAYLIST_SLOT_LABELS,
  PLAYLIST_SLOT_TYPES,
  groupPicksBySlot,
  type PlaylistPickRow,
  type PlaylistSlotType,
} from '@/lib/playlist';

/** One song on the desk, with both sides of the crossing resolved. */
export type SongDeskEntry = {
  songId: number;
  title: string;
  /** May be empty — a couple can free-type a title with no artist. */
  artist: string;
  /** The couple asked for it. */
  requested: boolean;
  /** This act has it in their repertoire. */
  inRepertoire: boolean;
};

export type SongDeskModel = {
  /** Requested, NOT in the repertoire. Actionable → rendered first. */
  gaps: SongDeskEntry[];
  /** Requested AND in the repertoire. The core set. */
  ready: SongDeskEntry[];
  /** In the repertoire, not requested. Filler. */
  spare: SongDeskEntry[];
  /** How many songs the couple asked for. `gaps.length + ready.length`. */
  requestedCount: number;
  /** How many of those this act plays. `ready.length`. */
  coveredCount: number;
  /**
   * Whole-percent coverage of the couple's requests, 0–100.
   *
   * ZERO REQUESTS IS 100, NOT 0. A couple who picked no songs has had every one
   * of their requests met, vacuously — and a desk that greeted that act with
   * "0% covered" would be accusing them of failing a test nobody set. Callers
   * should still branch on `requestedCount === 0` for copy; this value is safe
   * either way and never divides by zero.
   */
  coveragePct: number;
  /** True when the couple has chosen no songs at all — drives the empty state. */
  noRequests: boolean;
};

/**
 * Build the desk from the couple's requests and the act's repertoire.
 *
 * Tolerant by construction: either list may be empty, null-ish entries are
 * dropped, and a song appearing twice on one side (or on both) is counted once.
 * A day-of surface must not throw on a ragged row — the floor is the worst place
 * to discover a bad join.
 */
export function buildSongDesk(input: {
  /** The couple's picks for this event — `fetchEventSongRequests`. */
  requests: readonly Song[] | null | undefined;
  /** This act's repertoire — `fetchVendorSongs`. */
  repertoire: readonly Song[] | null | undefined;
}): SongDeskModel {
  const requestedIds = new Set<number>();
  const repertoireIds = new Set<number>();
  // One record per song_id, so a duplicate on either side collapses instead of
  // rendering the same title twice.
  const byId = new Map<number, Song>();

  for (const s of input.requests ?? []) {
    if (!isSong(s)) continue;
    requestedIds.add(s.song_id);
    if (!byId.has(s.song_id)) byId.set(s.song_id, s);
  }
  for (const s of input.repertoire ?? []) {
    if (!isSong(s)) continue;
    repertoireIds.add(s.song_id);
    if (!byId.has(s.song_id)) byId.set(s.song_id, s);
  }

  const gaps: SongDeskEntry[] = [];
  const ready: SongDeskEntry[] = [];
  const spare: SongDeskEntry[] = [];

  for (const [songId, song] of byId) {
    const requested = requestedIds.has(songId);
    const inRepertoire = repertoireIds.has(songId);
    const entry: SongDeskEntry = {
      songId,
      title: song.title,
      artist: song.artist ?? '',
      requested,
      inRepertoire,
    };
    if (requested && !inRepertoire) gaps.push(entry);
    else if (requested) ready.push(entry);
    else spare.push(entry);
  }

  // Alphabetical within each group: the source rows carry no ordering the
  // couple or the act chose, so anything else would be arbitrary AND unstable
  // between renders.
  const byTitle = (a: SongDeskEntry, b: SongDeskEntry) => a.title.localeCompare(b.title);
  gaps.sort(byTitle);
  ready.sort(byTitle);
  spare.sort(byTitle);

  const requestedCount = requestedIds.size;
  const coveredCount = ready.length;

  return {
    gaps,
    ready,
    spare,
    requestedCount,
    coveredCount,
    // No requests → vacuously complete. See the field doc.
    coveragePct:
      requestedCount === 0 ? 100 : Math.round((coveredCount / requestedCount) * 100),
    noRequests: requestedCount === 0,
  };
}

/** Guards a row from a ragged join — a missing/!numeric id or absent title. */
function isSong(s: Song | null | undefined): s is Song {
  return (
    !!s &&
    typeof s.song_id === 'number' &&
    Number.isFinite(s.song_id) &&
    typeof s.title === 'string' &&
    s.title.length > 0
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE HOST'S PLAYLIST, READ BY THE BAND  (Song Desk PR 2)
 *
 * The owner's priority reorder, 2026-07-27: "let's make this helpful for the
 * host and the band first." The host has been able to build a moment-by-moment
 * playlist since iteration 0016 — processional, first dance, dinner, and a
 * "Don't play these" list — and the band booked to play it had no way to see it.
 * `event_playlist_picks_music_vendor_read` already existed (verified 2026-07-27,
 * migration 20260622000000), so this is a pure read: no migration, no policy.
 *
 * ── WHY THIS IS A SECOND MODEL AND NOT MORE ROWS ON THE FIRST ──────────────
 *
 * {@link buildSongDesk} crosses the couple's FLAT onboarding picks
 * (`event_song_picks` → resolved `song_id`s) against the repertoire. This
 * crosses the couple's PER-MOMENT picks (`event_playlist_picks` → free text)
 * against the same repertoire. Different shape, different join, different
 * question — "what do they want, and when" rather than "can we play what they
 * asked for". The two sources do not talk to each other yet; that is Song Desk
 * PR 3 (owner answered 2026-07-30: onboarding pre-fills the studio), and until
 * it lands a couple can genuinely have picks in one and nothing in the other.
 * The surface says so out loud rather than rendering a confusing empty section.
 *
 * ── THE JOIN IS FUZZY, AND THAT IS THE INTERESTING PART ────────────────────
 *
 * `event_playlist_picks` carries `song_label` + nullable `artist` as free text
 * typed by the couple — it never resolved to a `songs` row. The repertoire is
 * `songs` rows. So matching is by normalised text, mirroring the dedup key used
 * everywhere else (`lower(btrim(title)) || '|' || lower(btrim(artist))` — the
 * SQL generated column, `normalizedKey()` in lib/songs.ts, and
 * `resolve_song_id()`):
 *
 *   • both sides name an artist → they must agree.
 *   • either side leaves it blank → title alone decides, and the surface shows
 *     the MATCHED artist beside the pick so the musician can spot a wrong
 *     "Perfect" themselves. A blank artist is common (the studio does not
 *     require one), so refusing to match on it would report gaps that aren't.
 *
 * That relaxed rule is knowingly generous: a pick reading only "Perfect" matches
 * a repertoire "Perfect" by anybody. The alternative — reporting a gap the act
 * does not have — is worse on a night when the flagged rows are the ones they act
 * on, and showing the matched artist keeps the guess visible instead of silent.
 *
 * ── THE BANNED LIST IS CROSSED THE OTHER WAY UP ────────────────────────────
 *
 * For a normal moment the actionable state is "they asked and you DON'T play
 * it". For "Don't play these" it inverts: the hazard is a banned song you DO
 * play — the one row on this screen that can ruin a wedding. Same crossing,
 * opposite urgency, so `hazardCount` is its own number and the renderer flips
 * the emphasis rather than reusing the gap styling.
 * ══════════════════════════════════════════════════════════════════════════ */

/** One song on the host's playlist, resolved against this act's repertoire. */
export type HostPlaylistEntry = {
  /** `event_playlist_picks.pick_id` — stable React key. */
  pickId: string;
  /** What the couple typed. Never empty (the studio requires a label). */
  title: string;
  /** What the couple typed, or '' — the studio does not require an artist. */
  artist: string;
  /** The couple's note for this pick, or '' ("the acoustic version, please"). */
  notes: string;
  /** This act has it. For a banned song this is the hazard, not the win. */
  inRepertoire: boolean;
  /**
   * The artist on the MATCHED repertoire song, but only when the pick named
   * none and the match therefore rested on the title alone. '' otherwise —
   * including when the pick named an artist, since repeating it would be noise.
   */
  matchedArtist: string;
};

/** One moment of the night that actually has picks in it. */
export type HostPlaylistMoment = {
  slot: PlaylistSlotType;
  /** From `PLAYLIST_SLOT_LABELS` — the couple's own wording, not a re-spelling. */
  label: string;
  entries: HostPlaylistEntry[];
};

export type HostPlaylistModel = {
  /**
   * The night in order, `banned_songs` excluded and EMPTY MOMENTS DROPPED. The
   * couple's studio lists all slots because it is an authoring surface; a band
   * reading a phone on a venue floor does not need eight headings to learn that
   * six of them are blank.
   */
  moments: HostPlaylistMoment[];
  /** The "Don't play these" list, separate because it is an anti-pick. */
  banned: HostPlaylistEntry[];
  /** Picks across every real moment. Excludes the banned list. */
  positiveCount: number;
  /** Requested somewhere in the night, and this act does not play it. */
  gapCount: number;
  /** Banned AND in the repertoire — the row that can ruin a wedding. */
  hazardCount: number;
  /** No picks at all, in any slot. Drives the "not built yet" line. */
  isEmpty: boolean;
};

/**
 * Build the band's view of the host's playlist.
 *
 * Tolerant like {@link buildSongDesk}, for the same reason — the floor is the
 * worst place to discover a bad join. Either list may be null; a row with an
 * unknown `slot_type` or no label is dropped rather than thrown on.
 */
export function buildHostPlaylist(input: {
  /** The host's per-moment picks — `fetchPlaylistPicks`. */
  picks: readonly PlaylistPickRow[] | null | undefined;
  /** This act's repertoire — `fetchVendorSongs`. */
  repertoire: readonly Song[] | null | undefined;
}): HostPlaylistModel {
  const byTitle = indexRepertoireByTitle(input.repertoire);

  // Ragged rows out before grouping — see `isPick` for why it matters here.
  const usable: PlaylistPickRow[] = [];
  for (const p of input.picks ?? []) {
    if (isPick(p)) usable.push(p);
  }

  const grouped = groupPicksBySlot(usable);

  const moments: HostPlaylistMoment[] = [];
  let positiveCount = 0;
  let gapCount = 0;

  for (const slot of PLAYLIST_SLOT_TYPES) {
    if (slot === 'banned_songs') continue; // its own field — see below
    const rows = grouped[slot];
    if (rows.length === 0) continue; // empty moments are dropped, not rendered
    const entries = rows.map((row) => toEntry(row, byTitle));
    positiveCount += entries.length;
    gapCount += entries.filter((e) => !e.inRepertoire).length;
    moments.push({ slot, label: PLAYLIST_SLOT_LABELS[slot], entries });
  }

  const banned = grouped.banned_songs.map((row) => toEntry(row, byTitle));

  return {
    moments,
    banned,
    positiveCount,
    gapCount,
    hazardCount: banned.filter((e) => e.inRepertoire).length,
    isEmpty: positiveCount === 0 && banned.length === 0,
  };
}

/** Normalised half of the shared dedup key: `lower(btrim(x))`. */
function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Guards a playlist row from a ragged join. A slot outside the known set is
 * dropped rather than pushed into `groupPicksBySlot`'s fixed Record, where it
 * would throw. ⚠ Extending the slot list means extending that Record too — see
 * Song Desk PR 6.
 */
function isPick(p: PlaylistPickRow | null | undefined): p is PlaylistPickRow {
  return (
    !!p &&
    typeof p.slot_type === 'string' &&
    (PLAYLIST_SLOT_TYPES as readonly string[]).includes(p.slot_type) &&
    typeof p.song_label === 'string' &&
    p.song_label.trim().length > 0
  );
}

/**
 * Repertoire bucketed by normalised title — one bucket may hold several artists
 * ("Perfect" by both Ed Sheeran and One Direction).
 *
 * Each bucket is sorted by artist for the same reason `buildSongDesk` sorts its
 * groups: when a pick names no artist the title alone decides the match, and a
 * surface whose answer depends on row-fetch order is unstable between renders.
 */
function indexRepertoireByTitle(
  repertoire: readonly Song[] | null | undefined,
): Map<string, Song[]> {
  const out = new Map<string, Song[]>();
  for (const s of repertoire ?? []) {
    if (!isSong(s)) continue;
    const key = norm(s.title);
    const bucket = out.get(key);
    if (bucket) bucket.push(s);
    else out.set(key, [s]);
  }
  for (const bucket of out.values()) {
    bucket.sort((a, b) => (a.artist ?? '').localeCompare(b.artist ?? ''));
  }
  return out;
}

/** Resolve one pick against the repertoire index. See the artist rules above. */
function toEntry(row: PlaylistPickRow, byTitle: Map<string, Song[]>): HostPlaylistEntry {
  const title = row.song_label.trim();
  const artist = (row.artist ?? '').trim();
  const candidates = byTitle.get(norm(title)) ?? [];

  // ONE predicate, not a preference ladder. An earlier draft tried exact matches
  // before relaxed ones; it could never change an answer — if an exact match
  // exists a compatible one does too, so `inRepertoire` was identical, and
  // `matchedArtist` is only ever set when the pick named nobody. Dead weight on a
  // day-of path, so it is gone. Determinism comes from the sorted buckets.
  const match = candidates.find(
    (c) => !artist || !norm(c.artist) || norm(c.artist) === norm(artist),
  );

  return {
    pickId: row.pick_id,
    title,
    artist,
    notes: (row.notes ?? '').trim(),
    inRepertoire: !!match,
    // Only worth showing when the pick itself named nobody.
    matchedArtist: !artist && match?.artist ? match.artist.trim() : '',
  };
}
