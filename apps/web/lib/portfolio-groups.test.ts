/**
 * lib/portfolio-groups.test.ts — Portfolio's three groups (Build 2 §10 #35, lane B2-B).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALBUM_OPEN_MAX, albumDay, eventAlbums, groupCount, inspirationAlbums, serviceAlbums } from './portfolio-groups';

test('events: one album per event, newest first, titled by its booking', () => {
  const rows = [
    { eventId: 'a', url: 'a1', createdAt: '2026-10-01T00:00:00Z' },
    { eventId: 'b', url: 'b1', createdAt: '2026-11-07T00:00:00Z' },
    { eventId: 'a', url: 'a2', createdAt: '2026-10-02T00:00:00Z' },
    { eventId: 'b', url: null, createdAt: '2026-11-06T00:00:00Z' },
  ];
  const out = eventAlbums(rows, [{ eventId: 'b', eventName: 'Santos wedding', bookedDate: '2026-11-07' }], { thisYear: 2026, albumHref: (id) => `/x/${id}` });
  assert.deepEqual(out.map((a) => a.key), ['b', 'a']);
  assert.equal(out[0]!.title, 'Santos wedding');
  assert.equal(out[0]!.total, 2, 'an unsigned photo still counts');
  assert.deepEqual(out[0]!.urls, ['b1']);
  assert.match(out[0]!.line, /Papic album · 2 photos$/);
  assert.equal(out[1]!.title, 'Your booked event');
  assert.deepEqual(out[1]!.urls, ['a2', 'a1']);
  assert.equal(out[1]!.href, '/x/a');
});

test('events: an opened album draws at most ALBUM_OPEN_MAX; the rest is "+N"', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ eventId: 'a', url: `u${i}`, createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` }));
  const [a] = eventAlbums(rows, [], { thisYear: 2026, albumHref: null });
  assert.equal(a!.urls.length, ALBUM_OPEN_MAX);
  assert.equal(a!.total, 30);
  assert.equal(a!.href, null);
});

test('albumDay: the year only when it is not this year, no timezone shift', () => {
  assert.doesNotMatch(albumDay('2026-11-08', 2026), /2026/);
  assert.match(albumDay('2025-11-08', 2026), /2025/);
  assert.match(albumDay('2026-11-08', 2026), /8/);
});

test('services: a card with no photo is not an album', () => {
  const out = serviceAlbums([
    { id: 's1', title: 'Photo', urls: ['p'], total: 3 },
    { id: 's2', title: 'Booth', urls: [], total: 0 },
  ]);
  assert.deepEqual(out.map((a) => [a.key, a.line]), [['s1', '3 photos']]);
});

test('inspiration: one album per part', () => {
  const out = inspirationAlbums([
    { id: '1', url: 'a', part: 'Styling' },
    { id: '2', url: 'b', part: 'Portraits' },
    { id: '3', url: 'c', part: 'Styling' },
  ]);
  assert.deepEqual(out.map((a) => [a.title, a.total]), [['Styling', 2], ['Portraits', 1]]);
});

test('a refused read says nothing about the count', () => {
  assert.equal(groupCount(null), '');
  assert.equal(groupCount([1, 2]), ' · 2');
});
