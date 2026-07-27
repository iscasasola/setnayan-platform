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
 */
import type { Song } from '@/lib/songs';

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
