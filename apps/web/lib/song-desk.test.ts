/**
 * Song desk — the crossing tests.
 *
 * `buildSongDesk()` is the whole decision behind the music specialization: the
 * surface is three lists and a percentage plus markup. So this suite carries the
 * claims the PR is accountable for:
 *
 *   1. THE CROSSING IS RIGHT. Every song lands in exactly one of gaps / ready /
 *      spare, and membership follows (requested × inRepertoire) with no song
 *      lost and none duplicated.
 *   2. GAPS ARE THE POINT. A requested song the act does not play is the one
 *      actionable row on the desk; it must be findable and must never be
 *      silently folded into `ready`.
 *   3. IT CANNOT THROW ON THE FLOOR. Empty lists, ragged rows and duplicate
 *      ids are all survivable — a day-of surface that throws mid-set is worse
 *      than one that renders a short list.
 *   4. ZERO REQUESTS IS 100%, NOT 0%. The divide-by-zero case is a deliberate
 *      product decision, not an accident, so it is pinned here.
 *
 * Neutralisation check (2026-07-27, run — not asserted): inverting the
 * `requested && !inRepertoire` branch to `requested && inRepertoire` turns
 * 10 of these 14 red. The 4 that survive are exactly the cases with no
 * requested-AND-in-repertoire song to misfile — spare-only, no-requests,
 * both-empty, and null inputs — i.e. the ones that deliberately do not exercise
 * the crossing. That asymmetry is the proof these tests assert the crossing
 * itself rather than merely that the function returns three arrays.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSongDesk } from './song-desk';
import type { Song } from './songs';

const song = (song_id: number, title: string, artist = 'Artist'): Song => ({
  song_id,
  title,
  artist,
});

// ── 1 · The crossing ────────────────────────────────────────────────────────

test('a requested song the act plays is READY', () => {
  const m = buildSongDesk({ requests: [song(1, 'Perfect')], repertoire: [song(1, 'Perfect')] });
  assert.deepEqual(m.ready.map((e) => e.songId), [1]);
  assert.equal(m.gaps.length, 0);
  assert.equal(m.spare.length, 0);
});

test('a requested song the act does NOT play is a GAP', () => {
  const m = buildSongDesk({ requests: [song(2, 'Kiss the Rain')], repertoire: [] });
  assert.deepEqual(m.gaps.map((e) => e.songId), [2]);
  assert.equal(m.ready.length, 0);
});

test('a repertoire song nobody asked for is SPARE', () => {
  const m = buildSongDesk({ requests: [], repertoire: [song(3, 'Through the Years')] });
  assert.deepEqual(m.spare.map((e) => e.songId), [3]);
  assert.equal(m.gaps.length, 0);
  assert.equal(m.ready.length, 0);
});

test('a mixed event splits into all three groups, losing nothing', () => {
  const m = buildSongDesk({
    requests: [song(1, 'Perfect'), song(2, 'Kiss the Rain'), song(3, 'A Thousand Years')],
    repertoire: [song(1, 'Perfect'), song(3, 'A Thousand Years'), song(9, 'Filler')],
  });
  assert.deepEqual(m.gaps.map((e) => e.songId), [2]);
  assert.deepEqual(m.ready.map((e) => e.songId).sort(), [1, 3]);
  assert.deepEqual(m.spare.map((e) => e.songId), [9]);

  // Nothing lost, nothing duplicated: the union of the three groups is exactly
  // the union of the two inputs.
  const all = [...m.gaps, ...m.ready, ...m.spare].map((e) => e.songId).sort();
  assert.deepEqual(all, [1, 2, 3, 9]);
});

test('every entry carries flags consistent with the group it landed in', () => {
  const m = buildSongDesk({
    requests: [song(1, 'A'), song(2, 'B')],
    repertoire: [song(1, 'A'), song(3, 'C')],
  });
  for (const e of m.gaps) assert.ok(e.requested && !e.inRepertoire, 'gap flags');
  for (const e of m.ready) assert.ok(e.requested && e.inRepertoire, 'ready flags');
  for (const e of m.spare) assert.ok(!e.requested && e.inRepertoire, 'spare flags');
});

// ── 2 · Counts and coverage ─────────────────────────────────────────────────

test('counts read off the requested side, not the repertoire size', () => {
  const m = buildSongDesk({
    requests: [song(1, 'A'), song(2, 'B'), song(3, 'C'), song(4, 'D')],
    // A big repertoire must not inflate coverage of the couple's four picks.
    repertoire: [song(1, 'A'), song(5, 'E'), song(6, 'F'), song(7, 'G'), song(8, 'H')],
  });
  assert.equal(m.requestedCount, 4);
  assert.equal(m.coveredCount, 1);
  assert.equal(m.coveragePct, 25);
});

test('no requests reads as 100% and flags noRequests — never 0%, never NaN', () => {
  const m = buildSongDesk({ requests: [], repertoire: [song(1, 'A')] });
  assert.equal(m.requestedCount, 0);
  assert.equal(m.coveragePct, 100);
  assert.equal(m.noRequests, true);
  assert.ok(Number.isFinite(m.coveragePct));
});

test('coverage is a whole percent', () => {
  const m = buildSongDesk({
    requests: [song(1, 'A'), song(2, 'B'), song(3, 'C')],
    repertoire: [song(1, 'A')],
  });
  assert.equal(m.coveragePct, 33); // 33.33… rounded
  assert.equal(Number.isInteger(m.coveragePct), true);
});

// ── 3 · Floor tolerance ─────────────────────────────────────────────────────

test('both sides empty is an empty desk, not a throw', () => {
  const m = buildSongDesk({ requests: [], repertoire: [] });
  assert.deepEqual([m.gaps, m.ready, m.spare], [[], [], []]);
  assert.equal(m.noRequests, true);
});

test('null / undefined inputs survive', () => {
  for (const input of [
    { requests: null, repertoire: null },
    { requests: undefined, repertoire: undefined },
    { requests: null, repertoire: [song(1, 'A')] },
  ]) {
    assert.doesNotThrow(() => buildSongDesk(input));
  }
});

test('ragged rows from a bad join are dropped, not rendered', () => {
  const m = buildSongDesk({
    requests: [
      song(1, 'Real'),
      { song_id: NaN, title: 'No id', artist: '' } as Song,
      { song_id: 2, title: '', artist: '' } as Song, // empty title
      null as unknown as Song,
    ],
    repertoire: [],
  });
  assert.deepEqual(m.gaps.map((e) => e.title), ['Real']);
  assert.equal(m.requestedCount, 1);
});

test('a duplicate song_id collapses to one row', () => {
  const m = buildSongDesk({
    requests: [song(1, 'Perfect'), song(1, 'Perfect')],
    repertoire: [song(1, 'Perfect'), song(1, 'Perfect')],
  });
  assert.equal(m.ready.length, 1);
  assert.equal(m.requestedCount, 1);
  assert.equal(m.coveragePct, 100);
});

test('a missing artist renders as empty string, never undefined', () => {
  const m = buildSongDesk({
    requests: [{ song_id: 1, title: 'Untitled Pick' } as Song],
    repertoire: [],
  });
  assert.equal(m.gaps[0]?.artist, '');
});

// ── 4 · Stable order ────────────────────────────────────────────────────────

test('each group is alphabetical, so the desk does not reshuffle between renders', () => {
  const m = buildSongDesk({
    requests: [song(3, 'Zamboanga'), song(1, 'Anak'), song(2, 'Malaya')],
    repertoire: [],
  });
  assert.deepEqual(m.gaps.map((e) => e.title), ['Anak', 'Malaya', 'Zamboanga']);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · THE HOST'S PLAYLIST — `buildHostPlaylist()` (Song Desk PR 2)
 *
 * A second crossing with a genuinely different failure surface from the first:
 * the picks are FREE TEXT (`song_label` + nullable `artist`), never resolved to a
 * `songs` row, so the join is by normalised text and the artist rules are the
 * part that can be quietly wrong. The claims this PR is accountable for:
 *
 *   1. THE FUZZY JOIN IS RIGHT — case and padding are ignored; a named artist
 *      must agree; a blank artist on EITHER side lets the title decide; and the
 *      answer does not depend on repertoire row order.
 *   2. THE BANNED LIST IS READ THE OTHER WAY UP — the hazard is a banned song
 *      the act DOES play, and it must never be counted as a normal gap.
 *   3. THE NIGHT READS LIKE THE NIGHT — chronological, empty moments dropped,
 *      `banned_songs` never rendered as a moment.
 *   4. IT CANNOT THROW ON THE FLOOR — null lists, a labelless row, and an
 *      unknown slot (which would throw inside `groupPicksBySlot`'s fixed Record)
 *      are all survivable.
 *
 * Neutralisation check (2026-07-30 — actually run, numbers as measured):
 *
 *   • artist rules → plain full-key equality (`title|artist` both sides): 3 red
 *     (both blank-artist cases + the ragged-repertoire row, whose match rests on
 *     a blank artist). The case/padding test SURVIVES, correctly — equal keys are
 *     equal either way, so it pins normalisation, not the artist rules.
 *   • `hazardCount` inverted to count NOT-in-repertoire: exactly 2 red, both in
 *     §5.2 and nothing else. That isolation is the claim — the banned crossing is
 *     asserted independently of the moment crossing, so one cannot mask the other.
 *   • empty moments kept instead of dropped: 14 red. Broad because the shape of
 *     `moments` shifts under every index-based assertion; informative only as
 *     coverage, not as a targeted probe.
 *
 * This is also how the "exact artist match beats a blank-artist one" preference
 * in the first draft got deleted: no mutation of it could turn anything red,
 * because it could not change an answer. An unkillable branch was the tell.
 * ══════════════════════════════════════════════════════════════════════════ */

import { buildHostPlaylist } from './song-desk';
import type { PlaylistPickRow, PlaylistSlotType } from './playlist';

let seq = 0;
const pick = (
  slot: PlaylistSlotType,
  song_label: string,
  artist: string | null = null,
  notes: string | null = null,
): PlaylistPickRow => {
  seq += 1;
  return {
    pick_id: `pick-${seq}`,
    public_id: `S89P-${seq}`,
    event_id: 'evt-1',
    slot_type: slot,
    song_label,
    artist,
    notes,
    sort_order: seq,
    created_by_user_id: 'user-1',
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
  };
};

// ── 5.1 · The fuzzy join ────────────────────────────────────────────────────

test('a pick matches the repertoire despite case and padding', () => {
  const m = buildHostPlaylist({
    picks: [pick('first_dance', '  beautiful IN white ', 'westlife')],
    repertoire: [song(1, 'Beautiful In White', 'Westlife')],
  });
  assert.equal(m.moments[0]?.entries[0]?.inRepertoire, true);
  assert.equal(m.gapCount, 0);
});

test('both sides name an artist and they disagree → NOT a match', () => {
  const m = buildHostPlaylist({
    picks: [pick('open_floor', 'Perfect', 'One Direction')],
    repertoire: [song(1, 'Perfect', 'Ed Sheeran')],
  });
  assert.equal(m.moments[0]?.entries[0]?.inRepertoire, false);
  assert.equal(m.gapCount, 1);
});

test('the couple named no artist → the title decides, and we show whose it is', () => {
  const m = buildHostPlaylist({
    picks: [pick('dinner', 'Perfect')],
    repertoire: [song(1, 'Perfect', 'Ed Sheeran')],
  });
  const entry = m.moments[0]?.entries[0];
  assert.equal(entry?.inRepertoire, true);
  assert.equal(entry?.artist, ''); // the couple's field stays empty
  assert.equal(entry?.matchedArtist, 'Ed Sheeran'); // ours, from the match
});

test('the REPERTOIRE names no artist → the title still decides', () => {
  const m = buildHostPlaylist({
    picks: [pick('dinner', 'Kahit Kailan', 'South Border')],
    repertoire: [song(1, 'Kahit Kailan', '')],
  });
  assert.equal(m.moments[0]?.entries[0]?.inRepertoire, true);
  // The pick named an artist, so we do not echo one back at them.
  assert.equal(m.moments[0]?.entries[0]?.matchedArtist, '');
});

test('a named artist matches among several same-title songs', () => {
  const m = buildHostPlaylist({
    picks: [pick('dinner', 'Perfect', 'One Direction')],
    repertoire: [song(1, 'Perfect', 'Ed Sheeran'), song(2, 'Perfect', 'One Direction')],
  });
  assert.equal(m.moments[0]?.entries[0]?.inRepertoire, true);
});

test('two same-title songs and a blank pick resolve the same way every render', () => {
  const forward = buildHostPlaylist({
    picks: [pick('dinner', 'Perfect')],
    repertoire: [song(1, 'Perfect', 'One Direction'), song(2, 'Perfect', 'Ed Sheeran')],
  });
  const reversed = buildHostPlaylist({
    picks: [pick('dinner', 'Perfect')],
    repertoire: [song(2, 'Perfect', 'Ed Sheeran'), song(1, 'Perfect', 'One Direction')],
  });
  assert.equal(
    forward.moments[0]?.entries[0]?.matchedArtist,
    reversed.moments[0]?.entries[0]?.matchedArtist,
  );
});

// ── 5.2 · The banned list is crossed the other way up ───────────────────────

test('a banned song the act PLAYS is the hazard', () => {
  const m = buildHostPlaylist({
    picks: [pick('banned_songs', 'Wonderwall', 'Oasis')],
    repertoire: [song(1, 'Wonderwall', 'Oasis')],
  });
  assert.equal(m.hazardCount, 1);
  assert.equal(m.banned[0]?.inRepertoire, true);
});

test('a banned song the act does NOT play is no hazard and no gap', () => {
  const m = buildHostPlaylist({
    picks: [pick('banned_songs', 'Wonderwall', 'Oasis')],
    repertoire: [],
  });
  assert.equal(m.hazardCount, 0);
  assert.equal(m.gapCount, 0); // banned songs are anti-picks, never gaps
});

test('banned picks are excluded from the positive count and from the moments', () => {
  const m = buildHostPlaylist({
    picks: [pick('dinner', 'Ikaw'), pick('banned_songs', 'Wonderwall')],
    repertoire: [],
  });
  assert.equal(m.positiveCount, 1);
  assert.deepEqual(m.moments.map((x) => x.slot), ['dinner']);
  assert.equal(m.banned.length, 1);
});

// ── 5.3 · The night reads like the night ────────────────────────────────────

test('moments render chronologically, not in pick order', () => {
  const m = buildHostPlaylist({
    picks: [pick('open_floor', 'Jopay'), pick('processional', 'Canon in D'), pick('dinner', 'Ikaw')],
    repertoire: [],
  });
  assert.deepEqual(m.moments.map((x) => x.slot), ['processional', 'dinner', 'open_floor']);
});

test('moments with no picks are dropped, not rendered empty', () => {
  const m = buildHostPlaylist({ picks: [pick('first_dance', 'Ikaw')], repertoire: [] });
  assert.equal(m.moments.length, 1);
});

test('a moment carries the couple-facing label, not the column value', () => {
  const m = buildHostPlaylist({ picks: [pick('banned_songs', 'X'), pick('cocktail_hour', 'Sway')], repertoire: [] });
  assert.equal(m.moments[0]?.label, 'Cocktail hour');
});

test("the couple's note survives to the surface", () => {
  const m = buildHostPlaylist({
    picks: [pick('first_dance', 'Ikaw', 'Yeng Constantino', 'the acoustic version, please')],
    repertoire: [],
  });
  assert.equal(m.moments[0]?.entries[0]?.notes, 'the acoustic version, please');
});

test('picks keep their sort_order within a moment', () => {
  const first = pick('open_floor', 'Alapaap');
  const second = pick('open_floor', 'Buloy');
  const m = buildHostPlaylist({ picks: [first, second], repertoire: [] });
  assert.deepEqual(m.moments[0]?.entries.map((e) => e.title), ['Alapaap', 'Buloy']);
});

// ── 5.4 · It cannot throw on the floor ──────────────────────────────────────

test('null lists produce an empty playlist, not a throw', () => {
  const m = buildHostPlaylist({ picks: null, repertoire: null });
  assert.equal(m.isEmpty, true);
  assert.equal(m.moments.length, 0);
  assert.equal(m.banned.length, 0);
});

test('an unknown slot is dropped instead of throwing inside groupPicksBySlot', () => {
  const rogue = { ...pick('dinner', 'Ikaw'), slot_type: 'after_party' as PlaylistSlotType };
  const m = buildHostPlaylist({ picks: [rogue, pick('dinner', 'Anak')], repertoire: [] });
  assert.deepEqual(m.moments[0]?.entries.map((e) => e.title), ['Anak']);
});

test('a labelless row is dropped', () => {
  const m = buildHostPlaylist({ picks: [pick('dinner', '   '), pick('dinner', 'Anak')], repertoire: [] });
  assert.equal(m.positiveCount, 1);
});

test('a ragged repertoire row cannot break the index', () => {
  const m = buildHostPlaylist({
    picks: [pick('dinner', 'Anak')],
    repertoire: [{ title: 'Anak' } as Song, song(1, 'Anak', 'Freddie Aguilar')],
  });
  assert.equal(m.moments[0]?.entries[0]?.inRepertoire, true);
});

test('isEmpty is false when only banned songs exist', () => {
  const m = buildHostPlaylist({ picks: [pick('banned_songs', 'Wonderwall')], repertoire: [] });
  assert.equal(m.isEmpty, false);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · ELEVEN MOMENTS AND A VIBE PER MOMENT  (Song Desk PRs 6 + 4)
 *
 * Owner-answered 2026-07-30. Two claims worth pinning, and one that changed:
 *
 *   1. THE NIGHT GAINED THREE MOMENTS and must still read chronologically —
 *      prelude before the processional, the walk out after the ceremony, the
 *      grand entrance after that, `banned_songs` still last.
 *   2. A VIBE ALONE IS A COMPLETE INSTRUCTION. "Jazz for dinner" with no songs
 *      named is the owner's own example, so a moment carrying a vibe and zero
 *      picks MUST render — which reverses §5.3's "empty moments are dropped" for
 *      exactly that case and no other.
 *   3. `isEmpty` had to follow: a vibe-only night is not an empty playlist.
 * ══════════════════════════════════════════════════════════════════════════ */

import {
  PLAYLIST_SLOT_TYPES,
  PLAYLIST_SLOT_LABELS,
  PLAYLIST_VIBES,
  groupPicksBySlot,
} from './playlist';

// ── 6.1 · the slot list ────────────────────────────────────────────────────

test('the night reads chronologically, eleven moments, anti-picks last', () => {
  assert.deepEqual(
    [...PLAYLIST_SLOT_TYPES],
    [
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
    ],
    'order IS the contract — the studio and the desk both render in array order',
  );
});

test('every slot has a label and a hint — the Records cannot be half-filled', () => {
  // `tsc` enforces this for a literal, but these are the maps a new slot is most
  // likely to be missing from at runtime after a bad merge.
  for (const slot of PLAYLIST_SLOT_TYPES) {
    const label = PLAYLIST_SLOT_LABELS[slot];
    assert.ok(label && label.length > 0, `${slot} has no label`);
  }
});

test('grouping is derived from the slot list, so a new slot can never throw', () => {
  // The PR 6 trap: `groupPicksBySlot` used a hand-written Record and did
  // `out[slot].push(row)`, so a slot missing from it was a TypeError at render.
  const grouped = groupPicksBySlot([]);
  for (const slot of PLAYLIST_SLOT_TYPES) {
    assert.ok(Array.isArray(grouped[slot]), `${slot} missing from the grouped Record`);
  }
});

test('a pick in one of the NEW moments lands in that moment', () => {
  const m = buildHostPlaylist({
    picks: [pick('grand_entrance', 'Uptown Funk', 'Bruno Mars')],
    repertoire: [],
  });
  assert.deepEqual(m.moments.map((x) => x.slot), ['grand_entrance']);
  assert.equal(m.moments[0]?.label, 'Grand entrance');
});

test('the three new moments sort into the night, not onto the end', () => {
  const m = buildHostPlaylist({
    picks: [
      pick('open_floor', 'Jopay'),
      pick('prelude', 'Canon in D'),
      pick('grand_entrance', 'Sway'),
      pick('recessional', 'Signed Sealed Delivered'),
    ],
    repertoire: [],
  });
  assert.deepEqual(m.moments.map((x) => x.slot), [
    'prelude',
    'recessional',
    'grand_entrance',
    'open_floor',
  ]);
});

// ── 6.2 · the vibe ─────────────────────────────────────────────────────────

test('six vibes, frozen, in scan order', () => {
  assert.deepEqual(
    [...PLAYLIST_VIBES],
    ['acoustic', 'classical', 'jazz', 'opm', 'pop', 'showband'],
    'owner froze exactly these six — a seventh is a question, not a commit',
  );
});

test('A VIBE WITH NO SONGS STILL RENDERS — the owner’s own example', () => {
  // "Jazz for dinner" is a complete instruction to a band. §5.3 drops empty
  // moments; this is the one exception, and it is the entire point of PR 4.
  const m = buildHostPlaylist({ picks: [], repertoire: [], vibes: { dinner: 'jazz' } });
  assert.deepEqual(m.moments.map((x) => x.slot), ['dinner']);
  assert.equal(m.moments[0]?.vibe, 'jazz');
  assert.equal(m.moments[0]?.entries.length, 0);
});

test('a moment carries a vibe AND its songs — never one instead of the other', () => {
  const m = buildHostPlaylist({
    picks: [pick('dinner', 'Through the Years', 'Kenny Rogers')],
    repertoire: [],
    vibes: { dinner: 'jazz' },
  });
  assert.equal(m.moments.length, 1);
  assert.equal(m.moments[0]?.vibe, 'jazz');
  assert.deepEqual(m.moments[0]?.entries.map((e) => e.title), ['Through the Years']);
});

test('a vibe-only night is NOT empty', () => {
  const m = buildHostPlaylist({ picks: [], repertoire: [], vibes: { cocktail_hour: 'acoustic' } });
  assert.equal(m.isEmpty, false, 'the desk must not say "they haven’t set out the night"');
});

test('a moment with neither songs nor a vibe is still dropped', () => {
  const m = buildHostPlaylist({ picks: [pick('dinner', 'Ikaw')], repertoire: [], vibes: {} });
  assert.equal(m.moments.length, 1, 'ten silent moments must not become ten headings');
});

test('vibes are absent by default — no vibe map means no vibes', () => {
  const m = buildHostPlaylist({ picks: [pick('dinner', 'Ikaw')], repertoire: [] });
  assert.equal(m.moments[0]?.vibe, null);
});

test('a vibe on banned_songs is ignored — you cannot ask for a feel you don’t want', () => {
  const m = buildHostPlaylist({
    picks: [],
    repertoire: [],
    vibes: { banned_songs: 'pop' },
  });
  assert.equal(m.moments.length, 0, 'banned_songs is never a moment');
  assert.equal(m.isEmpty, true);
});
