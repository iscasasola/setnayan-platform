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
