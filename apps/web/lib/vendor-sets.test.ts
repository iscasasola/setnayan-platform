/**
 * SETS — the tests. (Song Desk PR 5)
 *
 * `buildVendorSets` earns its keep on ONE claim, and it is the claim the contract
 * refused to compromise on: because a set is anchored to the SAME slot vocabulary
 * the couple's playlist uses, the desk can tell a band *"they asked for Through
 * the Years at dinner and it is not in this set"*. If sets had their own words for
 * the night ("After Party" vs `open_floor`) that sentence could never be written,
 * and the feature would be two lists side by side.
 *
 * So the suite is mostly about the crossing, plus the bounds the owner set
 * ("1/2/3/4/5/6 sets") and the tolerance every day-of surface needs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SETS,
  buildVendorSets,
  nextSetPosition,
  repertoireAvailableForSet,
  type SetSong,
  type VendorSetRow,
} from './vendor-sets';
import type { PlaylistSlotType } from './playlist';
import type { Song } from './songs';

const setRow = (
  position: number,
  name: string,
  slot: PlaylistSlotType = 'dinner',
  setId = `set-${position}`,
): VendorSetRow => ({ set_id: setId, position, name, slot_type: slot });

const setSong = (setId: string, songId: number, title: string, position = 100) => ({
  setId,
  setSongId: `ss-${setId}-${songId}`,
  songId,
  title,
  artist: 'Artist',
  position,
});

const hostPick = (label: string, songId: number | null = null) => ({
  song_label: label,
  song_id: songId,
});

// ── 1 · The crossing — the whole reason for the shared vocabulary ────────────

test('a host pick for this set’s moment that the set lacks is reported MISSING', () => {
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Slow burn', 'dinner')],
    setSongs: [setSong('set-1', 1, 'Ikaw')],
    hostPicksBySlot: { dinner: [hostPick('Through the Years')] },
  });
  assert.deepEqual(s?.missingFromHost, ['Through the Years']);
});

test('a host pick the set DOES contain is not reported — matched by resolved id', () => {
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Slow burn', 'dinner')],
    setSongs: [setSong('set-1', 745, 'Through the Years')],
    // The couple typed it differently; the id is what connects them.
    hostPicksBySlot: { dinner: [hostPick('through the years (the slow one)', 745)] },
  });
  assert.deepEqual(s?.missingFromHost, [], 'the id pass must catch it');
});

test('…and matched by TITLE when the host pick never resolved', () => {
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Slow burn', 'dinner')],
    setSongs: [setSong('set-1', 745, 'Through the Years')],
    hostPicksBySlot: { dinner: [hostPick('  through THE years ', null)] },
  });
  assert.deepEqual(s?.missingFromHost, []);
});

test('a host pick for a DIFFERENT moment is not this set’s problem', () => {
  // The anchor is doing its job: a set covering dinner is not accountable for
  // what the couple asked for at the first dance.
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Slow burn', 'dinner')],
    setSongs: [],
    hostPicksBySlot: { first_dance: [hostPick('Beautiful in White')] },
  });
  assert.deepEqual(s?.missingFromHost, []);
});

test('two sets on different moments each answer only for their own', () => {
  const sets = buildVendorSets({
    sets: [setRow(1, 'Arrival', 'grand_entrance', 'set-a'), setRow(2, 'Slow burn', 'dinner', 'set-b')],
    setSongs: [],
    hostPicksBySlot: {
      grand_entrance: [hostPick('Uptown Funk')],
      dinner: [hostPick('Through the Years')],
    },
  });
  assert.deepEqual(sets[0]?.missingFromHost, ['Uptown Funk']);
  assert.deepEqual(sets[1]?.missingFromHost, ['Through the Years']);
});

// ── 2 · Shape, order and labels ─────────────────────────────────────────────

test('sets render in the band’s own running order', () => {
  const sets = buildVendorSets({
    sets: [setRow(3, 'Party', 'open_floor', 'c'), setRow(1, 'Arrival', 'prelude', 'a'), setRow(2, 'Dinner', 'dinner', 'b')],
    setSongs: [],
    hostPicksBySlot: {},
  });
  assert.deepEqual(sets.map((s) => s.position), [1, 2, 3]);
});

test('a set carries the couple-facing label for its moment', () => {
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Arrival', 'grand_entrance')],
    setSongs: [],
    hostPicksBySlot: {},
  });
  assert.equal(s?.slotLabel, 'Grand entrance', 'the band sees the moment in the couple’s words');
});

test('songs inside a set keep their placed order', () => {
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Party', 'open_floor')],
    setSongs: [setSong('set-1', 2, 'Second', 200), setSong('set-1', 1, 'First', 100)],
    hostPicksBySlot: {},
  });
  assert.deepEqual(s?.songs.map((x) => x.title), ['First', 'Second']);
});

test('a named set with no songs is still a set', () => {
  // Bands name their sets before filling them; dropping empties would delete the
  // structure they are working inside.
  const sets = buildVendorSets({ sets: [setRow(1, 'Last call')], setSongs: [], hostPicksBySlot: {} });
  assert.equal(sets.length, 1);
  assert.deepEqual(sets[0]?.songs, []);
});

test('songs are attributed to the right set', () => {
  const sets = buildVendorSets({
    sets: [setRow(1, 'One', 'dinner', 'a'), setRow(2, 'Two', 'open_floor', 'b')],
    setSongs: [setSong('a', 1, 'Mine'), setSong('b', 2, 'Theirs')],
    hostPicksBySlot: {},
  });
  assert.deepEqual(sets[0]?.songs.map((s) => s.title), ['Mine']);
  assert.deepEqual(sets[1]?.songs.map((s) => s.title), ['Theirs']);
});

// ── 3 · The owner's bound: 1–6 ──────────────────────────────────────────────

test('the next set number FILLS A GAP rather than counting up', () => {
  // Deleting Set 3 of 4 and adding again must reuse 3. Nobody should renumber
  // their own night by hand.
  assert.equal(nextSetPosition([{ position: 1 }, { position: 2 }, { position: 4 }]), 3);
});

test('the next set number is 1 when there are none', () => {
  assert.equal(nextSetPosition([]), 1);
  assert.equal(nextSetPosition(null), 1);
});

test('six sets is the ceiling, and it says so with null', () => {
  const six = Array.from({ length: MAX_SETS }, (_, i) => ({ position: i + 1 }));
  assert.equal(nextSetPosition(six), null);
  assert.equal(MAX_SETS, 6, 'the owner said 1/2/3/4/5/6');
});

// ── 4 · The repertoire picker ───────────────────────────────────────────────

test('the picker offers the repertoire minus what is already in the set', () => {
  const repertoire: Song[] = [
    { song_id: 1, title: 'Ikaw', artist: 'Yeng' },
    { song_id: 2, title: 'Perfect', artist: 'Ed Sheeran' },
  ];
  const available = repertoireAvailableForSet({
    repertoire,
    setSongs: [{ setSongId: 'x', songId: 1, title: 'Ikaw', artist: 'Yeng', position: 100 }] as SetSong[],
  });
  assert.deepEqual(available.map((s) => s.title), ['Perfect']);
});

test('the picker is alphabetical and de-duplicated', () => {
  const available = repertoireAvailableForSet({
    repertoire: [
      { song_id: 3, title: 'Zamboanga', artist: '' },
      { song_id: 1, title: 'Anak', artist: '' },
      { song_id: 1, title: 'Anak', artist: '' },
    ],
    setSongs: [],
  });
  assert.deepEqual(available.map((s) => s.title), ['Anak', 'Zamboanga']);
});

// ── 5 · It cannot throw on the floor ────────────────────────────────────────

test('null everything produces no sets, not an exception', () => {
  assert.deepEqual(buildVendorSets({ sets: null, setSongs: null, hostPicksBySlot: {} }), []);
  assert.deepEqual(repertoireAvailableForSet({ repertoire: null, setSongs: null }), []);
});

test('a set anchored to an UNKNOWN slot is dropped, not rendered blank', () => {
  const sets = buildVendorSets({
    sets: [{ set_id: 'x', position: 1, name: 'Rogue', slot_type: 'after_party' as PlaylistSlotType }],
    setSongs: [],
    hostPicksBySlot: {},
  });
  assert.deepEqual(sets, [], 'a slot we cannot label is not renderable');
});

test('a ragged host pick cannot break the crossing', () => {
  const [s] = buildVendorSets({
    sets: [setRow(1, 'Slow burn', 'dinner')],
    setSongs: [],
    hostPicksBySlot: {
      dinner: [{ song_label: undefined as unknown as string, song_id: null }, hostPick('Real Song')],
    },
  });
  assert.deepEqual(s?.missingFromHost, ['Real Song']);
});
