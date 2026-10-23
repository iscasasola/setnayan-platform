/**
 * GUARD — Memories' albums (owner 2026-10-23): All · Papic · Challenges · Event Hub · Suppliers · Your uploads, in
 * that order; Challenges grouped by challenge in board order; moments in schedule order.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALBUM_KEYS, ALBUM_LABEL, captureInAlbum, challengeGroups, momentGroups } from './memories-albums';

const c = (id: string, order: number) => ({ id, title: `C${id}`, order });
const photos = [
  { id: 'a', album: 'papic' as const, challenge: c('2', 1) },
  { id: 'b', album: 'uploads' as const, challenge: null },
  { id: 'c', album: 'suppliers' as const },
  { id: 'd', album: 'papic' as const, challenge: c('1', 0) },
  { id: 'e', album: 'papic' as const, challenge: c('2', 1) },
];

test('the albums, in the owner’s order and words', () => {
  assert.deepEqual(
    ALBUM_KEYS.map((k) => ALBUM_LABEL[k]),
    ['All', 'Papic', 'Challenges', 'Event Hub', 'Suppliers', 'Your uploads'],
  );
});

test('each capture lands in its album; Event Hub draws no captures', () => {
  const ids = (k: (typeof ALBUM_KEYS)[number]) => photos.filter((p) => captureInAlbum(p, k)).map((p) => p.id);
  assert.deepEqual(ids('all'), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(ids('papic'), ['a', 'd', 'e']);
  assert.deepEqual(ids('uploads'), ['b']);
  assert.deepEqual(ids('suppliers'), ['c']);
  assert.deepEqual(ids('challenges'), ['a', 'd', 'e']);
  assert.deepEqual(ids('hub'), []);
});

test('Challenges are grouped by challenge, in board order', () => {
  const g = challengeGroups(photos);
  assert.deepEqual(
    g.map((x) => [x.title, x.photos.map((p) => p.id)]),
    [
      ['C1', ['d']],
      ['C2', ['a', 'e']],
    ],
  );
});

test('moments in schedule order; what no moment holds comes last', () => {
  const g = momentGroups(photos, [
    { key: 'm1', label: 'Ceremony', photoIds: ['d', 'a'] },
    { key: 'm2', label: 'Empty', photoIds: ['zz'] },
    { key: 'm3', label: 'Reception', photoIds: ['e'] },
  ]);
  assert.deepEqual(
    g.map((x) => [x.label, x.photos.map((p) => p.id)]),
    [
      ['Ceremony', ['d', 'a']],
      ['Reception', ['e']],
      ['Other moments', ['b', 'c']],
    ],
  );
});
